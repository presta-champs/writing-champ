"use client";

import { useState } from "react";
import {
  Send,
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Loader2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  RotateCcw,
} from "lucide-react";
import { updateArticleStatus } from "@/app/actions/mcp";

type PublishPanelProps = {
  articleId: string;
  articleStatus: string;
  websiteId?: string;
  websiteName?: string;
  cmsConnected: boolean;
  externalPostId?: string | null;
  publishedAt?: string | null;
  scheduledAt?: string | null;
  postUrl?: string | null;
  approvalRequired: boolean;
  onStatusChange: (newStatus: string) => void;
};

export function PublishPanel({
  articleId,
  articleStatus,
  websiteName,
  cmsConnected,
  externalPostId,
  publishedAt,
  scheduledAt,
  postUrl,
  approvalRequired,
  onStatusChange,
}: PublishPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("09:00");
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
    postUrl?: string;
  } | null>(null);
  const [statusUpdating, setStatusUpdating] = useState(false);

  const isPublished = articleStatus === "published";
  const isScheduled = articleStatus === "scheduled";
  const isFailed = articleStatus === "failed";
  const isDraft = articleStatus === "draft";
  const isPending = articleStatus === "pending_approval";
  const isApproved = articleStatus === "approved";

  const canPublish = cmsConnected && (isDraft || isApproved || isFailed);
  const canSchedule = cmsConnected && (isDraft || isApproved || isFailed);
  const needsApproval = approvalRequired && isDraft;

  async function handlePublish() {
    setPublishing(true);
    setResult(null);
    try {
      const res = await fetch(`/api/articles/${articleId}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (data.success) {
        setResult({
          success: true,
          message: "Article published successfully!",
          postUrl: data.postUrl,
        });
        onStatusChange("published");
      } else {
        setResult({ success: false, message: data.error || "Publish failed" });
        onStatusChange("failed");
      }
    } catch (err) {
      setResult({
        success: false,
        message: err instanceof Error ? err.message : "Publish failed",
      });
    }
    setPublishing(false);
  }

  async function handleSchedule() {
    if (!scheduleDate) return;
    setScheduling(true);
    setResult(null);
    try {
      const dateTime = new Date(`${scheduleDate}T${scheduleTime}:00`);
      const res = await fetch(`/api/articles/${articleId}/schedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schedule: dateTime.toISOString() }),
      });
      const data = await res.json();
      if (data.success) {
        setResult({
          success: true,
          message: `Scheduled for ${dateTime.toLocaleString()}`,
        });
        onStatusChange("scheduled");
      } else {
        setResult({ success: false, message: data.error || "Schedule failed" });
      }
    } catch (err) {
      setResult({
        success: false,
        message: err instanceof Error ? err.message : "Schedule failed",
      });
    }
    setScheduling(false);
  }

  async function handleStatusChange(newStatus: string) {
    setStatusUpdating(true);
    const res = await updateArticleStatus(
      articleId,
      newStatus as "draft" | "pending_approval" | "approved" | "scheduled" | "published" | "failed"
    );
    if (res.success) {
      onStatusChange(newStatus);
    }
    setStatusUpdating(false);
  }

  // Minimum schedule date is tomorrow
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const minDate = tomorrow.toISOString().split("T")[0];

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
    >
      {/* Header - always visible */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-5 text-left transition hover:opacity-90"
      >
        <div className="flex items-center gap-2">
          <Send size={18} style={{ color: "var(--accent)" }} />
          <h3 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
            Publish
          </h3>
          {isPublished && (
            <span
              className="text-xs font-medium px-2 py-0.5 rounded-full"
              style={{ color: "var(--success)", background: "var(--success-light)" }}
            >
              Published
            </span>
          )}
          {isScheduled && (
            <span
              className="text-xs font-medium px-2 py-0.5 rounded-full"
              style={{ color: "var(--accent)", background: "var(--accent-light)" }}
            >
              Scheduled
            </span>
          )}
          {isFailed && (
            <span
              className="text-xs font-medium px-2 py-0.5 rounded-full"
              style={{ color: "var(--danger)", background: "var(--danger-light)" }}
            >
              Failed
            </span>
          )}
        </div>
        {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {expanded && (
        <div className="px-5 pb-5 space-y-4" style={{ borderTop: "1px solid var(--border)" }}>
          {/* Published state */}
          {isPublished && (
            <div
              className="rounded-lg p-4 mt-4"
              style={{ background: "var(--success-light)" }}
            >
              <div className="flex items-start gap-2">
                <CheckCircle2 size={16} style={{ color: "var(--success)" }} className="shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium" style={{ color: "var(--success)" }}>
                    Published{publishedAt ? ` on ${new Date(publishedAt).toLocaleString()}` : ""}
                  </p>
                  {(postUrl || externalPostId) && (
                    <a
                      href={postUrl || "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs mt-1 hover:underline"
                      style={{ color: "var(--accent)" }}
                    >
                      View on {websiteName || "site"} <ExternalLink size={10} />
                    </a>
                  )}
                  {externalPostId && (
                    <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                      External ID: {externalPostId}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Scheduled state */}
          {isScheduled && scheduledAt && (
            <div
              className="rounded-lg p-4 mt-4"
              style={{ background: "var(--accent-light)" }}
            >
              <div className="flex items-start gap-2">
                <Clock size={16} style={{ color: "var(--accent)" }} className="shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium" style={{ color: "var(--accent)" }}>
                    Scheduled for {new Date(scheduledAt).toLocaleString()}
                  </p>
                  <button
                    onClick={() => handleStatusChange("draft")}
                    disabled={statusUpdating}
                    className="inline-flex items-center gap-1 text-xs mt-2 hover:underline"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    <RotateCcw size={10} /> Cancel schedule
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Failed state */}
          {isFailed && (
            <div
              className="rounded-lg p-4 mt-4"
              style={{ background: "var(--danger-light)" }}
            >
              <div className="flex items-start gap-2">
                <XCircle size={16} style={{ color: "var(--danger)" }} className="shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium" style={{ color: "var(--danger)" }}>
                    Last publish attempt failed
                  </p>
                  <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                    You can retry publishing below.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Approval workflow */}
          {needsApproval && (
            <div
              className="rounded-lg p-4 mt-4"
              style={{ background: "var(--surface-warm)", border: "1px solid var(--border)" }}
            >
              <div className="flex items-start gap-2">
                <AlertCircle size={16} style={{ color: "var(--accent)" }} className="shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
                    Approval required
                  </p>
                  <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                    This article needs to be approved before publishing.
                  </p>
                  <button
                    onClick={() => handleStatusChange("pending_approval")}
                    disabled={statusUpdating}
                    className="inline-flex items-center gap-1.5 mt-3 px-3 py-1.5 rounded-lg text-sm font-medium transition hover:opacity-90 disabled:opacity-50"
                    style={{ background: "var(--accent)", color: "var(--accent-text)" }}
                  >
                    {statusUpdating ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                    Submit for Approval
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Pending approval state */}
          {isPending && (
            <div
              className="rounded-lg p-4 mt-4 space-y-3"
              style={{ background: "var(--accent-light)" }}
            >
              <div className="flex items-start gap-2">
                <Clock size={16} style={{ color: "var(--accent)" }} className="shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium" style={{ color: "var(--accent)" }}>
                    Awaiting approval
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleStatusChange("approved")}
                  disabled={statusUpdating}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition hover:opacity-90 disabled:opacity-50"
                  style={{ background: "var(--success)", color: "#fff" }}
                >
                  <CheckCircle2 size={14} /> Approve
                </button>
                <button
                  onClick={() => handleStatusChange("draft")}
                  disabled={statusUpdating}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition hover:opacity-80 disabled:opacity-50"
                  style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}
                >
                  <RotateCcw size={14} /> Return to Draft
                </button>
              </div>
            </div>
          )}

          {/* CMS not connected */}
          {!cmsConnected && (isDraft || isApproved || isFailed) && (
            <div
              className="rounded-lg p-4 mt-4 text-center"
              style={{ background: "var(--surface-warm)", border: "1px solid var(--border)" }}
            >
              <AlertCircle size={20} className="mx-auto mb-2" style={{ color: "var(--text-muted)" }} />
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                {websiteName
                  ? `CMS not connected for "${websiteName}". Configure the connection in site settings to publish.`
                  : "No website assigned. Assign a website to this article to enable publishing."}
              </p>
            </div>
          )}

          {/* Publish / Schedule actions */}
          {(canPublish || canSchedule) && !needsApproval && (
            <div className="space-y-3 mt-4">
              <div className="flex items-center gap-2">
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                  Destination: <strong>{websiteName}</strong>
                </span>
              </div>

              {/* Result message */}
              {result && (
                <div
                  className="rounded-lg p-3 text-sm flex items-start gap-2"
                  style={{
                    background: result.success ? "var(--success-light)" : "var(--danger-light)",
                    color: result.success ? "var(--success)" : "var(--danger)",
                  }}
                >
                  {result.success ? <CheckCircle2 size={14} className="shrink-0 mt-0.5" /> : <XCircle size={14} className="shrink-0 mt-0.5" />}
                  <div>
                    <p>{result.message}</p>
                    {result.postUrl && (
                      <a
                        href={result.postUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs mt-1 hover:underline"
                      >
                        View published article <ExternalLink size={10} />
                      </a>
                    )}
                  </div>
                </div>
              )}

              {/* Publish now button */}
              <button
                onClick={handlePublish}
                disabled={publishing}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition hover:opacity-90 disabled:opacity-50"
                style={{ background: "var(--accent)", color: "var(--accent-text)" }}
              >
                {publishing ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Send size={16} />
                )}
                {publishing ? "Publishing..." : isFailed ? "Retry Publish" : "Publish Now"}
              </button>

              {/* Schedule section */}
              <div
                className="rounded-lg p-4"
                style={{ background: "var(--surface-warm)", border: "1px solid var(--border)" }}
              >
                <div className="flex items-center gap-2 mb-3">
                  <Calendar size={14} style={{ color: "var(--text-secondary)" }} />
                  <span className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
                    Schedule for Later
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={scheduleDate}
                    min={minDate}
                    onChange={(e) => setScheduleDate(e.target.value)}
                    className="flex-1 rounded-lg px-3 py-1.5 text-sm"
                    style={{ border: "1px solid var(--border)", background: "var(--background)", color: "var(--foreground)" }}
                  />
                  <input
                    type="time"
                    value={scheduleTime}
                    onChange={(e) => setScheduleTime(e.target.value)}
                    className="rounded-lg px-3 py-1.5 text-sm"
                    style={{ border: "1px solid var(--border)", background: "var(--background)", color: "var(--foreground)" }}
                  />
                  <button
                    onClick={handleSchedule}
                    disabled={scheduling || !scheduleDate}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition hover:opacity-90 disabled:opacity-50"
                    style={{ background: "var(--accent-light)", color: "var(--accent)" }}
                  >
                    {scheduling ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Clock size={14} />
                    )}
                    Schedule
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
