"use client";

import { useState } from "react";
import { updateDefaultModel } from "@/app/actions/settings";
import { Loader2, Check } from "lucide-react";

const MODEL_GROUPS = [
  {
    provider: "Anthropic",
    models: [
      { id: "claude-sonnet-4-20250514", label: "Claude Sonnet 4" },
      { id: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5" },
    ],
  },
  {
    provider: "OpenAI",
    models: [
      { id: "gpt-4o", label: "GPT-4o" },
      { id: "gpt-4o-mini", label: "GPT-4o Mini" },
      { id: "gpt-4.1", label: "GPT-4.1" },
      { id: "gpt-4.1-mini", label: "GPT-4.1 Mini" },
    ],
  },
  {
    provider: "Gemini",
    models: [
      { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
      { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
      { id: "gemini-2.0-flash", label: "Gemini 2.0 Flash" },
    ],
  },
];

type DefaultModelSelectorProps = {
  currentModel: string | null;
  isAdmin: boolean;
};

export function DefaultModelSelector({ currentModel, isAdmin }: DefaultModelSelectorProps) {
  const [selected, setSelected] = useState<string>(currentModel || "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasChanged = (selected || null) !== (currentModel || null);

  async function handleSave() {
    if (!isAdmin) return;

    setSaving(true);
    setError(null);
    setSaved(false);

    const result = await updateDefaultModel(selected || null);

    if (result.success) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } else {
      setError(result.error || "Failed to update default model");
    }

    setSaving(false);
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
          Default AI Model
        </p>
        <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
          Set an organization-wide default model for article generation.
          Users can still override this per-article if no default is set.
        </p>
      </div>

      <select
        value={selected}
        onChange={(e) => {
          setSelected(e.target.value);
          setSaved(false);
          setError(null);
        }}
        disabled={!isAdmin || saving}
        className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none disabled:opacity-50"
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          color: "var(--foreground)",
        }}
      >
        <option value="">No default (use model picker)</option>
        {MODEL_GROUPS.map((group) => (
          <optgroup key={group.provider} label={group.provider}>
            {group.models.map((model) => (
              <option key={model.id} value={model.id}>
                {model.label}
              </option>
            ))}
          </optgroup>
        ))}
      </select>

      <div className="flex items-center gap-3">
        {isAdmin && (
          <button
            onClick={handleSave}
            disabled={!hasChanged || saving}
            className="px-4 py-1.5 rounded-lg text-sm font-medium transition-opacity disabled:opacity-40"
            style={{
              background: "var(--accent)",
              color: "var(--accent-text)",
            }}
          >
            {saving ? (
              <span className="flex items-center gap-1.5">
                <Loader2 size={14} className="animate-spin" />
                Saving...
              </span>
            ) : (
              "Save"
            )}
          </button>
        )}

        {saved && (
          <span
            className="flex items-center gap-1 text-xs font-medium"
            style={{ color: "var(--accent)" }}
          >
            <Check size={14} />
            Saved
          </span>
        )}
      </div>

      {!isAdmin && (
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          Only admins can change the default model.
        </p>
      )}

      {error && (
        <p className="text-xs" style={{ color: "var(--danger)" }}>
          {error}
        </p>
      )}
    </div>
  );
}
