"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";

type ExternalSeoToggleProps = {
  enabled: boolean;
  isAdmin: boolean;
};

export function ExternalSeoToggle({ enabled, isAdmin }: ExternalSeoToggleProps) {
  const [isEnabled, setIsEnabled] = useState(enabled);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleToggle() {
    if (!isAdmin) return;

    const newValue = !isEnabled;
    setSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/organizations/external-seo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: newValue }),
      });
      const data = await res.json();
      if (data.success) {
        setIsEnabled(newValue);
      } else {
        setError(data.error || "Failed to update");
      }
    } catch {
      setError("Failed to update setting");
    }
    setSaving(false);
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
            External SEO Grading (Surfer SEO)
          </p>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
            When enabled, the SEO audit will also fetch a content score from Surfer SEO.
          </p>
        </div>
        <button
          onClick={handleToggle}
          disabled={!isAdmin || saving}
          className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none disabled:opacity-50"
          style={{
            background: isEnabled ? "var(--accent)" : "var(--border)",
          }}
          aria-label="Toggle external SEO grading"
        >
          {saving ? (
            <span className="absolute inset-0 flex items-center justify-center">
              <Loader2 size={12} className="animate-spin" style={{ color: "var(--accent-text)" }} />
            </span>
          ) : (
            <span
              className="inline-block h-4 w-4 rounded-full transition-transform duration-200"
              style={{
                background: isEnabled ? "var(--accent-text)" : "var(--text-muted)",
                transform: isEnabled ? "translateX(1.375rem)" : "translateX(0.25rem)",
              }}
            />
          )}
        </button>
      </div>
      {isEnabled && (
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          Add your Surfer SEO API key in the API Keys section above.
        </p>
      )}
      {!isAdmin && (
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          Only admins can change this setting.
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
