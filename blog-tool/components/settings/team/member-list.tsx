"use client";

import { useState } from "react";
import { updateMemberRole, removeMember, type TeamMember } from "@/app/actions/team";
import { Loader2, Trash2 } from "lucide-react";

type Props = {
  members: TeamMember[];
  currentUserId: string;
  isAdmin: boolean;
};

const ROLE_COLORS: Record<string, { bg: string; text: string }> = {
  admin: { bg: "var(--accent)", text: "var(--accent-text)" },
  editor: { bg: "var(--surface-warm)", text: "var(--text-secondary)" },
  viewer: { bg: "var(--surface-warm)", text: "var(--text-muted)" },
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function MemberList({ members, currentUserId, isAdmin }: Props) {
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleRoleChange(userId: string, newRole: string) {
    setLoadingId(userId);
    setError(null);
    const result = await updateMemberRole(userId, newRole);
    if (!result.success) setError(result.error || "Failed to update role.");
    setLoadingId(null);
  }

  async function handleRemove(userId: string, memberName: string) {
    const confirmed = window.confirm(
      `Remove ${memberName || "this member"} from the workspace? They will lose access to all content.`
    );
    if (!confirmed) return;

    setLoadingId(userId);
    setError(null);
    const result = await removeMember(userId);
    if (!result.success) setError(result.error || "Failed to remove member.");
    setLoadingId(null);
  }

  return (
    <div>
      {error && (
        <p className="text-xs mb-3" style={{ color: "var(--danger)" }}>
          {error}
        </p>
      )}

      {/* Desktop table */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border)" }}>
              <th
                className="text-left py-2 px-2 font-medium"
                style={{ color: "var(--text-muted)" }}
              >
                Member
              </th>
              <th
                className="text-left py-2 px-2 font-medium"
                style={{ color: "var(--text-muted)" }}
              >
                Role
              </th>
              <th
                className="text-left py-2 px-2 font-medium"
                style={{ color: "var(--text-muted)" }}
              >
                Joined
              </th>
              {isAdmin && (
                <th
                  className="text-right py-2 px-2 font-medium"
                  style={{ color: "var(--text-muted)" }}
                >
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {members.map((member) => {
              const isCurrentUser = member.user_id === currentUserId;
              const isLoading = loadingId === member.user_id;
              const roleStyle = ROLE_COLORS[member.role] || ROLE_COLORS.viewer;

              return (
                <tr
                  key={member.user_id}
                  style={{ borderBottom: "1px solid var(--border)" }}
                >
                  <td className="py-3 px-2">
                    <div>
                      <span
                        className="font-medium"
                        style={{ color: "var(--foreground)" }}
                      >
                        {member.name || member.email.split("@")[0]}
                      </span>
                      {isCurrentUser && (
                        <span
                          className="text-xs ml-1.5"
                          style={{ color: "var(--text-muted)" }}
                        >
                          (you)
                        </span>
                      )}
                      <div
                        className="text-xs"
                        style={{ color: "var(--text-muted)" }}
                      >
                        {member.email}
                      </div>
                    </div>
                  </td>

                  <td className="py-3 px-2">
                    {isAdmin && !isCurrentUser ? (
                      <div className="flex items-center gap-1.5">
                        <select
                          value={member.role}
                          onChange={(e) =>
                            handleRoleChange(member.user_id, e.target.value)
                          }
                          disabled={isLoading}
                          className="rounded-md px-2 py-1 text-xs font-medium capitalize"
                          style={{
                            border: "1px solid var(--border)",
                            background: "var(--surface)",
                            color: "var(--foreground)",
                          }}
                        >
                          <option value="admin">Admin</option>
                          <option value="editor">Editor</option>
                          <option value="viewer">Viewer</option>
                        </select>
                        {isLoading && (
                          <Loader2
                            size={12}
                            className="animate-spin"
                            style={{ color: "var(--text-muted)" }}
                          />
                        )}
                      </div>
                    ) : (
                      <span
                        className="text-xs font-medium px-2 py-0.5 rounded-full capitalize"
                        style={{
                          background: roleStyle.bg,
                          color: roleStyle.text,
                        }}
                      >
                        {member.role}
                      </span>
                    )}
                  </td>

                  <td
                    className="py-3 px-2 text-xs"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {formatDate(member.joined_at)}
                  </td>

                  {isAdmin && (
                    <td className="py-3 px-2 text-right">
                      {!isCurrentUser && (
                        <button
                          onClick={() =>
                            handleRemove(member.user_id, member.name || member.email)
                          }
                          disabled={isLoading}
                          className="p-1.5 rounded-md transition hover:opacity-80 disabled:opacity-40"
                          style={{ color: "var(--danger)" }}
                          title="Remove member"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="sm:hidden space-y-3">
        {members.map((member) => {
          const isCurrentUser = member.user_id === currentUserId;
          const isLoading = loadingId === member.user_id;
          const roleStyle = ROLE_COLORS[member.role] || ROLE_COLORS.viewer;

          return (
            <div
              key={member.user_id}
              className="rounded-lg p-3"
              style={{ border: "1px solid var(--border)" }}
            >
              <div className="flex items-start justify-between mb-2">
                <div>
                  <span
                    className="font-medium text-sm"
                    style={{ color: "var(--foreground)" }}
                  >
                    {member.name || member.email.split("@")[0]}
                    {isCurrentUser && (
                      <span
                        className="text-xs ml-1"
                        style={{ color: "var(--text-muted)" }}
                      >
                        (you)
                      </span>
                    )}
                  </span>
                  <div
                    className="text-xs"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {member.email}
                  </div>
                </div>
                <span
                  className="text-xs font-medium px-2 py-0.5 rounded-full capitalize"
                  style={{ background: roleStyle.bg, color: roleStyle.text }}
                >
                  {member.role}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span
                  className="text-xs"
                  style={{ color: "var(--text-muted)" }}
                >
                  Joined {formatDate(member.joined_at)}
                </span>
                {isAdmin && !isCurrentUser && (
                  <div className="flex items-center gap-2">
                    <select
                      value={member.role}
                      onChange={(e) =>
                        handleRoleChange(member.user_id, e.target.value)
                      }
                      disabled={isLoading}
                      className="rounded-md px-2 py-1 text-xs"
                      style={{
                        border: "1px solid var(--border)",
                        background: "var(--surface)",
                        color: "var(--foreground)",
                      }}
                    >
                      <option value="admin">Admin</option>
                      <option value="editor">Editor</option>
                      <option value="viewer">Viewer</option>
                    </select>
                    <button
                      onClick={() =>
                        handleRemove(
                          member.user_id,
                          member.name || member.email
                        )
                      }
                      disabled={isLoading}
                      className="p-1 rounded-md"
                      style={{ color: "var(--danger)" }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {members.length === 0 && (
        <p className="text-sm py-6 text-center" style={{ color: "var(--text-muted)" }}>
          No team members yet.
        </p>
      )}
    </div>
  );
}
