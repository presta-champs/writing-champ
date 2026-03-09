"use client";

import { useState, useEffect } from "react";
import { saveFieldMapping, getFieldMapping } from "@/app/actions/mcp";
import { FIELD_MAPPING_DEFAULTS } from "@/lib/mcp/types";
import type { FieldMapping } from "@/lib/mcp/types";
import { Settings2, Loader2, CheckCircle2 } from "lucide-react";

type FieldMappingEditorProps = {
  websiteId: string;
  isAdmin: boolean;
};

const FIELD_LABELS: { key: keyof FieldMapping; label: string; description: string }[] = [
  { key: "title", label: "Title", description: "Article headline" },
  { key: "content", label: "Content", description: "Article body (HTML)" },
  { key: "slug", label: "Slug", description: "URL-friendly identifier" },
  { key: "excerpt", label: "Excerpt", description: "Short summary" },
  { key: "status", label: "Status", description: "Publication status (draft, publish)" },
  { key: "meta_title", label: "Meta Title", description: "SEO title tag" },
  { key: "meta_description", label: "Meta Description", description: "SEO meta description" },
  { key: "date", label: "Date", description: "Publication date (ISO 8601)" },
];

export function FieldMappingEditor({ websiteId, isAdmin }: FieldMappingEditorProps) {
  const [mapping, setMapping] = useState<Required<FieldMapping>>({ ...FIELD_MAPPING_DEFAULTS });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ text: string; isError: boolean } | null>(null);

  useEffect(() => {
    async function load() {
      const result = await getFieldMapping(websiteId);
      if (result.success && result.mapping) {
        setMapping({ ...FIELD_MAPPING_DEFAULTS, ...result.mapping });
      }
      setLoading(false);
    }
    load();
  }, [websiteId]);

  async function handleSave() {
    setSaving(true);
    setMessage(null);

    // Only include fields that differ from defaults
    const customMapping: FieldMapping = {};
    for (const field of FIELD_LABELS) {
      const value = mapping[field.key];
      if (value && value !== FIELD_MAPPING_DEFAULTS[field.key]) {
        customMapping[field.key] = value;
      }
    }

    const result = await saveFieldMapping(websiteId, customMapping);
    if (result.success) {
      setMessage({ text: "Field mapping saved.", isError: false });
    } else {
      setMessage({ text: result.error || "Failed to save field mapping.", isError: true });
    }
    setSaving(false);
  }

  function handleReset() {
    setMapping({ ...FIELD_MAPPING_DEFAULTS });
    setMessage(null);
  }

  function updateField(key: keyof FieldMapping, value: string) {
    setMapping((prev) => ({ ...prev, [key]: value }));
    setMessage(null);
  }

  if (loading) {
    return (
      <div
        className="rounded-xl p-6"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <div className="flex items-center gap-2">
          <Loader2 size={16} className="animate-spin" style={{ color: "var(--text-muted)" }} />
          <span className="text-sm" style={{ color: "var(--text-muted)" }}>
            Loading field mapping...
          </span>
        </div>
      </div>
    );
  }

  return (
    <div
      className="rounded-xl p-6"
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
    >
      <div className="flex items-center gap-2 mb-2">
        <Settings2 size={18} style={{ color: "var(--accent)" }} />
        <h3 className="text-lg font-semibold" style={{ color: "var(--foreground)" }}>
          Field Mapping
        </h3>
      </div>

      <p className="text-sm mb-5" style={{ color: "var(--text-muted)" }}>
        Map WritingChamps fields to your CMS field names. The webhook payload will use your custom
        field names instead of the defaults.
      </p>

      <div
        className="rounded-lg overflow-hidden"
        style={{ border: "1px solid var(--border)" }}
      >
        {/* Table header */}
        <div
          className="grid grid-cols-[1fr_1fr] gap-4 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide"
          style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)", color: "var(--text-muted)" }}
        >
          <span>WritingChamps Field</span>
          <span>Your CMS Field</span>
        </div>

        {/* Table rows */}
        {FIELD_LABELS.map((field, index) => (
          <div
            key={field.key}
            className="grid grid-cols-[1fr_1fr] gap-4 px-4 py-3 items-center"
            style={{
              borderBottom: index < FIELD_LABELS.length - 1 ? "1px solid var(--border)" : "none",
            }}
          >
            <div>
              <span className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
                {field.label}
              </span>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                {field.description}
              </p>
            </div>
            <input
              type="text"
              value={mapping[field.key] || ""}
              onChange={(e) => updateField(field.key, e.target.value)}
              disabled={!isAdmin}
              placeholder={FIELD_MAPPING_DEFAULTS[field.key]}
              className="w-full rounded-lg px-3 py-1.5 text-sm disabled:opacity-50"
              style={{
                border: "1px solid var(--border)",
                background: "var(--background)",
                color: "var(--foreground)",
              }}
            />
          </div>
        ))}
      </div>

      {message && (
        <p
          className="text-sm mt-3"
          style={{ color: message.isError ? "var(--danger)" : "var(--success)" }}
        >
          {message.text}
        </p>
      )}

      {isAdmin && (
        <div className="flex items-center gap-2 mt-4">
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition hover:opacity-90 disabled:opacity-50"
            style={{ background: "var(--accent)", color: "var(--accent-text)" }}
          >
            {saving ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <CheckCircle2 size={14} />
            )}
            {saving ? "Saving..." : "Save Mapping"}
          </button>
          <button
            onClick={handleReset}
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition hover:opacity-80 disabled:opacity-50"
            style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}
          >
            Reset to Defaults
          </button>
        </div>
      )}
    </div>
  );
}
