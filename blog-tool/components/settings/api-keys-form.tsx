"use client";

import { useState } from "react";
import { saveApiKey } from "@/app/actions/settings";
import { Loader2, Eye, EyeOff, Check, X, Pencil, Trash2 } from "lucide-react";

type KeyInfo = {
  key: string;
  label: string;
  isSet: boolean;
  masked: string;
};

type Props = {
  keys: KeyInfo[];
  isAdmin: boolean;
};

export function ApiKeysForm({ keys, isAdmin }: Props) {
  return (
    <div className="space-y-3">
      {keys.map((k) => (
        <ApiKeyRow key={k.key} info={k} isAdmin={isAdmin} />
      ))}
    </div>
  );
}

function ApiKeyRow({ info, isAdmin }: { info: KeyInfo; isAdmin: boolean }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const [showValue, setShowValue] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function handleSave() {
    setSaving(true);
    setMessage("");
    const result = await saveApiKey(info.key, value);
    if (result.success) {
      setMessage("Saved.");
      setEditing(false);
      setValue("");
      setTimeout(() => setMessage(""), 3000);
    } else {
      setMessage(result.error || "Failed.");
    }
    setSaving(false);
  }

  async function handleRemove() {
    if (!confirm(`Remove ${info.label} API key?`)) return;
    setSaving(true);
    const result = await saveApiKey(info.key, "");
    if (result.success) {
      setMessage("Removed.");
      setTimeout(() => setMessage(""), 3000);
    }
    setSaving(false);
  }

  return (
    <div
      className="rounded-lg px-4 py-3"
      style={{ border: "1px solid var(--border)", background: "var(--surface-warm)" }}
    >
      <div className="flex items-center justify-between">
        <div>
          <span className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
            {info.label}
          </span>
          {info.isSet && !editing && (
            <span className="text-xs ml-2 font-mono" style={{ color: "var(--text-muted)" }}>
              {info.masked}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {info.isSet && !editing && (
            <span
              className="text-xs px-2 py-0.5 rounded-full font-medium"
              style={{ background: "var(--success-light)", color: "var(--success)" }}
            >
              Active
            </span>
          )}
          {!info.isSet && !editing && (
            <span
              className="text-xs px-2 py-0.5 rounded-full"
              style={{ background: "var(--surface)", color: "var(--text-muted)" }}
            >
              Not set
            </span>
          )}
          {isAdmin && !editing && (
            <>
              <button
                onClick={() => { setEditing(true); setValue(""); }}
                className="p-1 rounded transition hover:opacity-70"
                style={{ color: "var(--text-muted)" }}
                title={info.isSet ? "Change key" : "Add key"}
              >
                <Pencil size={14} />
              </button>
              {info.isSet && (
                <button
                  onClick={handleRemove}
                  disabled={saving}
                  className="p-1 rounded transition hover:opacity-70"
                  style={{ color: "var(--danger)" }}
                  title="Remove key"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {editing && (
        <div className="mt-3 flex gap-2">
          <div className="relative flex-1">
            <input
              type={showValue ? "text" : "password"}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={info.isSet ? "Enter new key to replace..." : "Paste your API key..."}
              className="w-full rounded-lg px-3 py-2 pr-9 text-sm font-mono"
              style={{ border: "1px solid var(--border)", background: "var(--surface)" }}
              autoFocus
            />
            <button
              type="button"
              onClick={() => setShowValue(!showValue)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2"
              style={{ color: "var(--text-muted)" }}
            >
              {showValue ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
          <button
            onClick={handleSave}
            disabled={saving || !value.trim()}
            className="px-3 py-2 rounded-lg text-sm font-medium transition hover:opacity-90 disabled:opacity-40"
            style={{ background: "var(--accent)", color: "var(--accent-text)" }}
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
          </button>
          <button
            onClick={() => { setEditing(false); setValue(""); setMessage(""); }}
            className="px-3 py-2 rounded-lg text-sm transition hover:opacity-70"
            style={{ border: "1px solid var(--border)", color: "var(--text-muted)" }}
          >
            <X size={14} />
          </button>
        </div>
      )}

      {message && (
        <p
          className="text-xs mt-1.5"
          style={{ color: message === "Saved." || message === "Removed." ? "var(--success)" : "var(--danger)" }}
        >
          {message}
        </p>
      )}
    </div>
  );
}
