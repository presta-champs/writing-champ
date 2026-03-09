"use client";

import { useState } from "react";
import { CheckCircle2, XCircle, Send, RotateCcw, Loader2, Clock, MessageSquare } from "lucide-react";

type ApprovalSectionProps = {
  articleId: string;
  articleStatus: string;
  approvalWorkflowEnabled: boolean;
  approvalComment?: string | null;
  userRole?: string;
  onStatusChange: (newStatus: string) => void;
};

export function ApprovalSection({
  articleId,
  articleStatus,
  approvalWorkflowEnabled,
  approvalComment,
  userRole,
  onStatusChange,
}: ApprovalSectionProps) {
  const [loading, setLoading] = useState(false);
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (!approvalWorkflowEnabled) return null;

  async function handleAction(action: "submit" | "approve" | "reject" | "return") {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/articles/${articleId}/approval`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, comment: comment || undefined }),
      });
      const data = await res.json();
      if (data.success) {
        const statusMap: Record<string, string> = {
          submit: "pending_approval",
          approve: "approved",
          reject: "draft",
          return: "draft",
        };
        onStatusChange(statusMap[action]);
        setComment("");
      } else {
        setError(data.error || "Action failed");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    }
    setLoading(false);
  }

  const isDraft = articleStatus === "draft";
  const isPending = articleStatus === "pending_approval";
  const isAdmin = userRole === "admin";

  return (
    <div
      className="rounded-xl p-5 space-y-3"
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
    >
      <h3 className="text-sm font-semibold flex items-center gap-2" style={{ color: "var(--foreground)" }}>
        <CheckCircle2 size={16} style={{ color: "var(--accent)" }} />
        Approval Workflow
      </h3>

      {error && (
        <p className="text-xs" style={{ color: "var(--danger)" }}>{error}</p>
      )}

      {approvalComment && (
        <div
          className="rounded-lg p-3 text-sm flex items-start gap-2"
          style={{ background: "var(--surface-warm)" }}
        >
          <MessageSquare size={14} className="shrink-0 mt-0.5" style={{ color: "var(--text-muted)" }} />
          <p style={{ color: "var(--text-secondary)" }}>{approvalComment}</p>
        </div>
      )}

      {isDraft && (
        <button
          onClick={() => handleAction("submit")}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition hover:opacity-90 disabled:opacity-50"
          style={{ background: "var(--accent)", color: "var(--accent-text)" }}
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          Submit for Approval
        </button>
      )}

      {isPending && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Clock size={14} style={{ color: "var(--accent)" }} />
            <span className="text-sm" style={{ color: "var(--accent)" }}>Awaiting approval</span>
          </div>

          {isAdmin && (
            <>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Optional comment..."
                rows={2}
                className="w-full rounded-lg px-3 py-2 text-sm resize-none"
                style={{ border: "1px solid var(--border)", background: "var(--background)", color: "var(--foreground)" }}
              />
              <div className="flex gap-2">
                <button
                  onClick={() => handleAction("approve")}
                  disabled={loading}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition hover:opacity-90 disabled:opacity-50"
                  style={{ background: "var(--success)", color: "#fff" }}
                >
                  <CheckCircle2 size={14} /> Approve
                </button>
                <button
                  onClick={() => handleAction("reject")}
                  disabled={loading}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition hover:opacity-80 disabled:opacity-50"
                  style={{ border: "1px solid var(--border)", color: "var(--danger)" }}
                >
                  <XCircle size={14} /> Reject
                </button>
                <button
                  onClick={() => handleAction("return")}
                  disabled={loading}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition hover:opacity-80 disabled:opacity-50"
                  style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}
                >
                  <RotateCcw size={14} /> Return to Draft
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
