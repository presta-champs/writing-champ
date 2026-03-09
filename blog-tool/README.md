# WritingChamps - AI Content Writing Platform

WritingChamps is a multi-tenant AI-powered content writing platform built with Next.js 16, Supabase, and TypeScript. It enables teams to generate high-quality blog articles using customizable AI personas with distinct writing voices, brand-aligned site profiles, and multi-provider AI support.

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Database Schema](#database-schema)
- [Project Structure](#project-structure)
- [AI Generation Pipeline](#ai-generation-pipeline)
- [API Reference](#api-reference)
- [Authentication & Authorization](#authentication--authorization)
- [Deployment](#deployment)
- [Roadmap](#roadmap)

---

## Features

### Core
- **Multi-tenant architecture** -- organizations with role-based access (admin/editor)
- **Site management** -- create websites with full brand voice profiles (tone guardrails, banned topics/words, content pillars)
- **Persona management** -- AI writing personas with configurable tone sliders, quirks, signature phrases, and SEO settings
- **Writing sample upload** -- upload .txt, .docx, .pdf files to train persona voice
- **AI voice analysis** -- automatically analyze writing samples to generate voice summaries, principles, and tone scores
- **8 built-in personas** -- pre-configured personas modeled after well-known writing styles (Paul Graham, Seth Godin, Malcolm Gladwell, etc.)

### Article Generation
- **Multi-step article pipeline** -- site selection -> persona selection -> article brief -> AI generation
- **Multi-provider AI** -- supports Claude (Anthropic) and GPT (OpenAI) with automatic fallback
- **Streaming generation** -- real-time article streaming via Tiptap rich text editor
- **Model picker** -- choose AI model per article (Claude Sonnet 4, Claude Haiku 4.5, GPT-4o, GPT-4o Mini, GPT-4.1, GPT-4.1 Mini)
- **9-layer prompt assembly** -- combines website brand voice, persona voice, SEO instructions, and article brief into optimized prompts

### Content Management
- **Content library** -- searchable, filterable list of all articles with status badges
- **Article detail page** -- view, edit with Tiptap rich text editor, save changes
- **Multi-format export** -- download as HTML, Markdown, or plain text
- **Copy to clipboard** -- one-click HTML copy

### Settings & Security
- **Encrypted API key storage** -- AES-256-GCM encryption for all provider keys stored in the database
- **Per-org API keys** -- each organization stores their own AI provider keys with env var fallback
- **Usage tracking** -- every AI generation and voice analysis is logged with model and cost estimates
- **Dashboard** -- real-time stats (sites, personas, articles this month), recent articles, quick actions

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router, React 19) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS 4 + CSS custom properties (warm palette) |
| Database | PostgreSQL via Supabase |
| Auth | Supabase Auth (email/password) |
| Storage | Supabase Storage (writing samples) |
| AI - Anthropic | `@anthropic-ai/sdk` (Claude Sonnet 4, Haiku 4.5) |
| AI - OpenAI | `openai` SDK (GPT-4o, GPT-4.1 family) |
| Rich Text Editor | Tiptap (ProseMirror-based) |
| Validation | Zod 4 |
| Icons | Lucide React |
| Document Parsing | mammoth (.docx), pdf-parse (.pdf) |

---

## Architecture

```
Browser (React 19)
    |
    v
Next.js 16 App Router
    |
    +-- Server Components (dashboard, settings, personas list)
    +-- Client Components (article editor, forms, filters)
    +-- Server Actions (auth, CRUD operations)
    +-- API Routes (generation, writing samples, voice analysis)
    |
    +-- lib/generation/       -- AI provider clients + model router
    |     +-- claude.ts       -- Anthropic Claude streaming + sync
    |     +-- openai.ts       -- OpenAI GPT streaming + sync
    |     +-- model-router.ts -- provider routing + fallback
    |     +-- prompt.ts       -- 9-layer prompt assembler
    |     +-- stream.ts       -- async generator to ReadableStream
    |     +-- cost-estimator.ts
    |     +-- token-counter.ts
    |
    +-- lib/persona/          -- Voice analysis
    +-- lib/crypto.ts         -- AES-256-GCM encryption
    +-- lib/supabase/         -- Server + client Supabase instances
    +-- lib/export/           -- HTML-to-Markdown converter
    |
    v
Supabase
    +-- Auth (JWT sessions, middleware protection)
    +-- PostgreSQL (all application data)
    +-- Storage (writing sample files)
```

### Multi-Tenancy

All data is scoped by `organization_id`. Every query includes an org filter derived from the authenticated user's membership. The system supports two roles:

- **Admin** -- full access, can manage API keys, invite members, delete articles
- **Editor** -- can create sites, personas, and generate articles

---

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Supabase CLI (for local development) or a Supabase project
- At least one AI provider API key (Anthropic or OpenAI)

### Installation

```bash
# Clone the repository
git clone https://github.com/presta-champs/writing-champ.git
cd writing-champ

# Install dependencies
npm install

# Set up environment variables
cp .env.local.example .env.local
# Edit .env.local with your Supabase and AI provider credentials

# Start Supabase locally (optional)
npx supabase start

# Run the database migrations
# Option A: Using Supabase CLI
npx supabase db push

# Option B: Run init.sql directly against your database
psql $DATABASE_URL -f db/init.sql

# Start the development server
npm run dev
```

The app will be available at `http://localhost:3000`.

### First-Time Setup

1. Navigate to `http://localhost:3000/signup` and create an account
2. The onboarding flow will create your organization
3. Go to **Settings** and add your AI provider API key (Anthropic or OpenAI)
4. Create a **Website** with brand voice settings
5. Create a **Persona** or install built-in personas
6. Go to **New Article** and generate your first article

---

## Environment Variables

Create a `.env.local` file with the following variables:

```env
# Supabase (required)
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres

# AI Providers (at least one required)
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...

# Encryption (required - used to encrypt API keys stored in the database)
ENCRYPTION_SECRET=generate-a-random-32-byte-hex-string

# Optional - future features
GOOGLE_AI_API_KEY=
AHREFS_API_KEY=
NEWSAPI_KEY=
UNSPLASH_ACCESS_KEY=
PEXELS_API_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
JWT_SECRET=
INTERNAL_API_KEY=
```

**Note:** API keys can be configured in two ways:
1. **Environment variables** -- set in `.env.local` (shared across all orgs)
2. **Per-organization** -- entered in the Settings page (encrypted with AES-256-GCM, stored in `organizations.api_integration_keys`)

The system checks org-level keys first, then falls back to environment variables.

---

## Database Schema

The full schema is defined in `db/init.sql`. Key tables:

| Table | Purpose |
|-------|---------|
| `organizations` | Multi-tenant orgs with plan limits and encrypted API keys |
| `users` | User accounts linked to Supabase Auth |
| `organization_members` | User-org membership with roles (admin/editor) |
| `websites` | Sites with brand voice profiles and CMS connection config |
| `personas` | AI writing personas with tone sliders, voice fields, SEO settings |
| `persona_writing_samples` | Uploaded writing samples with extracted text |
| `persona_website_assignments` | Many-to-many persona-site mapping with usage counts |
| `articles` | Generated articles with metadata, keywords, status tracking |
| `article_keywords` | Per-article keyword data (volume, difficulty, role) |
| `article_tags` | Tagging system for articles |
| `campaigns` | Cross-tool campaign orchestration (blog + email + social) |
| `usage_events` | Cost tracking for all AI operations |
| `generation_jobs` / `generation_job_items` | Batch generation queue |
| `website_content_index` | Published content index for internal linking |
| `news_feed_items` | News feed for content inspiration |

---

## Project Structure

```
blog-tool/
+-- app/
|   +-- actions/              # Server actions (auth, CRUD, settings)
|   |   +-- auth.ts           # Login, signup, signout
|   |   +-- onboarding.ts     # First-time org creation
|   |   +-- personas.ts       # Persona CRUD + voice analysis trigger
|   |   +-- settings.ts       # API key management, org settings
|   |   +-- sites.ts          # Website CRUD
|   |   +-- writing-samples.ts # Sample upload/delete
|   |
|   +-- api/                  # API routes
|   |   +-- generate/         # POST - article generation (streaming)
|   |   +-- models/           # GET - available AI models
|   |   +-- personas/[id]/analyze-voice/  # POST - voice analysis
|   |   +-- writing-samples/  # GET/POST - sample management
|   |   +-- writing-samples/[id]/  # DELETE - sample deletion
|   |   +-- articles/[id]/    # GET/PATCH - article CRUD
|   |   +-- articles/[id]/export/  # GET - article export
|   |
|   +-- dashboard/            # Protected dashboard pages
|   |   +-- page.tsx          # Dashboard home (stats, recent articles)
|   |   +-- layout.tsx        # Sidebar navigation
|   |   +-- articles/new/     # Article creation wizard
|   |   +-- articles/[id]/    # Article detail + editor
|   |   +-- library/          # Content library with filters
|   |   +-- personas/         # Persona list + detail + create
|   |   +-- sites/            # Site list + detail + create
|   |   +-- settings/         # Org settings, API keys, account
|   |
|   +-- login/                # Login page
|   +-- signup/               # Signup page
|   +-- onboarding/           # First-time org setup
|   +-- globals.css           # CSS variables (warm palette) + global styles
|   +-- layout.tsx            # Root layout (fonts, metadata)
|
+-- components/
|   +-- editor/
|   |   +-- article-editor.tsx  # Tiptap rich text editor (streaming + editing)
|   +-- personas/
|   |   +-- writing-samples.tsx # Drag-and-drop upload + voice analysis UI
|   |   +-- voice-form.tsx      # Persona voice settings form
|   |   +-- persona-grid.tsx    # Persona card grid
|   |   +-- website-assignments.tsx # Persona-to-site assignment
|   |   +-- install-builtins-button.tsx
|   +-- settings/
|   |   +-- api-keys-form.tsx   # API key management with encryption
|   |   +-- org-name-form.tsx   # Organization name editor
|   +-- sites/
|       +-- brand-voice-form.tsx # Brand voice profile editor
|
+-- lib/
|   +-- generation/           # AI generation infrastructure
|   |   +-- claude.ts         # Anthropic Claude client (streaming + sync)
|   |   +-- openai.ts         # OpenAI GPT client (streaming + sync)
|   |   +-- model-router.ts   # Multi-provider routing with fallback
|   |   +-- prompt.ts         # 9-layer prompt assembler
|   |   +-- stream.ts         # AsyncGenerator -> ReadableStream adapter
|   |   +-- cost-estimator.ts # Per-model cost calculation
|   |   +-- token-counter.ts  # Approximate token counting
|   |   +-- types.ts          # Shared generation types
|   +-- persona/
|   |   +-- voice-analysis.ts # AI voice profile extraction from samples
|   +-- export/
|   |   +-- html-to-markdown.ts # Zero-dependency HTML-to-Markdown converter
|   +-- supabase/
|   |   +-- server.ts         # Server-side Supabase client
|   |   +-- client.ts         # Browser-side Supabase client
|   |   +-- middleware.ts      # Auth session refresh
|   +-- hooks/
|   |   +-- use-user.ts       # Server hook: get current user
|   |   +-- use-organization.ts # Server hook: get current org
|   +-- builtin-personas/     # 8 pre-configured writing personas
|   +-- crypto.ts             # AES-256-GCM encrypt/decrypt
|   +-- permissions.ts        # Role-based access helpers
|   +-- usage.ts              # Usage event logging
|
+-- types/
|   +-- index.ts              # TypeScript types for all DB tables
|   +-- mammoth.d.ts          # Type declarations for mammoth
|   +-- pdf-parse.d.ts        # Type declarations for pdf-parse
|
+-- db/
|   +-- init.sql              # Complete database schema
|
+-- middleware.ts              # Route protection (redirects unauthenticated users)
```

---

## AI Generation Pipeline

The article generation flow follows a multi-step wizard:

### 1. Site Selection
User picks a website. The site's brand voice profile (description, tone guardrails, banned topics, content pillars) is loaded.

### 2. Persona Selection
User picks a persona filtered by site assignments. Shows usage counts and recommended badges.

### 3. Article Brief
User fills in:
- **Topic** -- what the article is about
- **Format** -- how-to guide, opinion, roundup, explainer, listicle, tutorial, case study
- **AI Model** -- Claude Sonnet 4, Claude Haiku 4.5, GPT-4o, GPT-4o Mini, GPT-4.1, GPT-4.1 Mini
- **Target Length** -- word count (100-10,000)
- **Primary Keyword** -- main SEO keyword (optional)
- **Secondary Keywords** -- supporting keywords (optional)
- **Notes** -- additional instructions

### 4. Generation
The system:
1. Assembles a 9-layer prompt from website + persona + brief data
2. Routes to the selected AI provider (with automatic fallback if the provider's key is missing)
3. Streams the response into the Tiptap editor in real-time
4. After completion, saves the article to the database and logs usage

### 5. Editing & Export
User can:
- Edit the article with full rich text formatting
- Save changes back to the database
- Export as HTML, Markdown, or plain text
- Copy HTML to clipboard

### Prompt Assembly Layers

The prompt assembler (`lib/generation/prompt.ts`) combines these layers:

1. **System identity** -- you are a professional content writer
2. **Website context** -- site name, URL, description
3. **Brand voice** -- tone guardrails, required elements
4. **Content restrictions** -- banned topics and words
5. **Persona voice** -- bio, voice summary, principles, sentence rules
6. **Persona tone** -- formal/warmth/conciseness/humor scores, quirks, signature phrases
7. **SEO instructions** -- keyword placement, heading style, FAQ/TOC toggles
8. **Article brief** -- topic, format, target length, notes
9. **Output format** -- HTML structure requirements

### Provider Fallback

If the selected model's provider has no API key configured, the system automatically falls back:
1. Try the requested provider
2. Fall back to Anthropic (Claude Sonnet 4)
3. Fall back to OpenAI (GPT-4o)

---

## API Reference

### Generation

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/generate` | Generate an article (streaming response) |
| `GET` | `/api/models` | List available AI models based on configured keys |

**POST /api/generate** body:
```json
{
  "websiteId": "uuid",
  "personaId": "uuid",
  "topic": "How to train a puppy",
  "format": "how-to",
  "targetLength": 1500,
  "model": "claude-sonnet-4-20250514",
  "primaryKeyword": "puppy training",
  "secondaryKeywords": ["dog training", "pet care"],
  "notes": "Focus on positive reinforcement"
}
```

### Writing Samples

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/writing-samples?personaId=uuid` | List samples for a persona |
| `POST` | `/api/writing-samples` | Upload a writing sample (multipart form) |
| `DELETE` | `/api/writing-samples/[id]` | Delete a sample |

### Voice Analysis

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/personas/[id]/analyze-voice` | Analyze writing samples and generate voice profile |

### Articles

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/articles/[id]` | Get article by ID |
| `PATCH` | `/api/articles/[id]` | Update article |
| `GET` | `/api/articles/[id]/export` | Export article |

---

## Authentication & Authorization

### Auth Flow
1. **Signup** -- creates Supabase Auth user + `users` row + organization + admin membership
2. **Login** -- Supabase Auth session with JWT
3. **Middleware** -- `middleware.ts` protects all `/dashboard` routes, refreshes sessions
4. **Server hooks** -- `useUser()` and `useOrganization()` resolve the current context

### Role-Based Access
- `lib/permissions.ts` provides `isAdmin()`, `isEditor()`, `requireAdmin()` helpers
- Admin-only operations: managing API keys, changing org name, deleting articles
- Both roles: creating sites, personas, generating articles

### API Key Security
- Organization API keys are encrypted with **AES-256-GCM** before storage
- The `ENCRYPTION_SECRET` env var is the encryption key
- Keys are decrypted server-side only when needed for API calls
- The UI shows masked keys (first 8 + last 4 characters)

---

## Deployment

### Vercel (Recommended)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Set environment variables in Vercel dashboard
# - All variables from .env.local
# - ENCRYPTION_SECRET must be a strong random value
```

### Docker

A `Dockerfile` is included for containerized deployment:

```bash
docker build -t writingchamps .
docker run -p 3000:3000 --env-file .env.local writingchamps
```

### Requirements for Production
- A Supabase project (cloud or self-hosted)
- At least one AI provider API key
- A strong `ENCRYPTION_SECRET` (generate with `openssl rand -hex 32`)
- HTTPS enabled (required for secure cookies)

---

## Roadmap

The project follows a phased build plan (see `PHASES.md` for detailed task breakdowns):

### Phase 1 -- Foundation (Current)
- [x] Auth, onboarding, dashboard
- [x] Site management with brand voice
- [x] Persona management with voice analysis
- [x] Multi-provider article generation (Claude + OpenAI)
- [x] Content library and article detail pages
- [x] Encrypted API key management
- [x] Multi-format export (HTML, Markdown, plain text)
- [ ] Security review (RLS audit)

### Phase 2 -- SEO & Ahrefs
- Persona SEO tab
- Ahrefs keyword research integration
- Internal linking from content index
- SEO checker (keyword density, heading structure, meta validation, readability)
- One-click SEO fixes

### Phase 3 -- Publishing
- WordPress REST API integration
- Content index sync from WordPress
- Publish/schedule articles
- Article duplication and tagging

### Phase 4 -- Images
- Stock photo search (Unsplash/Pexels)
- AI image generation (Gemini Imagen)
- Alt text generation
- Featured image support

### Phase 5 -- Full Feature Set
- Google Gemini text generation
- Provider failover with retry
- Approval workflow
- Section regeneration with tone nudges
- Bulk scheduling
- Team management

### Phase 6 -- Commercial Readiness
- Tier enforcement and feature gates
- Stripe billing integration
- Usage dashboard
- Batch article generator (CSV)
- Rate limiting and security hardening

---

## Design System

The UI uses a warm, editorial color palette defined as CSS custom properties:

```css
--background: #faf8f5    /* Page background */
--foreground: #2c2825    /* Primary text */
--surface: #ffffff       /* Card/panel backgrounds */
--surface-warm: #f5f0ea  /* Subtle warm backgrounds */
--border: #e8e0d8        /* Default borders */
--accent: #7c5e3c        /* Primary accent (warm brown) */
--accent-light: #f0e8de  /* Accent backgrounds */
--success: #5a7a5a       /* Success states */
--danger: #a05050        /* Error/delete states */
--text-muted: #8a7f74    /* Muted text */
--text-secondary: #6b5f53 /* Secondary text */
```

Typography:
- **Headings**: Source Serif 4 (serif)
- **Body**: Source Sans 3 (sans-serif)

---

## Contributing

1. Create a feature branch from `master`
2. Make your changes
3. Ensure the build passes: `npm run build`
4. Submit a pull request

---

## License

Private repository. All rights reserved.
