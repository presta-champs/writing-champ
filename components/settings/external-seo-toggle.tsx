"use client";

import { useState } from "react";
import { Globe, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function ExternalSeoToggle({
  enabled,
  isAdmin,
}: {
  enabled: boolean;
  isAdmin: boolean;
}) {
  const [on, setOn] = useState(enabled);
  const [saving, setSaving] = useState(false);

  async function toggle() {
    if (!isAdmin) return;
    setSaving(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }

    const { data: membership } = await supabase
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", user.id)
      .limit(1)
      .single();

    if (membership) {
      await supabase
        .from("organizations")
        .update({ external_seo_grader_enabled: !on })
        .eq("id", membership.organization_id);
      setOn(!on);
    }
    setSaving(false);
  }

  return (
    <div
      className="flex items-center justify-between p-4 rounded-xl"
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
    >
      <div className="flex items-center gap-3">
        <Globe size={18} style={{ color: "var(--accent)" }} />
        <div>
          <p className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
            External SEO Grader
          </p>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            Use Surfer SEO to score articles after generation (requires API key)
          </p>
        </div>
      </div>
      <button
        onClick={toggle}
        disabled={saving || !isAdmin}
        className="relative w-11 h-6 rounded-full transition disabled:opacity-50"
        style={{ background: on ? "var(--accent)" : "var(--border)" }}
      >
        {saving ? (
          <Loader2 size={12} className="absolute top-1.5 left-1/2 -translate-x-1/2 animate-spin" style={{ color: "#fff" }} />
        ) : (
          <span
            className="absolute top-0.5 w-5 h-5 rounded-full transition-transform"
            style={{
              background: "#fff",
              transform: on ? "translateX(22px)" : "translateX(2px)",
            }}
          />
        )}
      </button>
    </div>
  );
}
