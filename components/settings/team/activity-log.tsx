"use client";

import { useState } from "react";
import { Activity, ChevronDown } from "lucide-react";

type ActivityEvent = {
  id: string;
  event_type: string;
  model_used?: string;
  estimated_cost_usd?: number;
  created_at: string;
  user_id?: string;
};

export function ActivityLog({
  initialEvents,
  initialTotal,
}: {
  initialEvents: ActivityEvent[];
  initialTotal: number;
}) {
  const [events] = useState<ActivityEvent[]>(initialEvents);
  const [expanded, setExpanded] = useState(false);

  const displayEvents = expanded ? events : events.slice(0, 10);

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
    >
      <div className="p-4 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border)" }}>
        <div className="flex items-center gap-2">
          <Activity size={16} style={{ color: "var(--accent)" }} />
          <p className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
            Activity Log
          </p>
          <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "var(--surface-warm)", color: "var(--text-muted)" }}>
            {initialTotal} events
          </span>
        </div>
      </div>

      {displayEvents.length === 0 ? (
        <div className="p-6 text-center">
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>No activity yet</p>
        </div>
      ) : (
        <div className="divide-y" style={{ borderColor: "var(--border)" }}>
          {displayEvents.map((event) => (
            <div key={event.id} className="px-4 py-2.5 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium" style={{ color: "var(--foreground)" }}>
                  {event.event_type.replace(/_/g, " ")}
                </p>
                {event.model_used && (
                  <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>{event.model_used}</p>
                )}
              </div>
              <div className="text-right">
                <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                  {new Date(event.created_at).toLocaleString()}
                </p>
                {event.estimated_cost_usd != null && event.estimated_cost_usd > 0 && (
                  <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                    ${event.estimated_cost_usd.toFixed(4)}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {events.length > 10 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full p-2 text-center text-xs flex items-center justify-center gap-1"
          style={{ color: "var(--accent)", borderTop: "1px solid var(--border)" }}
        >
          {expanded ? "Show less" : `Show all ${events.length}`}
          <ChevronDown size={12} style={{ transform: expanded ? "rotate(180deg)" : undefined }} />
        </button>
      )}
    </div>
  );
}
