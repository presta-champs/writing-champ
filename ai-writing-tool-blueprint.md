# AI Content Suite — Product Blueprint

---

## Vision

A unified internal environment for creating, managing, and publishing persona-driven content across multiple websites. Three tools — blog, email, and social — sit under a common admin and share personas, websites, and campaign briefs. An idea enters the system once. Each tool produces its format-appropriate output from that shared context. The result is a fully consistent, automated content marketing funnel driven by real voice, not generic AI copy.

This document covers the blog tool in full, the shared infrastructure, and the realistic integration strategy for the existing email tool.

---

## The Full Environment

```
┌──────────────────────────────────────────────────────────────────┐
│                     COMMON ADMIN                                 │
│   Organizations · Users · Personas · Campaigns                   │
│   Websites (MCP config) · News Feed · Usage tracking             │
│                                                                  │
│   Lives in the blog tool's backend (PostgreSQL)                  │
│   Exposed to other tools via REST API                            │
└─────────────────────┬────────────────────────────────────────────┘
                      │  REST API (shared data layer)
          ┌───────────┼────────────────┐
          ▼           ▼                ▼
   ┌────────────┐  ┌──────────────┐  ┌──────────────┐
   │  BLOG TOOL │  │  EMAIL TOOL  │  │  SOCIAL TOOL │
   │  Next.js   │  │  Vanilla JS  │  │  (planned)   │
   │  PostgreSQL│  │  SQLite      │  │              │
   │  Docker    │  │  Docker      │  │              │
   └─────┬──────┘  └──────┬───────┘  └──────┬───────┘
         │                │                  │
         ▼                ▼                  ▼
      MCP to          Mailchimp          Platform
      websites          API               APIs

All services run in Docker containers on a shared internal network.
A root-level docker-compose.yml orchestrates the full suite.
Each tool can also be started independently via its own docker-compose.
```

**Important:** The email tool is an existing, independently deployed application (vanilla JS + Node.js/Express + SQLite, running in Docker). It is not being rewritten. Integration happens through an API bridge — the email tool adds a lightweight module that fetches personas and reports campaign status back to the common admin's API. Both tools remain independently deployable.

---

## A Note on the Email Tool's Origins

The email tool was built as a standalone application with no expectation of being part of a larger system. Its architecture reflects that: state lives in localStorage, brands are isolated per-instance, there is no auth layer, AI config is stored client-side, and there is no concept of shared personas, campaigns, or cross-tool coordination.

**Everything described in this blueprint takes precedence over those original design decisions.** Where the email tool's standalone architecture conflicts with the requirements of the owned media environment — shared personas, campaign continuity, consistent voice across tools, cross-tool status tracking — the email tool must be adapted. The API bridge approach described here is the minimum viable adaptation that preserves the existing tool's functionality while bringing it into the shared environment.

Concretely, this means:

- **Brands become websites.** The email tool's brand concept maps to the blog tool's website concept. The one-time brand-to-website mapping is not optional — without it, persona and campaign sharing cannot function.
- **Tone selectors become persona selectors.** The existing `currentTone` dropdown and content length slider are the standalone tool's approximation of what a persona does properly. In the shared environment, persona selection replaces or wraps these controls. The underlying `buildPrompt()` function is updated to accept persona parameters.
- **The Content Planner becomes campaign-aware.** Projects in the Content Planner are no longer isolated planning artifacts — they are the email tool's face of a shared campaign object. The `campaign_id` column is not cosmetic; it is the thread connecting an email project to the blog post, the social content, and the shared brief that seeded all of them.
- **AI config moves toward the shared layer.** The email tool currently stores its OpenAI key client-side. As the environment matures, AI provider configuration should migrate to the common admin. The email tool's OpenAI dependency may also be revisited — the blog tool uses Claude as primary, and consistency across tools is a long-term goal.
- **Scalability is now a shared concern.** The standalone tool has no usage tracking, no tier enforcement, and no multi-tenancy. These are handled at the common admin level and do not need to be rebuilt inside the email tool — but the email tool must report usage events to the shared `usage_events` table so the common admin's dashboard reflects the full picture.

The email tool's existing features — newsletter generation, Mailchimp integration, statistics, A/B tests, subscriber tagging, the Content Planner — are not being replaced. They are being connected. The work is additive at the feature level and architectural at the integration level.

---

## The Two Architectures Side by Side

Understanding both tools' actual stacks is essential for knowing what the integration requires.

| | Blog tool | Email tool |
|---|---|---|
| Frontend | Next.js (Docker container) | Vanilla JS via nginx (Docker container) |
| Backend | Node.js via Next.js API routes (Docker container) | Node.js / Express (Docker container) |
| Database | PostgreSQL (Docker container) | SQLite (Docker volume) |
| Auth | JWT / session auth (internal) | None (internal tool) |
| AI | Claude (primary), switchable | OpenAI (gpt-4o-mini default) |
| State | Database + server | localStorage + SQLite |
| Deployment | Docker (all services containerized) | Docker (nginx:3001 + node:3002) |
| Brands/orgs | Organizations → Websites | Brands (localStorage) |
| Campaign analog | Campaign object (new) | Content Planner projects (existing) |
| Tone config | Persona (structured) | `currentTone` select + `buildPrompt()` |

---

## Integration Strategy: API Bridge

The common admin and all shared data live in the blog tool's PostgreSQL database. The blog tool exposes a set of REST API endpoints that any other tool can call. The email tool consumes these endpoints through a new integration module without changing its core architecture.

### What the blog tool exposes

```
GET  /api/shared/personas              List personas for an org
GET  /api/shared/personas/:id          Single persona (voice, tone params)
GET  /api/shared/campaigns             List campaigns
GET  /api/shared/campaigns/:id         Campaign detail (brief, source article, status)
POST /api/shared/campaigns/:id/email   Report email output linked to campaign
GET  /api/shared/websites              List websites (for brand mapping)
```

These endpoints require an API key per integration (stored in the email tool's existing `brand_settings` table alongside the Mailchimp key).

### What the email tool adds

A new `integration.js` module in `app/js/` that:
- Fetches the persona list from the blog tool API and presents it as a dropdown in the Setup tab (alongside or replacing the existing tone selector)
- Fetches a selected persona's voice and tone params and injects them into `buildPrompt()`
- Fetches open campaigns and surfaces them in the Content Planner so projects can be linked to a campaign
- Posts back to `/api/shared/campaigns/:id/email` when a newsletter is sent, updating the campaign's `email_sent` status

### Brand-to-website mapping

The email tool has **brands** (stored in localStorage, each with its own Mailchimp key). The blog tool has **websites**. These are not the same concept but they map to each other: a brand in the email tool corresponds to a website in the blog tool.

A one-time mapping config is stored in the email tool's `brand_settings` SQLite table as a new `blog_tool_website_id` column. Once mapped, the integration module knows which website's personas and campaigns to fetch when a given brand is active.

---

## The Campaign Object

When someone brings an idea to the common admin, it becomes a **campaign**. A campaign holds the brief: what this is about, which website, which persona, and what the core message is. Each tool produces its own output from that shared brief independently — there is no forced sequence.

The blog tool produces a post. The email tool produces a newsletter. The social tool produces platform posts. All three share the same persona, the same core message, and the same site context.

A campaign can be started from scratch (a free-text idea) or seeded from a news article pulled from the industry feed. When seeded from a news article, the source article's metadata is stored with the campaign and carried through to every tool's output as a citation reference.

**Campaign states:**
`draft` → `in_progress` → outputs tracked independently: `blog_published`, `email_sent`, `social_posted`

**Campaign → Content Planner mapping:**
The email tool's existing Content Planner has projects with categories `blog | service | module | marketing` and a status workflow `scheduled → working → done → sent → archived`. When a campaign is linked to a Content Planner project, the project gains a `campaign_id` reference. The campaign's `email_sent` field updates when the project is marked `sent`. This is a lightweight link — the Content Planner continues to work exactly as it does today.

---

## The Shared Persona Layer

Personas live in the blog tool's PostgreSQL database. They are created and edited in the common admin. Other tools consume them via the API bridge.

**How persona data flows to the email tool:**
1. User opens the email tool and selects a brand
2. The integration module calls `GET /api/shared/personas` (filtered by the brand's mapped website)
3. A persona dropdown appears in the Setup tab alongside the existing tone and language selectors
4. When the user selects a persona, the module calls `GET /api/shared/personas/:id`
5. The persona's tone params and voice summary are passed into `buildPrompt()` alongside the existing brand, template, and language data

The email tool's existing `selectTone()` function remains available as a fallback when no persona is selected. Persona-driven generation is an enhancement, not a replacement of the existing flow.

**What a persona exposes to each tool:**

| Parameter | Blog tool | Email tool | Social tool |
|---|---|---|---|
| `voice_summary` | Full prompt injection | Injected into `buildPrompt()` | Compressed injection |
| `tone_formal` | Yes | Yes — maps to tone character | Yes |
| `tone_warmth` | Yes | Yes | Yes |
| `tone_conciseness` | Yes | Yes — maps to content length | Yes (primary) |
| `tone_humor` | Yes | Yes | Yes |
| `quirks` | Yes | Yes — appended to style section | Condensed |
| `forbidden_words` | Yes | Yes — added to prompt constraints | Yes |
| `seo_*` fields | Yes | No | No |
| `email_subject_style` | No | Yes | No |
| `social_handle_voice` | No | No | Yes |

---

## MCP Architecture

### How Website Connections Work

The blog tool connects to websites through MCP (Model Context Protocol) rather than direct API calls. MCP creates a standardized interface between the tool and each site. The tool sends the same read and write requests regardless of which CMS the site runs. A per-platform MCP server handles the translation underneath.

This means:
- Site connections work identically in the UI regardless of whether the site runs WordPress, PrestaShop, or something else
- Adding a new CMS type means deploying a new MCP server, not modifying the tool
- The tool can both read context from sites and publish back to them through the same interface

### MCP Operation Types

**Read operations (context gathering):**
- Fetch recent published posts and their URLs
- Fetch site categories and tags
- Fetch active products and modules (ecommerce sites)
- Fetch existing page titles and URLs

**Write operations (publishing):**
- Create post as draft
- Create post as published
- Schedule post for a future date
- Upload images to media library
- Update an existing post

### Site Config

Each site record stores a platform type and an MCP server URL. The blog tool never makes platform-specific API calls directly.

```
website
  platform_type: "wordpress" | "prestashop" | "custom"
  mcp_server_url: "https://mcp.yourserver.com/site-slug"
  mcp_auth_token: (encrypted)
```

**MCP server responsibilities per platform:**

| Platform | MCP server responsibility |
|---|---|
| WordPress | Wraps WP REST API. Translates standardized MCP requests to WP endpoints. |
| PrestaShop | Wraps PrestaShop Webservice API. Translates to PS blog module endpoints. |
| Custom | Webhook-based. Custom server per site where no native API exists. |

### Live Site Context

When a site is selected in the blog tool, the tool calls the site's MCP server and fetches:
- Recent post titles and URLs (for same-site internal link suggestions)
- Site categories
- Active product and module names (grounds the AI in what this specific site sells)

This context is loaded into session cache alongside sibling-site context (described below) and fed into the generation prompt.

---

## News Feed

### Purpose

When a user has no specific idea in mind, the news feed gives them a curated stream of recent articles in their site's industry. They pick one, it becomes the campaign seed, and the tool generates a response piece — commentary, analysis, a how-to prompted by the news — in the site's voice and persona, with the source article cited automatically.

The feed is not a content scraper. The AI writes original content. The source article is referenced, linked, and attributed — it is the prompt, not the product.

### How the Feed Works

Each site has a news feed configuration: a set of topics, keywords, and optionally specific trusted sources. The feed aggregator runs on a configurable refresh schedule (default: every 6 hours) and stores fetched articles in the `news_feed_items` table.

**Feed configuration per site (set in Site Manager):**
- Industry topics (e.g. "ecommerce, PrestaShop, Shopify, web performance")
- Keyword inclusions (e.g. "checkout optimization, payment gateway")
- Keyword exclusions (e.g. topics to filter out)
- Trusted sources (optional — RSS URLs or publication names to prioritize)
- Refresh interval (6h default, configurable)

**News data sources:**
- NewsAPI.org (primary — broad news index, filterable by keyword and source)
- RSS feed ingestion (for trusted sources not indexed by NewsAPI)

### Feed UI

The feed is accessible from two places:
1. The campaign creation flow — a "Start from news" option surfaces the feed before the brief is written
2. The blog tool dashboard — a persistent "Industry Feed" panel showing the latest items for all sites the user has access to

Each feed item shows: headline, source publication, publication date, a one-sentence excerpt, and two actions — **Start campaign** and **Dismiss**.

Dismissed items are hidden for the dismissing user. They remain in the DB and visible to other team members.

### When a News Article Seeds a Campaign

The user clicks "Start campaign" on a feed item. The campaign form opens pre-populated with:
- The news article's headline as a starting point for the core idea (editable)
- The source article stored as campaign metadata: title, URL, publication name, published date

The source article metadata travels with the campaign to all three tools.

### How the Source Article Appears in Generated Content

The source article is passed to the AI in the article brief layer of the prompt:

> "This article is inspired by the following news item. Reference it naturally — link to it where contextually appropriate, and treat it as the reporting you are responding to. Do not reproduce its content. Write original analysis, commentary, or instruction that the reader could not get from reading the source alone. Source: [Title] — [Publication] — [URL]"

In the generated HTML, the tool appends a source attribution block at the end of the article:

```html
<p class="source-attribution">
  Source: <a href="[URL]" target="_blank" rel="noopener">[Title]</a> — [Publication], [Date]
</p>
```

This block is visible and editable in the rich-text editor before publishing. The SEO check confirms the outbound link to the source is present.

---

## Cross-Site Interlinking

### Purpose

Within an organization, each website has a distinct topic specialty. When content written for Site A naturally touches a subject that Site B owns, the tool recognizes the connection and inserts a link to Site B — automatically and contextually, not as a forced mention.

For example: an article on PrestaChamps about store optimization might mention consulting a marketing specialist. PayPerChamps covers marketing and paid acquisition. The tool knows this. When the PrestaChamps article reaches that moment, it links to the most relevant PayPerChamps page rather than leaving the mention unlinked.

This builds a link network across the organization's sites without manual effort, in a way that is contextually earned rather than forced.

### Site Specialty Profiles

Each site record includes a **specialty profile**: a structured description of what the site covers.

**Specialty profile fields per site:**
- `specialty_summary` — one or two sentences: "PayPerChamps covers paid marketing, SEO consulting, and customer acquisition strategy for ecommerce businesses."
- `specialty_topics` — array of topic tags: ["paid advertising", "SEO", "marketing consulting", "Google Ads", "Meta Ads"]
- `primary_url` — the site's homepage, used as a fallback link when no specific post is relevant

### How Cross-Site Linking Works During Generation

When generating an article for Site A, the tool assembles a sibling-site context block containing all other sites in the organization:

```
Other sites in this organization:
- PayPerChamps (payperchamps.com): Covers paid marketing, SEO consulting,
  and customer acquisition for ecommerce.
  Topics: paid advertising, SEO, marketing consulting, Google Ads, Meta Ads.
  Recent relevant content: [fetched via MCP — up to 5 post titles + URLs]

- ShopifyChamps (shopifychamps.com): Covers Shopify store setup, apps,
  and theme development.
  Topics: Shopify, themes, apps, checkout.
  Recent relevant content: [fetched via MCP — up to 5 post titles + URLs]
```

The prompt instructs the AI:

> "When the content you are writing naturally mentions a topic covered by one of the sibling sites listed above, link to the most relevant page from that site. Use the specific post URL if one is provided and contextually fits. Use the site's primary URL as a fallback. Do not force mentions — only link where a link would feel natural and useful to the reader."

For each sibling site, the tool calls its MCP server and fetches the 5 most recently published posts, filtered by relevance to the article topic before being passed to the prompt.

### Cross-Site Link Review

After generation, the SEO check panel includes a **Cross-site links** section:

```
Cross-site links inserted
─────────────────────────
✓ PayPerChamps linked — "marketing consultant" (paragraph 4)
    → payperchamps.com/what-is-paid-acquisition
✓ ShopifyChamps linked — "Shopify alternative" (paragraph 7)
    → shopifychamps.com/prestashop-vs-shopify

No sibling site link inserted for: "SEO audit" (paragraph 2)
    Nearest match: PayPerChamps — no specific post found.
    [Link to homepage] [Skip]
```

The user can accept, swap, or remove any cross-site link before publishing.

---

## Tech Stack

**Blog tool frontend:** Next.js
**Blog tool backend:** Node.js via Next.js API routes
**Database:** PostgreSQL (containerized)
**Auth:** JWT-based session auth (internal; no external auth provider dependency)
**AI — Blog tool:** Anthropic Claude API (primary) + OpenAI / Gemini (switchable)
**AI — Email tool:** OpenAI (existing, unchanged)
**AI — Images:** Gemini Imagen + Unsplash / Pexels API
**SEO Data:** Ahrefs API + optional Surfer SEO / Clearscope
**News Feed:** NewsAPI.org + RSS ingestion
**MCP:** Self-hosted MCP servers per CMS type (WordPress, PrestaShop), each containerized
**Containerization:** Docker + Docker Compose for all services
**Email tool:** Existing vanilla JS + Node.js/Express + SQLite + Docker stack, unchanged
**Social tool (planned):** Stack TBD — integrates via same API bridge pattern

---

## Docker Setup and Launch

### Repository Structure

The suite is split across three repositories sharing a Docker network. A root-level orchestration repo contains the `docker-compose.yml` that starts everything together.

```
content-suite/                        ← root orchestration repo
├── docker-compose.yml                ← starts all services together
├── docker-compose.override.yml       ← local dev overrides (gitignored)
├── .env                              ← shared environment variables
├── blog-tool/                        ← blog tool repo (submodule or sibling)
└── email-tool/                       ← email tool repo (submodule or sibling)

blog-tool/
├── app/                              ← Next.js application
├── server/                           ← API routes (Next.js API or standalone Express)
├── db/                               ← PostgreSQL migrations (using node-pg-migrate or similar)
├── workers/
│   └── feed-worker/                  ← news feed refresh scheduler
├── mcp/
│   ├── wordpress/                    ← WordPress MCP server
│   └── prestashop/                   ← PrestaShop MCP server
├── Dockerfile
├── docker-compose.yml                ← standalone blog-tool launch
└── .env.example

email-tool/                           ← existing repo, unchanged except integration module
├── app/
├── server/
├── docker-compose.yml                ← existing standalone launch (unchanged)
└── CLAUDE.md
```

---

### Root docker-compose.yml

This file starts the full suite. Each service is on a shared internal network (`suite-network`) so they can communicate by service name.

```yaml
version: "3.9"

networks:
  suite-network:
    driver: bridge

volumes:
  blog-db-data:
  email-data:

services:

  # ── Blog Tool ────────────────────────────────────────────────

  blog-app:
    build:
      context: ./blog-tool
      dockerfile: Dockerfile
    container_name: blog-app
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://postgres:${POSTGRES_PASSWORD}@blog-db:5432/blogtool
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - AHREFS_API_KEY=${AHREFS_API_KEY}
      - NEWSAPI_KEY=${NEWSAPI_KEY}
      - JWT_SECRET=${JWT_SECRET}
      - INTERNAL_API_KEY=${INTERNAL_API_KEY}
    depends_on:
      blog-db:
        condition: service_healthy
    networks:
      - suite-network
    restart: unless-stopped

  blog-db:
    image: postgres:16-alpine
    container_name: blog-db
    environment:
      - POSTGRES_DB=blogtool
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
    volumes:
      - blog-db-data:/var/lib/postgresql/data
      - ./blog-tool/db/init.sql:/docker-entrypoint-initdb.d/init.sql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - suite-network
    restart: unless-stopped

  feed-worker:
    build:
      context: ./blog-tool/workers/feed-worker
    container_name: feed-worker
    environment:
      - DATABASE_URL=postgresql://postgres:${POSTGRES_PASSWORD}@blog-db:5432/blogtool
      - NEWSAPI_KEY=${NEWSAPI_KEY}
      - FEED_REFRESH_INTERVAL_HOURS=6
    depends_on:
      blog-db:
        condition: service_healthy
    networks:
      - suite-network
    restart: unless-stopped

  # ── MCP Servers ───────────────────────────────────────────────

  mcp-wordpress:
    build:
      context: ./blog-tool/mcp/wordpress
    container_name: mcp-wordpress
    ports:
      - "4001:4001"
    environment:
      - MCP_PORT=4001
    networks:
      - suite-network
    restart: unless-stopped

  mcp-prestashop:
    build:
      context: ./blog-tool/mcp/prestashop
    container_name: mcp-prestashop
    ports:
      - "4002:4002"
    environment:
      - MCP_PORT=4002
    networks:
      - suite-network
    restart: unless-stopped

  # ── Email Tool (existing, unchanged) ─────────────────────────

  email-nginx:
    image: nginx:alpine
    container_name: email-nginx
    ports:
      - "3001:80"
    volumes:
      - ./email-tool/app:/usr/share/nginx/html:ro
      - ./email-tool/nginx.conf:/etc/nginx/conf.d/default.conf:ro
    depends_on:
      - email-api
    networks:
      - suite-network
    restart: unless-stopped

  email-api:
    build:
      context: ./email-tool/server
    container_name: email-api
    ports:
      - "3002:3002"
    environment:
      - PORT=3002
      - BLOG_TOOL_API_URL=http://blog-app:3000
      - BLOG_TOOL_API_KEY=${INTERNAL_API_KEY}
    volumes:
      - email-data:/data
    networks:
      - suite-network
    restart: unless-stopped
```

---

### Root .env

```env
# Database
POSTGRES_PASSWORD=changeme_in_production

# AI providers
ANTHROPIC_API_KEY=
OPENAI_API_KEY=

# SEO + News
AHREFS_API_KEY=
NEWSAPI_KEY=

# Internal auth between services
JWT_SECRET=changeme_in_production
INTERNAL_API_KEY=changeme_in_production

# Optional
GEMINI_API_KEY=
UNSPLASH_ACCESS_KEY=
PEXELS_API_KEY=
```

---

### Quick Start Commands

```bash
# Clone the root repo and initialise tool repos
git clone https://github.com/your-org/content-suite
cd content-suite
git submodule update --init --recursive   # if using submodules

# Copy and fill in environment variables
cp .env.example .env

# Start the full suite
docker-compose up -d

# Start only the blog tool (standalone)
cd blog-tool && docker-compose up -d

# Start only the email tool (standalone — existing workflow unchanged)
cd email-tool && docker-compose up -d

# View logs
docker-compose logs -f blog-app
docker-compose logs -f email-api
docker-compose logs -f feed-worker

# Run database migrations (blog tool)
docker-compose exec blog-app npm run db:migrate

# Stop everything
docker-compose down

# Stop and remove volumes (full reset)
docker-compose down -v
```

---

### Blog Tool Dockerfile

```dockerfile
FROM node:20-alpine AS base
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM base AS runner
ENV NODE_ENV=production
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

EXPOSE 3000
CMD ["node", "server.js"]
```

---

### Service URLs (default local)

| Service | URL | Notes |
|---|---|---|
| Blog tool | http://localhost:3000 | Main UI + API |
| Email tool | http://localhost:3001 | Existing app, unchanged |
| Email API | http://localhost:3002 | Existing API, unchanged |
| MCP — WordPress | http://localhost:4001 | Per-site auth via request headers |
| MCP — PrestaShop | http://localhost:4002 | Per-site auth via request headers |
| PostgreSQL | localhost:5432 | Internal only; not exposed in production |

---

### Inter-Service Communication

All containers are on `suite-network`. Services refer to each other by container name, not localhost.

| Caller | Calls | Via |
|---|---|---|
| `blog-app` | `blog-db` | `postgresql://postgres:...@blog-db:5432/blogtool` |
| `feed-worker` | `blog-db` | Same connection string |
| `blog-app` | `mcp-wordpress` | `http://mcp-wordpress:4001` |
| `blog-app` | `mcp-prestashop` | `http://mcp-prestashop:4002` |
| `email-api` | `blog-app` | `http://blog-app:3000/api/shared/...` + `INTERNAL_API_KEY` header |

The email tool's `integration.js` module uses the `BLOG_TOOL_API_URL` environment variable injected at container start, so the blog tool URL is never hardcoded.

---

### Production Notes

For production deployment on a VPS or cloud VM:
- Replace the `docker-compose.override.yml` dev overrides with production values
- Use a reverse proxy (nginx or Caddy) in front of both tools to handle SSL and route by subdomain
- Set `POSTGRES_PASSWORD`, `JWT_SECRET`, and `INTERNAL_API_KEY` to strong random values — never use the defaults
- The PostgreSQL container's port should not be exposed externally in production (remove the `ports` entry for `blog-db` in the production compose file)
- The `feed-worker` container runs independently; if it crashes, it restarts without affecting the UI

---

## Multi-Tenancy

Every piece of data in the blog tool's database belongs to an **organization**. Users, personas, websites, articles, campaigns, news feed configs, and usage events are all scoped to an org. A second customer is a second organization with no architectural change required.

Cross-site interlinking only operates within an organization — a site never receives sibling context from a different org's sites.

The email tool has no organization concept natively. For multi-tenant use of the email tool, the existing brand-scoping system (`X-Brand-Id` header, `brand_settings` table) handles per-brand isolation. The brand-to-website mapping described in the integration strategy is what connects the two systems.

---

## Article Creation Pipeline

A user can create an article directly without a campaign. The recommended flow starts with a campaign brief — either from a free-text idea or from a news feed item.

---

### Step 0 — Campaign Brief

From the common admin or the blog tool's "New Campaign" entry point.

**Option A — Start from idea:**
- Select site
- Select persona
- Enter the core idea
- Audience context (optional)
- Campaign tag (links blog, email, and social outputs together)

**Option B — Start from news feed:**
- Browse the industry feed
- Click "Start campaign" on an article
- Site pre-selected based on feed origin (editable)
- Core idea pre-populated from article headline (editable)
- Source article stored as campaign metadata automatically

The campaign is saved. Each tool opens it and produces its output independently.

---

### Step 1 — Open in Blog Tool

User opens the campaign. Site and persona are pre-populated.

When the site is confirmed, the tool simultaneously:
- Calls the target site's MCP server to fetch recent posts, categories, and product names
- Calls each sibling site's MCP server to fetch recent posts (filtered by relevance to the campaign topic)

Both the same-site content index and the sibling-site context block are assembled before generation begins.

---

### Step 2 — Select or Confirm Persona

Persona from the campaign is pre-selected. User can swap it.

Loaded from the shared persona record:
- Voice settings
- SEO defaults (blog-specific persona fields)
- Writing samples if uploaded

Both can be overridden for this specific article before proceeding.

---

### Step 3 — Article Brief

Pre-populated from the campaign. Fully editable.

User confirms or adjusts:
- Topic and headline direction
- Article format (how-to, opinion, roundup, explainer, listicle, etc.)
- Target length
- Additional notes, angle, things to include or avoid
- SEO settings (pre-populated from persona defaults, editable here)

If the campaign was seeded from a news article, the source article is shown here as read-only context with an option to remove it from the brief.

---

### Step 4 — Keyword Research

The tool takes the topic and the persona's Ahrefs settings and runs keyword research automatically.

Behind the scenes:
- Calls Ahrefs Keywords Explorer API with the seed keyword and target country
- Returns keywords with search volume, keyword difficulty (KD), and CPC
- Filters by the persona's minimum volume and maximum KD thresholds
- Clusters results by semantic group

What the user sees:
- Keyword table: keyword / monthly searches / difficulty / suggested role (Primary / Secondary / Ignore)
- AI pre-selects a recommended primary keyword and secondaries
- User can reassign roles, remove keywords, or accept as-is

This step can be skipped — the user can enter keywords manually and bypass Ahrefs entirely.

---

### Step 5 — Article Generation

All context is assembled into a layered prompt and sent to the selected AI model.

**Prompt layers, in order:**

1. **System identity** — writer role, no preamble, output starts immediately as clean HTML
2. **Brand voice rules** — site-level: niche context, tone guardrails, banned topics, banned words, required disclaimers
3. **Persona injection** — bio, tone params, quirks, forbidden words, signature phrases
4. **Voice grounding** — AI-generated voice summary and excerpts from uploaded writing samples
5. **Same-site context from MCP** — active product and module names, recent post topics, site categories fetched live
6. **Sibling-site context** — specialty summaries and relevant recent posts from all other sites in the organization, with cross-linking instruction
7. **SEO instructions** — primary keyword, secondaries, density, heading structure, linking targets, FAQ/TOC flags
8. **Same-site internal link reference** — recent post titles and URLs from the target site, instruction to link naturally
9. **Article brief** — topic, format, length, notes, campaign core idea
10. **Source article (if applicable)** — title, publication, URL, instruction to reference and link without reproducing
11. **Image placement** — insert `[IMAGE: descriptive prompt]` markers at natural points
12. **Output format** — clean HTML, no AI clichés, no filler openers, no padding conclusions

The article opens in the rich-text editor. The user can edit inline, regenerate sections, or apply tone and length adjustments before proceeding.

Full prompt snapshot stored with the article record.

---

### Step 6 — Image Generation and Alt Text

For each `[IMAGE: ...]` marker in the article, including the featured image:

**Stock mode:** the description is used as a search query against Unsplash/Pexels, returning 3–5 options.

**AI generation mode:** Gemini Imagen receives the marker description plus the persona's image style setting.

After each image is selected or generated:
- Alt text is auto-generated based on image content and the article's primary keyword
- Alt text is editable before publishing
- Images are stored in Supabase Storage and inserted inline in the editor

---

### Step 7 — SEO Check

An automated audit runs on the completed article. Warnings inform — they never block publishing.

**Standard checks:**
- Primary keyword in: title, first paragraph, at least one H2, meta description
- Secondary keywords distributed throughout body
- Keyword density within target range
- Outbound link count within set range
- Same-site internal links present and pointing to real URLs
- Meta title within character limit and containing primary keyword
- Meta description within character limit
- All images have alt text
- Alt text contains primary keyword at least once
- Heading structure is logical (no skipped levels)
- Article length within 10% of target
- Readability score (Flesch-Kincaid)

**Cross-site links section:**
- Lists every cross-site link inserted during generation
- Flags sibling site candidate matches where no specific post was found, offering homepage link or skip
- Allows removal of any cross-site link before publishing

**Source article check (if applicable):**
- Confirms the source article is linked in the body or attribution block

An optional external grader toggle (Surfer SEO / Clearscope) submits the article to the external tool's API and returns a content score alongside the internal checklist.

---

### Step 8 — Approval (Optional)

If the approval workflow is toggled on for the organization, Editors cannot publish directly:
- Editor submits for review
- Admin receives a notification
- Admin approves or rejects with a comment
- Editor is notified either way

If approval is off, Editors publish directly.

---

### Step 9 — Publish via MCP

User selects: **Publish now / Schedule / Save as draft on site / Keep in tool only**

For any publish option, the blog tool sends a write request to the site's MCP server:
- Post body (HTML)
- Meta title and meta description
- Category and tags
- Featured image (uploaded to site media library via MCP first)
- Scheduled date if applicable

**On failure:** "Could not publish to [site name]. The article has been saved in your Content Library. You can retry publishing from there." MCP event logged with full request and response for debugging. No data loss under any failure condition.

After successful publish, the campaign record updates: `blog_published: true`, `blog_post_url: [url]`.

---

### Step 10 — Campaign Status

After publishing, the tool shows the campaign's cross-tool status:

```
Campaign: PrestaShop Speed Module Launch
────────────────────────────────────────
Blog post:    ✓ Published — prestaspeed.com/blog/speed-module
Email:        ⏳ Project linked in email tool — status: working
Social:       ○ Not started
```

The email status reflects whatever the linked Content Planner project's status is, synced via the API bridge.

---

## Site Manager

Each site record stores:
- Site name, URL, platform type
- MCP server URL and auth token
- Brand voice profile: site description, niche, tone guardrails, banned topics, banned words, required elements, content pillars
- **Specialty profile:** specialty summary, specialty topic tags, primary URL — used for cross-site interlinking
- **News feed config:** industry topics, keyword inclusions, keyword exclusions, trusted RSS sources, refresh interval
- MCP connection status with test connection button (Admin only)

---

## Persona Manager

Personas are created and managed in the common admin. The blog tool's persona interface is read-and-assign only.

Each persona has three tabs:

**Voice tab:**
- Name, bio, avatar
- Tone sliders: formality, warmth, conciseness, humor
- Quirks (behavioral notes)
- Forbidden words
- Signature phrases (optional)
- Writing samples: upload 1–5 documents; extracted text generates a voice summary used in prompts

**SEO tab (blog-specific):**
- Default outbound and internal link counts
- Keyword density target and placement rules
- Heading depth preference
- FAQ and TOC toggles
- Meta description length and title tag format
- Ahrefs settings: target country, minimum search volume, maximum keyword difficulty

**Assignments tab:**
- Which sites this persona is assigned to
- Usage count per site (determines which persona is marked Recommended)

---

## Content Library

All articles created in the blog tool, regardless of status:

- Filter by site, persona, format, status, date, keyword, campaign tag, news-seeded
- Full-text search
- Open, re-edit, or republish any past article
- Duplicate to spin a variation
- Internal tags: evergreen, seasonal, needs review, etc.
- Usage stats per article visible to Admins

---

## Batch Generator

- Upload a CSV: site, topic, persona, format, keywords (optional), length, image mode, campaign tag
- Each row runs the full pipeline
- Jobs queue sequentially with a live progress view
- All results land in Content Library as Drafts
- Bulk-schedule from the results view
- Cross-site interlinking runs on each batch item

---

## Team and Settings

**Team:** Invite by email. Roles: Admin / Editor. Approval workflow toggle. Activity log.

**Settings:** Default AI model. Default image mode. External SEO grader toggle. Global tone and SEO defaults. Notifications. Organization name and usage stats.

---

## MCP Failure Handling

**On site selection (read failure):**
- Site loads without live context
- Cached content index used if available, labeled with last-sync date
- Sibling-site context falls back to specialty profile text only (no specific post links)

**On publish (write failure):**
- Article preserved in Content Library as Approved
- Plain-English error message with retry option
- MCP event logged with full request and response
- No data loss under any failure condition

---

## Common Admin vs. Tool Responsibilities

**Common admin owns:**
- Organizations
- Users and roles (blog tool and future tools)
- Personas — shared API surface for all tools
- Websites, MCP config, specialty profiles, news feed config
- Campaigns — brief, cross-tool status tracking
- Usage dashboard
- API keys for integration (one per connected external tool)

**Blog tool owns:**
- Article creation pipeline
- Rich-text editor
- SEO check (including cross-site link review)
- Approval workflow
- Content Library and Batch Generator
- Shared API endpoints consumed by email and social tools

**Email tool owns (existing, unchanged architecture):**
- Newsletter editor, `buildPrompt()`, template system
- Mailchimp connection and campaign management
- Statistics, subscriber analytics, A/B tests
- Content Planner (projects linked to campaigns via API bridge)
- New: `integration.js` module for persona fetch and campaign sync

**Social tool owns (planned):**
- Post composition per platform
- Platform API connections and scheduling
- Integrates via same API bridge pattern as email tool

---

## Database Structure

```sql
-- Blog tool / common admin database (PostgreSQL via Supabase)

organizations
  id, name, approval_workflow_enabled, external_seo_grader_enabled,
  api_integration_keys (JSON — one key per connected external tool),
  created_at

users
  id, email, name, created_at

organization_members
  organization_id, user_id, role (admin/editor), joined_at

websites
  id, organization_id, name, url,
  platform_type (wordpress/prestashop/custom),
  mcp_server_url,
  mcp_auth_token (encrypted),
  mcp_status (connected/error/unconfigured),
  mcp_last_synced,
  -- brand voice --
  site_description, tone_guardrails, banned_topics, banned_words,
  required_elements, content_pillars (array),
  -- specialty profile for cross-site interlinking --
  specialty_summary,
  specialty_topics (array),
  primary_url,
  -- news feed config --
  feed_topics (array),
  feed_keywords_include (array),
  feed_keywords_exclude (array),
  feed_refresh_interval_hours,
  created_at

website_feed_sources
  id, website_id, source_type (rss/publication_name),
  source_value, active, created_at

news_feed_items
  id, website_id, organization_id,
  headline, url, publication_name, published_at,
  excerpt, fetched_at,
  dismissed_by (array of user_ids)

-- Optional persistent cache for offline fallback.
-- Primary source is live MCP fetch on site selection.
website_content_index
  id, website_id, post_title, post_url, post_excerpt, fetched_at

-- Tool-agnostic personas. All tools consume via API.
personas
  id, organization_id, name, bio, avatar_url,
  -- shared across all tools --
  tone_formal, tone_warmth, tone_conciseness, tone_humor,
  quirks, forbidden_words, signature_phrases, voice_summary,
  -- blog-tool-specific --
  model_override, image_style,
  seo_outbound_links, seo_internal_links, seo_link_placement,
  seo_keyword_density, seo_keyword_placement_rules,
  seo_heading_depth, seo_include_faq, seo_include_toc,
  seo_meta_description_length, seo_title_tag_format,
  seo_ahrefs_min_volume, seo_ahrefs_max_difficulty, seo_ahrefs_country,
  -- email-tool-specific (consumed by email tool via API) --
  email_subject_style, email_preheader_style,
  -- social-tool-specific (planned) --
  social_brevity, social_handle_style,
  archived, created_at

persona_writing_samples
  id, persona_id, filename, storage_url, extracted_text, uploaded_at

persona_website_assignments
  persona_id, website_id, usage_count

-- Shared campaign brief across all tools
campaigns
  id, organization_id, website_id, persona_id,
  title, core_idea, audience_context,
  -- news article seed (nullable) --
  source_article_url, source_article_title,
  source_article_publication, source_article_published_at,
  news_feed_item_id (nullable),
  -- output tracking --
  status (draft/in_progress/complete),
  blog_published (bool), blog_post_url, blog_post_id,
  email_sent (bool), email_campaign_id,
  email_planner_project_id,  -- ID of the linked Content Planner project
  social_posted (bool), social_post_ids (array),
  created_by, created_at, updated_at

articles
  id, organization_id, campaign_id (nullable),
  title, body, meta_title, meta_description,
  persona_id, website_id, format, word_count,
  primary_keyword, secondary_keywords,
  model_used, prompt_snapshot,
  seo_score, seo_audit_snapshot,
  cross_site_links_snapshot (JSON),
  external_seo_score, featured_image_url,
  source_article_url, source_article_title, source_article_publication,
  status (draft/pending_approval/approved/scheduled/published/failed),
  scheduled_at, published_at,
  external_post_id,
  mcp_publish_log,
  created_by, approved_by, created_at, updated_at

article_keywords
  id, article_id, keyword, search_volume, difficulty,
  role (primary/secondary), source (ahrefs/manual)

article_images
  id, article_id, storage_url, source (stock/generated),
  position, alt_text

article_tags
  article_id, tag

article_cross_site_links
  id, article_id,
  target_website_id, target_url, anchor_text,
  paragraph_index, status (inserted/removed_by_user),
  created_at

mcp_events
  id, website_id, organization_id,
  operation (read_posts/read_products/publish/schedule/draft),
  status (success/error),
  request_snapshot, response_snapshot,
  duration_ms, created_at

usage_events
  id, organization_id, article_id, user_id,
  event_type (generation/image_gen/stock_search/kw_research/seo_check/mcp_publish/news_fetch),
  model_used, estimated_cost_usd, created_at

generation_jobs
  id, organization_id, created_by, status,
  total, completed, failed, created_at

generation_job_items
  id, job_id, article_id, status, error_message
```

```sql
-- Email tool database (SQLite — existing schema, additions only)

-- Existing: brand_settings
-- Addition: two new columns
ALTER TABLE brand_settings ADD COLUMN blog_tool_website_id TEXT;
ALTER TABLE brand_settings ADD COLUMN blog_tool_api_key TEXT;

-- Existing: projects (Content Planner)
-- Addition: one new column
ALTER TABLE projects ADD COLUMN campaign_id TEXT;
-- campaign_id maps to campaigns.id in the blog tool PostgreSQL DB
```

---

## AI Prompt Architecture (Blog Tool)

**Layer 1 — System identity**
Writer role. No preamble. Output is clean HTML.

**Layer 2 — Brand voice rules**
Site description, niche, tone guardrails, banned topics, banned words, required elements.

**Layer 3 — Persona injection**
Bio, tone params, quirks, forbidden words, signature phrases.

**Layer 4 — Voice grounding**
Voice summary and excerpts from writing samples.

**Layer 5 — Same-site context from MCP**
Active products, module names, recent post topics, site categories fetched live.

**Layer 6 — Sibling-site context**
Specialty summaries and relevant recent posts from all sibling sites. Cross-linking instruction: link when content naturally touches a sibling's specialty; specific post URL preferred, homepage as fallback; never force a mention.

**Layer 7 — SEO instructions**
Primary keyword, secondaries, density, heading structure, linking targets, FAQ/TOC flags.

**Layer 8 — Same-site internal link reference**
Recent post titles and URLs from the target site, instruction to link naturally.

**Layer 9 — Article brief**
Topic, format, length, notes, campaign core idea.

**Layer 10 — Source article (if applicable)**
Title, publication, URL. Instruction: reference and link naturally; do not reproduce; write original work the reader could not get from the source alone.

**Layer 11 — Image placement**
Insert `[IMAGE: descriptive prompt]` markers.

**Layer 12 — Output format**
Clean HTML, no AI clichés, no filler openers, no padding conclusions.

---

## Key UX Principles

- **Site first, persona second.** Site selection triggers MCP context fetch — same-site and sibling-site — before anything else.
- **Recommended is earned.** The persona marked Recommended is determined by actual usage history, not manual assignment.
- **The pipeline is guided, not rigid.** Every step allows review and adjustment before proceeding.
- **Cross-site links are reviewed, never silent.** Every sibling-site link is surfaced in the SEO check and can be removed before publishing.
- **News is a starting point, not the content.** Feed articles seed the idea. The tool generates original work that references the source.
- **SEO is a checklist, not a gate.** Warnings inform — they never block.
- **Approval is a setting, not a given.** Toggle per organization.
- **MCP failures never lose data.** Every failure surfaces a plain-English explanation and leaves the article accessible.
- **Campaign is optional context, not a required workflow.** Articles can be created without one.
- **Personas are the consistency layer.** One persona update propagates to all tools via API.
- **The email tool stays intact.** Integration adds capability without breaking existing workflows.

---

## Build Order

**Phase 1 — Blog tool foundation**
Multi-org PostgreSQL database. Supabase auth. Common admin scaffold: organizations, users, personas (tool-agnostic schema from day one). Blog tool: Site Manager with brand voice profile, specialty profile, MCP config, and news feed config fields (feeds and MCP not yet connected). Persona creation with Voice tab and writing sample upload. Single article generation with manual keyword entry and manual export.

**Phase 2 — MCP connections**
WordPress MCP server. PrestaShop MCP server. Site selection triggers live same-site context fetch. Same-site internal linking from MCP-fetched content. Publish via MCP (draft and publish now). MCP failure handling and status indicators.

**Phase 3 — SEO and Ahrefs**
Persona SEO tab. Ahrefs keyword research step. Keyword approval UI. SEO check step. Optional Surfer/Clearscope toggle.

**Phase 4 — Cross-site interlinking**
Specialty profile fields in Site Manager. Sibling-site MCP fetch at generation time. Cross-site link prompt layer. Cross-site links section in SEO check. `article_cross_site_links` table.

**Phase 5 — News feed**
NewsAPI integration. RSS feed ingestion. Feed config in Site Manager. `news_feed_items` table and refresh scheduler. Feed UI in campaign creation and blog tool dashboard. Source article metadata on campaigns. Source article prompt layer. Attribution block in generated HTML. Source link check in SEO step.

**Phase 6 — Campaigns and shared API**
Campaign object in common admin. Campaign brief creation (from idea and from news). Blog tool reads from campaign on open. Shared API endpoints (`/api/shared/personas`, `/api/shared/campaigns`, etc.) with API key auth. Campaign status view showing cross-tool output.

**Phase 7 — Email tool integration**
`integration.js` module in email tool. Blog-tool API key and website-ID mapping added to `brand_settings` table. Persona dropdown in email tool Setup tab feeding into `buildPrompt()`. Content Planner projects gain `campaign_id` column. Campaign status in blog tool reflects Content Planner project status.

**Phase 8 — Images and scheduling**
Stock photo integration (Unsplash/Pexels). Image placement markers. Alt text generation. Gemini Imagen. Featured image support. Scheduled publishing via MCP.

**Phase 9 — Full feature set**
Model switching (GPT and Gemini text). Approval workflow toggle. Bulk scheduling. Inline section regeneration. Batch generator with campaign tagging. Full Content Library filter set. Custom CMS webhook support.

**Phase 10 — Commercial readiness**
Usage dashboard across all tools. Stripe billing integration. Social tool integration point: connects via same API bridge pattern established in Phase 7.
