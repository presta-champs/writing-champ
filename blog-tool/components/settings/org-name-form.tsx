"use client";

import { useState } from "react";
import { updateOrgName } from "@/app/actions/settings";
import { Loader2 } from "lucide-react";

type Props = {
  currentName: string;
  isAdmin: boolean;
};

export function OrgNameForm({ currentName, isAdmin }: Props) {
  const [name, setName] = useState(currentName);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function handleSave() {
    if (!name.trim() || name === currentName) return;
    setSaving(true);
    setMessage("");
    const result = await updateOrgName(name);
    setMessage(result.success ? "Saved." : result.error || "Failed.");
    setSaving(false);
    if (result.success) setTimeout(() => setMessage(""), 3000);
  }

  return (
    <div>
      <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
        Workspace Name
      </label>
      <div className="flex gap-2">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={!isAdmin}
          className="flex-1 rounded-lg px-3 py-2 text-sm disabled:opacity-60"
          style={{ border: "1px solid var(--border)", background: "var(--surface)" }}
        />
        {isAdmin && (
          <button
            onClick={handleSave}
            disabled={saving || !name.trim() || name === currentName}
            className="px-4 py-2 rounded-lg text-sm font-medium transition hover:opacity-90 disabled:opacity-40"
            style={{ background: "var(--accent)", color: "var(--accent-text)" }}
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : "Save"}
          </button>
        )}
      </div>
      {message && (
        <p
          className="text-xs mt-1.5"
          style={{ color: message === "Saved." ? "var(--success)" : "var(--danger)" }}
        >
          {message}
        </p>
      )}
    </div>
  );
}
