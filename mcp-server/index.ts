import { MCPServer, text, object, markdown, error } from "mcp-use/server";
import { z } from "zod";
import { supabase } from "./supabase.js";

const server = new MCPServer({
  name: "writing-champ",
  title: "WritingChamp MCP",
  version: "1.0.0",
  baseUrl: process.env.MCP_URL || `http://localhost:${process.env.MCP_PORT || 3100}`,
});

// ─── Health ────────────────────────────────────────────────────────────────

server.app.get("/health", (c) => c.json({ status: "ok", server: "writing-champ-mcp" }));

// ─── PERSONAS ──────────────────────────────────────────────────────────────

server.tool(
  {
    name: "list-personas",
    description: "List all writing personas available in the organization",
    schema: z.object({
      org_id: z.string().describe("Organization ID"),
    }),
  },
  async ({ org_id }) => {
    const { data, error: err } = await supabase
      .from("personas")
      .select("id, name, bio, voice_summary, tone_formal, tone_warmth, tone_conciseness")
      .eq("organization_id", org_id)
      .order("name");
    if (err) return error(err.message);
    return object(data || []);
  }
);

server.tool(
  {
    name: "get-persona",
    description: "Get full details of a specific writing persona",
    schema: z.object({
      persona_id: z.string().describe("Persona UUID"),
    }),
  },
  async ({ persona_id }) => {
    const { data, error: err } = await supabase
      .from("personas")
      .select("*")
      .eq("id", persona_id)
      .single();
    if (err) return error(err.message);
    return object(data);
  }
);

// ─── SITES ─────────────────────────────────────────────────────────────────

server.tool(
  {
    name: "list-sites",
    description: "List all CMS sites connected to the organization",
    schema: z.object({
      org_id: z.string().describe("Organization ID"),
    }),
  },
  async ({ org_id }) => {
    const { data, error: err } = await supabase
      .from("websites")
      .select("id, name, url, platform_type, mcp_status, site_description, content_pillars")
      .eq("organization_id", org_id)
      .order("name");
    if (err) return error(err.message);
    return object(data || []);
  }
);

server.tool(
  {
    name: "get-site",
    description: "Get full details of a specific site including editorial guidelines",
    schema: z.object({
      site_id: z.string().describe("Website UUID"),
    }),
  },
  async ({ site_id }) => {
    const { data, error: err } = await supabase
      .from("websites")
      .select("*")
      .eq("id", site_id)
      .single();
    if (err) return error(err.message);
    // Strip sensitive fields
    if (data) {
      delete data.mcp_auth_token;
      delete data.mcp_auth_token_iv;
    }
    return object(data);
  }
);

// ─── ARTICLES ──────────────────────────────────────────────────────────────

server.tool(
  {
    name: "list-articles",
    description: "List articles with optional filtering by site, status, or search query",
    schema: z.object({
      org_id: z.string().describe("Organization ID"),
      site_id: z.string().optional().describe("Filter by website ID"),
      status: z.enum(["draft", "pending_approval", "approved", "scheduled", "published", "failed"]).optional().describe("Filter by article status"),
      search: z.string().optional().describe("Search in title or primary keyword"),
      limit: z.number().min(1).max(100).optional().describe("Max results (default 25)"),
    }),
  },
  async ({ org_id, site_id, status, search, limit = 25 }) => {
    let query = supabase
      .from("articles")
      .select("id, title, status, primary_keyword, seo_score, created_at, updated_at, website_id")
      .eq("organization_id", org_id)
      .order("updated_at", { ascending: false })
      .limit(limit);

    if (site_id) query = query.eq("website_id", site_id);
    if (status) query = query.eq("status", status);
    if (search) query = query.or(`title.ilike.%${search}%,primary_keyword.ilike.%${search}%`);

    const { data, error: err } = await query;
    if (err) return error(err.message);
    return object(data || []);
  }
);

server.tool(
  {
    name: "get-article",
    description: "Get full article content including HTML body, SEO metadata, and status",
    schema: z.object({
      article_id: z.string().describe("Article UUID"),
    }),
  },
  async ({ article_id }) => {
    const { data, error: err } = await supabase
      .from("articles")
      .select("*")
      .eq("id", article_id)
      .single();
    if (err) return error(err.message);
    return object(data);
  }
);

server.tool(
  {
    name: "update-article",
    description: "Update an article's content, title, meta fields, or status",
    schema: z.object({
      article_id: z.string().describe("Article UUID"),
      title: z.string().optional().describe("Article title"),
      body: z.string().optional().describe("Full HTML body of the article"),
      meta_title: z.string().optional().describe("SEO meta title (max 60 chars recommended)"),
      meta_description: z.string().optional().describe("SEO meta description (max 160 chars recommended)"),
      status: z.enum(["draft", "pending_approval", "approved", "scheduled", "published"]).optional().describe("Article status"),
      primary_keyword: z.string().optional().describe("Primary SEO keyword"),
    }),
  },
  async ({ article_id, ...fields }) => {
    const update: Record<string, unknown> = { ...fields, updated_at: new Date().toISOString() };
    if (fields.body) update.body = fields.body;

    const { data, error: err } = await supabase
      .from("articles")
      .update(update)
      .eq("id", article_id)
      .select("id, title, status, updated_at")
      .single();
    if (err) return error(err.message);
    return object(data);
  }
);

server.tool(
  {
    name: "create-article",
    description: "Create a new article draft for a site",
    schema: z.object({
      org_id: z.string().describe("Organization ID"),
      website_id: z.string().describe("Target website UUID"),
      title: z.string().describe("Article title"),
      primary_keyword: z.string().optional().describe("Primary SEO keyword"),
      body: z.string().optional().describe("HTML body content"),
      meta_title: z.string().optional().describe("SEO meta title"),
      meta_description: z.string().optional().describe("SEO meta description"),
      persona_id: z.string().optional().describe("Writing persona UUID to use"),
    }),
  },
  async ({ org_id, website_id, title, primary_keyword, body, meta_title, meta_description, persona_id }) => {
    const { data, error: err } = await supabase
      .from("articles")
      .insert({
        organization_id: org_id,
        website_id,
        title,
        primary_keyword: primary_keyword || null,
        body: body || "",
        meta_title: meta_title || null,
        meta_description: meta_description || null,
        persona_id: persona_id || null,
        status: "draft",
      })
      .select("id, title, status, created_at")
      .single();
    if (err) return error(err.message);
    return object(data);
  }
);

// ─── SEO ───────────────────────────────────────────────────────────────────

server.tool(
  {
    name: "research-keywords",
    description: "Get keyword suggestions based on a seed keyword using Google Autocomplete",
    schema: z.object({
      seed: z.string().describe("Seed keyword to get suggestions for"),
      country: z.string().optional().describe("Country code for localization (default: us)"),
      limit: z.number().min(1).max(20).optional().describe("Max suggestions (default 10)"),
    }),
  },
  async ({ seed, country = "us", limit = 10 }) => {
    try {
      const url = `https://suggestqueries.google.com/complete/search?client=firefox&q=${encodeURIComponent(seed)}&hl=${country}`;
      const res = await fetch(url, {
        signal: AbortSignal.timeout(5000),
        headers: { "User-Agent": "Mozilla/5.0" },
      });
      if (!res.ok) throw new Error("Google API unavailable");
      const data = await res.json();
      const suggestions: string[] = (data[1] || []).slice(0, limit);
      return object(suggestions.map((kw) => ({ keyword: kw })));
    } catch {
      const suffixes = ["", " guide", " tips", " best practices", " examples", " how to", " tutorial", " vs", " benefits", " tools"];
      return object(suffixes.slice(0, limit).map((s) => ({ keyword: seed.trim() + s })));
    }
  }
);

server.tool(
  {
    name: "check-seo",
    description: "Analyze an article's SEO quality — checks keyword usage, meta tags, headings, content length, and readability",
    schema: z.object({
      article_id: z.string().describe("Article UUID to analyze"),
    }),
  },
  async ({ article_id }) => {
    const { data: article, error: err } = await supabase
      .from("articles")
      .select("title, body, primary_keyword, meta_title, meta_description")
      .eq("id", article_id)
      .single();
    if (err) return error(err.message);
    if (!article) return error("Article not found");

    const html = article.body || "";
    const keyword = (article.primary_keyword || "").toLowerCase();
    const plainText = html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
    const wordCount = plainText.split(/\s+/).length;
    const headings = html.match(/<h[1-6][^>]*>.*?<\/h[1-6]>/gi) || [];
    const images = html.match(/<img[^>]*>/gi) || [];
    const imagesWithAlt = images.filter((img) => /alt="[^"]+"/i.test(img));
    const links = html.match(/<a[^>]*href[^>]*>/gi) || [];

    const issues: string[] = [];
    const passed: string[] = [];

    // Keyword checks
    if (!keyword) {
      issues.push("No primary keyword set");
    } else {
      const kwCount = (plainText.toLowerCase().match(new RegExp(keyword, "g")) || []).length;
      const density = wordCount > 0 ? (kwCount / wordCount) * 100 : 0;
      if (kwCount === 0) issues.push(`Primary keyword "${keyword}" not found in content`);
      else if (density < 0.5) issues.push(`Keyword density too low (${density.toFixed(1)}%)`);
      else if (density > 3) issues.push(`Keyword density too high (${density.toFixed(1)}%) — may look spammy`);
      else passed.push(`Keyword density OK (${density.toFixed(1)}%)`);

      if (article.title?.toLowerCase().includes(keyword)) passed.push("Keyword in title");
      else issues.push("Primary keyword missing from title");

      if (article.meta_title?.toLowerCase().includes(keyword)) passed.push("Keyword in meta title");
      else issues.push("Primary keyword missing from meta title");

      if (article.meta_description?.toLowerCase().includes(keyword)) passed.push("Keyword in meta description");
      else issues.push("Primary keyword missing from meta description");

      const h1Match = headings.some((h) => h.toLowerCase().includes(keyword) && /<h1/i.test(h));
      if (h1Match) passed.push("Keyword in H1");
      else issues.push("Primary keyword missing from H1 heading");
    }

    // Content checks
    if (wordCount < 300) issues.push(`Content too short (${wordCount} words — aim for 800+)`);
    else if (wordCount < 800) issues.push(`Content could be longer (${wordCount} words — 800+ recommended)`);
    else passed.push(`Good content length (${wordCount} words)`);

    // Meta checks
    if (!article.meta_title) issues.push("Missing meta title");
    else if (article.meta_title.length > 60) issues.push(`Meta title too long (${article.meta_title.length} chars — max 60)`);
    else passed.push("Meta title length OK");

    if (!article.meta_description) issues.push("Missing meta description");
    else if (article.meta_description.length > 160) issues.push(`Meta description too long (${article.meta_description.length} chars — max 160)`);
    else passed.push("Meta description length OK");

    // Structure checks
    if (headings.length === 0) issues.push("No headings found — add H2/H3 structure");
    else passed.push(`${headings.length} heading(s) found`);

    if (images.length === 0) issues.push("No images — consider adding visuals");
    else if (imagesWithAlt.length < images.length) issues.push(`${images.length - imagesWithAlt.length} image(s) missing alt text`);
    else passed.push(`All ${images.length} image(s) have alt text`);

    if (links.length === 0) issues.push("No links found — add internal/external links");
    else passed.push(`${links.length} link(s) found`);

    const score = Math.max(0, Math.min(100, Math.round((passed.length / (passed.length + issues.length)) * 100)));

    return object({ score, issues, passed, wordCount, headingCount: headings.length, imageCount: images.length, linkCount: links.length });
  }
);

server.tool(
  {
    name: "generate-meta",
    description: "Generate SEO meta title and description for an article based on its content and keyword",
    schema: z.object({
      article_id: z.string().describe("Article UUID"),
    }),
  },
  async ({ article_id }) => {
    const { data: article, error: err } = await supabase
      .from("articles")
      .select("title, body, primary_keyword")
      .eq("id", article_id)
      .single();
    if (err) return error(err.message);

    const plainText = (article.body || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
    const excerpt = plainText.slice(0, 500);
    const keyword = article.primary_keyword || "";

    const metaTitle = article.title
      ? article.title.length > 60
        ? article.title.slice(0, 57) + "..."
        : article.title
      : "Untitled Article";

    const metaDescription = excerpt.length > 160
      ? excerpt.slice(0, 157) + "..."
      : excerpt || "Read this article for insights and practical tips.";

    return object({
      meta_title: metaTitle,
      meta_description: metaDescription,
      primary_keyword: keyword,
      tip: "For best results, have Claude rewrite these with the keyword naturally included.",
    });
  }
);

// ─── CONTENT INDEX (CMS) ──────────────────────────────────────────────────

server.tool(
  {
    name: "get-content-index",
    description: "Fetch the content index from a connected CMS site — shows all published posts/pages",
    schema: z.object({
      site_id: z.string().describe("Website UUID"),
    }),
  },
  async ({ site_id }) => {
    const { data, error: err } = await supabase
      .from("content_index")
      .select("id, remote_id, title, slug, url, status, published_at, content_type")
      .eq("website_id", site_id)
      .order("published_at", { ascending: false })
      .limit(200);
    if (err) return error(err.message);
    return object(data || []);
  }
);

// ─── CROSS-SITE INTERLINKING ───────────────────────────────────────────────

server.tool(
  {
    name: "find-interlink-opportunities",
    description: "Find content across all org sites that could be linked to/from an article — analyzes keyword and topic overlap for internal linking",
    schema: z.object({
      article_id: z.string().describe("Article UUID to find interlink targets for"),
      org_id: z.string().describe("Organization ID"),
      max_results: z.number().min(1).max(50).optional().describe("Max link suggestions (default 15)"),
    }),
  },
  async ({ article_id, org_id, max_results = 15 }) => {
    // Get the source article
    const { data: article, error: artErr } = await supabase
      .from("articles")
      .select("id, title, primary_keyword, body, website_id")
      .eq("id", article_id)
      .single();
    if (artErr) return error(artErr.message);
    if (!article) return error("Article not found");

    const keyword = (article.primary_keyword || "").toLowerCase();
    const plainText = (article.body || "").replace(/<[^>]*>/g, " ").toLowerCase();

    // Get all published content across org sites (articles + content index)
    const [articlesResult, indexResult, sitesResult] = await Promise.all([
      supabase
        .from("articles")
        .select("id, title, primary_keyword, website_id, status, meta_description")
        .eq("organization_id", org_id)
        .neq("id", article_id)
        .in("status", ["published", "approved", "draft"])
        .limit(500),
      supabase
        .from("content_index")
        .select("id, title, slug, url, website_id, content_type")
        .in("website_id", [
          // Get all org site IDs
        ])
        .limit(500),
      supabase
        .from("websites")
        .select("id, name, url")
        .eq("organization_id", org_id),
    ]);

    const sites = new Map((sitesResult.data || []).map((s) => [s.id, s]));
    const siteIds = Array.from(sites.keys());

    // Also fetch content index for all org sites
    const { data: indexData } = await supabase
      .from("content_index")
      .select("id, title, slug, url, website_id, content_type")
      .in("website_id", siteIds)
      .limit(500);

    type LinkSuggestion = {
      type: "article" | "cms_content";
      id: string;
      title: string;
      url?: string;
      site_name: string;
      site_id: string;
      relevance: "high" | "medium" | "low";
      reason: string;
      direction: "link_to" | "link_from" | "both";
    };

    const suggestions: LinkSuggestion[] = [];

    // Score articles from the org
    for (const other of articlesResult.data || []) {
      const otherKeyword = (other.primary_keyword || "").toLowerCase();
      const otherTitle = (other.title || "").toLowerCase();
      const site = sites.get(other.website_id);

      let score = 0;
      const reasons: string[] = [];

      // Keyword overlap
      if (keyword && otherKeyword) {
        if (keyword === otherKeyword) {
          score += 3;
          reasons.push("Same primary keyword");
        } else if (otherKeyword.includes(keyword) || keyword.includes(otherKeyword)) {
          score += 2;
          reasons.push("Related primary keyword");
        }
      }

      // Keyword appears in other article's title
      if (keyword && otherTitle.includes(keyword)) {
        score += 2;
        reasons.push("Your keyword appears in their title");
      }

      // Other's keyword appears in your content
      if (otherKeyword && plainText.includes(otherKeyword)) {
        score += 2;
        reasons.push("Their keyword appears in your content");
      }

      // Cross-site bonus (interlinking across different domains is more valuable)
      if (other.website_id !== article.website_id) {
        score += 1;
        reasons.push("Cross-site link opportunity");
      }

      if (score > 0) {
        suggestions.push({
          type: "article",
          id: other.id,
          title: other.title || "Untitled",
          site_name: site?.name || "Unknown site",
          site_id: other.website_id,
          relevance: score >= 4 ? "high" : score >= 2 ? "medium" : "low",
          reason: reasons.join("; "),
          direction: score >= 3 ? "both" : "link_to",
        });
      }
    }

    // Score CMS content index items
    for (const item of indexData || []) {
      const itemTitle = (item.title || "").toLowerCase();
      const site = sites.get(item.website_id);

      let score = 0;
      const reasons: string[] = [];

      if (keyword && itemTitle.includes(keyword)) {
        score += 2;
        reasons.push("Your keyword in their title");
      }

      if (item.website_id !== article.website_id) {
        score += 1;
        reasons.push("Cross-site content");
      }

      if (score > 0) {
        suggestions.push({
          type: "cms_content",
          id: item.id,
          title: item.title || "Untitled",
          url: item.url || undefined,
          site_name: site?.name || "Unknown site",
          site_id: item.website_id,
          relevance: score >= 3 ? "high" : score >= 2 ? "medium" : "low",
          reason: reasons.join("; "),
          direction: "link_to",
        });
      }
    }

    // Sort by relevance
    const relevanceOrder = { high: 0, medium: 1, low: 2 };
    suggestions.sort((a, b) => relevanceOrder[a.relevance] - relevanceOrder[b.relevance]);

    return object({
      source_article: { id: article.id, title: article.title, keyword: article.primary_keyword },
      suggestions: suggestions.slice(0, max_results),
      total_candidates: suggestions.length,
    });
  }
);

server.tool(
  {
    name: "search-org-content",
    description: "Search all content across all sites in the organization by keyword or phrase — useful for finding interlinking targets or duplicate content",
    schema: z.object({
      org_id: z.string().describe("Organization ID"),
      query: z.string().describe("Search keyword or phrase"),
      site_id: z.string().optional().describe("Limit search to a specific site"),
      limit: z.number().min(1).max(50).optional().describe("Max results (default 20)"),
    }),
  },
  async ({ org_id, query, site_id, limit = 20 }) => {
    const searchTerm = `%${query}%`;

    // Search articles
    let articleQuery = supabase
      .from("articles")
      .select("id, title, primary_keyword, status, website_id, meta_description, updated_at")
      .eq("organization_id", org_id)
      .or(`title.ilike.${searchTerm},primary_keyword.ilike.${searchTerm},meta_description.ilike.${searchTerm}`)
      .order("updated_at", { ascending: false })
      .limit(limit);

    if (site_id) articleQuery = articleQuery.eq("website_id", site_id);

    // Search content index
    const { data: siteData } = await supabase
      .from("websites")
      .select("id")
      .eq("organization_id", org_id);
    const siteIds = (siteData || []).map((s) => s.id);

    const [articlesResult, indexResult] = await Promise.all([
      articleQuery,
      siteIds.length > 0
        ? supabase
            .from("content_index")
            .select("id, title, slug, url, website_id, content_type, published_at")
            .in("website_id", site_id ? [site_id] : siteIds)
            .ilike("title", searchTerm)
            .limit(limit)
        : Promise.resolve({ data: [], error: null }),
    ]);

    // Get site names for display
    const { data: sites } = await supabase
      .from("websites")
      .select("id, name, url")
      .eq("organization_id", org_id);
    const siteMap = new Map((sites || []).map((s) => [s.id, s]));

    const results = [
      ...(articlesResult.data || []).map((a) => ({
        type: "article" as const,
        id: a.id,
        title: a.title,
        keyword: a.primary_keyword,
        status: a.status,
        site: siteMap.get(a.website_id)?.name || "Unknown",
        site_url: siteMap.get(a.website_id)?.url,
      })),
      ...(indexResult.data || []).map((c) => ({
        type: "cms_content" as const,
        id: c.id,
        title: c.title,
        url: c.url,
        content_type: c.content_type,
        site: siteMap.get(c.website_id)?.name || "Unknown",
        site_url: siteMap.get(c.website_id)?.url,
      })),
    ];

    return object({ query, results: results.slice(0, limit), total: results.length });
  }
);

server.tool(
  {
    name: "suggest-anchor-text",
    description: "Given a target article/URL and the source article content, suggest natural anchor text placements for interlinking",
    schema: z.object({
      source_article_id: z.string().describe("Article UUID that will contain the link"),
      target_title: z.string().describe("Title of the article/page being linked to"),
      target_keyword: z.string().optional().describe("Primary keyword of the target content"),
      target_url: z.string().optional().describe("URL of the target content"),
    }),
  },
  async ({ source_article_id, target_title, target_keyword, target_url }) => {
    const { data: source, error: err } = await supabase
      .from("articles")
      .select("title, body, primary_keyword")
      .eq("id", source_article_id)
      .single();
    if (err) return error(err.message);

    const plainText = (source.body || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
    const sentences = plainText.split(/[.!?]+/).filter((s) => s.trim().length > 20);
    const targetTerms = [target_keyword, ...target_title.split(/\s+/).filter((w) => w.length > 4)].filter(Boolean).map((t) => t!.toLowerCase());

    const placements: { sentence: string; anchor_text: string; reason: string }[] = [];

    for (const sentence of sentences) {
      const lower = sentence.toLowerCase();
      for (const term of targetTerms) {
        if (lower.includes(term)) {
          placements.push({
            sentence: sentence.trim().slice(0, 200),
            anchor_text: target_keyword || target_title,
            reason: `Contains "${term}" — natural placement for link to "${target_title}"`,
          });
          break;
        }
      }
    }

    return object({
      source_article: source.title,
      target: { title: target_title, keyword: target_keyword, url: target_url },
      placements: placements.slice(0, 10),
      suggested_anchor_texts: [
        target_keyword,
        target_title,
        target_title.toLowerCase().replace(/^(how to |what is |why |the )/i, "").trim(),
      ].filter(Boolean),
    });
  }
);

// ─── PUBLISHING ────────────────────────────────────────────────────────────

server.tool(
  {
    name: "publish-article",
    description: "Publish an article to its connected CMS (WordPress, PrestaShop, or custom webhook). The site must have MCP configured.",
    schema: z.object({
      article_id: z.string().describe("Article UUID to publish"),
    }),
  },
  async ({ article_id }) => {
    // This calls the app's existing API route
    const appUrl = process.env.APP_URL || "http://localhost:3000";
    try {
      const res = await fetch(`${appUrl}/api/articles/${article_id}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (!res.ok) return error(data.error || "Publish failed");
      return object(data);
    } catch (e) {
      return error(`Failed to reach app server at ${appUrl}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
);

server.tool(
  {
    name: "schedule-article",
    description: "Schedule an article for future publication",
    schema: z.object({
      article_id: z.string().describe("Article UUID"),
      publish_at: z.string().describe("ISO 8601 datetime for scheduled publication (must be in the future)"),
    }),
  },
  async ({ article_id, publish_at }) => {
    const appUrl = process.env.APP_URL || "http://localhost:3000";
    try {
      const res = await fetch(`${appUrl}/api/articles/${article_id}/schedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publish_at }),
      });
      const data = await res.json();
      if (!res.ok) return error(data.error || "Schedule failed");
      return object(data);
    } catch (e) {
      return error(`Failed to reach app server at ${appUrl}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
);

// ─── PROMPTS ───────────────────────────────────────────────────────────────

server.prompt(
  {
    name: "write-article",
    description: "Generate a prompt for writing a full SEO-optimized article with a persona's voice",
    schema: z.object({
      topic: z.string().describe("Article topic or title"),
      keyword: z.string().describe("Primary SEO keyword"),
      persona_name: z.string().optional().describe("Writing persona name"),
      voice_summary: z.string().optional().describe("Voice/tone description"),
      word_count: z.number().optional().describe("Target word count (default 1500)"),
      site_guidelines: z.string().optional().describe("Site-specific editorial guidelines"),
    }),
  },
  async ({ topic, keyword, persona_name, voice_summary, word_count = 1500, site_guidelines }) => {
    let prompt = `Write a comprehensive, SEO-optimized article about "${topic}".

## Requirements
- Primary keyword: "${keyword}" — use naturally throughout, aim for 1-2% density
- Target length: ~${word_count} words
- Include an engaging H1 title with the keyword
- Use H2 and H3 subheadings to structure the content
- Write a compelling introduction that hooks the reader
- Include practical examples, tips, or data where relevant
- End with a clear conclusion or call to action
- Output as clean HTML (no full document wrapper, just the article body)`;

    if (persona_name || voice_summary) {
      prompt += `\n\n## Voice & Tone`;
      if (persona_name) prompt += `\nWrite as ${persona_name}.`;
      if (voice_summary) prompt += `\n${voice_summary}`;
    }

    if (site_guidelines) {
      prompt += `\n\n## Editorial Guidelines\n${site_guidelines}`;
    }

    prompt += `\n\n## SEO Meta
Also provide at the end:
- Meta title (max 60 chars, include keyword)
- Meta description (max 160 chars, include keyword, compelling CTA)`;

    return text(prompt);
  }
);

server.prompt(
  {
    name: "interlink-review",
    description: "Generate a prompt for reviewing and suggesting internal links for an article",
    schema: z.object({
      article_title: z.string().describe("Title of the article to review"),
      article_keyword: z.string().describe("Primary keyword"),
      available_links: z.string().describe("JSON array of available pages/articles to link to, each with title and url"),
    }),
  },
  async ({ article_title, article_keyword, available_links }) => {
    return text(`Review the article "${article_title}" (keyword: "${article_keyword}") and suggest internal link placements.

Available pages to link to:
${available_links}

For each suggestion provide:
1. The sentence or paragraph where a link should be placed
2. The recommended anchor text
3. Which page it should link to and why
4. Whether it's a contextual link, further reading, or related content

Aim for 3-5 internal links. Ensure anchor text is natural, varied (not just the keyword), and relevant to the linked content.`);
  }
);

// ─── RESOURCES ─────────────────────────────────────────────────────────────

server.resource(
  {
    uri: "writing-champ://capabilities",
    name: "WritingChamp Capabilities",
    mimeType: "application/json",
  },
  async () =>
    object({
      tools: [
        "list-personas", "get-persona",
        "list-sites", "get-site",
        "list-articles", "get-article", "create-article", "update-article",
        "research-keywords", "check-seo", "generate-meta",
        "get-content-index",
        "find-interlink-opportunities", "search-org-content", "suggest-anchor-text",
        "publish-article", "schedule-article",
      ],
      prompts: ["write-article", "interlink-review"],
      description: "AI-powered content suite for creating, optimizing, and publishing SEO content across multiple CMS platforms with cross-site interlinking.",
    })
);

// ─── START ─────────────────────────────────────────────────────────────────

const port = parseInt(process.env.MCP_PORT || "3100", 10);
server.listen(port);
console.log(`WritingChamp MCP server running on port ${port}`);
