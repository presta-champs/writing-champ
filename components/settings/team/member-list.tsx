"use client";

import { useState } from "react";
import { UserMinus, Shield, Loader2, User } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Member = {
  user_id: string;
  role: string;
  users?: { email?: string; name?: string };
};

export function MemberList({
  members,
  currentUserId,
  isAdmin,
}: {
  members: Member[];
  currentUserId: string;
  isAdmin: boolean;
}) {
  const [removingId, setRemovingId] = useState<string | null>(null);

  async function handleRemove(userId: string) {
    if (!isAdmin || userId === currentUserId) return;
    setRemovingId(userId);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setRemovingId(null); return; }

    const { data: membership } = await supabase
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", user.id)
      .limit(1)
      .single();

    if (membership) {
      await supabase
        .from("organization_members")
        .delete()
        .eq("user_id", userId)
        .eq("organization_id", membership.organization_id);
    }
    setRemovingId(null);
    window.location.reload();
  }

  return (
    <div className="space-y-2">
      {members.map((m) => {
        const email = (m.users as { email?: string })?.email || m.user_id;
        const name = (m.users as { name?: string })?.name;
        const isSelf = m.user_id === currentUserId;

        return (
          <div
            key={m.user_id}
            className="flex items-center justify-between p-3 rounded-lg"
            style={{ border: "1px solid var(--border)" }}
          >
            <div className="flex items-center gap-3">
              <User size={16} style={{ color: "var(--text-muted)" }} />
              <div>
                <p className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
                  {name || email}
                  {isSelf && <span className="text-xs ml-1" style={{ color: "var(--text-muted)" }}>(you)</span>}
                </p>
                {name && <p className="text-xs" style={{ color: "var(--text-muted)" }}>{email}</p>}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span
                className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full"
                style={{
                  background: m.role === "admin" ? "var(--accent-light)" : "var(--surface-warm)",
                  color: m.role === "admin" ? "var(--accent)" : "var(--text-muted)",
                }}
              >
                {m.role === "admin" && <Shield size={10} />}
                {m.role}
              </span>
              {isAdmin && !isSelf && (
                <button
                  onClick={() => handleRemove(m.user_id)}
                  disabled={removingId === m.user_id}
                  className="p-1.5 rounded-lg transition hover:opacity-80 disabled:opacity-50"
                  style={{ color: "var(--danger)" }}
                >
                  {removingId === m.user_id ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <UserMinus size={14} />
                  )}
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
