"use client";

import { useState, useCallback, useEffect } from "react";
import { X, Search, Sparkles, Link as LinkIcon, Loader2, ExternalLink } from "lucide-react";
import type { StockPhoto } from "@/lib/images/stock-search";

type ImageModel = { id: string; label: string; provider: string; costPerImage?: number };

type Tab = "search" | "generate" | "url";

type Props = {
  open: boolean;
  onClose: () => void;
  onSelect: (url: string, alt: string) => void;
  initialQuery?: string;
  primaryKeyword?: string;
};

export function ImagePickerModal({ open, onClose, onSelect, initialQuery = "", primaryKeyword }: Props) {
  const [tab, setTab] = useState<Tab>("search");
  const [query, setQuery] = useState(initialQuery);
  const [photos, setPhotos] = useState<StockPhoto[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [page, setPage] = useState(1);
  const [totalResults, setTotalResults] = useState(0);

  const [genPrompt, setGenPrompt] = useState(initialQuery);
  const [genModel, setGenModel] = useState("");
  const [imageModels, setImageModels] = useState<ImageModel[]>([]);
  const [generating, setGenerating] = useState(false);
  const [generatedUrl, setGeneratedUrl] = useState("");
  const [genError, setGenError] = useState("");

  // Fetch available image models when Generate tab is opened
  useEffect(() => {
    if (tab !== "generate" || imageModels.length > 0) return;
    fetch("/api/models?type=image")
      .then((r) => r.json())
      .then((data) => {
        const models: ImageModel[] = data.models || [];
        setImageModels(models);
        if (models.length > 0 && !genModel) setGenModel(models[0].id);
      })
      .catch(() => {});
  }, [tab]);

  const [urlInput, setUrlInput] = useState("");
  const [altInput, setAltInput] = useState(primaryKeyword || initialQuery);

  const handleSearch = useCallback(async (p = 1) => {
    if (!query.trim()) return;
    setSearching(true);
    setSearchError("");
    try {
      const res = await fetch(`/api/images/search?q=${encodeURIComponent(query)}&page=${p}&per_page=12`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Search failed");
      setPhotos(data.photos || []);
      setTotalResults(data.totalResults || 0);
      setPage(p);
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setSearching(false);
    }
  }, [query]);

  const handleSelectPhoto = useCallback(async (photo: StockPhoto) => {
    // Trigger Unsplash download tracking if needed
    if (photo.source === "unsplash" && photo.downloadUrl) {
      fetch("/api/images/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ downloadUrl: photo.downloadUrl }),
      }).catch(() => {});
    }
    onSelect(photo.url, photo.alt);
    onClose();
  }, [onSelect, onClose]);

  const handleGenerate = useCallback(async () => {
    if (!genPrompt.trim() || !genModel) return;
    setGenerating(true);
    setGenError("");
    setGeneratedUrl("");
    try {
      const res = await fetch("/api/images/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: genPrompt, model: genModel }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Generation failed");
      setGeneratedUrl(data.url);
    } catch (err) {
      setGenError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  }, [genPrompt, genModel]);

  const handleUrlSubmit = useCallback(() => {
    if (!urlInput.trim()) return;
    onSelect(urlInput.trim(), altInput.trim() || "Article image");
    onClose();
  }, [urlInput, altInput, onSelect, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.5)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-3xl max-h-[85vh] rounded-xl overflow-hidden flex flex-col"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
          <h2 className="text-lg font-semibold" style={{ color: "var(--foreground)" }}>Choose Image</h2>
          <button onClick={onClose} className="p-1 rounded hover:opacity-70" style={{ color: "var(--text-muted)" }}>
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-5 pt-3" style={{ borderBottom: "1px solid var(--border)" }}>
          {([
            { id: "search" as Tab, label: "Stock Photos", icon: <Search size={14} /> },
            { id: "generate" as Tab, label: "AI Generate", icon: <Sparkles size={14} /> },
            { id: "url" as Tab, label: "URL", icon: <LinkIcon size={14} /> },
          ]).map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium rounded-t-lg transition"
              style={{
                color: tab === t.id ? "var(--accent)" : "var(--text-muted)",
                background: tab === t.id ? "var(--surface)" : "transparent",
                borderBottom: tab === t.id ? "2px solid var(--accent)" : "2px solid transparent",
              }}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {/* Search Tab */}
          {tab === "search" && (
            <div>
              <div className="flex gap-2 mb-4">
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleSearch(1); }}
                  placeholder="Search stock photos..."
                  className="flex-1 rounded-lg px-3 py-2 text-sm"
                  style={{ border: "1px solid var(--border)", background: "var(--background)" }}
                />
                <button
                  onClick={() => handleSearch(1)}
                  disabled={searching || !query.trim()}
                  className="px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-1.5 disabled:opacity-40"
                  style={{ background: "var(--accent)", color: "var(--accent-text)" }}
                >
                  {searching ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                  Search
                </button>
              </div>

              {searchError && (
                <div className="text-sm p-3 rounded-lg mb-4" style={{ background: "var(--danger-light)", color: "var(--danger)" }}>
                  {searchError}
                </div>
              )}

              {photos.length > 0 && (
                <>
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    {photos.map((photo) => (
                      <button
                        key={photo.id}
                        onClick={() => handleSelectPhoto(photo)}
                        className="group relative rounded-lg overflow-hidden aspect-[3/2] transition hover:ring-2"
                        style={{ background: "var(--surface-warm)", "--tw-ring-color": "var(--accent)" } as React.CSSProperties}
                      >
                        <img
                          src={photo.thumbUrl}
                          alt={photo.alt}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2 opacity-0 group-hover:opacity-100 transition">
                          <p className="text-white text-[10px] truncate">
                            {photo.photographer}
                            <span className="opacity-60 ml-1">({photo.source})</span>
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>

                  {/* Pagination */}
                  <div className="flex items-center justify-between text-sm" style={{ color: "var(--text-muted)" }}>
                    <span>{totalResults.toLocaleString()} results</span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleSearch(page - 1)}
                        disabled={page <= 1 || searching}
                        className="px-3 py-1 rounded text-sm disabled:opacity-30"
                        style={{ border: "1px solid var(--border)" }}
                      >
                        Prev
                      </button>
                      <span className="px-2 py-1">Page {page}</span>
                      <button
                        onClick={() => handleSearch(page + 1)}
                        disabled={searching || photos.length < 12}
                        className="px-3 py-1 rounded text-sm disabled:opacity-30"
                        style={{ border: "1px solid var(--border)" }}
                      >
                        Next
                      </button>
                    </div>
                  </div>
                </>
              )}

              {!searching && photos.length === 0 && query && (
                <p className="text-sm text-center py-8" style={{ color: "var(--text-muted)" }}>
                  No photos found. Try a different search term.
                </p>
              )}
            </div>
          )}

          {/* Generate Tab */}
          {tab === "generate" && (
            <div>
              <p className="text-sm mb-3" style={{ color: "var(--text-muted)" }}>
                Describe the image you want and AI will generate it.
              </p>

              {/* Model selector */}
              <div className="mb-3">
                <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
                  Model
                </label>
                {imageModels.length === 0 ? (
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                    No image generation API keys configured. Add a Google AI or OpenAI key in Settings.
                  </p>
                ) : (
                  <>
                    <select
                      value={genModel}
                      onChange={(e) => setGenModel(e.target.value)}
                      className="w-full rounded-lg px-3 py-2 text-sm"
                      style={{ border: "1px solid var(--border)", background: "var(--background)" }}
                    >
                      {imageModels.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.label} ({m.provider})
                        </option>
                      ))}
                    </select>
                    {(() => {
                      const sel = imageModels.find((m) => m.id === genModel);
                      return sel?.costPerImage ? (
                        <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                          ≈ ${sel.costPerImage.toFixed(2)} per image
                        </p>
                      ) : null;
                    })()}
                  </>
                )}
              </div>

              <div className="flex gap-2 mb-4">
                <input
                  type="text"
                  value={genPrompt}
                  onChange={(e) => setGenPrompt(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleGenerate(); }}
                  placeholder="e.g. developer reviewing code on dual monitors in modern office"
                  className="flex-1 rounded-lg px-3 py-2 text-sm"
                  style={{ border: "1px solid var(--border)", background: "var(--background)" }}
                />
                <button
                  onClick={handleGenerate}
                  disabled={generating || !genPrompt.trim() || !genModel}
                  className="px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-1.5 disabled:opacity-40"
                  style={{ background: "var(--accent)", color: "var(--accent-text)" }}
                >
                  {generating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                  Generate
                </button>
              </div>

              {genError && (
                <div className="text-sm p-3 rounded-lg mb-4" style={{ background: "var(--danger-light)", color: "var(--danger)" }}>
                  {genError}
                </div>
              )}

              {generating && (
                <div className="flex items-center justify-center py-12" style={{ color: "var(--text-muted)" }}>
                  <Loader2 size={24} className="animate-spin mr-2" />
                  <span className="text-sm">Generating image... this may take a moment</span>
                </div>
              )}

              {generatedUrl && (
                <div className="space-y-3">
                  <div className="rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)" }}>
                    <img src={generatedUrl} alt={genPrompt} className="w-full" />
                  </div>
                  <button
                    onClick={() => {
                      onSelect(generatedUrl, genPrompt);
                      onClose();
                    }}
                    className="w-full py-2.5 rounded-lg text-sm font-medium"
                    style={{ background: "var(--accent)", color: "var(--accent-text)" }}
                  >
                    Use This Image
                  </button>
                </div>
              )}
            </div>
          )}

          {/* URL Tab */}
          {tab === "url" && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Image URL</label>
                <input
                  type="url"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="https://example.com/image.jpg"
                  className="w-full rounded-lg px-3 py-2 text-sm"
                  style={{ border: "1px solid var(--border)", background: "var(--background)" }}
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Alt Text</label>
                <input
                  type="text"
                  value={altInput}
                  onChange={(e) => setAltInput(e.target.value)}
                  placeholder="Descriptive alt text for accessibility"
                  className="w-full rounded-lg px-3 py-2 text-sm"
                  style={{ border: "1px solid var(--border)", background: "var(--background)" }}
                />
              </div>
              {urlInput && (
                <div className="rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)" }}>
                  <img src={urlInput} alt={altInput} className="w-full max-h-64 object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                </div>
              )}
              <button
                onClick={handleUrlSubmit}
                disabled={!urlInput.trim()}
                className="w-full py-2.5 rounded-lg text-sm font-medium disabled:opacity-40"
                style={{ background: "var(--accent)", color: "var(--accent-text)" }}
              >
                Insert Image
              </button>
            </div>
          )}
        </div>

        {/* Footer attribution */}
        {tab === "search" && photos.length > 0 && (
          <div className="px-5 py-2 text-[10px] flex items-center gap-3" style={{ borderTop: "1px solid var(--border)", color: "var(--text-muted)" }}>
            <span>Photos from</span>
            <a href="https://unsplash.com" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 hover:underline">
              Unsplash <ExternalLink size={8} />
            </a>
            <a href="https://www.pexels.com" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 hover:underline">
              Pexels <ExternalLink size={8} />
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
