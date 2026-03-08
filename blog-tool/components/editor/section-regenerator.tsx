"use client";

import { useState } from "react";
import {
  RefreshCw,
  X,
  Check,
  ArrowDownNarrowWide,
  ArrowUpNarrowWide,
  GraduationCap,
  MessageCircle,
  Minimize2,
  ListTree,
} from "lucide-react";

type SectionRegenNudge =
  | "shorter"
  | "longer"
  | "more formal"
  | "more casual"
  | "simpler"
  | "more detailed";

const NUDGE_OPTIONS: {
  value: SectionRegenNudge;
  label: string;
  icon: typeof RefreshCw;
}[] = [
  { value: "shorter", label: "Shorter", icon: Minimize2 },
  { value: "longer", label: "Longer", icon: ArrowUpNarrowWide },
  { value: "more formal", label: "More formal", icon: GraduationCap },
  { value: "more casual", label: "More casual", icon: MessageCircle },
  { value: "simpler", label: "Simpler", icon: ArrowDownNarrowWide },
  { value: "more detailed", label: "More detailed", icon: ListTree },
];

type Props = {
  articleId: string;
  primaryKeyword?: string;
  selectedHtml: string;
  onReplace: (newHtml: string) => void;
  onClose: () => void;
};

export function SectionRegenerator({
  articleId,
  primaryKeyword,
  selectedHtml,
  onReplace,
  onClose,
}: Props) {
  const [selectedNudge, setSelectedNudge] = useState<
    SectionRegenNudge | undefined
  >();
  const [loading, setLoading] = useState(false);
  const [resultHtml, setResultHtml] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [costInfo, setCostInfo] = useState<{
    model: string;
    costUsd: number;
  } | null>(null);

  async function handleRegenerate() {
    if (!selectedHtml.trim()) return;

    setLoading(true);
    setError(null);
    setResultHtml(null);
    setCostInfo(null);

    try {
      const response = await fetch("/api/articles/regen-section", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          articleId,
          sectionHtml: selectedHtml,
          nudge: selectedNudge,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(
          errData.error || `Request failed (${response.status})`
        );
      }

      const data = await response.json();
      setResultHtml(data.html);
      setCostInfo({ model: data.model, costUsd: data.costUsd });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Regeneration failed";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  function handleApply() {
    if (resultHtml) {
      onReplace(resultHtml);
    }
  }

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        <h3
          className="text-sm font-semibold"
          style={{ color: "var(--foreground)" }}
        >
          Regenerate Section
        </h3>
        <button
          onClick={onClose}
          className="p-1 rounded-md transition hover:opacity-70"
          style={{ color: "var(--text-muted)" }}
          aria-label="Close"
        >
          <X size={16} />
        </button>
      </div>

      <div className="px-4 py-3 space-y-4">
        {/* Selected section preview */}
        <div>
          <label
            className="block text-xs font-medium mb-1.5"
            style={{ color: "var(--text-muted)" }}
          >
            Selected section
          </label>
          <div
            className="overflow-y-auto rounded-lg px-3 py-2 text-sm prose prose-sm max-w-none"
            style={{
              maxHeight: "200px",
              background: "var(--surface-warm)",
              border: "1px solid var(--border)",
              color: "var(--foreground)",
            }}
            dangerouslySetInnerHTML={{ __html: selectedHtml }}
          />
        </div>

        {/* Nudge pills */}
        <div>
          <label
            className="block text-xs font-medium mb-2"
            style={{ color: "var(--text-muted)" }}
          >
            Adjustment (optional)
          </label>
          <div className="flex flex-wrap gap-2">
            {NUDGE_OPTIONS.map((opt) => {
              const isActive = selectedNudge === opt.value;
              const Icon = opt.icon;
              return (
                <button
                  key={opt.value}
                  onClick={() =>
                    setSelectedNudge(isActive ? undefined : opt.value)
                  }
                  disabled={loading}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition"
                  style={{
                    background: isActive
                      ? "var(--accent)"
                      : "var(--surface-warm)",
                    color: isActive
                      ? "var(--accent-text)"
                      : "var(--foreground)",
                    border: isActive
                      ? "1px solid var(--accent)"
                      : "1px solid var(--border)",
                    opacity: loading ? 0.6 : 1,
                    cursor: loading ? "not-allowed" : "pointer",
                  }}
                >
                  <Icon size={12} />
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Regenerate button */}
        <button
          onClick={handleRegenerate}
          disabled={loading || !selectedHtml.trim()}
          className="inline-flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-lg text-sm font-medium transition"
          style={{
            background: "var(--accent)",
            color: "var(--accent-text)",
            opacity: loading || !selectedHtml.trim() ? 0.6 : 1,
            cursor:
              loading || !selectedHtml.trim() ? "not-allowed" : "pointer",
          }}
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          {loading ? "Regenerating..." : "Regenerate"}
        </button>

        {/* Error */}
        {error && (
          <div
            className="rounded-lg px-3 py-2 text-sm"
            style={{
              background: "var(--surface-warm)",
              border: "1px solid var(--border)",
              color: "var(--danger, #dc2626)",
            }}
          >
            {error}
          </div>
        )}

        {/* Result preview */}
        {resultHtml && (
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label
                className="text-xs font-medium"
                style={{ color: "var(--text-muted)" }}
              >
                Result
              </label>
              {costInfo && (
                <span
                  className="text-[10px]"
                  style={{ color: "var(--text-muted)" }}
                >
                  {costInfo.model} &middot; $
                  {costInfo.costUsd.toFixed(4)}
                </span>
              )}
            </div>
            <div
              className="overflow-y-auto rounded-lg px-3 py-2 text-sm prose prose-sm max-w-none"
              style={{
                maxHeight: "300px",
                background: "var(--surface-warm)",
                border: "1px solid var(--border)",
                color: "var(--foreground)",
              }}
              dangerouslySetInnerHTML={{ __html: resultHtml }}
            />

            {/* Apply / Discard buttons */}
            <div className="flex items-center gap-2 mt-3">
              <button
                onClick={handleApply}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition"
                style={{
                  background: "var(--accent)",
                  color: "var(--accent-text)",
                  cursor: "pointer",
                }}
              >
                <Check size={14} />
                Apply
              </button>
              <button
                onClick={() => {
                  setResultHtml(null);
                  setCostInfo(null);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition hover:opacity-70"
                style={{
                  background: "var(--surface-warm)",
                  color: "var(--foreground)",
                  border: "1px solid var(--border)",
                  cursor: "pointer",
                }}
              >
                <X size={14} />
                Discard
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
