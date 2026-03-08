"use client";

import { useState, useEffect } from "react";
import {
  Plus,
  Trash2,
  ExternalLink,
  FileText,
  Link as LinkIcon,
  X,
} from "lucide-react";

type ContentIndexEntry = {
  id: string;
  website_id: string;
  post_title: string;
  post_url: string;
  post_excerpt: string | null;
  fetched_at: string;
};

export function ContentIndex({ websiteId }: { websiteId: string }) {
  const [entries, setEntries] = useState<ContentIndexEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [adding, setAdding] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadEntries();
  }, [websiteId]);

  async function loadEntries() {
    try {
      const res = await fetch(`/api/content-index?websiteId=${websiteId}`);
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json();
      setEntries(data.entries);
    } catch {
      setError("Failed to load content index");
    } finally {
      setLoading(false);
    }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !url.trim()) return;
    setAdding(true);
    setError(null);
    try {
      const res = await fetch("/api/content-index", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          websiteId,
          post_title: title.trim(),
          post_url: url.trim(),
          post_excerpt: excerpt.trim() || undefined,
        }),
      });
      if (!res.ok) throw new Error("Failed to add");
      const data = await res.json();
      setEntries((prev) => [data.entry, ...prev]);
      setTitle("");
      setUrl("");
      setExcerpt("");
      setShowAddForm(false);
    } catch {
      setError("Failed to add entry");
    } finally {
      setAdding(false);
    }
  }

  async function handleDelete(entryId: string) {
    setDeletingId(entryId);
    try {
      const res = await fetch(`/api/content-index/${entryId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete");
      setEntries((prev) => prev.filter((e) => e.id !== entryId));
    } catch {
      setError("Failed to delete entry");
    } finally {
      setDeletingId(null);
    }
  }

  if (loading) {
    return (
      <div
        className="rounded-xl p-8 text-center"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <div
          className="animate-spin rounded-full h-6 w-6 border-2 border-t-transparent mx-auto"
          style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }}
        />
      </div>
    );
  }

  return (
    <div
      className="rounded-xl p-6"
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <LinkIcon size={18} style={{ color: "var(--accent)" }} />
          <h3 className="text-lg font-semibold" style={{ color: "var(--foreground)" }}>
            Content Index
          </h3>
          <span
            className="text-xs px-2 py-0.5 rounded-full"
            style={{ background: "var(--surface-warm)", color: "var(--text-muted)" }}
          >
            {entries.length} pages
          </span>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition hover:opacity-90"
          style={{ background: "var(--accent)", color: "var(--accent-text)" }}
        >
          {showAddForm ? <X size={14} /> : <Plus size={14} />}
          {showAddForm ? "Cancel" : "Add Page"}
        </button>
      </div>

      <p className="text-sm mb-4" style={{ color: "var(--text-muted)" }}>
        Pages listed here will be available for internal linking during article generation.
        The AI will naturally link to relevant pages from this index.
      </p>

      {error && (
        <div
          className="rounded-lg p-3 mb-4 text-sm"
          style={{ background: "var(--danger-light)", color: "var(--danger)" }}
        >
          {error}
          <button onClick={() => setError(null)} className="ml-2 font-medium underline">
            dismiss
          </button>
        </div>
      )}

      {/* Add form */}
      {showAddForm && (
        <form
          onSubmit={handleAdd}
          className="rounded-lg p-4 mb-4 space-y-3"
          style={{ background: "var(--surface-warm)", border: "1px solid var(--border)" }}
        >
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: "var(--foreground)" }}>
              Page Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="How to Train Your Dog"
              required
              className="w-full px-3 py-2 rounded-lg text-sm"
              style={{
                background: "var(--background)",
                border: "1px solid var(--border)",
                color: "var(--foreground)",
              }}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: "var(--foreground)" }}>
              URL *
            </label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/how-to-train-your-dog"
              required
              className="w-full px-3 py-2 rounded-lg text-sm"
              style={{
                background: "var(--background)",
                border: "1px solid var(--border)",
                color: "var(--foreground)",
              }}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: "var(--foreground)" }}>
              Excerpt (optional)
            </label>
            <input
              type="text"
              value={excerpt}
              onChange={(e) => setExcerpt(e.target.value)}
              placeholder="A comprehensive guide to dog training basics..."
              className="w-full px-3 py-2 rounded-lg text-sm"
              style={{
                background: "var(--background)",
                border: "1px solid var(--border)",
                color: "var(--foreground)",
              }}
            />
          </div>
          <button
            type="submit"
            disabled={adding || !title.trim() || !url.trim()}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition hover:opacity-90 disabled:opacity-50"
            style={{ background: "var(--accent)", color: "var(--accent-text)" }}
          >
            {adding ? "Adding..." : "Add to Index"}
          </button>
        </form>
      )}

      {/* Entry list */}
      {entries.length === 0 ? (
        <div className="text-center py-8">
          <FileText size={32} className="mx-auto mb-2" style={{ color: "var(--text-muted)" }} />
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            No pages indexed yet. Add published pages so the AI can link to them.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {entries.map((entry) => (
            <div
              key={entry.id}
              className="flex items-start justify-between gap-3 p-3 rounded-lg transition"
              style={{ border: "1px solid var(--border)" }}
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate" style={{ color: "var(--foreground)" }}>
                  {entry.post_title}
                </p>
                <a
                  href={entry.post_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs hover:underline truncate"
                  style={{ color: "var(--accent)" }}
                >
                  {entry.post_url} <ExternalLink size={10} />
                </a>
                {entry.post_excerpt && (
                  <p className="text-xs mt-1 line-clamp-1" style={{ color: "var(--text-muted)" }}>
                    {entry.post_excerpt}
                  </p>
                )}
              </div>
              <button
                onClick={() => handleDelete(entry.id)}
                disabled={deletingId === entry.id}
                className="p-1.5 rounded-lg transition hover:opacity-80 shrink-0"
                style={{ color: "var(--danger)" }}
              >
                {deletingId === entry.id ? (
                  <div
                    className="animate-spin rounded-full h-3.5 w-3.5 border border-t-transparent"
                    style={{ borderColor: "var(--danger)", borderTopColor: "transparent" }}
                  />
                ) : (
                  <Trash2 size={14} />
                )}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
