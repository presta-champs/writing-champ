"use client";

import { useState } from "react";
import {
  Search,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Wrench,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

type SeoCheckResult = {
  id: string;
  category: string;
  label: string;
  status: "pass" | "warning" | "fail";
  message: string;
  fixable?: boolean;
  details?: Record<string, unknown>;
};

type SeoAuditResult = {
  score: number;
  checks: SeoCheckResult[];
  summary: { pass: number; warning: number; fail: number };
};

type Props = {
  articleId: string | null;
  html: string;
  metaTitle?: string;
  metaDescription?: string;
  primaryKeyword?: string;
  secondaryKeywords?: string[];
  targetWordCount?: number;
  onFixApplied?: (fixedHtml: string) => void;
};

const STATUS_ICONS = {
  pass: CheckCircle2,
  warning: AlertTriangle,
  fail: XCircle,
};

const STATUS_COLORS = {
  pass: "var(--success)",
  warning: "var(--accent)",
  fail: "var(--danger)",
};

export function SeoCheckPanel({
  html,
  metaTitle,
  metaDescription,
  primaryKeyword,
  secondaryKeywords,
  targetWordCount,
  onFixApplied,
}: Props) {
  const [audit, setAudit] = useState<SeoAuditResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [fixingId, setFixingId] = useState<string | null>(null);

  async function runAudit() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/seo-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          html,
          metaTitle,
          metaDescription,
          primaryKeyword: primaryKeyword || "",
          secondaryKeywords: secondaryKeywords || [],
          targetWordCount: targetWordCount || 1500,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "SEO check failed");
      }
      const data = await res.json();
      setAudit(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "SEO check failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleFix(checkId: string) {
    if (!audit || !onFixApplied) return;
    setFixingId(checkId);
    try {
      const res = await fetch("/api/seo-check/fix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          checkId,
          html,
          metaTitle,
          metaDescription,
          primaryKeyword,
        }),
      });
      if (!res.ok) throw new Error("Fix failed");
      const data = await res.json();
      if (data.fixedHtml) {
        onFixApplied(data.fixedHtml);
        // Re-run audit after fix
        setTimeout(runAudit, 500);
      }
    } catch {
      // Silently fail — user can try again
    } finally {
      setFixingId(null);
    }
  }

  // Group checks by category
  const categories = audit
    ? Object.entries(
        audit.checks.reduce<Record<string, SeoCheckResult[]>>((acc, check) => {
          if (!acc[check.category]) acc[check.category] = [];
          acc[check.category].push(check);
          return acc;
        }, {})
      )
    : [];

  const CATEGORY_LABELS: Record<string, string> = {
    keywords: "Keywords",
    structure: "Structure",
    meta: "Meta Tags",
    links: "Links",
    readability: "Readability",
    images: "Images",
  };

  function getScoreColor(score: number) {
    if (score >= 80) return "var(--success)";
    if (score >= 50) return "var(--accent)";
    return "var(--danger)";
  }

  return (
    <div
      className="rounded-xl p-6"
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold" style={{ color: "var(--foreground)" }}>
          SEO Audit
        </h3>
        <button
          onClick={runAudit}
          disabled={loading || !primaryKeyword}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition hover:opacity-90 disabled:opacity-50"
          style={{ background: "var(--accent)", color: "var(--accent-text)" }}
        >
          {loading ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Search size={14} />
          )}
          {loading ? "Analyzing..." : audit ? "Re-check" : "Run SEO Check"}
        </button>
      </div>

      {!primaryKeyword && (
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Set a primary keyword to enable SEO checking.
        </p>
      )}

      {error && (
        <div
          className="rounded-lg p-3 mb-4 text-sm"
          style={{ background: "var(--danger-light)", color: "var(--danger)" }}
        >
          {error}
        </div>
      )}

      {audit && (
        <>
          {/* Score overview */}
          <div className="flex items-center gap-6 mb-6">
            <div className="text-center">
              <div
                className="text-3xl font-bold"
                style={{ color: getScoreColor(audit.score) }}
              >
                {audit.score}
              </div>
              <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                / 100
              </div>
            </div>
            <div className="flex gap-4 text-sm">
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 size={14} style={{ color: "var(--success)" }} />
                {audit.summary.pass} passed
              </span>
              <span className="inline-flex items-center gap-1.5">
                <AlertTriangle size={14} style={{ color: "var(--accent)" }} />
                {audit.summary.warning} warnings
              </span>
              <span className="inline-flex items-center gap-1.5">
                <XCircle size={14} style={{ color: "var(--danger)" }} />
                {audit.summary.fail} failed
              </span>
            </div>
          </div>

          {/* Category breakdown */}
          <div className="space-y-2">
            {categories.map(([category, checks]) => {
              const worstStatus = checks.some((c) => c.status === "fail")
                ? "fail"
                : checks.some((c) => c.status === "warning")
                ? "warning"
                : "pass";
              const isExpanded = expandedCategory === category;

              return (
                <div key={category}>
                  <button
                    onClick={() =>
                      setExpandedCategory(isExpanded ? null : category)
                    }
                    className="w-full flex items-center justify-between p-3 rounded-lg transition"
                    style={{ border: "1px solid var(--border)" }}
                  >
                    <div className="flex items-center gap-2">
                      {(() => {
                        const Icon = STATUS_ICONS[worstStatus];
                        return (
                          <Icon
                            size={16}
                            style={{ color: STATUS_COLORS[worstStatus] }}
                          />
                        );
                      })()}
                      <span
                        className="text-sm font-medium"
                        style={{ color: "var(--foreground)" }}
                      >
                        {CATEGORY_LABELS[category] || category}
                      </span>
                      <span
                        className="text-xs"
                        style={{ color: "var(--text-muted)" }}
                      >
                        {checks.filter((c) => c.status === "pass").length}/
                        {checks.length} passed
                      </span>
                    </div>
                    {isExpanded ? (
                      <ChevronUp size={14} style={{ color: "var(--text-muted)" }} />
                    ) : (
                      <ChevronDown size={14} style={{ color: "var(--text-muted)" }} />
                    )}
                  </button>

                  {isExpanded && (
                    <div className="ml-4 mt-1 space-y-1">
                      {checks.map((check) => {
                        const Icon = STATUS_ICONS[check.status];
                        return (
                          <div
                            key={check.id}
                            className="flex items-start gap-2 p-2 rounded-lg text-sm"
                          >
                            <Icon
                              size={14}
                              className="mt-0.5 shrink-0"
                              style={{ color: STATUS_COLORS[check.status] }}
                            />
                            <div className="flex-1 min-w-0">
                              <span
                                className="font-medium"
                                style={{ color: "var(--foreground)" }}
                              >
                                {check.label}
                              </span>
                              <p
                                className="text-xs mt-0.5"
                                style={{ color: "var(--text-muted)" }}
                              >
                                {check.message}
                              </p>
                            </div>
                            {check.fixable &&
                              check.status !== "pass" &&
                              onFixApplied && (
                                <button
                                  onClick={() => handleFix(check.id)}
                                  disabled={fixingId === check.id}
                                  className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium shrink-0 transition hover:opacity-80"
                                  style={{
                                    background: "var(--accent-light)",
                                    color: "var(--accent)",
                                  }}
                                >
                                  {fixingId === check.id ? (
                                    <Loader2 size={10} className="animate-spin" />
                                  ) : (
                                    <Wrench size={10} />
                                  )}
                                  Fix
                                </button>
                              )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
