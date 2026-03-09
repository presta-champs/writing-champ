"use client";

import { useState, useEffect } from "react";
import { Cpu, Loader2, Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function DefaultModelSelector({
  currentModel,
  isAdmin,
}: {
  currentModel: string;
  isAdmin: boolean;
}) {
  const [model, setModel] = useState(currentModel || "");
  const [models, setModels] = useState<{ id: string; name: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/models?type=text");
        if (res.ok) {
          const data = await res.json();
          setModels(data.models || []);
        }
      } catch { /* ignore */ }
    }
    load();
  }, []);

  async function handleSave() {
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
        .update({ default_model: model || null })
        .eq("id", membership.organization_id);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
    setSaving(false);
  }

  return (
    <div
      className="p-4 rounded-xl space-y-3"
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
    >
      <div className="flex items-center gap-2">
        <Cpu size={18} style={{ color: "var(--accent)" }} />
        <p className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
          Default AI Model
        </p>
      </div>
      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
        The default model used for article generation when no override is set.
      </p>
      <div className="flex items-center gap-2">
        <select
          value={model}
          onChange={(e) => setModel(e.target.value)}
          disabled={!isAdmin}
          className="flex-1 rounded-lg px-3 py-2 text-sm disabled:opacity-50"
          style={{ border: "1px solid var(--border)", background: "var(--background)", color: "var(--foreground)" }}
        >
          <option value="">Auto (best available)</option>
          {models.map((m) => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>
        {isAdmin && (
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition hover:opacity-90 disabled:opacity-50"
            style={{ background: "var(--accent)", color: "var(--accent-text)" }}
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : saved ? <Check size={14} /> : null}
            {saved ? "Saved" : "Save"}
          </button>
        )}
      </div>
    </div>
  );
}
