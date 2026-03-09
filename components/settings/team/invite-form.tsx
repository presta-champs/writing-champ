"use client";

import { useState } from "react";
import { UserPlus, Loader2, Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function InviteForm() {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("member");
  const [inviting, setInviting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setInviting(true);
    setResult(null);

    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setResult({ success: false, message: "Not authenticated" }); setInviting(false); return; }

      const { data: membership } = await supabase
        .from("organization_members")
        .select("organization_id")
        .eq("user_id", user.id)
        .limit(1)
        .single();

      if (!membership) { setResult({ success: false, message: "No organization" }); setInviting(false); return; }

      // Check if user exists
      const { data: existingUser } = await supabase
        .from("users")
        .select("id")
        .eq("email", email.trim().toLowerCase())
        .single();

      if (!existingUser) {
        setResult({ success: false, message: "User not found. They need to sign up first." });
        setInviting(false);
        return;
      }

      // Check if already a member
      const { data: existingMember } = await supabase
        .from("organization_members")
        .select("user_id")
        .eq("user_id", existingUser.id)
        .eq("organization_id", membership.organization_id)
        .single();

      if (existingMember) {
        setResult({ success: false, message: "Already a member" });
        setInviting(false);
        return;
      }

      const { error } = await supabase
        .from("organization_members")
        .insert({
          user_id: existingUser.id,
          organization_id: membership.organization_id,
          role,
        });

      if (error) {
        setResult({ success: false, message: error.message });
      } else {
        setResult({ success: true, message: `${email} added as ${role}` });
        setEmail("");
      }
    } catch (err) {
      setResult({ success: false, message: err instanceof Error ? err.message : "Failed" });
    }
    setInviting(false);
  }

  return (
    <form
      onSubmit={handleInvite}
      className="p-4 rounded-xl space-y-3"
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
    >
      <p className="text-sm font-medium flex items-center gap-2" style={{ color: "var(--foreground)" }}>
        <UserPlus size={16} style={{ color: "var(--accent)" }} />
        Add Team Member
      </p>
      <div className="flex items-center gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="colleague@company.com"
          required
          className="flex-1 rounded-lg px-3 py-2 text-sm"
          style={{ border: "1px solid var(--border)", background: "var(--background)", color: "var(--foreground)" }}
        />
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="rounded-lg px-3 py-2 text-sm"
          style={{ border: "1px solid var(--border)", background: "var(--background)", color: "var(--foreground)" }}
        >
          <option value="member">Member</option>
          <option value="admin">Admin</option>
        </select>
        <button
          type="submit"
          disabled={inviting || !email.trim()}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition hover:opacity-90 disabled:opacity-50"
          style={{ background: "var(--accent)", color: "var(--accent-text)" }}
        >
          {inviting ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />}
          Add
        </button>
      </div>
      {result && (
        <p
          className="text-xs flex items-center gap-1"
          style={{ color: result.success ? "var(--success)" : "var(--danger)" }}
        >
          {result.success && <Check size={12} />}
          {result.message}
        </p>
      )}
    </form>
  );
}
