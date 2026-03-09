"use client";

import { useState } from "react";
import { Calendar, Clock, X, Loader2 } from "lucide-react";

type ArticleRow = {
  id: string;
  title?: string | null;
  status?: string;
};

type BulkScheduleBarProps = {
  selectedArticles: ArticleRow[];
  onScheduled: () => void;
  onClear: () => void;
};

export default function BulkScheduleBar({
  selectedArticles,
  onScheduled,
  onClear,
}: BulkScheduleBarProps) {
  const [date, setDate] = useState("");
  const [time, setTime] = useState("09:00");
  const [scheduling, setScheduling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (selectedArticles.length === 0) return null;

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const minDate = tomorrow.toISOString().split("T")[0];

  async function handleSchedule() {
    if (!date) return;
    setScheduling(true);
    setError(null);

    const dateTime = new Date(`${date}T${time}:00`).toISOString();
    let failed = 0;

    for (const article of selectedArticles) {
      try {
        const res = await fetch(`/api/articles/${article.id}/schedule`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ schedule: dateTime }),
        });
        if (!res.ok) failed++;
      } catch {
        failed++;
      }
    }

    setScheduling(false);
    if (failed > 0) {
      setError(`${failed} of ${selectedArticles.length} failed to schedule`);
    } else {
      onScheduled();
    }
  }

  return (
    <div
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 rounded-xl px-5 py-3 shadow-lg flex items-center gap-3 flex-wrap"
      style={{ background: "var(--surface)", border: "1px solid var(--accent)" }}
    >
      <span className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
        {selectedArticles.length} selected
      </span>

      <input
        type="date"
        value={date}
        min={minDate}
        onChange={(e) => setDate(e.target.value)}
        className="rounded-lg px-2 py-1 text-sm"
        style={{ border: "1px solid var(--border)", background: "var(--background)", color: "var(--foreground)" }}
      />
      <input
        type="time"
        value={time}
        onChange={(e) => setTime(e.target.value)}
        className="rounded-lg px-2 py-1 text-sm"
        style={{ border: "1px solid var(--border)", background: "var(--background)", color: "var(--foreground)" }}
      />

      <button
        onClick={handleSchedule}
        disabled={scheduling || !date}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition hover:opacity-90 disabled:opacity-50"
        style={{ background: "var(--accent)", color: "var(--accent-text)" }}
      >
        {scheduling ? <Loader2 size={14} className="animate-spin" /> : <Calendar size={14} />}
        Schedule All
      </button>

      <button onClick={onClear} className="p-1 opacity-60 hover:opacity-100">
        <X size={16} />
      </button>

      {error && (
        <span className="text-xs" style={{ color: "var(--danger)" }}>{error}</span>
      )}
    </div>
  );
}
