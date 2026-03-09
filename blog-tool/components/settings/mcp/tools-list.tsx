"use client";

import { useState } from "react";
import { Wrench, ChevronDown, Search, Globe, FileText, Link2, Send } from "lucide-react";

type ToolCategory = {
  name: string;
  icon: typeof Wrench;
  tools: { name: string; description: string }[];
};

const TOOL_CATEGORIES: ToolCategory[] = [
  {
    name: "Content Management",
    icon: FileText,
    tools: [
      { name: "list-articles", description: "List articles with filtering by site, status, or search" },
      { name: "get-article", description: "Get full article content, SEO metadata, and status" },
      { name: "create-article", description: "Create a new article draft for a site" },
      { name: "update-article", description: "Update article content, title, meta fields, or status" },
      { name: "list-personas", description: "List all writing personas in the organization" },
      { name: "get-persona", description: "Get full details of a writing persona" },
    ],
  },
  {
    name: "SEO & Keywords",
    icon: Search,
    tools: [
      { name: "research-keywords", description: "Get keyword suggestions from Google Autocomplete" },
      { name: "check-seo", description: "Analyze article SEO — keyword usage, meta tags, headings, readability" },
      { name: "generate-meta", description: "Generate SEO meta title and description from article content" },
    ],
  },
  {
    name: "Cross-Site Interlinking",
    icon: Link2,
    tools: [
      { name: "find-interlink-opportunities", description: "Find content across all org sites for internal linking" },
      { name: "search-org-content", description: "Search all content across all sites by keyword" },
      { name: "suggest-anchor-text", description: "Suggest natural anchor text placements for links" },
    ],
  },
  {
    name: "Sites & Publishing",
    icon: Send,
    tools: [
      { name: "list-sites", description: "List all connected CMS sites" },
      { name: "get-site", description: "Get site details including editorial guidelines" },
      { name: "get-content-index", description: "Fetch published content from a connected CMS" },
      { name: "publish-article", description: "Publish article to its connected CMS" },
      { name: "schedule-article", description: "Schedule article for future publication" },
    ],
  },
];

export function McpToolsList() {
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <section
      className="rounded-xl overflow-hidden"
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
    >
      <div className="p-6 pb-3">
        <div className="flex items-center gap-2 mb-1">
          <Wrench size={18} style={{ color: "var(--accent)" }} />
          <h2 className="text-lg font-semibold" style={{ color: "var(--foreground)" }}>
            Available Tools
          </h2>
          <span
            className="text-xs px-2 py-0.5 rounded-full"
            style={{ background: "var(--surface-warm)", color: "var(--text-muted)" }}
          >
            {TOOL_CATEGORIES.reduce((sum, c) => sum + c.tools.length, 0)} tools
          </span>
        </div>
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          These tools are available to Claude Desktop and any connected MCP client.
        </p>
      </div>

      <div>
        {TOOL_CATEGORIES.map((category) => {
          const isOpen = expanded === category.name;
          return (
            <div key={category.name}>
              <button
                onClick={() => setExpanded(isOpen ? null : category.name)}
                className="w-full flex items-center justify-between px-6 py-3 transition hover:opacity-80"
                style={{ borderTop: "1px solid var(--border)" }}
              >
                <div className="flex items-center gap-2">
                  <category.icon size={15} style={{ color: "var(--accent)" }} />
                  <span className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
                    {category.name}
                  </span>
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                    {category.tools.length}
                  </span>
                </div>
                <ChevronDown
                  size={14}
                  style={{
                    color: "var(--text-muted)",
                    transform: isOpen ? "rotate(180deg)" : undefined,
                    transition: "transform 0.2s",
                  }}
                />
              </button>

              {isOpen && (
                <div className="px-6 pb-3 space-y-2">
                  {category.tools.map((tool) => (
                    <div
                      key={tool.name}
                      className="flex items-start gap-3 p-2.5 rounded-lg"
                      style={{ background: "var(--background)" }}
                    >
                      <code
                        className="text-xs font-mono px-1.5 py-0.5 rounded shrink-0"
                        style={{ background: "var(--surface-warm)", color: "var(--accent)" }}
                      >
                        {tool.name}
                      </code>
                      <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                        {tool.description}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
