"use client";

import { useState, useEffect } from "react";
import { Tag, Plus, X, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function ArticleTags({ articleId }: { articleId: string }) {
  const [tags, setTags] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTag, setNewTag] = useState("");
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data } = await supabase
        .from("article_tags")
        .select("id, name")
        .eq("article_id", articleId)
        .order("created_at", { ascending: true });
      setTags(data || []);
      setLoading(false);
    }
    load();
  }, [articleId]);

  async function handleAdd() {
    if (!newTag.trim()) return;
    setAdding(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("article_tags")
      .insert({ article_id: articleId, name: newTag.trim() })
      .select("id, name")
      .single();
    if (data && !error) {
      setTags((prev) => [...prev, data]);
    }
    setNewTag("");
    setAdding(false);
  }

  async function handleRemove(tagId: string) {
    const supabase = createClient();
    await supabase.from("article_tags").delete().eq("id", tagId);
    setTags((prev) => prev.filter((t) => t.id !== tagId));
  }

  if (loading) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Tag size={14} style={{ color: "var(--text-muted)" }} />
      {tags.map((tag) => (
        <span
          key={tag.id}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs"
          style={{ background: "var(--surface-warm)", color: "var(--text-secondary)" }}
        >
          {tag.name}
          <button onClick={() => handleRemove(tag.id)} className="hover:opacity-70">
            <X size={10} />
          </button>
        </span>
      ))}
      <form
        onSubmit={(e) => { e.preventDefault(); handleAdd(); }}
        className="inline-flex items-center gap-1"
      >
        <input
          type="text"
          value={newTag}
          onChange={(e) => setNewTag(e.target.value)}
          placeholder="Add tag"
          className="w-20 px-2 py-0.5 rounded text-xs"
          style={{ border: "1px solid var(--border)", background: "var(--background)", color: "var(--foreground)" }}
        />
        <button type="submit" disabled={adding || !newTag.trim()} className="opacity-60 hover:opacity-100 disabled:opacity-30">
          {adding ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
        </button>
      </form>
    </div>
  );
}
