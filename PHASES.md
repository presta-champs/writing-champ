# WritingChamps — Build Phases

Granular task breakdown for each phase. Every task has a clear deliverable, the agent responsible, and dependencies. Tasks within a phase are ordered — complete them top to bottom.

---

## Phase 1 — Foundation

Everything the platform needs before a single article can be generated. At the end of this phase, one user can log in, create a site with a brand voice, create a persona with uploaded writing samples, and generate a single article with Claude — then export it manually.

### 1.1 Project Scaffolding

| # | Task | Agent | Depends On | Deliverable |
|---|------|-------|------------|-------------|
| 1.1.1 | Initialize Next.js project with App Router, TypeScript, Tailwind | DevOps | — | Working `npm run dev` with clean app shell |
| 1.1.2 | Set up Supabase project (database, auth, storage) | DevOps | — | Supabase project connected, env vars configured |
| 1.1.3 | Create `.env.local` and `.env.example` with all required vars | DevOps | 1.1.2 | Environment files, `.env` in `.gitignore` |
| 1.1.4 | Configure Supabase client (server + browser) | DevOps | 1.1.2 | `lib/supabase/server.ts`, `lib/supabase/client.ts` |
| 1.1.5 | Establish folder structure conventions | SaaS Arch | 1.1.1 | Documented folder layout (`app/`, `lib/`, `components/`, `types/`) |

### 1.2 Database Schema

| # | Task | Agent | Depends On | Deliverable |
|---|------|-------|------------|-------------|
| 1.2.1 | Create `organizations` table with plan, article_limit, billing fields | SaaS Arch | 1.1.2 | Migration + RLS policy |
| 1.2.2 | Create `users` table linked to Supabase Auth | SaaS Arch | 1.1.2 | Migration + RLS policy |
| 1.2.3 | Create `organization_members` join table (user + org + role) | SaaS Arch | 1.2.1, 1.2.2 | Migration + RLS policy |
| 1.2.4 | Create `websites` table with brand voice fields | SaaS Arch | 1.2.1 | Migration + RLS policy |
| 1.2.5 | Create `personas` table with all voice + SEO fields | SaaS Arch | 1.2.1 | Migration + RLS policy |
| 1.2.6 | Create `persona_writing_samples` table | SaaS Arch | 1.2.5 | Migration + RLS policy |
| 1.2.7 | Create `persona_website_assignments` table with usage_count | SaaS Arch | 1.2.4, 1.2.5 | Migration + RLS policy |
| 1.2.8 | Create `articles` table with all fields + status enum | SaaS Arch | 1.2.1, 1.2.4, 1.2.5 | Migration + RLS policy |
| 1.2.9 | Create `article_keywords` table | SaaS Arch | 1.2.8 | Migration + RLS policy |
| 1.2.10 | Create `article_tags` table | SaaS Arch | 1.2.8 | Migration + RLS policy |
| 1.2.11 | Create `usage_events` table | SaaS Arch | 1.2.1 | Migration + RLS policy |
| 1.2.12 | Write TypeScript types for all tables | SaaS Arch | 1.2.1–1.2.11 | `/types/index.ts` |
| 1.2.13 | Add indexes on foreign keys + common query patterns | SaaS Arch | 1.2.1–1.2.11 | Migration with index definitions |

### 1.3 Auth & Onboarding

| # | Task | Agent | Depends On | Deliverable |
|---|------|-------|------------|-------------|
| 1.3.1 | Implement Supabase Auth (email + password) | Security | 1.1.4, 1.2.2 | Auth configured, login/signup functional |
| 1.3.2 | Build login page | Frontend | 1.3.1 | `/login` page with form + error handling |
| 1.3.3 | Build signup page | Frontend | 1.3.1 | `/signup` page with form + error handling |
| 1.3.4 | Build onboarding flow (create org on first login) | Frontend + Backend API | 1.3.1, 1.2.1 | New user → create org → redirect to dashboard |
| 1.3.5 | Create auth middleware (protect all `/dashboard` routes) | Security | 1.3.1 | `middleware.ts` with route protection |
| 1.3.6 | Create `useUser` and `useOrganization` hooks | Backend API | 1.3.1, 1.2.3 | Hooks that return current user + org context |
| 1.3.7 | Create `lib/permissions.ts` (role check helpers) | Security | 1.2.3 | `isAdmin()`, `isEditor()`, `requireAdmin()` |

### 1.4 Site Manager

| # | Task | Agent | Depends On | Deliverable |
|---|------|-------|------------|-------------|
| 1.4.1 | CRUD API for websites (scoped to org) | Backend API | 1.2.4, 1.3.6 | Server actions or API routes |
| 1.4.2 | Build site list page | Frontend | 1.4.1 | `/dashboard/sites` — list, empty state, add button |
| 1.4.3 | Build add/edit site form (name, URL, CMS type) | Frontend | 1.4.1 | Form with validation |
| 1.4.4 | Build Brand Voice profile editor | Frontend | 1.4.1 | Site description, tone guardrails, banned topics/words, required elements, content pillars |
| 1.4.5 | Combine site settings + brand voice into single site detail page | Frontend | 1.4.3, 1.4.4 | `/dashboard/sites/[id]` with tabbed layout |

### 1.5 Persona Manager (Voice Tab)

| # | Task | Agent | Depends On | Deliverable |
|---|------|-------|------------|-------------|
| 1.5.1 | CRUD API for personas (scoped to org) | Backend API | 1.2.5, 1.3.6 | Server actions or API routes |
| 1.5.2 | Build persona list page | Frontend | 1.5.1 | `/dashboard/personas` — list, empty state, add button |
| 1.5.3 | Build Voice tab form (name, bio, avatar, tone sliders, quirks, forbidden words, signature phrases, model override, image style) | Frontend | 1.5.1 | Full voice settings form |
| 1.5.4 | Build website assignment UI (assign persona to sites) | Frontend + Backend API | 1.5.1, 1.4.1 | Multi-select with `persona_website_assignments` |
| 1.5.5 | Build writing sample upload (accept .txt, .docx, .pdf) | Backend API | 1.2.6 | Upload to Supabase Storage, extract text, save to `persona_writing_samples` |
| 1.5.6 | Implement voice analysis (AI analyzes uploaded samples → generates voice summary) | AI Integration + Prompt Eng | 1.5.5 | `lib/persona/voice-analysis.ts` — sends samples to Claude, returns plain-English voice summary, saves to `personas.voice_summary` |
| 1.5.7 | Build writing samples list in UI (view, delete uploaded samples) | Frontend | 1.5.5 | Sample list with upload status and delete |

### 1.6 Article Generation (Minimal Pipeline)

| # | Task | Agent | Depends On | Deliverable |
|---|------|-------|------------|-------------|
| 1.6.1 | Build Claude API client with streaming | AI Integration | 1.1.3 | `lib/generation/claude.ts` — typed client, streaming support |
| 1.6.2 | Build basic model router (Claude only for now, but extensible) | AI Integration | 1.6.1 | `lib/generation/model-router.ts` |
| 1.6.3 | Build token counter + cost estimator for Claude | AI Integration | 1.6.1 | `lib/generation/token-counter.ts`, `lib/generation/cost-estimator.ts` |
| 1.6.4 | Build 9-layer prompt assembler | Prompt Eng | 1.2.4, 1.2.5 | `lib/generation/prompt.ts` — takes website, persona, brief, keywords → assembled prompt |
| 1.6.5 | Build usage event logger | Backend API | 1.2.11 | `lib/usage.ts` — logs to `usage_events` with cost |
| 1.6.6 | Build article generation API endpoint | Backend API | 1.6.2, 1.6.4, 1.6.5 | API route: receives brief → assembles prompt → calls Claude → streams response → saves article → logs usage |
| 1.6.7 | Build article creation flow — Step 1: site picker | Frontend | 1.4.1 | Site selection with brand voice loaded |
| 1.6.8 | Build article creation flow — Step 2: persona picker | Frontend | 1.5.1, 1.5.4 | Persona list filtered by site, "Recommended" badge by usage_count |
| 1.6.9 | Build article creation flow — Step 3: article brief form | Frontend | — | Topic, format, length, notes, manual keyword entry |
| 1.6.10 | Build article creation flow — Step 5: streaming editor | Frontend | 1.6.6 | Tiptap editor showing streamed generation, inline editing after completion |
| 1.6.11 | Build manual export (HTML, Markdown, plain text) | Backend API + Frontend | 1.6.10 | Export button with format selection, file download |

### 1.7 Dashboard

| # | Task | Agent | Depends On | Deliverable |
|---|------|-------|------------|-------------|
| 1.7.1 | Build dashboard shell layout (sidebar nav, header, main content area) | Frontend | 1.3.5 | App layout with navigation to sites, personas, new article |
| 1.7.2 | Build dashboard home page (recent articles, quick stats) | Frontend | 1.6.6 | `/dashboard` with recent articles list and basic counts |

### 1.8 Phase 1 Security Review

| # | Task | Agent | Depends On | Deliverable |
|---|------|-------|------------|-------------|
| 1.8.1 | Audit all queries for org scoping | Security | 1.4–1.6 | Every query confirmed scoped by `organization_id` |
| 1.8.2 | Verify RLS policies on all tables | Security | 1.2 | RLS active and tested |
| 1.8.3 | Verify no secrets in client-side code | Security | 1.1–1.6 | Audit pass |
| 1.8.4 | Verify middleware protects all routes | Security | 1.3.5 | No unprotected `/dashboard` routes |

### Phase 1 — Done When

- [ ] User can sign up, log in, and land on the dashboard
- [ ] User can create a website with a full brand voice profile
- [ ] User can create a persona with tone sliders, quirks, and uploaded writing samples
- [ ] Voice analysis generates a summary from uploaded samples
- [ ] User can walk through steps 1-3-5: select site → select persona → write brief → generate article with Claude (streaming)
- [ ] User can edit the generated article inline
- [ ] User can export as HTML, Markdown, or plain text
- [ ] Every generation logs to `usage_events` with estimated cost
- [ ] All data is org-scoped with RLS

---

## Phase 2 — SEO & Ahrefs

Adds the keyword research step, the SEO audit step, and the persona SEO tab. After this phase, articles go through the full research → generate → check cycle.

### 2.1 Persona SEO Tab

| # | Task | Agent | Depends On | Deliverable |
|---|------|-------|------------|-------------|
| 2.1.1 | Build SEO tab form (linking sliders, keyword density, heading depth, FAQ/TOC toggles, meta settings, Ahrefs settings) | Frontend | Phase 1 | Full SEO settings form on persona detail page |
| 2.1.2 | SEO defaults pre-populate the article brief form | Backend API + Frontend | 2.1.1 | When persona is selected in pipeline, SEO fields auto-fill (editable) |

### 2.2 Keyword Research (Ahrefs)

| # | Task | Agent | Depends On | Deliverable |
|---|------|-------|------------|-------------|
| 2.2.1 | Build Ahrefs API client | Backend API | Phase 1 | `lib/seo/ahrefs.ts` — Keywords Explorer call |
| 2.2.2 | Build keyword filtering + clustering logic | SEO Engine | 2.2.1 | `lib/seo/keywords.ts` — filter by volume/KD, cluster by semantic group |
| 2.2.3 | Build AI-based keyword role assignment (Primary/Secondary/Ignore) | SEO Engine + AI Integration | 2.2.2 | `lib/seo/keyword-picker.ts` — AI suggests roles |
| 2.2.4 | Build keyword research API endpoint | Backend API | 2.2.1–2.2.3 | Route: receives seed + persona settings → calls Ahrefs → filters → clusters → assigns roles → returns |
| 2.2.5 | Log Ahrefs calls to `usage_events` | Backend API | 2.2.4, 1.6.5 | Every keyword lookup logged with cost |
| 2.2.6 | Build pipeline Step 4: keyword research UI | Frontend | 2.2.4 | Keyword table with volume, KD, role assignment, approve button. Skip option for manual entry |

### 2.3 Internal Linking

| # | Task | Agent | Depends On | Deliverable |
|---|------|-------|------------|-------------|
| 2.3.1 | Create `website_content_index` table (if not already in Phase 1 schema) | SaaS Arch | Phase 1 | Migration + RLS |
| 2.3.2 | Build manual content index entry (placeholder until CMS sync in Phase 3) | Backend API | 2.3.1 | API to add/edit/delete content index entries for a site |
| 2.3.3 | Feed content index into prompt Layer 6 (internal link reference) | Prompt Eng | 2.3.2, 1.6.4 | Prompt assembler includes relevant published articles for linking |

### 2.4 SEO Checker

| # | Task | Agent | Depends On | Deliverable |
|---|------|-------|------------|-------------|
| 2.4.1 | Build HTML parser for article analysis | SEO Engine | Phase 1 | `lib/seo/html-parser.ts` — extracts headings, links, paragraphs, images, meta |
| 2.4.2 | Build keyword density calculator | SEO Engine | 2.4.1 | `lib/seo/density.ts` |
| 2.4.3 | Build heading structure validator | SEO Engine | 2.4.1 | `lib/seo/headings.ts` — checks hierarchy, keyword in H2s |
| 2.4.4 | Build meta title/description checker | SEO Engine | 2.4.1 | `lib/seo/meta.ts` — length limits, keyword presence |
| 2.4.5 | Build link validator (internal + outbound) | SEO Engine | 2.4.1, 2.3.1 | `lib/seo/links.ts` — count, verify internal URLs exist in content index |
| 2.4.6 | Build image alt text checker | SEO Engine | 2.4.1 | Checks all images have alt text, keyword in at least one |
| 2.4.7 | Build Flesch-Kincaid readability scorer | SEO Engine | — | `lib/seo/readability.ts` |
| 2.4.8 | Build article length checker | SEO Engine | — | Checks word count within 10% of target |
| 2.4.9 | Build SEO audit orchestrator | SEO Engine | 2.4.1–2.4.8 | `lib/seo/checker.ts` — runs all checks, returns checklist with pass/warning/fail |
| 2.4.10 | Build one-click fix handlers | SEO Engine | 2.4.9 | `lib/seo/fixes.ts` — e.g. "add keyword to meta description" |
| 2.4.11 | Build SEO check API endpoint | Backend API | 2.4.9 | Route: receives article → runs audit → returns checklist |
| 2.4.12 | Build pipeline Step 7: SEO check UI | Frontend | 2.4.11, 2.4.10 | Checklist with pass/warning/fail indicators, fix buttons, plain-English suggestions |

### Phase 2 — Done When

- [ ] Persona detail page has a full SEO tab with all settings
- [ ] SEO defaults pre-populate the article brief
- [ ] Pipeline includes Step 4: Ahrefs keyword research with approval table
- [ ] Keywords can be manually entered (skipping Ahrefs)
- [ ] Generated articles include internal links from the content index
- [ ] Pipeline includes Step 7: full SEO audit checklist
- [ ] One-click fixes work for applicable checks
- [ ] Every Ahrefs call logged to `usage_events`

---

## Phase 3 — Publishing

Connects the tool to WordPress. Articles can be published, scheduled, or saved as drafts. Content library gives a full archive of all articles.

### 3.1 WordPress Integration

| # | Task | Agent | Depends On | Deliverable |
|---|------|-------|------------|-------------|
| 3.1.1 | Build WordPress REST API client (posts) | CMS Integration | Phase 1 | `lib/cms/wordpress.ts` — create/update posts via Application Password auth |
| 3.1.2 | Build WordPress media upload | CMS Integration | 3.1.1 | Upload images via `/wp-json/wp/v2/media`, return media ID |
| 3.1.3 | Build connection test logic | CMS Integration | 3.1.1 | `lib/cms/test.ts` — validates credentials and endpoint |
| 3.1.4 | Add WordPress connection fields to site settings UI | Frontend | 3.1.3 | Site URL, Application Password, default post status/category/tags, test button |
| 3.1.5 | Encrypt CMS credentials before storage | Security | 3.1.4 | `connection_config` stored encrypted |

### 3.2 Content Index Sync

| # | Task | Agent | Depends On | Deliverable |
|---|------|-------|------------|-------------|
| 3.2.1 | Build content index sync from WordPress | CMS Integration | 3.1.1, 2.3.1 | `lib/cms/sync.ts` — pull published posts (title, URL, excerpt, date) into `website_content_index` |
| 3.2.2 | Build "Sync content" button in site manager | Frontend | 3.2.1 | Button triggers sync, shows last synced timestamp |
| 3.2.3 | Auto-sync content index when site is selected in pipeline | Backend API | 3.2.1 | Cached per session, fresh pull if stale |

### 3.3 Publishing Flow

| # | Task | Agent | Depends On | Deliverable |
|---|------|-------|------------|-------------|
| 3.3.1 | Build publish service (sends article to WordPress) | Backend API + CMS Integration | 3.1.1, 3.1.2 | `lib/publish/` — uploads images first, then creates post with media IDs |
| 3.3.2 | Build schedule service | Job Queue | 3.3.1 | `lib/publish/scheduler.ts` — persists `scheduled_at`, cron picks it up |
| 3.3.3 | Set up Vercel Cron for scheduled publishing | DevOps + Job Queue | 3.3.2 | Cron endpoint checks for due articles every minute |
| 3.3.4 | Build pipeline Step 9: publish UI | Frontend | 3.3.1, 3.3.2 | Publish now (with confirmation), schedule (date/time picker), save as draft, export |
| 3.3.5 | Handle publish success/failure with status updates | Backend API | 3.3.1 | Article status transitions: draft → published / failed. Store `external_post_id` |
| 3.3.6 | Log publish events to `usage_events` | Backend API | 3.3.1 | Every publish attempt logged |

### 3.4 Content Library

| # | Task | Agent | Depends On | Deliverable |
|---|------|-------|------------|-------------|
| 3.4.1 | Build content library queries (filter, search, paginate) | Backend API | Phase 1 | Filter by site, persona, format, status, date, keyword. Full-text search |
| 3.4.2 | Build content library page | Frontend | 3.4.1 | `/dashboard/library` — article list with filters, search bar, status badges |
| 3.4.3 | Build article detail page (view, re-edit, republish) | Frontend | 3.4.1 | `/dashboard/articles/[id]` — editor, SEO check, publish actions |
| 3.4.4 | Build duplicate article action (same brief, fresh generation) | Backend API + Frontend | 3.4.1 | "Duplicate" button → pre-fills pipeline with same brief |
| 3.4.5 | Build article tagging (evergreen, seasonal, needs review, etc.) | Backend API + Frontend | 1.2.10 | Tag management on article detail page |

### Phase 3 — Done When

- [ ] WordPress sites can be connected with tested credentials
- [ ] Content index syncs from WordPress (manual + auto on site selection)
- [ ] Articles can be published to WordPress immediately
- [ ] Articles can be scheduled for future publishing
- [ ] Scheduled publishing fires reliably via cron
- [ ] Articles can be saved as drafts
- [ ] Content library shows all articles with filters and search
- [ ] Articles can be re-opened, re-edited, duplicated, and republished
- [ ] CMS credentials are encrypted at rest
- [ ] All publish events logged to `usage_events`

---

## Phase 4 — Images

Adds image discovery, AI generation, alt text, and featured image support. After this phase, the full image pipeline (Step 6) works.

### 4.1 Image Infrastructure

| # | Task | Agent | Depends On | Deliverable |
|---|------|-------|------------|-------------|
| 4.1.1 | Create `article_images` table (if not in Phase 1 schema) | SaaS Arch | Phase 1 | Migration + RLS |
| 4.1.2 | Set up Supabase Storage bucket for images with RLS | DevOps + Security | 4.1.1 | Storage bucket, org-scoped access policies |
| 4.1.3 | Build image upload/storage service | Backend API | 4.1.2 | `lib/images/storage.ts` — upload to Supabase Storage, return public URL |

### 4.2 Stock Photos

| # | Task | Agent | Depends On | Deliverable |
|---|------|-------|------------|-------------|
| 4.2.1 | Build Unsplash API client | Backend API | Phase 1 | `lib/images/unsplash.ts` — search by query, return image options |
| 4.2.2 | Build Pexels API client (fallback) | Backend API | Phase 1 | `lib/images/pexels.ts` |
| 4.2.3 | Build stock photo search endpoint | Backend API | 4.2.1, 4.2.2 | Route: query → search Unsplash (fallback Pexels) → return 3-5 options |

### 4.3 AI Image Generation

| # | Task | Agent | Depends On | Deliverable |
|---|------|-------|------------|-------------|
| 4.3.1 | Build Gemini Imagen client | AI Integration | Phase 1 | `lib/images/imagen.ts` — send prompt + style → receive image |
| 4.3.2 | Build image generation endpoint | Backend API | 4.3.1, 4.1.3 | Route: description + persona image style → generate → store → return URL |
| 4.3.3 | Log image generation to `usage_events` | Backend API | 4.3.2 | Every AI image logged with cost |

### 4.4 Image Pipeline

| # | Task | Agent | Depends On | Deliverable |
|---|------|-------|------------|-------------|
| 4.4.1 | Build `[IMAGE: ...]` marker parser | Backend API | Phase 1 | `lib/images/parser.ts` — extracts markers from article HTML |
| 4.4.2 | Build alt text generator (AI-based) | AI Integration | Phase 1 | `lib/images/alt-text.ts` — generates alt text from image context + primary keyword |
| 4.4.3 | Build marker-to-image replacement service | Backend API | 4.4.1, 4.1.3 | Replaces `[IMAGE: ...]` markers with final `<img>` tags |
| 4.4.4 | Build pipeline Step 6: image UI | Frontend | 4.2.3, 4.3.2, 4.4.2 | For each marker: stock picker OR AI generate. Alt text editor. Featured image selector |
| 4.4.5 | Build featured image support | Frontend + Backend API | 4.4.4 | First image or user-selected image set as `articles.featured_image_url` |

### Phase 4 — Done When

- [ ] `[IMAGE: ...]` markers are parsed from generated articles
- [ ] Users can search stock photos (Unsplash/Pexels) for each marker
- [ ] Users can generate AI images via Gemini Imagen for each marker
- [ ] Alt text is auto-generated and editable
- [ ] Images are stored in Supabase Storage with org-scoped access
- [ ] Markers are replaced with final `<img>` tags in the article
- [ ] Featured image can be selected
- [ ] Image generation costs logged to `usage_events`

---

## Phase 5 — Full Feature Set

Adds model switching, custom CMS, external SEO grader, approval workflow, bulk scheduling, and inline section regeneration. After this phase, every feature in the blueprint works.

### 5.1 Model Switching

| # | Task | Agent | Depends On | Deliverable |
|---|------|-------|------------|-------------|
| 5.1.1 | Build OpenAI GPT client with streaming | AI Integration | Phase 1 | `lib/generation/openai.ts` |
| 5.1.2 | Build Google Gemini text client with streaming | AI Integration | Phase 1 | `lib/generation/gemini.ts` |
| 5.1.3 | Extend model router: persona override → org default → global fallback | AI Integration | 5.1.1, 5.1.2 | `model-router.ts` checks persona, then org, then global setting |
| 5.1.4 | Build provider failover (Claude → GPT → Gemini) | AI Integration | 5.1.3 | Retry on same provider for transient errors, failover for persistent |
| 5.1.5 | Add token counting + cost estimation for GPT and Gemini | AI Integration | 5.1.1, 5.1.2 | Token counter and cost estimator support all three providers |
| 5.1.6 | Add model selector to organization settings UI | Frontend | 5.1.3 | Default AI model dropdown in settings |

### 5.2 Custom CMS Webhooks

| # | Task | Agent | Depends On | Deliverable |
|---|------|-------|------------|-------------|
| 5.2.1 | Build generic webhook publisher | CMS Integration | Phase 3 | `lib/cms/webhook.ts` — POST to configured endpoint with mapped fields |
| 5.2.2 | Build field mapping configuration | CMS Integration | 5.2.1 | Map WritingChamps fields → CMS field names, stored per website |
| 5.2.3 | Build connection test for webhooks | CMS Integration | 5.2.1 | Test endpoint with sample payload |
| 5.2.4 | Add custom CMS setup UI to site manager | Frontend | 5.2.1–5.2.3 | Endpoint URL, HTTP method, auth type, field mapper, test button |

### 5.3 External SEO Grader

| # | Task | Agent | Depends On | Deliverable |
|---|------|-------|------------|-------------|
| 5.3.1 | Build Surfer SEO API client | SEO Engine | Phase 2 | `lib/seo/surfer.ts` — submit article, receive content score |
| 5.3.2 | Add external grader toggle to organization settings | Frontend + Backend API | 5.3.1 | Per-org toggle: on/off, select provider |
| 5.3.3 | Integrate external score into SEO check UI | Frontend | 5.3.1, 5.3.2 | External score shown alongside internal checklist when toggled on |

### 5.4 Approval Workflow

| # | Task | Agent | Depends On | Deliverable |
|---|------|-------|------------|-------------|
| 5.4.1 | Build approval service (submit, approve, reject with comment) | Backend API | Phase 1 | `lib/publish/approval.ts` — status transitions: draft → pending_approval → approved / rejected |
| 5.4.2 | Add approval workflow toggle to team settings | Frontend + Backend API | 5.4.1 | `organizations.approval_workflow_enabled` toggle |
| 5.4.3 | Build pipeline Step 8: approval UI | Frontend | 5.4.1, 5.4.2 | Submit for review button (editors), approve/reject with comment (admins) |
| 5.4.4 | Build notification for approval requests | Backend API | 5.4.1 | Admin notified when article submitted; editor notified on approve/reject |
| 5.4.5 | Enforce: editors can't publish when approval is on | Security | 5.4.2 | Permission check in publish endpoint |

### 5.5 Section Regeneration

| # | Task | Agent | Depends On | Deliverable |
|---|------|-------|------------|-------------|
| 5.5.1 | Build section regeneration prompt | Prompt Eng | Phase 1 | Prompt that takes a section + context → regenerated section matching persona voice |
| 5.5.2 | Build section regeneration endpoint | Backend API + AI Integration | 5.5.1 | Route: selected section + full article context → regenerated section (streamed) |
| 5.5.3 | Add inline regeneration controls to editor | Frontend | 5.5.2 | Select section → "Regenerate" button → streamed replacement |
| 5.5.4 | Build tone/length nudge controls | Frontend + Prompt Eng | 5.5.1 | "Make shorter", "Make more casual", etc. — applied to selected section |

### 5.6 Bulk Scheduling

| # | Task | Agent | Depends On | Deliverable |
|---|------|-------|------------|-------------|
| 5.6.1 | Build bulk schedule endpoint (assign dates to multiple articles) | Backend API | Phase 3 | Route: receives array of article IDs + dates → sets `scheduled_at` |
| 5.6.2 | Build bulk schedule UI in content library | Frontend | 5.6.1 | Multi-select articles → assign schedule dates |

### 5.7 Team Management

| # | Task | Agent | Depends On | Deliverable |
|---|------|-------|------------|-------------|
| 5.7.1 | Build team invite by email | Backend API | 1.2.3 | Invite endpoint → creates org membership |
| 5.7.2 | Build team management page | Frontend | 5.7.1 | `/dashboard/settings/team` — member list, roles, invite form |
| 5.7.3 | Build activity log (who generated what, when, which model) | Backend API + Frontend | 1.2.11 | Admin-visible activity feed from `usage_events` |

### Phase 5 — Done When

- [ ] Articles can be generated with Claude, GPT, or Gemini (switchable)
- [ ] Provider failover works automatically on persistent errors
- [ ] Custom CMS webhooks work with configurable field mapping
- [ ] External SEO grader returns a score alongside internal checks (when toggled on)
- [ ] Approval workflow blocks editor publishing when enabled
- [ ] Admins can approve/reject with comments
- [ ] Sections can be regenerated inline with tone/length nudges
- [ ] Multiple articles can be bulk-scheduled from the content library
- [ ] Team members can be invited, assigned roles
- [ ] Activity log visible to admins

---

## Phase 6 — Commercial Readiness

Enforces tier limits, adds Stripe billing, usage dashboards, and the batch generator. After this phase, the product can accept paying customers.

### 6.1 Tier Enforcement

| # | Task | Agent | Depends On | Deliverable |
|---|------|-------|------------|-------------|
| 6.1.1 | Build limit checking service | Backend API + Security | Phase 1 | `lib/limits.ts` — check monthly article count, persona count, website count, seat count against plan |
| 6.1.2 | Enforce article limit before generation | Backend API | 6.1.1 | Generation endpoint rejects if monthly limit reached |
| 6.1.3 | Enforce persona/website/seat limits on creation | Backend API | 6.1.1 | CRUD endpoints reject if plan limit reached |
| 6.1.4 | Build feature gates (AI images, batch generator, Ahrefs) | Security | 6.1.1 | `lib/billing/gates.ts` — `canUseAIImages(org)`, `canUseBatch(org)`, etc. |
| 6.1.5 | Build upgrade prompt UI | Frontend | 6.1.4 | When a gated feature is accessed, show plan comparison + upgrade CTA |

### 6.2 Usage Dashboard

| # | Task | Agent | Depends On | Deliverable |
|---|------|-------|------------|-------------|
| 6.2.1 | Build usage data queries (cost by model, by user, by month) | Backend API | 1.2.11 | Aggregation queries on `usage_events` |
| 6.2.2 | Build admin usage dashboard page | Frontend | 6.2.1 | `/dashboard/settings/usage` — charts, tables, totals. Admin-only |
| 6.2.3 | Build per-article cost display | Frontend | 6.2.1 | Cost badge on article detail page (admin-visible) |

### 6.3 Stripe Billing

| # | Task | Agent | Depends On | Deliverable |
|---|------|-------|------------|-------------|
| 6.3.1 | Align Stripe products/prices with tier structure | SaaS Arch | — | Stripe product IDs mapped to Starter/Pro/Enterprise |
| 6.3.2 | Build Stripe Checkout flow | Backend API | 6.3.1 | `lib/billing/stripe.ts` — create checkout session, redirect to Stripe |
| 6.3.3 | Build Stripe webhook handler | Backend API + Security | 6.3.2 | Handle `checkout.session.completed`, `invoice.paid`, `customer.subscription.updated/deleted` |
| 6.3.4 | Update org plan on subscription events | Backend API | 6.3.3 | Webhook updates `organizations.plan` and `article_limit` |
| 6.3.5 | Build plan management page | Frontend | 6.3.2, 6.3.3 | `/dashboard/settings/billing` — current plan, usage vs limits, upgrade/downgrade buttons |
| 6.3.6 | Handle downgrades gracefully | Backend API | 6.3.4 | If downgrading exceeds limits: warn but don't delete. Block new creation until within limits |
| 6.3.7 | Monthly usage reset on billing cycle | Backend API | 6.3.4 | Reset article count on `billing_cycle_start` anniversary |

### 6.4 Batch Generator

| # | Task | Agent | Depends On | Deliverable |
|---|------|-------|------------|-------------|
| 6.4.1 | Build CSV parser (validate columns: site, topic, persona, format, keywords, length, image mode) | Backend API | — | Parse and validate CSV, return errors for invalid rows |
| 6.4.2 | Build batch job queue (each row → `generation_job_items`) | Job Queue | 6.4.1 | `lib/jobs/batch.ts` — creates `generation_jobs` + items |
| 6.4.3 | Build batch worker (processes items sequentially through full pipeline) | Job Queue + Backend API | 6.4.2 | Each item: keyword research (if needed) → generation → images → SEO check → save as draft |
| 6.4.4 | Build retry + failure handling per job item | Job Queue | 6.4.3 | Failed items get error message, don't block remaining items |
| 6.4.5 | Build batch generator page (CSV upload + progress view) | Frontend | 6.4.2, 6.4.3 | `/dashboard/batch` — upload, live progress (completed/failed/total), results link to content library |
| 6.4.6 | Gate batch generator behind Pro/Enterprise plan | Security | 6.1.4 | Starter plan sees upgrade prompt |

### 6.5 Final Security Audit

| # | Task | Agent | Depends On | Deliverable |
|---|------|-------|------------|-------------|
| 6.5.1 | Full org isolation audit across all endpoints | Security | All phases | Every route confirmed scoped |
| 6.5.2 | Stripe webhook signature verification | Security | 6.3.3 | Webhooks reject unsigned payloads |
| 6.5.3 | Rate limiting on all public endpoints | Security | All phases | Per-org and per-user rate limits |
| 6.5.4 | Prompt injection hardening review | Security | All phases | User content sandboxed in all prompts |
| 6.5.5 | Credential encryption audit | Security | All phases | All CMS configs and sensitive fields encrypted |

### Phase 6 — Done When

- [ ] Tier limits enforced: article caps, persona/website/seat limits, feature gates
- [ ] Upgrade prompts appear when limits are hit or gated features accessed
- [ ] Stripe Checkout works for all tiers
- [ ] Plan changes (upgrade/downgrade) handled correctly
- [ ] Monthly usage resets on billing cycle
- [ ] Admin usage dashboard shows costs by model, user, and month
- [ ] Batch generator accepts CSV, processes through full pipeline, shows live progress
- [ ] Batch generator gated behind Pro/Enterprise
- [ ] Full security audit passed
- [ ] Product is ready for paying customers
