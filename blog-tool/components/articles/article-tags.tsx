"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { X, Plus, Tag } from "lucide-react";
import {
  getArticleTags,
  addArticleTag,
  removeArticleTag,
  getOrgTags,
} from "@/app/actions/article-tags";

const PREDEFINED_TAGS = [
  "evergreen",
  "seasonal",
  "needs review",
  "updated",
  "pillar content",
];

type ArticleTagsProps = {
  articleId: string;
};

// Assign a deterministic color to each tag based on its content
const TAG_COLORS: { bg: string; text: string; border: string }[] = [
  { bg: "var(--accent-light)", text: "var(--accent)", border: "var(--accent)" },
  { bg: "var(--success-light)", text: "var(--success)", border: "var(--success)" },
  { bg: "var(--surface-warm)", text: "var(--text-secondary)", border: "var(--border)" },
  { bg: "var(--danger-light)", text: "var(--danger)", border: "var(--danger)" },
];

function getTagColor(tag: string) {
  let hash = 0;
  for (let i = 0; i < tag.length; i++) {
    hash = tag.charCodeAt(i) + ((hash << 5) - hash);
  }
  return TAG_COLORS[Math.abs(hash) % TAG_COLORS.length];
}

export function ArticleTags({ articleId }: ArticleTagsProps) {
  const [tags, setTags] = useState<string[]>([]);
  const [orgTags, setOrgTags] = useState<string[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [showInput, setShowInput] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [removingTag, setRemovingTag] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Load tags on mount
  useEffect(() => {
    async function load() {
      const [articleResult, orgResult] = await Promise.all([
        getArticleTags(articleId),
        getOrgTags(),
      ]);
      setTags(articleResult.tags);
      setOrgTags(orgResult.tags);
      setLoading(false);
    }
    load();
  }, [articleId]);

  // Focus input when shown
  useEffect(() => {
    if (showInput && inputRef.current) {
      inputRef.current.focus();
    }
  }, [showInput]);

  // Close suggestions on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
        if (!inputValue.trim()) {
          setShowInput(false);
        }
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [inputValue]);

  const handleAdd = useCallback(
    async (tag: string) => {
      const trimmed = tag.trim().toLowerCase();
      if (!trimmed || tags.includes(trimmed)) {
        setInputValue("");
        setShowSuggestions(false);
        return;
      }

      setAdding(true);
      const result = await addArticleTag(articleId, trimmed);
      if (result.success) {
        setTags((prev) => [...prev, trimmed].sort());
        // Add to org tags if new
        setOrgTags((prev) =>
          prev.includes(trimmed) ? prev : [...prev, trimmed].sort()
        );
      }
      setInputValue("");
      setShowSuggestions(false);
      setAdding(false);
      inputRef.current?.focus();
    },
    [articleId, tags]
  );

  const handleRemove = useCallback(
    async (tag: string) => {
      setRemovingTag(tag);
      const result = await removeArticleTag(articleId, tag);
      if (result.success) {
        setTags((prev) => prev.filter((t) => t !== tag));
      }
      setRemovingTag(null);
    },
    [articleId]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        if (inputValue.trim()) {
          handleAdd(inputValue);
        }
      } else if (e.key === "Escape") {
        setInputValue("");
        setShowInput(false);
        setShowSuggestions(false);
      }
    },
    [inputValue, handleAdd]
  );

  // Build suggestion list: predefined + org tags, filtered by input, excluding already-applied tags
  const suggestions = [
    ...new Set([...PREDEFINED_TAGS, ...orgTags]),
  ]
    .filter((t) => !tags.includes(t))
    .filter((t) => !inputValue || t.includes(inputValue.toLowerCase()))
    .slice(0, 8);

  if (loading) {
    return (
      <div
        className="rounded-xl p-4"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <div className="flex items-center gap-2">
          <Tag size={14} style={{ color: "var(--text-muted)" }} />
          <span className="text-sm" style={{ color: "var(--text-muted)" }}>
            Loading tags...
          </span>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="rounded-xl p-4"
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
    >
      <div className="flex items-center gap-2 mb-2">
        <Tag size={14} style={{ color: "var(--text-muted)" }} />
        <span
          className="text-xs font-semibold uppercase tracking-wide"
          style={{ color: "var(--text-muted)" }}
        >
          Tags
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {/* Existing tags */}
        {tags.map((tag) => {
          const color = getTagColor(tag);
          const isRemoving = removingTag === tag;
          return (
            <span
              key={tag}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-opacity"
              style={{
                background: color.bg,
                color: color.text,
                border: `1px solid ${color.border}`,
                opacity: isRemoving ? 0.5 : 1,
              }}
            >
              {tag}
              <button
                onClick={() => handleRemove(tag)}
                disabled={isRemoving}
                className="inline-flex items-center justify-center rounded-full transition hover:opacity-70"
                style={{
                  width: "14px",
                  height: "14px",
                  marginLeft: "2px",
                }}
                aria-label={`Remove tag ${tag}`}
              >
                <X size={10} />
              </button>
            </span>
          );
        })}

        {/* Add tag button / input */}
        {showInput ? (
          <div className="relative">
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => {
                setInputValue(e.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              onKeyDown={handleKeyDown}
              disabled={adding}
              placeholder="Add tag..."
              className="rounded-lg px-2.5 py-1 text-xs"
              style={{
                border: "1px solid var(--border)",
                background: "var(--background)",
                color: "var(--foreground)",
                width: "140px",
                outline: "none",
              }}
            />

            {/* Suggestions dropdown */}
            {showSuggestions && suggestions.length > 0 && (
              <div
                className="absolute left-0 top-full mt-1 rounded-lg py-1 shadow-lg z-50"
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  minWidth: "180px",
                  maxHeight: "200px",
                  overflowY: "auto",
                }}
              >
                {suggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => handleAdd(suggestion)}
                    className="w-full text-left px-3 py-1.5 text-xs transition"
                    style={{ color: "var(--foreground)" }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.background = "var(--surface-warm)")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.background = "transparent")
                    }
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <button
            onClick={() => setShowInput(true)}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition hover:opacity-80"
            style={{
              border: "1px dashed var(--border)",
              color: "var(--text-muted)",
              background: "transparent",
            }}
          >
            <Plus size={12} />
            Add tag
          </button>
        )}
      </div>
    </div>
  );
}
