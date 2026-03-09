"use client";

import { useState } from "react";
import { CalendarClock, X, Loader2, CheckCircle2, AlertCircle } from "lucide-react";

type Props = {
  selectedArticles: { id: string; title: string | null }[];
  onScheduled: () => void;
  onClear: () => void;
};

type FeedbackState =
  | { type: "idle" }
  | { type: "loading" }
  | { type: "success"; message: string }
  | { type: "error"; message: string };

export default function BulkScheduleBar({ selectedArticles, onScheduled, onClear }: Props) {
  const [dateTime, setDateTime] = useState("");
  const [feedback, setFeedback] = useState<FeedbackState>({ type: "idle" });

  // Minimum datetime value: now (rounded to nearest minute)
  const now = new Date();
  now.setSeconds(0, 0);
  const minDateTime = now.toISOString().slice(0, 16);

  async function handleSchedule() {
    // Validate datetime is set
    if (!dateTime) {
      setFeedback({ type: "error", message: "Please pick a date and time first." });
      return;
    }

    // Validate datetime is in the future
    const scheduledDate = new Date(dateTime);
    if (scheduledDate <= new Date()) {
      setFeedback({ type: "error", message: "The schedule date must be in the future." });
      return;
    }

    setFeedback({ type: "loading" });

    const isoDate = scheduledDate.toISOString();
    const payload = {
      articles: selectedArticles.map((a) => ({
        id: a.id,
        scheduledAt: isoDate,
      })),
    };

    try {
      const res = await fetch("/api/articles/bulk-schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok && res.status !== 207) {
        setFeedback({
          type: "error",
          message: data.error || "Something went wrong. Please try again.",
        });
        return;
      }

      if (data.failed > 0) {
        const failedItems = (data.results || [])
          .filter((r: { success: boolean }) => !r.success)
          .map((r: { id: string; error?: string }) => r.error || r.id)
          .join("; ");
        setFeedback({
          type: "error",
          message: `${data.scheduled} scheduled, ${data.failed} failed: ${failedItems}`,
        });
      } else {
        setFeedback({
          type: "success",
          message: `${data.scheduled} article${data.scheduled !== 1 ? "s" : ""} scheduled successfully.`,
        });
      }

      // Allow user to read the success message, then notify parent
      setTimeout(() => {
        setFeedback({ type: "idle" });
        setDateTime("");
        onScheduled();
      }, 1500);
    } catch {
      setFeedback({
        type: "error",
        message: "Network error. Please check your connection and try again.",
      });
    }
  }

  const count = selectedArticles.length;
  const isLoading = feedback.type === "loading";

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-40"
      style={{
        background: "var(--surface)",
        borderTop: "2px solid var(--border)",
        boxShadow: "0 -4px 20px rgba(0, 0, 0, 0.08)",
      }}
    >
      <div className="max-w-6xl mx-auto px-4 py-3">
        {/* Main row */}
        <div className="flex items-center gap-4 flex-wrap">
          {/* Selected count */}
          <div className="flex items-center gap-2 mr-auto">
            <CalendarClock size={18} style={{ color: "var(--accent)" }} />
            <span className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
              {count} article{count !== 1 ? "s" : ""} selected
            </span>
          </div>

          {/* DateTime picker */}
          <div className="flex items-center gap-2">
            <label
              htmlFor="bulk-schedule-datetime"
              className="text-sm font-medium hidden sm:inline"
              style={{ color: "var(--text-muted)" }}
            >
              Schedule for:
            </label>
            <input
              id="bulk-schedule-datetime"
              type="datetime-local"
              value={dateTime}
              min={minDateTime}
              onChange={(e) => {
                setDateTime(e.target.value);
                if (feedback.type === "error") setFeedback({ type: "idle" });
              }}
              className="px-3 py-2 rounded-lg text-sm"
              style={{
                background: "var(--background)",
                border: "1px solid var(--border)",
                color: "var(--foreground)",
              }}
            />
          </div>

          {/* Schedule All button */}
          <button
            onClick={handleSchedule}
            disabled={isLoading}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: "var(--accent)", color: "var(--accent-text)" }}
          >
            {isLoading ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                Scheduling...
              </>
            ) : (
              <>
                <CalendarClock size={15} />
                Schedule All
              </>
            )}
          </button>

          {/* Clear Selection button */}
          <button
            onClick={onClear}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm transition hover:opacity-80 disabled:opacity-50"
            style={{
              background: "var(--background)",
              border: "1px solid var(--border)",
              color: "var(--text-muted)",
            }}
          >
            <X size={14} />
            Clear
          </button>
        </div>

        {/* Feedback row */}
        {feedback.type === "success" && (
          <div className="flex items-center gap-2 mt-2">
            <CheckCircle2 size={15} style={{ color: "var(--success)" }} />
            <span className="text-sm font-medium" style={{ color: "var(--success)" }}>
              {feedback.message}
            </span>
          </div>
        )}
        {feedback.type === "error" && (
          <div className="flex items-center gap-2 mt-2">
            <AlertCircle size={15} style={{ color: "var(--danger)" }} />
            <span className="text-sm font-medium" style={{ color: "var(--danger)" }}>
              {feedback.message}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
