"use client";

import { useState } from "react";
import { inviteTeamMember } from "@/app/actions/team";
import { Loader2, UserPlus } from "lucide-react";

export function InviteForm() {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("editor");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;

    setSaving(true);
    setMessage(null);

    const result = await inviteTeamMember(email, role);

    if (result.success) {
      setMessage({ text: "Member added successfully.", ok: true });
      setEmail("");
      setRole("editor");
      setTimeout(() => setMessage(null), 4000);
    } else {
      setMessage({ text: result.error || "Failed to invite member.", ok: false });
    }

    setSaving(false);
  }

  return (
    <form onSubmit={handleInvite} className="space-y-3">
      <div className="flex gap-2 flex-wrap">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="colleague@company.com"
          required
          className="flex-1 min-w-[200px] rounded-lg px-3 py-2 text-sm"
          style={{ border: "1px solid var(--border)", background: "var(--surface)" }}
        />
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="rounded-lg px-3 py-2 text-sm"
          style={{
            border: "1px solid var(--border)",
            background: "var(--surface)",
            color: "var(--foreground)",
          }}
        >
          <option value="editor">Editor</option>
          <option value="viewer">Viewer</option>
          <option value="admin">Admin</option>
        </select>
        <button
          type="submit"
          disabled={saving || !email.trim()}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition hover:opacity-90 disabled:opacity-40"
          style={{ background: "var(--accent)", color: "var(--accent-text)" }}
        >
          {saving ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <UserPlus size={14} />
          )}
          Add Member
        </button>
      </div>

      {message && (
        <p
          className="text-xs"
          style={{ color: message.ok ? "var(--success)" : "var(--danger)" }}
        >
          {message.text}
        </p>
      )}
    </form>
  );
}
