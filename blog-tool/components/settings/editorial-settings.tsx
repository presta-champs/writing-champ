"use client";

import { useState } from "react";
import { updateEditorialGuidelines } from "@/app/actions/settings";
import { BookOpenText, Plus, X } from "lucide-react";

type EditorialData = {
  editorial_pov: string | null;
  editorial_person_rules: string;
  editorial_commercial_tone: string;
  editorial_dos: string[];
  editorial_donts: string[];
  editorial_custom_rules: string;
};

export function EditorialSettings({
  initial,
  isAdmin,
}: {
  initial: EditorialData;
  isAdmin: boolean;
}) {
  const [pov, setPov] = useState(initial.editorial_pov || "");
  const [personRules, setPersonRules] = useState(initial.editorial_person_rules);
  const [commercialTone, setCommercialTone] = useState(initial.editorial_commercial_tone);
  const [dos, setDos] = useState<string[]>(initial.editorial_dos);
  const [donts, setDonts] = useState<string[]>(initial.editorial_donts);
  const [customRules, setCustomRules] = useState(initial.editorial_custom_rules);
  const [newDo, setNewDo] = useState("");
  const [newDont, setNewDont] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function handleSubmit(formData: FormData) {
    setSaving(true);
    setMessage("");
    formData.set("editorial_dos", JSON.stringify(dos));
    formData.set("editorial_donts", JSON.stringify(donts));
    const result = await updateEditorialGuidelines(formData);
    setMessage(result.success ? "Editorial guidelines saved." : result.error || "Failed to save.");
    setSaving(false);
  }

  function addDo() {
    const trimmed = newDo.trim();
    if (trimmed && !dos.includes(trimmed)) {
      setDos([...dos, trimmed]);
      setNewDo("");
    }
  }

  function addDont() {
    const trimmed = newDont.trim();
    if (trimmed && !donts.includes(trimmed)) {
      setDonts([...donts, trimmed]);
      setNewDont("");
    }
  }

  const disabled = !isAdmin;

  return (
    <form action={handleSubmit} className="space-y-5">
      {/* POV */}
      <div>
        <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
          Point of View
        </label>
        <select
          name="editorial_pov"
          value={pov}
          onChange={(e) => setPov(e.target.value)}
          disabled={disabled}
          className="w-full rounded-lg px-3 py-2 text-sm"
          style={{ border: "1px solid var(--border)", background: "var(--surface)", color: "var(--foreground)" }}
        >
          <option value="">Not set (persona decides)</option>
          <option value="first_person">First person (I / we)</option>
          <option value="second_person">Second person (you / your)</option>
          <option value="third_person">Third person (the company / they)</option>
        </select>
      </div>

      {/* POV details */}
      {pov && (
        <div>
          <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
            POV Details (optional)
          </label>
          <input
            type="text"
            name="editorial_person_rules"
            value={personRules}
            onChange={(e) => setPersonRules(e.target.value)}
            disabled={disabled}
            placeholder='e.g. "Never refer to the company as we — use the brand name instead"'
            className="w-full rounded-lg px-3 py-2 text-sm"
            style={{ border: "1px solid var(--border)", background: "var(--surface)", color: "var(--foreground)" }}
          />
        </div>
      )}

      {/* Commercial tone */}
      <div>
        <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
          Commercial Language Policy
        </label>
        <textarea
          name="editorial_commercial_tone"
          value={commercialTone}
          onChange={(e) => setCommercialTone(e.target.value)}
          disabled={disabled}
          rows={2}
          placeholder='e.g. "Avoid salesy language. Never use superlatives like best/greatest. Position products as helpful, not revolutionary."'
          className="w-full rounded-lg px-3 py-2 text-sm"
          style={{ border: "1px solid var(--border)", background: "var(--surface)", color: "var(--foreground)" }}
        />
      </div>

      {/* Always Do */}
      <div>
        <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
          Always Do
        </label>
        <p className="text-xs mb-2" style={{ color: "var(--text-muted)" }}>
          Rules every article must follow, regardless of persona.
        </p>
        <div className="space-y-1.5 mb-2">
          {dos.map((rule, i) => (
            <div
              key={i}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm"
              style={{ background: "var(--success-light, var(--surface-warm))", color: "var(--foreground)" }}
            >
              <span className="flex-1">{rule}</span>
              {!disabled && (
                <button type="button" onClick={() => setDos(dos.filter((_, j) => j !== i))} className="opacity-50 hover:opacity-100">
                  <X size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
        {!disabled && (
          <div className="flex gap-2">
            <input
              type="text"
              value={newDo}
              onChange={(e) => setNewDo(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addDo(); } }}
              placeholder="Add a rule..."
              className="flex-1 rounded-lg px-3 py-1.5 text-sm"
              style={{ border: "1px solid var(--border)", background: "var(--surface)" }}
            />
            <button
              type="button"
              onClick={addDo}
              className="px-3 py-1.5 rounded-lg text-sm font-medium"
              style={{ background: "var(--accent-light)", color: "var(--accent)" }}
            >
              <Plus size={14} />
            </button>
          </div>
        )}
      </div>

      {/* Never Do */}
      <div>
        <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
          Never Do
        </label>
        <p className="text-xs mb-2" style={{ color: "var(--text-muted)" }}>
          Things no article should ever contain.
        </p>
        <div className="space-y-1.5 mb-2">
          {donts.map((rule, i) => (
            <div
              key={i}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm"
              style={{ background: "var(--danger-light, var(--surface-warm))", color: "var(--foreground)" }}
            >
              <span className="flex-1">{rule}</span>
              {!disabled && (
                <button type="button" onClick={() => setDonts(donts.filter((_, j) => j !== i))} className="opacity-50 hover:opacity-100">
                  <X size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
        {!disabled && (
          <div className="flex gap-2">
            <input
              type="text"
              value={newDont}
              onChange={(e) => setNewDont(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addDont(); } }}
              placeholder="Add a rule..."
              className="flex-1 rounded-lg px-3 py-1.5 text-sm"
              style={{ border: "1px solid var(--border)", background: "var(--surface)" }}
            />
            <button
              type="button"
              onClick={addDont}
              className="px-3 py-1.5 rounded-lg text-sm font-medium"
              style={{ background: "var(--accent-light)", color: "var(--accent)" }}
            >
              <Plus size={14} />
            </button>
          </div>
        )}
      </div>

      {/* Custom rules */}
      <div>
        <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
          Additional Editorial Rules (free-form)
        </label>
        <textarea
          name="editorial_custom_rules"
          value={customRules}
          onChange={(e) => setCustomRules(e.target.value)}
          disabled={disabled}
          rows={3}
          placeholder='e.g. "Always cite sources. Use data to back claims. Include a CTA in the conclusion."'
          className="w-full rounded-lg px-3 py-2 text-sm"
          style={{ border: "1px solid var(--border)", background: "var(--surface)", color: "var(--foreground)" }}
        />
      </div>

      {/* Save */}
      <div className="flex items-center justify-between pt-2">
        <p
          className="text-sm"
          style={{ color: message.includes("Failed") || message.includes("Only") ? "var(--danger)" : "var(--success)" }}
        >
          {message}
        </p>
        <button
          type="submit"
          disabled={saving || disabled}
          className="px-5 py-2 rounded-lg font-medium text-sm transition hover:opacity-90 disabled:opacity-50"
          style={{ background: "var(--accent)", color: "var(--accent-text)" }}
        >
          {saving ? "Saving..." : "Save Guidelines"}
        </button>
      </div>
    </form>
  );
}
