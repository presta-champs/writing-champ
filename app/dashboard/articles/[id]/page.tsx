"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import {
  ArrowLeft,
  Save,
  Trash2,
  Download,
  Copy,
  Check,
  Clock,
  Globe,
  User,
  FileText,
  ChevronDown,
} from "lucide-react";
import { ArticleEditor } from "@/components/editor/article-editor";
import { htmlToMarkdown } from "@/lib/export/html-to-markdown";
import { SeoCheckPanel } from "@/components/pipeline/seo-check-panel";

type ArticleDetail = {
  id: string;
  title: string | null;
  body: string | null;
  format: string | null;
  word_count: number;
  primary_keyword: string | null;
  secondary_keywords: string[] | null;
  model_used: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  meta_title: string | null;
  meta_description: string | null;
  website: { id: string; name: string } | null;
  persona: { id: string; name: string } | null;
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  draft: { label: "Draft", color: "var(--text-secondary)", bg: "var(--surface-warm)" },
  pending_approval: { label: "Pending", color: "var(--accent)", bg: "var(--accent-light)" },
  approved: { label: "Approved", color: "var(--success)", bg: "var(--success-light)" },
  published: { label: "Published", color: "var(--success)", bg: "var(--success-light)" },
  failed: { label: "Failed", color: "var(--danger)", bg: "var(--danger-light)" },
};

export default function ArticleDetailPage() {
  const params = useParams();
  const router = useRouter();
  const articleId = params.id as string;

  const [article, setArticle] = useState<ArticleDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [editedHtml, setEditedHtml] = useState<string | null>(null);
  const [metaTitle, setMetaTitle] = useState("");
  const [metaDescription, setMetaDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [copied, setCopied] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

  // Close export dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) {
        setExportOpen(false);
      }
    }
    if (exportOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [exportOpen]);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: membership } = await supabase
        .from("organization_members")
        .select("organization_id")
        .eq("user_id", user.id)
        .limit(1)
        .single();

      if (!membership) return;

      const { data } = await supabase
        .from("articles")
        .select(`
          id, title, body, format, word_count, primary_keyword, secondary_keywords,
          model_used, status, created_at, updated_at, meta_title, meta_description,
          website:websites!articles_website_id_fkey(id, name),
          persona:personas!articles_persona_id_fkey(id, name)
        `)
        .eq("id", articleId)
        .eq("organization_id", membership.organization_id)
        .single();

      const art = data as unknown as ArticleDetail;
      setArticle(art);
      setMetaTitle(art?.meta_title || "");
      setMetaDescription(art?.meta_description || "");
      setLoading(false);
    }
    load();
  }, [articleId]);

  const hasChanges =
    (editedHtml !== null && editedHtml !== article?.body) ||
    metaTitle !== (article?.meta_title || "") ||
    metaDescription !== (article?.meta_description || "");

  const handleSave = useCallback(async () => {
    if (!article) return;
    setSaving(true);
    const supabase = createClient();

    const html = editedHtml ?? article.body ?? "";
    const wordCount = html.replace(/<[^>]*>/g, " ").split(/\s+/).filter(Boolean).length;

    await supabase
      .from("articles")
      .update({
        body: html,
        word_count: wordCount,
        meta_title: metaTitle || null,
        meta_description: metaDescription || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", article.id);

    setArticle((prev) => prev ? {
      ...prev,
      body: html,
      word_count: wordCount,
      meta_title: metaTitle || null,
      meta_description: metaDescription || null,
    } : prev);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }, [article, editedHtml, metaTitle, metaDescription]);

  const handleDelete = useCallback(async () => {
    if (!article) return;
    setDeleting(true);
    const supabase = createClient();
    await supabase.from("articles").delete().eq("id", article.id);
    router.push("/dashboard/library");
  }, [article, router]);

  const handleExport = useCallback(
    (format: "html" | "markdown" | "text") => {
      if (!article) return;
      const html = editedHtml ?? article.body ?? "";
      const slug = (article.title || "article")
        .replace(/[^a-z0-9]/gi, "-")
        .toLowerCase();

      let content: string;
      let mimeType: string;
      let extension: string;

      switch (format) {
        case "markdown": {
          content = htmlToMarkdown(html);
          mimeType = "text/markdown";
          extension = "md";
          break;
        }
        case "text": {
          // Strip all HTML tags and normalize whitespace
          content = html
            .replace(/<br\s*\/?>/gi, "\n")
            .replace(/<\/p>/gi, "\n\n")
            .replace(/<\/h[1-6]>/gi, "\n\n")
            .replace(/<\/li>/gi, "\n")
            .replace(/<\/tr>/gi, "\n")
            .replace(/<[^>]*>/g, "")
            .replace(/&nbsp;/gi, " ")
            .replace(/&amp;/gi, "&")
            .replace(/&lt;/gi, "<")
            .replace(/&gt;/gi, ">")
            .replace(/&quot;/gi, '"')
            .replace(/&#39;/gi, "'")
            .replace(/[ \t]+/g, " ")
            .replace(/\n /g, "\n")
            .replace(/\n{3,}/g, "\n\n")
            .trim();
          mimeType = "text/plain";
          extension = "txt";
          break;
        }
        default: {
          content = html;
          mimeType = "text/html";
          extension = "html";
          break;
        }
      }

      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${slug}.${extension}`;
      a.click();
      URL.revokeObjectURL(url);
      setExportOpen(false);
    },
    [article, editedHtml]
  );

  const handleCopyHtml = useCallback(async () => {
    if (!article) return;
    const html = editedHtml ?? article.body ?? "";
    await navigator.clipboard.writeText(html);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [article, editedHtml]);

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div
          className="animate-spin rounded-full h-8 w-8 border-2 border-t-transparent"
          style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }}
        />
      </div>
    );
  }

  if (!article) {
    return (
      <div className="max-w-3xl mx-auto text-center py-20">
        <FileText size={40} className="mx-auto mb-3" style={{ color: "var(--text-muted)" }} />
        <p className="font-medium" style={{ color: "var(--foreground)" }}>Article not found</p>
        <Link
          href="/dashboard/library"
          className="inline-flex items-center gap-2 mt-4 text-sm"
          style={{ color: "var(--accent)" }}
        >
          <ArrowLeft size={16} /> Back to Library
        </Link>
      </div>
    );
  }

  const sc = STATUS_CONFIG[article.status] || STATUS_CONFIG.draft;

  return (
    <div className="max-w-5xl mx-auto">
      {/* Top bar */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <Link
          href="/dashboard/library"
          className="inline-flex items-center gap-2 text-sm font-medium hover:opacity-80 transition"
          style={{ color: "var(--text-secondary)" }}
        >
          <ArrowLeft size={16} /> Library
        </Link>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCopyHtml}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition hover:opacity-80"
            style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? "Copied" : "Copy HTML"}
          </button>
          <div className="relative" ref={exportRef}>
            <button
              onClick={() => setExportOpen((prev) => !prev)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition hover:opacity-80"
              style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}
            >
              <Download size={14} /> Export <ChevronDown size={12} />
            </button>
            {exportOpen && (
              <div
                className="absolute right-0 mt-1 w-40 rounded-lg py-1 shadow-lg z-50"
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                }}
              >
                {[
                  { key: "html" as const, label: "HTML" },
                  { key: "markdown" as const, label: "Markdown" },
                  { key: "text" as const, label: "Plain Text" },
                ].map((opt) => (
                  <button
                    key={opt.key}
                    onClick={() => handleExport(opt.key)}
                    className="w-full text-left px-3 py-2 text-sm transition"
                    style={{ color: "var(--foreground)" }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.background = "var(--surface-warm)")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.background = "transparent")
                    }
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          {hasChanges && (
            <button
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition hover:opacity-90"
              style={{ background: "var(--accent)", color: "var(--accent-text)" }}
            >
              {saving ? (
                <div className="animate-spin rounded-full h-3.5 w-3.5 border border-t-transparent" style={{ borderColor: "var(--accent-text)", borderTopColor: "transparent" }} />
              ) : saved ? (
                <Check size={14} />
              ) : (
                <Save size={14} />
              )}
              {saving ? "Saving..." : saved ? "Saved" : "Save"}
            </button>
          )}
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition hover:opacity-80"
            style={{ border: "1px solid var(--border)", color: "var(--danger)" }}
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Delete confirmation */}
      {showDeleteConfirm && (
        <div
          className="rounded-xl p-4 mb-4 flex items-center justify-between"
          style={{ background: "var(--danger-light)", border: "1px solid var(--danger)" }}
        >
          <span className="text-sm font-medium" style={{ color: "var(--danger)" }}>
            Delete this article permanently?
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowDeleteConfirm(false)}
              className="px-3 py-1.5 rounded-lg text-sm transition hover:opacity-80"
              style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="px-3 py-1.5 rounded-lg text-sm font-medium transition hover:opacity-90"
              style={{ background: "var(--danger)", color: "#fff" }}
            >
              {deleting ? "Deleting..." : "Delete"}
            </button>
          </div>
        </div>
      )}

      {/* Article header */}
      <div
        className="rounded-xl p-6 mb-4"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <h1 className="text-xl font-bold mb-3" style={{ color: "var(--foreground)" }}>
          {article.title || "Untitled"}
        </h1>

        <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
          <span
            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium"
            style={{ color: sc.color, background: sc.bg }}
          >
            {sc.label}
          </span>

          {article.website && (
            <span className="inline-flex items-center gap-1.5" style={{ color: "var(--text-muted)" }}>
              <Globe size={14} /> {article.website.name}
            </span>
          )}
          {article.persona && (
            <span className="inline-flex items-center gap-1.5" style={{ color: "var(--text-muted)" }}>
              <User size={14} /> {article.persona.name}
            </span>
          )}
          <span className="inline-flex items-center gap-1.5" style={{ color: "var(--text-muted)" }}>
            <Clock size={14} /> {formatDate(article.created_at)}
          </span>
          {article.word_count > 0 && (
            <span style={{ color: "var(--text-muted)" }}>
              {article.word_count.toLocaleString()} words
            </span>
          )}
          {article.format && (
            <span className="capitalize" style={{ color: "var(--text-muted)" }}>
              {article.format.replace("-", " ")}
            </span>
          )}
          {article.model_used && (
            <span style={{ color: "var(--text-muted)" }}>
              {article.model_used}
            </span>
          )}
        </div>

        {/* Keywords */}
        {(article.primary_keyword || (article.secondary_keywords && article.secondary_keywords.length > 0)) && (
          <div className="flex flex-wrap gap-2 mt-3">
            {article.primary_keyword && (
              <span
                className="px-2 py-0.5 rounded text-xs font-medium"
                style={{ background: "var(--accent-light)", color: "var(--accent)" }}
              >
                {article.primary_keyword}
              </span>
            )}
            {article.secondary_keywords?.map((kw) => (
              <span
                key={kw}
                className="px-2 py-0.5 rounded text-xs"
                style={{ background: "var(--surface-warm)", color: "var(--text-secondary)" }}
              >
                {kw}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Meta fields */}
      <div
        className="rounded-xl p-5 mb-4 space-y-4"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <h3 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
          Meta Tags
        </h3>
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
              Meta Title
            </label>
            <span
              className="text-[10px] tabular-nums"
              style={{
                color: metaTitle.length > 60
                  ? "var(--danger)"
                  : metaTitle.length >= 50
                  ? "var(--success)"
                  : "var(--text-muted)",
              }}
            >
              {metaTitle.length}/60
            </span>
          </div>
          <input
            type="text"
            value={metaTitle}
            onChange={(e) => setMetaTitle(e.target.value)}
            placeholder="SEO-optimized page title (50-60 characters ideal)"
            className="w-full rounded-lg px-3 py-2 text-sm"
            style={{
              border: `1px solid ${!metaTitle ? "var(--danger)" : "var(--border)"}`,
              background: "var(--background)",
              color: "var(--foreground)",
            }}
          />
        </div>
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
              Meta Description
            </label>
            <span
              className="text-[10px] tabular-nums"
              style={{
                color: metaDescription.length > 160
                  ? "var(--danger)"
                  : metaDescription.length >= 120
                  ? "var(--success)"
                  : "var(--text-muted)",
              }}
            >
              {metaDescription.length}/160
            </span>
          </div>
          <textarea
            value={metaDescription}
            onChange={(e) => setMetaDescription(e.target.value)}
            placeholder="Compelling description for search results (120-160 characters ideal)"
            rows={2}
            className="w-full rounded-lg px-3 py-2 text-sm resize-none"
            style={{
              border: `1px solid ${!metaDescription ? "var(--danger)" : "var(--border)"}`,
              background: "var(--background)",
              color: "var(--foreground)",
            }}
          />
        </div>
      </div>

      {/* Editor */}
      <ArticleEditor
        content={article.body || ""}
        onChange={(html) => setEditedHtml(html)}
        editable={true}
        streaming={false}
      />

      {/* SEO Audit */}
      <div className="mt-6">
        <SeoCheckPanel
          articleId={article.id}
          html={editedHtml ?? article.body ?? ""}
          metaTitle={metaTitle || undefined}
          metaDescription={metaDescription || undefined}
          primaryKeyword={article.primary_keyword ?? undefined}
          secondaryKeywords={article.secondary_keywords ?? undefined}
          targetWordCount={article.word_count || 1500}
          onFixApplied={(fixedHtml) => setEditedHtml(fixedHtml)}
          onMetaChange={(title, desc) => {
            setMetaTitle(title);
            setMetaDescription(desc);
          }}
        />
      </div>
    </div>
  );
}
