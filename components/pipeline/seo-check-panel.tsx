"use client";

import { useState, useEffect } from "react";
import {
  Search,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Wrench,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  TrendingUp,
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
  onMetaChange?: (metaTitle: string, metaDescription: string) => void;
};

const STATUS_ICONS = {
  pass: CheckCircle2,
  warning: AlertTriangle,
  fail: XCircle,
};

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

function getScoreLabel(score: number) {
  if (score >= 90) return "Excellent";
  if (score >= 80) return "Good";
  if (score >= 60) return "Needs Work";
  if (score >= 40) return "Poor";
  return "Critical";
}

function getScoreBg(score: number) {
  if (score >= 80) return "var(--success-light)";
  if (score >= 50) return "var(--accent-light)";
  return "var(--danger-light)";
}

export function SeoCheckPanel({
  articleId,
  html,
  metaTitle,
  metaDescription,
  primaryKeyword,
  secondaryKeywords,
  targetWordCount,
  onFixApplied,
  onMetaChange,
}: Props) {
  const [audit, setAudit] = useState<SeoAuditResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
  const [fixingId, setFixingId] = useState<string | null>(null);

  // Auto-expand categories with issues, collapse passing ones
  useEffect(() => {
    if (!audit) return;
    const grouped = audit.checks.reduce<Record<string, SeoCheckResult[]>>((acc, check) => {
      if (!acc[check.category]) acc[check.category] = [];
      acc[check.category].push(check);
      return acc;
    }, {});
    const toCollapse = new Set<string>();
    for (const [cat, checks] of Object.entries(grouped)) {
      if (checks.every((c) => c.status === "pass")) {
        toCollapse.add(cat);
      }
    }
    setCollapsedCategories(toCollapse);
  }, [audit]);

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
          articleId: articleId || undefined,
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
    if (!audit) return;
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

      let changed = false;

      // Apply HTML fix
      if (data.fixedHtml && data.fixedHtml !== html && onFixApplied) {
        onFixApplied(data.fixedHtml);
        changed = true;
      }

      // Apply meta fixes
      const metaTitleChanged = data.fixedMetaTitle && data.fixedMetaTitle !== metaTitle;
      const metaDescChanged = data.fixedMetaDescription && data.fixedMetaDescription !== metaDescription;
      if ((metaTitleChanged || metaDescChanged) && onMetaChange) {
        onMetaChange(
          data.fixedMetaTitle || metaTitle || "",
          data.fixedMetaDescription || metaDescription || ""
        );
        changed = true;
      }

      if (changed) {
        setTimeout(runAudit, 500);
      }
    } catch {
      // Silently fail
    } finally {
      setFixingId(null);
    }
  }

  function toggleCategory(cat: string) {
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
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

  // Count fixable issues
  const fixableCount = audit
    ? audit.checks.filter((c) => c.fixable && c.status !== "pass").length
    : 0;

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
    >
      {/* Header */}
      <div
        className="px-6 py-4 flex items-center justify-between"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        <div className="flex items-center gap-2.5">
          <ShieldCheck size={20} style={{ color: "var(--accent)" }} />
          <h3 className="text-lg font-semibold" style={{ color: "var(--foreground)" }}>
            SEO Audit
          </h3>
        </div>
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

      {/* Empty state */}
      {!audit && !loading && !error && (
        <div className="px-6 py-10 text-center">
          <TrendingUp
            size={36}
            className="mx-auto mb-3"
            style={{ color: "var(--text-muted)", opacity: 0.5 }}
          />
          {!primaryKeyword ? (
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              Set a primary keyword to enable SEO checking.
            </p>
          ) : (
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              Click <strong>Run SEO Check</strong> to analyze your article for keyword usage,
              structure, meta tags, links, readability, and more.
            </p>
          )}
        </div>
      )}

      {error && (
        <div
          className="mx-6 my-4 rounded-lg p-3 text-sm"
          style={{ background: "var(--danger-light)", color: "var(--danger)" }}
        >
          {error}
        </div>
      )}

      {audit && (
        <>
          {/* Score hero */}
          <div
            className="px-6 py-5 flex items-center gap-6"
            style={{ background: getScoreBg(audit.score) }}
          >
            {/* Score ring */}
            <div className="relative shrink-0" style={{ width: 80, height: 80 }}>
              <svg viewBox="0 0 36 36" className="w-full h-full" style={{ transform: "rotate(-90deg)" }}>
                <circle
                  cx="18" cy="18" r="15.5"
                  fill="none"
                  stroke="var(--border)"
                  strokeWidth="3"
                />
                <circle
                  cx="18" cy="18" r="15.5"
                  fill="none"
                  stroke={getScoreColor(audit.score)}
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeDasharray={`${(audit.score / 100) * 97.4} 97.4`}
                />
              </svg>
              <div
                className="absolute inset-0 flex flex-col items-center justify-center"
              >
                <span
                  className="text-2xl font-bold leading-none"
                  style={{ color: getScoreColor(audit.score) }}
                >
                  {audit.score}
                </span>
              </div>
            </div>

            <div className="flex-1">
              <div
                className="text-base font-semibold mb-1"
                style={{ color: getScoreColor(audit.score) }}
              >
                {getScoreLabel(audit.score)}
              </div>

              {/* Summary pills */}
              <div className="flex flex-wrap gap-2">
                {audit.summary.fail > 0 && (
                  <span
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold"
                    style={{ background: "var(--danger)", color: "#fff" }}
                  >
                    <XCircle size={11} />
                    {audit.summary.fail} failed
                  </span>
                )}
                {audit.summary.warning > 0 && (
                  <span
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold"
                    style={{ background: "var(--accent)", color: "var(--accent-text)" }}
                  >
                    <AlertTriangle size={11} />
                    {audit.summary.warning} warnings
                  </span>
                )}
                {audit.summary.pass > 0 && (
                  <span
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium"
                    style={{ background: "rgba(0,0,0,0.06)", color: "var(--text-secondary)" }}
                  >
                    <CheckCircle2 size={11} />
                    {audit.summary.pass} passed
                  </span>
                )}
              </div>

              {fixableCount > 0 && onFixApplied && (
                <p className="text-xs mt-2" style={{ color: "var(--text-secondary)" }}>
                  <Wrench size={10} className="inline mr-1" />
                  {fixableCount} issue{fixableCount > 1 ? "s" : ""} can be auto-fixed
                </p>
              )}
            </div>
          </div>

          {/* Category cards */}
          <div className="p-4 space-y-3">
            {categories.map(([category, checks]) => {
              const failCount = checks.filter((c) => c.status === "fail").length;
              const warnCount = checks.filter((c) => c.status === "warning").length;
              const passCount = checks.filter((c) => c.status === "pass").length;
              const worstStatus: "pass" | "warning" | "fail" =
                failCount > 0 ? "fail" : warnCount > 0 ? "warning" : "pass";
              const isCollapsed = collapsedCategories.has(category);

              const borderColor =
                worstStatus === "fail"
                  ? "var(--danger)"
                  : worstStatus === "warning"
                  ? "var(--accent)"
                  : "var(--success)";

              return (
                <div
                  key={category}
                  className="rounded-lg overflow-hidden"
                  style={{
                    border: "1px solid var(--border)",
                    borderLeft: `4px solid ${borderColor}`,
                  }}
                >
                  {/* Category header */}
                  <button
                    onClick={() => toggleCategory(category)}
                    className="w-full flex items-center justify-between px-4 py-3 transition"
                    style={{
                      background:
                        worstStatus === "fail"
                          ? "var(--danger-light)"
                          : worstStatus === "warning"
                          ? "var(--accent-light)"
                          : "var(--surface)",
                    }}
                  >
                    <div className="flex items-center gap-3">
                      {(() => {
                        const Icon = STATUS_ICONS[worstStatus];
                        return (
                          <Icon
                            size={18}
                            style={{ color: borderColor }}
                          />
                        );
                      })()}
                      <span
                        className="text-sm font-semibold"
                        style={{ color: "var(--foreground)" }}
                      >
                        {CATEGORY_LABELS[category] || category}
                      </span>

                      {/* Inline status counts */}
                      <div className="flex items-center gap-1.5 ml-1">
                        {failCount > 0 && (
                          <span
                            className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                            style={{ background: "var(--danger)", color: "#fff" }}
                          >
                            {failCount} fail
                          </span>
                        )}
                        {warnCount > 0 && (
                          <span
                            className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                            style={{ background: "var(--accent)", color: "var(--accent-text)" }}
                          >
                            {warnCount} warn
                          </span>
                        )}
                        {passCount > 0 && failCount === 0 && warnCount === 0 && (
                          <span
                            className="text-[10px] font-medium px-1.5 py-0.5 rounded"
                            style={{ background: "var(--success-light)", color: "var(--success)" }}
                          >
                            All passed
                          </span>
                        )}
                      </div>
                    </div>

                    {isCollapsed ? (
                      <ChevronDown size={16} style={{ color: "var(--text-muted)" }} />
                    ) : (
                      <ChevronUp size={16} style={{ color: "var(--text-muted)" }} />
                    )}
                  </button>

                  {/* Check items */}
                  {!isCollapsed && (
                    <div className="divide-y" style={{ borderColor: "var(--border)" }}>
                      {checks.map((check) => {
                        const Icon = STATUS_ICONS[check.status];
                        const isIssue = check.status !== "pass";

                        return (
                          <div
                            key={check.id}
                            className="flex items-start gap-3 px-4 py-3"
                            style={{
                              background: isIssue
                                ? check.status === "fail"
                                  ? "rgba(220, 38, 38, 0.03)"
                                  : "rgba(180, 130, 50, 0.03)"
                                : "transparent",
                            }}
                          >
                            <Icon
                              size={15}
                              className="mt-0.5 shrink-0"
                              style={{
                                color:
                                  check.status === "pass"
                                    ? "var(--success)"
                                    : check.status === "warning"
                                    ? "var(--accent)"
                                    : "var(--danger)",
                              }}
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span
                                  className={`text-sm ${isIssue ? "font-semibold" : "font-medium"}`}
                                  style={{
                                    color: isIssue
                                      ? "var(--foreground)"
                                      : "var(--text-secondary)",
                                  }}
                                >
                                  {check.label}
                                </span>
                              </div>
                              <p
                                className="text-xs mt-0.5 leading-relaxed"
                                style={{
                                  color: isIssue
                                    ? "var(--text-secondary)"
                                    : "var(--text-muted)",
                                }}
                              >
                                {check.message}
                              </p>
                            </div>
                            {check.fixable && isIssue && (onFixApplied || onMetaChange) && (
                              <button
                                onClick={() => handleFix(check.id)}
                                disabled={fixingId === check.id}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0 transition hover:opacity-80"
                                style={{
                                  background:
                                    check.status === "fail"
                                      ? "var(--danger)"
                                      : "var(--accent)",
                                  color: "#fff",
                                }}
                              >
                                {fixingId === check.id ? (
                                  <Loader2 size={11} className="animate-spin" />
                                ) : (
                                  <Wrench size={11} />
                                )}
                                Auto-fix
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
