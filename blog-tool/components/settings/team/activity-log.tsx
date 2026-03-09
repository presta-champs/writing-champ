"use client";

import { useState, useTransition } from "react";
import { getActivityLog, type ActivityEvent } from "@/app/actions/team";
import { Loader2 } from "lucide-react";

type Props = {
  initialEvents: ActivityEvent[];
  initialTotal: number;
};

/** Human-readable label for event types */
function formatEventType(eventType: string): string {
  const labels: Record<string, string> = {
    article_generation: "generated an article",
    keyword_research: "ran keyword research",
    image_generation: "generated an image",
    seo_audit: "ran an SEO audit",
    article_publish: "published an article",
    voice_analysis: "analyzed writing samples",
  };
  return labels[eventType] || eventType.replace(/_/g, " ");
}

function formatCost(cost: number): string {
  if (cost === 0) return "$0.00";
  if (cost < 0.01) return "<$0.01";
  return `$${cost.toFixed(2)}`;
}

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);

  if (diffHours < 1) {
    const minutes = Math.floor(diffMs / (1000 * 60));
    return minutes <= 1 ? "just now" : `${minutes}m ago`;
  }
  if (diffHours < 24) return `${Math.floor(diffHours)}h ago`;
  if (diffHours < 48) return "yesterday";

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function ActivityLog({ initialEvents, initialTotal }: Props) {
  const [events, setEvents] = useState<ActivityEvent[]>(initialEvents);
  const [total, setTotal] = useState(initialTotal);
  const [isPending, startTransition] = useTransition();

  const hasMore = events.length < total;

  function loadMore() {
    startTransition(async () => {
      const result = await getActivityLog(50, events.length);
      setEvents((prev) => [...prev, ...result.events]);
      setTotal(result.total);
    });
  }

  if (events.length === 0) {
    return (
      <p className="text-sm py-6 text-center" style={{ color: "var(--text-muted)" }}>
        No activity yet. Events will appear here as your team uses the platform.
      </p>
    );
  }

  return (
    <div className="space-y-1">
      {events.map((event) => (
        <div
          key={event.id}
          className="flex items-center justify-between py-2 px-2 rounded-lg"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          <div className="flex-1 min-w-0">
            <span className="text-sm" style={{ color: "var(--foreground)" }}>
              <span className="font-medium">
                {event.user_name || event.user_email?.split("@")[0] || "Unknown"}
              </span>
              {" "}
              <span style={{ color: "var(--text-secondary)" }}>
                {formatEventType(event.event_type)}
              </span>
              {event.model_used && (
                <span style={{ color: "var(--text-muted)" }}>
                  {" "}using {event.model_used}
                </span>
              )}
            </span>
          </div>

          <div className="flex items-center gap-3 ml-3 shrink-0">
            <span
              className="text-xs font-mono"
              style={{ color: "var(--text-muted)" }}
            >
              {formatCost(event.estimated_cost_usd)}
            </span>
            <span
              className="text-xs"
              style={{ color: "var(--text-muted)" }}
            >
              {formatTimestamp(event.created_at)}
            </span>
          </div>
        </div>
      ))}

      {hasMore && (
        <div className="pt-3 text-center">
          <button
            onClick={loadMore}
            disabled={isPending}
            className="px-4 py-2 rounded-lg text-sm font-medium transition hover:opacity-90 disabled:opacity-40"
            style={{
              border: "1px solid var(--border)",
              color: "var(--text-secondary)",
            }}
          >
            {isPending ? (
              <span className="flex items-center gap-2">
                <Loader2 size={14} className="animate-spin" /> Loading...
              </span>
            ) : (
              `Load more (${total - events.length} remaining)`
            )}
          </button>
        </div>
      )}
    </div>
  );
}
