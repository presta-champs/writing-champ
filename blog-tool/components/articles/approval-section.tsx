"use client";

import { useState, useEffect } from "react";
import {
  Send,
  CheckCircle2,
  XCircle,
  Clock,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  Loader2,
  AlertTriangle,
  User,
} from "lucide-react";

type ApprovalEvent = {
  id: string;
  action: "submitted" | "approved" | "rejected";
  comment: string | null;
  created_at: string;
  user_name?: string;
  user_email?: string;
};

type ApprovalSectionProps = {
  articleId: string;
  articleStatus: string;
  approvalWorkflowEnabled: boolean;
  approvalComment: string | null;
  userRole: string;
  onStatusChange: (newStatus: string) => void;
};

const ACTION_CONFIG: Record<string, { label: string; color: string; icon: typeof Send }> = {
  submitted: { label: "Submitted for review", color: "var(--accent)", icon: Send },
  approved: { label: "Approved", color: "var(--success)", icon: CheckCircle2 },
  rejected: { label: "Rejected", color: "var(--danger)", icon: XCircle },
};

export function ApprovalSection({
  articleId,
  articleStatus,
  approvalWorkflowEnabled,
  approvalComment,
  userRole,
  onStatusChange,
}: ApprovalSectionProps) {
  const [submitting, setSubmitting] = useState(false);
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [comment, setComment] = useState("");
  const [rejectComment, setRejectComment] = useState("");
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [history, setHistory] = useState<ApprovalEvent[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const isAdmin = userRole === "admin";
  const isDraft = articleStatus === "draft";
  const isPending = articleStatus === "pending_approval";
  const isApproved = articleStatus === "approved";

  // Don't render anything if workflow is not enabled
  if (!approvalWorkflowEnabled) return null;

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/articles/${articleId}/approval`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "submit" }),
      });
      const data = await res.json();
      if (data.success) {
        onStatusChange("pending_approval");
      } else {
        setError(data.error || "Failed to submit for approval");
      }
    } catch {
      setError("Failed to submit for approval");
    }
    setSubmitting(false);
  }

  async function handleApprove() {
    setApproving(true);
    setError(null);
    try {
      const res = await fetch(`/api/articles/${articleId}/approval`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve", comment: comment || undefined }),
      });
      const data = await res.json();
      if (data.success) {
        onStatusChange("approved");
        setComment("");
      } else {
        setError(data.error || "Failed to approve article");
      }
    } catch {
      setError("Failed to approve article");
    }
    setApproving(false);
  }

  async function handleReject() {
    if (!rejectComment.trim()) {
      setError("A rejection comment is required");
      return;
    }
    setRejecting(true);
    setError(null);
    try {
      const res = await fetch(`/api/articles/${articleId}/approval`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reject", comment: rejectComment.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        onStatusChange("draft");
        setRejectComment("");
        setShowRejectForm(false);
      } else {
        setError(data.error || "Failed to reject article");
      }
    } catch {
      setError("Failed to reject article");
    }
    setRejecting(false);
  }

  async function loadHistory() {
    if (history.length > 0) {
      setHistoryOpen(!historyOpen);
      return;
    }
    setHistoryLoading(true);
    try {
      const res = await fetch(`/api/articles/${articleId}/approval`);
      const data = await res.json();
      if (data.events) {
        setHistory(data.events);
      }
    } catch {
      // Silently fail
    }
    setHistoryLoading(false);
    setHistoryOpen(true);
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
    >
      <div className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <CheckCircle2 size={18} style={{ color: "var(--accent)" }} />
          <h3 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
            Approval Workflow
          </h3>
          {isPending && (
            <span
              className="text-xs font-medium px-2 py-0.5 rounded-full"
              style={{ color: "var(--accent)", background: "var(--accent-light)" }}
            >
              Pending Review
            </span>
          )}
          {isApproved && (
            <span
              className="text-xs font-medium px-2 py-0.5 rounded-full"
              style={{ color: "var(--success)", background: "var(--success-light)" }}
            >
              Approved
            </span>
          )}
        </div>

        {/* Error message */}
        {error && (
          <div
            className="rounded-lg p-3 mb-4 flex items-start gap-2 text-sm"
            style={{ background: "var(--danger-light)", color: "var(--danger)" }}
          >
            <AlertTriangle size={14} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Rejection comment from last rejection */}
        {isDraft && approvalComment && (
          <div
            className="rounded-lg p-4 mb-4"
            style={{ background: "var(--danger-light)", border: "1px solid var(--danger)" }}
          >
            <div className="flex items-start gap-2">
              <XCircle size={16} style={{ color: "var(--danger)" }} className="shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium" style={{ color: "var(--danger)" }}>
                  Article was returned with feedback
                </p>
                <p
                  className="text-sm mt-1"
                  style={{ color: "var(--foreground)" }}
                >
                  {approvalComment}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Editor: Submit for Review button (when draft) */}
        {isDraft && (
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition hover:opacity-90 disabled:opacity-50"
            style={{ background: "var(--accent)", color: "var(--accent-text)" }}
          >
            {submitting ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Send size={14} />
            )}
            {submitting ? "Submitting..." : "Submit for Review"}
          </button>
        )}

        {/* Pending: show status for editors, actions for admins */}
        {isPending && !isAdmin && (
          <div
            className="rounded-lg p-4"
            style={{ background: "var(--accent-light)" }}
          >
            <div className="flex items-start gap-2">
              <Clock size={16} style={{ color: "var(--accent)" }} className="shrink-0 mt-0.5" />
              <p className="text-sm" style={{ color: "var(--accent)" }}>
                This article is awaiting admin approval.
              </p>
            </div>
          </div>
        )}

        {/* Admin actions when pending */}
        {isPending && isAdmin && (
          <div className="space-y-3">
            {/* Optional comment for approval */}
            <div>
              <label className="text-xs font-medium mb-1 block" style={{ color: "var(--text-secondary)" }}>
                Comment (optional)
              </label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Add a note..."
                rows={2}
                className="w-full rounded-lg px-3 py-2 text-sm resize-none"
                style={{
                  border: "1px solid var(--border)",
                  background: "var(--background)",
                  color: "var(--foreground)",
                }}
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleApprove}
                disabled={approving}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition hover:opacity-90 disabled:opacity-50"
                style={{ background: "var(--success)", color: "#fff" }}
              >
                {approving ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <CheckCircle2 size={14} />
                )}
                {approving ? "Approving..." : "Approve"}
              </button>

              {!showRejectForm ? (
                <button
                  onClick={() => setShowRejectForm(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm transition hover:opacity-80"
                  style={{ border: "1px solid var(--danger)", color: "var(--danger)" }}
                >
                  <XCircle size={14} /> Reject
                </button>
              ) : (
                <button
                  onClick={() => { setShowRejectForm(false); setRejectComment(""); }}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm transition hover:opacity-80"
                  style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}
                >
                  Cancel
                </button>
              )}
            </div>

            {/* Reject form */}
            {showRejectForm && (
              <div
                className="rounded-lg p-4 space-y-3"
                style={{ background: "var(--danger-light)", border: "1px solid var(--danger)" }}
              >
                <label className="text-xs font-medium block" style={{ color: "var(--danger)" }}>
                  Rejection reason (required)
                </label>
                <textarea
                  value={rejectComment}
                  onChange={(e) => setRejectComment(e.target.value)}
                  placeholder="Explain what needs to change..."
                  rows={3}
                  className="w-full rounded-lg px-3 py-2 text-sm resize-none"
                  style={{
                    border: "1px solid var(--danger)",
                    background: "var(--background)",
                    color: "var(--foreground)",
                  }}
                />
                <button
                  onClick={handleReject}
                  disabled={rejecting || !rejectComment.trim()}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition hover:opacity-90 disabled:opacity-50"
                  style={{ background: "var(--danger)", color: "#fff" }}
                >
                  {rejecting ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <XCircle size={14} />
                  )}
                  {rejecting ? "Rejecting..." : "Reject Article"}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Approved status */}
        {isApproved && (
          <div
            className="rounded-lg p-4"
            style={{ background: "var(--success-light)" }}
          >
            <div className="flex items-start gap-2">
              <CheckCircle2 size={16} style={{ color: "var(--success)" }} className="shrink-0 mt-0.5" />
              <p className="text-sm font-medium" style={{ color: "var(--success)" }}>
                This article has been approved and is ready to publish.
              </p>
            </div>
          </div>
        )}

        {/* History toggle */}
        <button
          onClick={loadHistory}
          className="inline-flex items-center gap-1.5 mt-4 text-xs transition hover:opacity-80"
          style={{ color: "var(--text-muted)" }}
        >
          <MessageSquare size={12} />
          {historyLoading ? "Loading..." : "Approval History"}
          {historyOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>

        {/* History list */}
        {historyOpen && history.length > 0 && (
          <div className="mt-3 space-y-2">
            {history.map((event) => {
              const config = ACTION_CONFIG[event.action] || ACTION_CONFIG.submitted;
              const Icon = config.icon;
              return (
                <div
                  key={event.id}
                  className="rounded-lg p-3 flex items-start gap-2"
                  style={{ background: "var(--surface-warm)" }}
                >
                  <Icon
                    size={14}
                    style={{ color: config.color }}
                    className="shrink-0 mt-0.5"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-medium" style={{ color: config.color }}>
                        {config.label}
                      </span>
                      <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                        {formatDate(event.created_at)}
                      </span>
                    </div>
                    {(event.user_name || event.user_email) && (
                      <span className="text-[10px] flex items-center gap-1 mt-0.5" style={{ color: "var(--text-muted)" }}>
                        <User size={10} />
                        {event.user_name || event.user_email}
                      </span>
                    )}
                    {event.comment && (
                      <p className="text-xs mt-1" style={{ color: "var(--foreground)" }}>
                        {event.comment}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {historyOpen && history.length === 0 && !historyLoading && (
          <p className="text-xs mt-3" style={{ color: "var(--text-muted)" }}>
            No approval events yet.
          </p>
        )}
      </div>
    </div>
  );
}
