"use client";

import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import {
  Search,
  Filter,
  FileText,
  Clock,
  ChevronLeft,
  ChevronRight,
  PenTool,
  ExternalLink,
} from "lucide-react";

type ArticleRow = {
  id: string;
  title: string | null;
  format: string | null;
  word_count: number;
  primary_keyword: string | null;
  model_used: string | null;
  status: string;
  created_at: string;
  website: { id: string; name: string } | null;
  persona: { id: string; name: string } | null;
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  draft: { label: "Draft", color: "var(--text-secondary)", bg: "var(--surface-warm)" },
  pending_approval: { label: "Pending", color: "var(--accent)", bg: "var(--accent-light)" },
  approved: { label: "Approved", color: "var(--success)", bg: "var(--success-light)" },
  scheduled: { label: "Scheduled", color: "var(--accent)", bg: "var(--accent-light)" },
  published: { label: "Published", color: "var(--success)", bg: "var(--success-light)" },
  failed: { label: "Failed", color: "var(--danger)", bg: "var(--danger-light)" },
};

const PAGE_SIZE = 20;

export default function LibraryPage() {
  const [articles, setArticles] = useState<ArticleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [siteFilter, setSiteFilter] = useState<string>("all");
  const [formatFilter, setFormatFilter] = useState<string>("all");
  const [page, setPage] = useState(0);

  // For filter dropdowns
  const [sites, setSites] = useState<{ id: string; name: string }[]>([]);

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

      const orgId = membership.organization_id;

      // Fetch articles with website and persona names
      const { data: articlesData } = await supabase
        .from("articles")
        .select(`
          id, title, format, word_count, primary_keyword, model_used, status, created_at,
          website:websites!articles_website_id_fkey(id, name),
          persona:personas!articles_persona_id_fkey(id, name)
        `)
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false });

      // Fetch sites for filter dropdown
      const { data: sitesData } = await supabase
        .from("websites")
        .select("id, name")
        .eq("organization_id", orgId)
        .order("name");

      setArticles((articlesData as unknown as ArticleRow[]) || []);
      setSites(sitesData || []);
      setLoading(false);
    }
    load();
  }, []);

  // Derived: unique formats from data
  const formats = useMemo(() => {
    const set = new Set(articles.map((a) => a.format).filter(Boolean));
    return Array.from(set).sort();
  }, [articles]);

  // Filtered + searched
  const filtered = useMemo(() => {
    let result = articles;

    if (statusFilter !== "all") {
      result = result.filter((a) => a.status === statusFilter);
    }
    if (siteFilter !== "all") {
      result = result.filter((a) => a.website?.id === siteFilter);
    }
    if (formatFilter !== "all") {
      result = result.filter((a) => a.format === formatFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (a) =>
          a.title?.toLowerCase().includes(q) ||
          a.primary_keyword?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [articles, statusFilter, siteFilter, formatFilter, search]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  // Reset page when filters change
  useEffect(() => {
    setPage(0);
  }, [search, statusFilter, siteFilter, formatFilter]);

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>
            Content Library
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
            {articles.length} article{articles.length !== 1 ? "s" : ""} total
          </p>
        </div>
        <Link
          href="/dashboard/articles/new"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition hover:opacity-90"
          style={{ background: "var(--accent)", color: "var(--accent-text)" }}
        >
          <PenTool size={16} /> New Article
        </Link>
      </div>

      {/* Filters bar */}
      <div
        className="rounded-xl p-4 mb-4 flex flex-wrap gap-3 items-center"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
      >
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2"
            style={{ color: "var(--text-muted)" }}
          />
          <input
            type="text"
            placeholder="Search by title or keyword..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-lg text-sm"
            style={{
              background: "var(--background)",
              border: "1px solid var(--border)",
              color: "var(--foreground)",
            }}
          />
        </div>

        {/* Status */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 rounded-lg text-sm"
          style={{
            background: "var(--background)",
            border: "1px solid var(--border)",
            color: "var(--foreground)",
          }}
        >
          <option value="all">All statuses</option>
          <option value="draft">Draft</option>
          <option value="pending_approval">Pending</option>
          <option value="approved">Approved</option>
          <option value="published">Published</option>
          <option value="failed">Failed</option>
        </select>

        {/* Site */}
        <select
          value={siteFilter}
          onChange={(e) => setSiteFilter(e.target.value)}
          className="px-3 py-2 rounded-lg text-sm"
          style={{
            background: "var(--background)",
            border: "1px solid var(--border)",
            color: "var(--foreground)",
          }}
        >
          <option value="all">All sites</option>
          {sites.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>

        {/* Format */}
        <select
          value={formatFilter}
          onChange={(e) => setFormatFilter(e.target.value)}
          className="px-3 py-2 rounded-lg text-sm"
          style={{
            background: "var(--background)",
            border: "1px solid var(--border)",
            color: "var(--foreground)",
          }}
        >
          <option value="all">All formats</option>
          {formats.map((f) => (
            <option key={f} value={f!}>
              {f}
            </option>
          ))}
        </select>
      </div>

      {/* Results */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div
            className="animate-spin rounded-full h-8 w-8 border-2 border-t-transparent"
            style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }}
          />
        </div>
      ) : filtered.length === 0 ? (
        <div
          className="rounded-xl p-12 text-center"
          style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
        >
          <FileText size={40} className="mx-auto mb-3" style={{ color: "var(--text-muted)" }} />
          <p className="font-medium" style={{ color: "var(--foreground)" }}>
            {articles.length === 0 ? "No articles yet" : "No articles match your filters"}
          </p>
          <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
            {articles.length === 0
              ? "Generate your first article to get started."
              : "Try adjusting your search or filters."}
          </p>
          {articles.length === 0 && (
            <Link
              href="/dashboard/articles/new"
              className="inline-flex items-center gap-2 px-4 py-2 mt-4 rounded-lg text-sm font-medium transition hover:opacity-90"
              style={{ background: "var(--accent)", color: "var(--accent-text)" }}
            >
              <PenTool size={16} /> Write First Article
            </Link>
          )}
        </div>
      ) : (
        <>
          {/* Table */}
          <div
            className="rounded-xl overflow-hidden"
            style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
          >
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  <th className="text-left px-4 py-3 font-medium" style={{ color: "var(--text-muted)" }}>
                    Title
                  </th>
                  <th className="text-left px-4 py-3 font-medium hidden md:table-cell" style={{ color: "var(--text-muted)" }}>
                    Site
                  </th>
                  <th className="text-left px-4 py-3 font-medium hidden lg:table-cell" style={{ color: "var(--text-muted)" }}>
                    Format
                  </th>
                  <th className="text-left px-4 py-3 font-medium hidden lg:table-cell" style={{ color: "var(--text-muted)" }}>
                    Words
                  </th>
                  <th className="text-left px-4 py-3 font-medium" style={{ color: "var(--text-muted)" }}>
                    Status
                  </th>
                  <th className="text-left px-4 py-3 font-medium hidden md:table-cell" style={{ color: "var(--text-muted)" }}>
                    Created
                  </th>
                  <th className="px-4 py-3 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((article) => {
                  const sc = STATUS_CONFIG[article.status] || STATUS_CONFIG.draft;
                  return (
                    <tr
                      key={article.id}
                      className="hover:opacity-95 transition cursor-pointer"
                      style={{ borderBottom: "1px solid var(--border)" }}
                    >
                      <td className="px-4 py-3">
                        <Link
                          href={`/dashboard/articles/${article.id}`}
                          className="font-medium hover:underline block"
                          style={{ color: "var(--foreground)" }}
                        >
                          {article.title || "Untitled"}
                        </Link>
                        {article.primary_keyword && (
                          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                            {article.primary_keyword}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell" style={{ color: "var(--text-secondary)" }}>
                        {article.website?.name || "—"}
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell capitalize" style={{ color: "var(--text-secondary)" }}>
                        {article.format?.replace("-", " ") || "—"}
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell" style={{ color: "var(--text-secondary)" }}>
                        {article.word_count?.toLocaleString() || "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className="inline-block px-2 py-0.5 rounded-full text-xs font-medium"
                          style={{ color: sc.color, background: sc.bg }}
                        >
                          {sc.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell text-xs" style={{ color: "var(--text-muted)" }}>
                        {formatDate(article.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/dashboard/articles/${article.id}`}
                          className="hover:opacity-70 transition"
                          style={{ color: "var(--accent)" }}
                        >
                          <ExternalLink size={16} />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <span className="text-sm" style={{ color: "var(--text-muted)" }}>
                Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} of{" "}
                {filtered.length}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="p-2 rounded-lg transition disabled:opacity-30"
                  style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="text-sm px-2" style={{ color: "var(--text-secondary)" }}>
                  {page + 1} / {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  className="p-2 rounded-lg transition disabled:opacity-30"
                  style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
