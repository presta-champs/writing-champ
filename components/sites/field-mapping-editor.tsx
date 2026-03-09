"use client";

import { useState, useEffect } from "react";
import { Settings2, Loader2, Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { FieldMapping } from "@/lib/mcp/types";
import { FIELD_MAPPING_DEFAULTS } from "@/lib/mcp/types";

const FIELD_LABELS: Record<keyof Required<FieldMapping>, string> = {
  title: "Title",
  content: "Content / Body",
  slug: "Slug / URL key",
  excerpt: "Excerpt / Summary",
  status: "Status",
  meta_title: "Meta Title (SEO)",
  meta_description: "Meta Description (SEO)",
  date: "Publish Date",
};

export function FieldMappingEditor({
  websiteId,
  isAdmin,
}: {
  websiteId: string;
  isAdmin: boolean;
}) {
  const [mapping, setMapping] = useState<FieldMapping>({ ...FIELD_MAPPING_DEFAULTS });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data } = await supabase
        .from("websites")
        .select("mcp_field_mapping")
        .eq("id", websiteId)
        .single();

      if (data?.mcp_field_mapping) {
        setMapping({ ...FIELD_MAPPING_DEFAULTS, ...(data.mcp_field_mapping as FieldMapping) });
      }
      setLoading(false);
    }
    load();
  }, [websiteId]);

  async function handleSave() {
    if (!isAdmin) return;
    setSaving(true);
    const supabase = createClient();
    await supabase
      .from("websites")
      .update({ mcp_field_mapping: mapping })
      .eq("id", websiteId);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  if (loading) return null;

  return (
    <div
      className="rounded-xl p-6"
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
    >
      <div className="flex items-center gap-2 mb-4">
        <Settings2 size={18} style={{ color: "var(--accent)" }} />
        <h3 className="text-lg font-semibold" style={{ color: "var(--foreground)" }}>
          Field Mapping
        </h3>
      </div>
      <p className="text-sm mb-4" style={{ color: "var(--text-muted)" }}>
        Map article fields to your CMS field names. Defaults work for standard WordPress.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {(Object.keys(FIELD_MAPPING_DEFAULTS) as (keyof FieldMapping)[]).map((field) => (
          <div key={field}>
            <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
              {FIELD_LABELS[field]}
            </label>
            <input
              type="text"
              value={mapping[field] || ""}
              onChange={(e) => setMapping((prev) => ({ ...prev, [field]: e.target.value }))}
              disabled={!isAdmin}
              placeholder={FIELD_MAPPING_DEFAULTS[field]}
              className="w-full rounded-lg px-3 py-1.5 text-sm disabled:opacity-50"
              style={{ border: "1px solid var(--border)", background: "var(--background)", color: "var(--foreground)" }}
            />
          </div>
        ))}
      </div>

      {isAdmin && (
        <button
          onClick={handleSave}
          disabled={saving}
          className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition hover:opacity-90 disabled:opacity-50"
          style={{ background: "var(--accent)", color: "var(--accent-text)" }}
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : saved ? <Check size={14} /> : null}
          {saved ? "Saved" : "Save Mapping"}
        </button>
      )}
    </div>
  );
}
