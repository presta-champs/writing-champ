/**
 * Stdio transport entry point for Claude Desktop.
 *
 * Claude Desktop config:
 *   "writing-champ": {
 *     "command": "node",
 *     "args": ["--import", "./load-env.js", "--import", "tsx/esm", "stdio.ts"],
 *     "cwd": "D:\\Downloads\\writing-champ-master\\writing-champ-master\\mcp-server"
 *   }
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { supabase } from "./supabase.js";

// Suppress any console output — stdio transport uses stdout for JSON-RPC
const origLog = console.log;
const origError = console.error;
console.log = (...args: unknown[]) => process.stderr.write(args.join(" ") + "\n");
console.error = (...args: unknown[]) => process.stderr.write(args.join(" ") + "\n");

const server = new McpServer({
  name: "writing-champ",
  version: "1.0.0",
});

// ─── Helper ────────────────────────────────────────────────────────────────

function err(msg: string) {
  return { content: [{ type: "text" as const, text: `Error: ${msg}` }] };
}
function json(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

// ─── ORGANIZATIONS ────────────────────────────────────────────────────────

server.tool(
  "list-organizations",
  "List all organizations — use this first to find the correct org_id",
  {},
  async () => {
    const { data, error } = await supabase
      .from("organizations")
      .select("id, name, created_at")
      .order("name");
    if (error) return err(error.message);
    return json(data || []);
  }
);

server.tool(
  "list-org-members",
  "List members of an organization — use to find user IDs for created_by",
  { org_id: z.string().describe("Organization ID") },
  async ({ org_id }) => {
    const { data, error } = await supabase
      .from("organization_members")
      .select("user_id, role, created_at")
      .eq("organization_id", org_id);
    if (error) return err(error.message);
    return json(data || []);
  }
);

// ─── PERSONAS ──────────────────────────────────────────────────────────────

server.tool(
  "list-personas",
  "List all writing personas available in the organization",
  { org_id: z.string().describe("Organization ID") },
  async ({ org_id }) => {
    const { data, error } = await supabase
      .from("personas")
      .select("id, name, bio, voice_summary, tone_formal, tone_warmth, tone_conciseness")
      .eq("organization_id", org_id)
      .order("name");
    if (error) return err(error.message);
    return json(data || []);
  }
);

server.tool(
  "get-persona",
  "Get full details of a specific writing persona",
  { persona_id: z.string().describe("Persona UUID") },
  async ({ persona_id }) => {
    const { data, error } = await supabase
      .from("personas")
      .select("*")
      .eq("id", persona_id)
      .single();
    if (error) return err(error.message);
    return json(data);
  }
);

// ─── SITES ─────────────────────────────────────────────────────────────────

server.tool(
  "list-sites",
  "List all CMS sites connected to the organization",
  { org_id: z.string().describe("Organization ID") },
  async ({ org_id }) => {
    const { data, error } = await supabase
      .from("websites")
      .select("id, name, url, platform_type, mcp_status, site_description, content_pillars")
      .eq("organization_id", org_id)
      .order("name");
    if (error) return err(error.message);
    return json(data || []);
  }
);

server.tool(
  "get-site",
  "Get full details of a specific site including editorial guidelines",
  { site_id: z.string().describe("Website UUID") },
  async ({ site_id }) => {
    const { data, error } = await supabase
      .from("websites")
      .select("*")
      .eq("id", site_id)
      .single();
    if (error) return err(error.message);
    if (data) {
      delete data.mcp_auth_token;
      delete data.mcp_auth_token_iv;
    }
    return json(data);
  }
);

// ─── ARTICLES ──────────────────────────────────────────────────────────────

server.tool(
  "list-articles",
  "List articles with optional filtering by site, status, or search query",
  {
    org_id: z.string().describe("Organization ID"),
    site_id: z.string().optional().describe("Filter by website ID"),
    status: z.enum(["draft", "pending_approval", "approved", "scheduled", "published", "failed"]).optional(),
    search: z.string().optional().describe("Search in title or primary keyword"),
    limit: z.number().min(1).max(100).optional().describe("Max results (default 25)"),
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
    const { data, error } = await query;
    if (error) return err(error.message);
    return json(data || []);
  }
);

server.tool(
  "get-article",
  "Get full article content including HTML body, SEO metadata, and status",
  { article_id: z.string().describe("Article UUID") },
  async ({ article_id }) => {
    const { data, error } = await supabase
      .from("articles")
      .select("*")
      .eq("id", article_id)
      .single();
    if (error) return err(error.message);
    return json(data);
  }
);

server.tool(
  "update-article",
  "Update an article's content, title, meta fields, or status",
  {
    article_id: z.string().describe("Article UUID"),
    title: z.string().optional(),
    body: z.string().optional().describe("Full HTML body"),
    meta_title: z.string().optional().describe("SEO meta title (max 60 chars)"),
    meta_description: z.string().optional().describe("SEO meta description (max 160 chars)"),
    status: z.enum(["draft", "pending_approval", "approved", "scheduled", "published"]).optional(),
    primary_keyword: z.string().optional(),
  },
  async ({ article_id, ...fields }) => {
    const update: Record<string, unknown> = { ...fields, updated_at: new Date().toISOString() };
    const { data, error } = await supabase
      .from("articles")
      .update(update)
      .eq("id", article_id)
      .select("id, title, status, updated_at")
      .single();
    if (error) return err(error.message);
    return json(data);
  }
);

server.tool(
  "create-article",
  "Create a new article draft for a site",
  {
    org_id: z.string().describe("Organization ID"),
    website_id: z.string().describe("Target website UUID"),
    title: z.string().describe("Article title"),
    primary_keyword: z.string().optional(),
    body: z.string().optional().describe("HTML body content"),
    meta_title: z.string().optional(),
    meta_description: z.string().optional(),
    persona_id: z.string().optional().describe("Writing persona UUID"),
    created_by: z.string().optional().describe("User UUID — use list-org-members to find valid IDs"),
  },
  async ({ org_id, website_id, title, primary_keyword, body, meta_title, meta_description, persona_id, created_by }) => {
    // If no created_by provided, try to find the first member of the org
    let userId = created_by || null;
    if (!userId) {
      const { data: members } = await supabase
        .from("organization_members")
        .select("user_id")
        .eq("organization_id", org_id)
        .limit(1);
      if (members && members.length > 0) userId = members[0].user_id;
    }

    const { data, error } = await supabase
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
        created_by: userId,
        status: "draft",
      })
      .select("id, title, status, created_at")
      .single();
    if (error) return err(error.message);
    return json(data);
  }
);

// ─── SEO ───────────────────────────────────────────────────────────────────

server.tool(
  "research-keywords",
  "Get keyword suggestions based on a seed keyword using Google Autocomplete",
  {
    seed: z.string().describe("Seed keyword"),
    country: z.string().optional().describe("Country code (default: us)"),
    limit: z.number().min(1).max(20).optional().describe("Max suggestions (default 10)"),
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
      return json(suggestions.map((kw) => ({ keyword: kw })));
    } catch {
      const suffixes = ["", " guide", " tips", " best practices", " examples", " how to", " tutorial", " vs", " benefits", " tools"];
      return json(suffixes.slice(0, limit).map((s) => ({ keyword: seed.trim() + s })));
    }
  }
);

server.tool(
  "check-seo",
  "Analyze article SEO — keyword usage, meta tags, headings, content length, readability",
  { article_id: z.string().describe("Article UUID to analyze") },
  async ({ article_id }) => {
    const { data: article, error: e } = await supabase
      .from("articles")
      .select("title, body, primary_keyword, meta_title, meta_description")
      .eq("id", article_id)
      .single();
    if (e) return err(e.message);
    if (!article) return err("Article not found");

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

    if (!keyword) {
      issues.push("No primary keyword set");
    } else {
      const kwCount = (plainText.toLowerCase().match(new RegExp(keyword, "g")) || []).length;
      const density = wordCount > 0 ? (kwCount / wordCount) * 100 : 0;
      if (kwCount === 0) issues.push(`Primary keyword "${keyword}" not found in content`);
      else if (density < 0.5) issues.push(`Keyword density too low (${density.toFixed(1)}%)`);
      else if (density > 3) issues.push(`Keyword density too high (${density.toFixed(1)}%)`);
      else passed.push(`Keyword density OK (${density.toFixed(1)}%)`);

      if (article.title?.toLowerCase().includes(keyword)) passed.push("Keyword in title");
      else issues.push("Primary keyword missing from title");
      if (article.meta_title?.toLowerCase().includes(keyword)) passed.push("Keyword in meta title");
      else issues.push("Primary keyword missing from meta title");
      if (article.meta_description?.toLowerCase().includes(keyword)) passed.push("Keyword in meta description");
      else issues.push("Primary keyword missing from meta description");

      const h1Match = headings.some((h) => h.toLowerCase().includes(keyword) && /<h1/i.test(h));
      if (h1Match) passed.push("Keyword in H1");
      else issues.push("Primary keyword missing from H1");
    }

    if (wordCount < 300) issues.push(`Content too short (${wordCount} words)`);
    else if (wordCount < 800) issues.push(`Content could be longer (${wordCount} words)`);
    else passed.push(`Good content length (${wordCount} words)`);

    if (!article.meta_title) issues.push("Missing meta title");
    else if (article.meta_title.length > 60) issues.push(`Meta title too long (${article.meta_title.length} chars)`);
    else passed.push("Meta title length OK");

    if (!article.meta_description) issues.push("Missing meta description");
    else if (article.meta_description.length > 160) issues.push(`Meta description too long (${article.meta_description.length} chars)`);
    else passed.push("Meta description length OK");

    if (headings.length === 0) issues.push("No headings found");
    else passed.push(`${headings.length} heading(s) found`);

    if (images.length === 0) issues.push("No images found");
    else if (imagesWithAlt.length < images.length) issues.push(`${images.length - imagesWithAlt.length} image(s) missing alt text`);
    else passed.push(`All ${images.length} image(s) have alt text`);

    if (links.length === 0) issues.push("No links found");
    else passed.push(`${links.length} link(s) found`);

    const score = Math.max(0, Math.min(100, Math.round((passed.length / (passed.length + issues.length)) * 100)));
    return json({ score, issues, passed, wordCount, headingCount: headings.length, imageCount: images.length, linkCount: links.length });
  }
);

server.tool(
  "generate-meta",
  "Generate SEO meta title and description from article content",
  { article_id: z.string().describe("Article UUID") },
  async ({ article_id }) => {
    const { data: article, error: e } = await supabase
      .from("articles")
      .select("title, body, primary_keyword")
      .eq("id", article_id)
      .single();
    if (e) return err(e.message);

    const plainText = (article.body || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
    const excerpt = plainText.slice(0, 500);

    const metaTitle = article.title
      ? article.title.length > 60 ? article.title.slice(0, 57) + "..." : article.title
      : "Untitled Article";
    const metaDescription = excerpt.length > 160 ? excerpt.slice(0, 157) + "..." : excerpt || "Read this article for insights and practical tips.";

    return json({ meta_title: metaTitle, meta_description: metaDescription, primary_keyword: article.primary_keyword || "" });
  }
);

// ─── CONTENT INDEX ─────────────────────────────────────────────────────────

server.tool(
  "get-content-index",
  "Fetch published content from a connected CMS site",
  { site_id: z.string().describe("Website UUID") },
  async ({ site_id }) => {
    const { data, error } = await supabase
      .from("content_index")
      .select("id, remote_id, title, slug, url, status, published_at, content_type")
      .eq("website_id", site_id)
      .order("published_at", { ascending: false })
      .limit(200);
    if (error) return err(error.message);
    return json(data || []);
  }
);

// ─── CROSS-SITE INTERLINKING ──────────────────────────────────────────────

server.tool(
  "find-interlink-opportunities",
  "Find content across all org sites for internal linking — analyzes keyword and topic overlap",
  {
    article_id: z.string().describe("Article UUID to find interlink targets for"),
    org_id: z.string().describe("Organization ID"),
    max_results: z.number().min(1).max(50).optional().describe("Max suggestions (default 15)"),
  },
  async ({ article_id, org_id, max_results = 15 }) => {
    const { data: article, error: artErr } = await supabase
      .from("articles")
      .select("id, title, primary_keyword, body, website_id")
      .eq("id", article_id)
      .single();
    if (artErr) return err(artErr.message);
    if (!article) return err("Article not found");

    const keyword = (article.primary_keyword || "").toLowerCase();
    const plainText = (article.body || "").replace(/<[^>]*>/g, " ").toLowerCase();

    const [articlesResult, sitesResult] = await Promise.all([
      supabase
        .from("articles")
        .select("id, title, primary_keyword, website_id, status, meta_description")
        .eq("organization_id", org_id)
        .neq("id", article_id)
        .in("status", ["published", "approved", "draft"])
        .limit(500),
      supabase
        .from("websites")
        .select("id, name, url")
        .eq("organization_id", org_id),
    ]);

    const sites = new Map((sitesResult.data || []).map((s: any) => [s.id, s]));
    const siteIds = Array.from(sites.keys());

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

    for (const other of articlesResult.data || []) {
      const otherKeyword = (other.primary_keyword || "").toLowerCase();
      const otherTitle = (other.title || "").toLowerCase();
      const site = sites.get(other.website_id);
      let score = 0;
      const reasons: string[] = [];

      if (keyword && otherKeyword) {
        if (keyword === otherKeyword) { score += 3; reasons.push("Same primary keyword"); }
        else if (otherKeyword.includes(keyword) || keyword.includes(otherKeyword)) { score += 2; reasons.push("Related primary keyword"); }
      }
      if (keyword && otherTitle.includes(keyword)) { score += 2; reasons.push("Your keyword in their title"); }
      if (otherKeyword && plainText.includes(otherKeyword)) { score += 2; reasons.push("Their keyword in your content"); }
      if (other.website_id !== article.website_id) { score += 1; reasons.push("Cross-site link opportunity"); }

      if (score > 0) {
        suggestions.push({
          type: "article", id: other.id, title: other.title || "Untitled",
          site_name: site?.name || "Unknown", site_id: other.website_id,
          relevance: score >= 4 ? "high" : score >= 2 ? "medium" : "low",
          reason: reasons.join("; "), direction: score >= 3 ? "both" : "link_to",
        });
      }
    }

    for (const item of indexData || []) {
      const itemTitle = (item.title || "").toLowerCase();
      const site = sites.get(item.website_id);
      let score = 0;
      const reasons: string[] = [];

      if (keyword && itemTitle.includes(keyword)) { score += 2; reasons.push("Your keyword in their title"); }
      if (item.website_id !== article.website_id) { score += 1; reasons.push("Cross-site content"); }

      if (score > 0) {
        suggestions.push({
          type: "cms_content", id: item.id, title: item.title || "Untitled",
          url: item.url || undefined, site_name: site?.name || "Unknown", site_id: item.website_id,
          relevance: score >= 3 ? "high" : score >= 2 ? "medium" : "low",
          reason: reasons.join("; "), direction: "link_to",
        });
      }
    }

    const relevanceOrder = { high: 0, medium: 1, low: 2 };
    suggestions.sort((a, b) => relevanceOrder[a.relevance] - relevanceOrder[b.relevance]);

    return json({
      source_article: { id: article.id, title: article.title, keyword: article.primary_keyword },
      suggestions: suggestions.slice(0, max_results),
      total_candidates: suggestions.length,
    });
  }
);

server.tool(
  "search-org-content",
  "Search all content across all sites by keyword — find interlinking targets or duplicates",
  {
    org_id: z.string().describe("Organization ID"),
    query: z.string().describe("Search keyword or phrase"),
    site_id: z.string().optional().describe("Limit to a specific site"),
    limit: z.number().min(1).max(50).optional().describe("Max results (default 20)"),
  },
  async ({ org_id, query, site_id, limit = 20 }) => {
    const searchTerm = `%${query}%`;

    let articleQuery = supabase
      .from("articles")
      .select("id, title, primary_keyword, status, website_id, meta_description, updated_at")
      .eq("organization_id", org_id)
      .or(`title.ilike.${searchTerm},primary_keyword.ilike.${searchTerm},meta_description.ilike.${searchTerm}`)
      .order("updated_at", { ascending: false })
      .limit(limit);
    if (site_id) articleQuery = articleQuery.eq("website_id", site_id);

    const { data: siteData } = await supabase.from("websites").select("id").eq("organization_id", org_id);
    const siteIds = (siteData || []).map((s: any) => s.id);

    const [articlesResult, indexResult] = await Promise.all([
      articleQuery,
      siteIds.length > 0
        ? supabase.from("content_index").select("id, title, slug, url, website_id, content_type, published_at")
            .in("website_id", site_id ? [site_id] : siteIds).ilike("title", searchTerm).limit(limit)
        : Promise.resolve({ data: [], error: null }),
    ]);

    const { data: sites } = await supabase.from("websites").select("id, name, url").eq("organization_id", org_id);
    const siteMap = new Map((sites || []).map((s: any) => [s.id, s]));

    const results = [
      ...(articlesResult.data || []).map((a: any) => ({
        type: "article", id: a.id, title: a.title, keyword: a.primary_keyword, status: a.status,
        site: siteMap.get(a.website_id)?.name || "Unknown",
      })),
      ...((indexResult as any).data || []).map((c: any) => ({
        type: "cms_content", id: c.id, title: c.title, url: c.url, content_type: c.content_type,
        site: siteMap.get(c.website_id)?.name || "Unknown",
      })),
    ];

    return json({ query, results: results.slice(0, limit), total: results.length });
  }
);

server.tool(
  "suggest-anchor-text",
  "Suggest natural anchor text placements for interlinking between articles",
  {
    source_article_id: z.string().describe("Article UUID that will contain the link"),
    target_title: z.string().describe("Title of the target page"),
    target_keyword: z.string().optional().describe("Primary keyword of target content"),
    target_url: z.string().optional().describe("URL of target content"),
  },
  async ({ source_article_id, target_title, target_keyword, target_url }) => {
    const { data: source, error: e } = await supabase
      .from("articles")
      .select("title, body, primary_keyword")
      .eq("id", source_article_id)
      .single();
    if (e) return err(e.message);

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
            reason: `Contains "${term}" — natural link placement`,
          });
          break;
        }
      }
    }

    return json({
      source_article: source.title,
      target: { title: target_title, keyword: target_keyword, url: target_url },
      placements: placements.slice(0, 10),
      suggested_anchor_texts: [target_keyword, target_title].filter(Boolean),
    });
  }
);

// ─── PUBLISHING ────────────────────────────────────────────────────────────

server.tool(
  "publish-article",
  "Publish an article to its connected CMS",
  { article_id: z.string().describe("Article UUID to publish") },
  async ({ article_id }) => {
    const appUrl = process.env.APP_URL || "http://localhost:3000";
    try {
      const res = await fetch(`${appUrl}/api/articles/${article_id}/publish`, { method: "POST", headers: { "Content-Type": "application/json" } });
      const data = await res.json();
      if (!res.ok) return err(data.error || "Publish failed");
      return json(data);
    } catch (e) {
      return err(`Failed to reach app server: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
);

server.tool(
  "schedule-article",
  "Schedule an article for future publication",
  {
    article_id: z.string().describe("Article UUID"),
    publish_at: z.string().describe("ISO 8601 datetime for scheduled publication"),
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
      if (!res.ok) return err(data.error || "Schedule failed");
      return json(data);
    } catch (e) {
      return err(`Failed to reach app server: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
);

// ─── PROMPTS ───────────────────────────────────────────────────────────────

server.prompt(
  "write-article",
  "Generate a prompt for writing a full SEO-optimized article",
  {
    topic: z.string().describe("Article topic or title"),
    keyword: z.string().describe("Primary SEO keyword"),
    persona_name: z.string().optional().describe("Writing persona name"),
    voice_summary: z.string().optional().describe("Voice/tone description"),
    word_count: z.number().optional().describe("Target word count (default 1500)"),
    site_guidelines: z.string().optional().describe("Site-specific editorial guidelines"),
  },
  ({ topic, keyword, persona_name, voice_summary, word_count = 1500, site_guidelines }) => {
    let prompt = `Write a comprehensive, SEO-optimized article about "${topic}".

## Requirements
- Primary keyword: "${keyword}" — use naturally, aim for 1-2% density
- Target length: ~${word_count} words
- Include an engaging H1 title with the keyword
- Use H2 and H3 subheadings
- Write a compelling introduction
- Include practical examples, tips, or data
- End with a conclusion or call to action
- Output as clean HTML (article body only)`;

    if (persona_name || voice_summary) {
      prompt += `\n\n## Voice & Tone`;
      if (persona_name) prompt += `\nWrite as ${persona_name}.`;
      if (voice_summary) prompt += `\n${voice_summary}`;
    }
    if (site_guidelines) prompt += `\n\n## Editorial Guidelines\n${site_guidelines}`;

    prompt += `\n\n## SEO Meta\nAlso provide:\n- Meta title (max 60 chars, include keyword)\n- Meta description (max 160 chars, include keyword)`;

    return { messages: [{ role: "user" as const, content: { type: "text" as const, text: prompt } }] };
  }
);

server.prompt(
  "interlink-review",
  "Generate a prompt for reviewing and suggesting internal links",
  {
    article_title: z.string().describe("Title of the article to review"),
    article_keyword: z.string().describe("Primary keyword"),
    available_links: z.string().describe("JSON array of available pages to link to"),
  },
  ({ article_title, article_keyword, available_links }) => {
    return {
      messages: [{
        role: "user" as const,
        content: {
          type: "text" as const,
          text: `Review the article "${article_title}" (keyword: "${article_keyword}") and suggest internal link placements.

Available pages to link to:
${available_links}

For each suggestion provide:
1. The sentence or paragraph where a link should be placed
2. The recommended anchor text
3. Which page it should link to and why
4. Whether it's contextual, further reading, or related content

Aim for 3-5 internal links with natural, varied anchor text.`,
        },
      }],
    };
  }
);

// ─── RESOURCES ─────────────────────────────────────────────────────────────

server.resource(
  "capabilities",
  "writing-champ://capabilities",
  async () => ({
    contents: [{
      uri: "writing-champ://capabilities",
      mimeType: "application/json",
      text: JSON.stringify({
        tools: [
          "list-personas", "get-persona", "list-sites", "get-site",
          "list-articles", "get-article", "create-article", "update-article",
          "research-keywords", "check-seo", "generate-meta", "get-content-index",
          "find-interlink-opportunities", "search-org-content", "suggest-anchor-text",
          "publish-article", "schedule-article",
        ],
        prompts: ["write-article", "interlink-review"],
        description: "AI-powered content suite for SEO content across multiple CMS platforms with cross-site interlinking.",
      }, null, 2),
    }],
  })
);

// ─── START ─────────────────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.log("WritingChamp MCP stdio server connected");
}

main().catch((e) => {
  process.stderr.write(`Fatal: ${e}\n`);
  process.exit(1);
});
