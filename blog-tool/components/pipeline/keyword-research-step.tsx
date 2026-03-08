"use client";

import { useState } from "react";
import { Search, Loader2, Check, X, ArrowRight, SkipForward } from "lucide-react";

type KeywordData = {
  keyword: string;
  role?: "primary" | "secondary" | "ignore";
  reason?: string;
};

type Props = {
  topic: string;
  currentPrimary: string;
  currentSecondary: string;
  onApply: (primary: string, secondary: string[]) => void;
  onSkip: () => void;
};

export function KeywordResearchStep({
  topic,
  currentPrimary,
  currentSecondary,
  onApply,
  onSkip,
}: Props) {
  const [seed, setSeed] = useState(currentPrimary || topic);
  const [country, setCountry] = useState("us");
  const [loading, setLoading] = useState(false);
  const [keywords, setKeywords] = useState<KeywordData[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  async function handleSearch() {
    if (!seed.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/keywords", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seed: seed.trim(), country, topic }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Keyword research failed");
      }
      const data = await res.json();
      setKeywords(data.assignments || []);
      setSearched(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Keyword research failed");
    } finally {
      setLoading(false);
    }
  }

  function toggleRole(index: number, role: "primary" | "secondary" | "ignore") {
    setKeywords((prev) =>
      prev.map((kw, i) => {
        if (i !== index) {
          if (role === "primary" && kw.role === "primary") {
            return { ...kw, role: "secondary" };
          }
          return kw;
        }
        return { ...kw, role: kw.role === role ? "ignore" : role };
      })
    );
  }

  function handleApply() {
    const primary = keywords.find((kw) => kw.role === "primary");
    const secondary = keywords.filter((kw) => kw.role === "secondary").map((kw) => kw.keyword);
    onApply(primary?.keyword || currentPrimary, secondary.length > 0 ? secondary : currentSecondary.split(",").map((s) => s.trim()).filter(Boolean));
  }

  const hasPrimary = keywords.some((kw) => kw.role === "primary");

  return (
    <div
      className="rounded-xl p-6"
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
    >
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold" style={{ color: "var(--foreground)" }}>
          Keyword Research
        </h2>
        <button
          onClick={onSkip}
          className="inline-flex items-center gap-1.5 text-sm hover:underline"
          style={{ color: "var(--text-muted)" }}
        >
          <SkipForward size={14} /> Skip — use manual keywords
        </button>
      </div>

      <p className="text-sm mb-4" style={{ color: "var(--text-muted)" }}>
        Search for real Google suggestions related to your topic. AI will recommend a primary
        keyword and secondary keywords to optimize your article.
      </p>

      {/* Search bar */}
      <div className="flex gap-3 mb-4">
        <input
          type="text"
          value={seed}
          onChange={(e) => setSeed(e.target.value)}
          placeholder="Enter seed keyword..."
          className="flex-1 rounded-lg px-3 py-2 text-sm"
          style={{ border: "1px solid var(--border)", background: "var(--background)" }}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
        />
        <select
          value={country}
          onChange={(e) => setCountry(e.target.value)}
          className="rounded-lg px-3 py-2 text-sm"
          style={{ border: "1px solid var(--border)", background: "var(--background)" }}
        >
          <option value="us">US</option>
          <option value="gb">UK</option>
          <option value="de">DE</option>
          <option value="fr">FR</option>
          <option value="es">ES</option>
          <option value="it">IT</option>
          <option value="nl">NL</option>
          <option value="au">AU</option>
          <option value="ca">CA</option>
        </select>
        <button
          onClick={handleSearch}
          disabled={loading || !seed.trim()}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition hover:opacity-90 disabled:opacity-50"
          style={{ background: "var(--accent)", color: "var(--accent-text)" }}
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
          {loading ? "Searching..." : "Search"}
        </button>
      </div>

      {error && (
        <div
          className="rounded-lg p-3 mb-4 text-sm"
          style={{ background: "var(--danger-light)", color: "var(--danger)" }}
        >
          {error}
        </div>
      )}

      {/* Results */}
      {searched && keywords.length > 0 && (
        <>
          <div className="overflow-y-auto mb-4" style={{ maxHeight: "400px" }}>
            <div className="flex flex-col gap-1">
              {keywords.map((kw, i) => (
                <div
                  key={kw.keyword}
                  className="flex items-center justify-between py-2 px-3 rounded-lg"
                  style={{
                    background:
                      kw.role === "primary"
                        ? "var(--accent-light)"
                        : kw.role === "secondary"
                        ? "var(--surface-warm)"
                        : "transparent",
                    borderBottom: "1px solid var(--border)",
                  }}
                >
                  <div className="flex-1 min-w-0">
                    <span className="text-sm" style={{ color: "var(--foreground)" }}>
                      {kw.keyword}
                    </span>
                    {kw.reason && (
                      <span className="text-xs ml-2" style={{ color: "var(--text-muted)" }}>
                        — {kw.reason}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 ml-3 shrink-0">
                    <button
                      onClick={() => toggleRole(i, "primary")}
                      className="px-2 py-0.5 rounded text-xs font-medium transition"
                      style={
                        kw.role === "primary"
                          ? { background: "var(--accent)", color: "var(--accent-text)" }
                          : { border: "1px solid var(--border)", color: "var(--text-muted)" }
                      }
                      title="Set as primary"
                    >
                      P
                    </button>
                    <button
                      onClick={() => toggleRole(i, "secondary")}
                      className="px-2 py-0.5 rounded text-xs font-medium transition"
                      style={
                        kw.role === "secondary"
                          ? { background: "var(--success)", color: "#fff" }
                          : { border: "1px solid var(--border)", color: "var(--text-muted)" }
                      }
                      title="Set as secondary"
                    >
                      S
                    </button>
                    <button
                      onClick={() => toggleRole(i, "ignore")}
                      className="px-1 py-0.5 rounded text-xs transition"
                      style={{ color: "var(--text-muted)" }}
                      title="Ignore"
                    >
                      <X size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between pt-3" style={{ borderTop: "1px solid var(--border)" }}>
            <div className="text-xs" style={{ color: "var(--text-muted)" }}>
              {hasPrimary ? (
                <span style={{ color: "var(--success)" }}>
                  <Check size={12} className="inline mr-1" />
                  Primary keyword selected
                </span>
              ) : (
                "Select a primary keyword (P) to continue"
              )}
            </div>
            <button
              onClick={handleApply}
              disabled={!hasPrimary}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition hover:opacity-90 disabled:opacity-50"
              style={{ background: "var(--accent)", color: "var(--accent-text)" }}
            >
              Apply Keywords <ArrowRight size={14} />
            </button>
          </div>
        </>
      )}

      {searched && keywords.length === 0 && !loading && !error && (
        <div className="text-center py-8">
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            No keywords found. Try a different seed keyword.
          </p>
        </div>
      )}
    </div>
  );
}
