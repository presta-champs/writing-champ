# Agent Workflows

How the 10 agents collaborate. Every workflow defines the order of invocation, what each agent delivers, and what it hands off to the next.

---

## 1. New Feature Workflow (General)

The default sequence for building any new feature end-to-end.

```
┌─────────────────────┐
│  SaaS Architecture  │  Schema changes, types, migration plan
└────────┬────────────┘
         │ delivers: updated schema + types
         ▼
┌─────────────────────┐
│   Backend API       │  API routes, services, validation, usage logging
└────────┬────────────┘
         │ delivers: working endpoints
         ▼
┌─────────────────────┐
│  Domain Agent(s)    │  AI Integration / SEO Engine / CMS / Job Queue
│  (as needed)        │  Domain-specific logic for the feature
└────────┬────────────┘
         │ delivers: domain logic wired to API layer
         ▼
┌─────────────────────┐
│  Frontend Arch      │  Pages, components, forms, streaming UI
└────────┬────────────┘
         │ delivers: complete user-facing feature
         ▼
┌─────────────────────┐
│  Security &         │  Org isolation audit, role checks, credential
│  Isolation          │  handling, prompt injection review
└────────┬────────────┘
         │ delivers: secure feature
         ▼
┌─────────────────────┐
│  QA & Testing       │  E2E workflows, UI component tests, mocked API
│                     │  tests, AI output validation
└─────────────────────┘
```

**Rule:** Security & Isolation and QA & Testing review every feature before it's considered done.

---

## 2. Article Creation Pipeline Workflow

Maps each pipeline step from the blueprint to the agents responsible.

```
Step 1 — Select Website
  → Backend API        (fetch org's websites, load brand voice)
  → Frontend Arch      (site picker UI, context loading)

Step 2 — Select Persona
  → Backend API        (fetch personas for site, usage-based ranking)
  → Frontend Arch      (persona picker, "Recommended" badge)

Step 3 — Article Brief
  → Frontend Arch      (brief form, SEO defaults pre-population)
  → Backend API        (validate brief, persist draft state)

Step 4 — Keyword Research
  → Backend API        (call Ahrefs, filter by persona SEO settings)
  → SEO Engine         (keyword clustering, role assignment logic)
  → Frontend Arch      (keyword table UI, approve/reassign)

Step 5 — Article Generation
  → Prompt Engineering  (assemble 9-layer prompt from all inputs)
  → AI Integration      (route to provider, stream response, log cost)
  → Backend API         (persist article + prompt snapshot)
  → Frontend Arch       (streaming editor, inline editing)

Step 6 — Image Generation
  → AI Integration      (Gemini Imagen for AI-generated images)
  → Backend API         (stock photo API calls, Supabase storage)
  → Frontend Arch       (image picker, alt text editor)

Step 7 — SEO Check
  → SEO Engine          (run full audit checklist, return results)
  → Frontend Arch       (checklist UI, one-click fix actions)

Step 8 — Approval (if enabled)
  → Backend API         (submit for review, approve/reject logic)
  → Frontend Arch       (approval status UI, notifications)

Step 9 — Publish
  → CMS Integration     (WordPress/webhook publish, media upload)
  → Job Queue           (if scheduled — cron job handling)
  → Backend API         (update article status, log usage)
  → Frontend Arch       (publish confirmation, schedule picker, export)
```

---

## 3. Phase Build Workflows

Agent invocation order for each build phase from the blueprint.

### Phase 1 — Foundation

```
SaaS Architecture     → Full schema: organizations, users, org_members,
                        websites, personas, persona_writing_samples,
                        persona_website_assignments, articles,
                        usage_events. Types. RLS policies.

Backend API           → CRUD: organizations, websites (with brand voice),
                        personas (voice tab + sample upload).
                        Manual keyword entry. Single article generation
                        endpoint (Claude only). Manual export (HTML/MD/TXT).
                        Usage event logging on every generation.

AI Integration        → Claude client only. Streaming response handler.
                        Token counting + cost estimation. Basic model router
                        (single provider for now, but built to extend).

Prompt Engineering    → Initial 9-layer prompt template. Persona voice
                        injection. Brand voice injection. Voice analysis
                        for uploaded writing samples.

Frontend Arch         → Auth pages (login/signup/onboarding). Dashboard.
                        Site manager (add/edit site + brand voice).
                        Persona manager (voice tab + sample upload).
                        Article creation flow (steps 1-3, 5 only — no
                        Ahrefs, no SEO check yet). Streaming editor.
                        Manual export button.

Security & Isolation  → RLS policies on all tables. Middleware auth.
                        Org-scoped queries audit. Role checks (admin/editor).
                        Credential encryption for site connection configs.

DevOps                → Project scaffolding. Vercel + Supabase setup.
                        Environment variables. .env.example.
```

### Phase 2 — SEO and Ahrefs

```
SaaS Architecture     → article_keywords table. Add SEO fields to personas
                        if not already present.

Backend API           → Ahrefs API integration endpoint. Keyword
                        filtering + clustering service. SEO check endpoint.
                        Internal link suggestion from content index.

SEO Engine            → Keyword density calculator. Heading validator.
                        Meta length checker. Flesch-Kincaid scorer.
                        Internal link validator. Full audit orchestrator.
                        One-click fix handlers.

Frontend Arch         → Persona SEO tab UI. Keyword research step (step 4)
                        with approval table. SEO check step (step 7) with
                        checklist UI and fix actions.

Security & Isolation  → Ahrefs API key protection. Usage logging audit
                        for keyword lookups.
```

### Phase 3 — Publishing

```
SaaS Architecture     → website_content_index table refinement.
                        Article status state machine
                        (draft → scheduled → published → failed).

CMS Integration       → WordPress REST API client. Media upload flow.
                        Content index sync. Connection test logic.

Backend API           → Publish endpoint. Schedule endpoint.
                        Content library queries (filter, search, paginate).

Job Queue             → Scheduled publishing cron job (Vercel Cron).
                        Content index sync worker.

Frontend Arch         → Publish step (step 9) — publish now / schedule /
                        draft / export. Content library page with filters.
                        Site manager "Sync content" button.

DevOps                → Vercel Cron configuration for scheduled publishing.

Security & Isolation  → WordPress credential encryption audit.
                        Publish permission checks (editor vs admin +
                        approval toggle).
```

### Phase 4 — Images

```
SaaS Architecture     → article_images table. Storage bucket policies.

AI Integration        → Gemini Imagen client. Image generation cost
                        estimation + logging.

Backend API           → Unsplash/Pexels search endpoints. Image upload
                        to Supabase Storage. Alt text generation endpoint.
                        Image marker parsing service.

Frontend Arch         → Image step (step 6) — stock picker, AI generation
                        option, alt text editor. Featured image support.
                        Inline image replacement in editor.

Security & Isolation  → Storage bucket RLS. Image access scoped to org.
                        Stock API key protection.
```

### Phase 5 — Full Feature Set

```
AI Integration        → Add OpenAI + Gemini text clients. Model switching
                        logic (per-persona override → org default → global
                        fallback). Provider failover. Retry strategy.

CMS Integration       → Custom webhook publisher. Field mapping config.
                        Connection test for webhooks.

SEO Engine            → Surfer SEO / Clearscope API client (external
                        grader, toggled per org).

Backend API           → Approval workflow (submit/approve/reject).
                        Bulk scheduling endpoint. Section regeneration
                        endpoint.

Prompt Engineering    → Section regeneration prompt. Tone/length nudge
                        prompts. Refine prompt templates based on
                        multi-model output quality.

Frontend Arch         → Model selector in persona settings. Custom CMS
                        setup UI with field mapping. Approval flow UI
                        (submit, status, notifications). Bulk schedule
                        view. Inline section regeneration in editor.

Job Queue             → Bulk scheduling worker.

Security & Isolation  → Webhook endpoint validation. Approval permission
                        audit. Model API key isolation.
```

### Phase 6 — Commercial Readiness

```
SaaS Architecture     → Stripe billing schema (subscription fields on
                        organizations). Plan enforcement query patterns.

Backend API           → Stripe Checkout + webhook handler. Plan upgrade/
                        downgrade logic. Tier limit enforcement on every
                        billable action. Usage dashboard data queries.
                        Batch generator endpoint (CSV parse → job queue).

Job Queue             → Batch generator pipeline — CSV rows → sequential
                        jobs through full article pipeline. Progress
                        tracking. Failure handling per item.

Frontend Arch         → Usage dashboard (cost by model, by user, by
                        month). Plan management page. Upgrade prompts
                        when approaching limits. Batch generator UI
                        (CSV upload, live progress, results view).

Security & Isolation  → Stripe webhook signature verification. Plan
                        enforcement bypass audit. Usage data visibility
                        restricted to admins.

DevOps                → Stripe environment setup. Cost monitoring alerts.
                        Production scaling review.
```

---

## 4. Bug Fix Workflow

```
1. Identify which domain the bug lives in
2. Invoke the relevant domain agent directly
3. If the bug crosses domains → start with Backend API to trace the flow
4. If it's a data issue → start with SaaS Architecture
5. After the fix → Security & Isolation reviews if the bug involved
   auth, permissions, or data access
```

---

## 5. Security Review Workflow

Run after every feature, before every release.

```
Security & Isolation
  ├── Org isolation     → Every new query scoped by organization_id?
  ├── Role checks       → Admin-only routes reject editors?
  ├── Credentials       → CMS configs encrypted? API keys in env only?
  ├── Prompt injection  → User content sandboxed in prompts?
  ├── Rate limiting     → New endpoints rate-limited?
  └── Audit logging     → Sensitive actions logged?
```

---

## 6. QA & Testing Workflow

Run alongside and after feature development.

```
QA & Testing
  ├── Unit & API tests  → Services and endpoints thoroughly tested?
  ├── UI & Components   → Components accessible and fully covered?
  ├── AI Validation     → Prompt injection and edge case outputs validated?
  └── E2E Workflows     → Core user journeys (e.g. article flow) automated?
```

---

## 7. Agent Dependency Map

Which agents depend on which. Arrows mean "depends on output of."

```
                    ┌──────────────┐
                    │    SaaS      │
                    │ Architecture │
                    └──────┬───────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
       ┌────────────┐ ┌────────┐ ┌───────────┐
       │ Backend    │ │Security│ │  DevOps   │
       │ API        │ │& Isol. │ │           │
       └─────┬──────┘ └────────┘ └───────────┘
             │
    ┌────────┼──────────┬──────────┬──────────┐
    ▼        ▼          ▼          ▼          ▼
┌───────┐┌───────┐┌─────────┐┌────────┐┌─────────┐
│  AI   ││Prompt ││  SEO    ││  CMS   ││Job Queue│
│Integr.││Engine ││ Engine  ││Integr. ││& BG Proc│
└───┬───┘└───┬───┘└────┬────┘└───┬────┘└────┬────┘
    │        │         │         │           │
    └────────┴─────────┴─────────┴───────────┘
                       │
                       ▼
              ┌─────────────────┐
              │    Frontend     │
              │  Architecture   │
              └────────┬────────┘
                       │
                       ▼
              ┌─────────────────┐
              │  QA & Testing   │
              └─────────────────┘
```

**Reading the map:**
- SaaS Architecture is always first — schema and types feed everything.
- Backend API consumes schema and exposes endpoints for all domain agents.
- Domain agents (AI, Prompt, SEO, CMS, Job Queue) build on Backend API.
- Frontend Architecture consumes everything above.
- QA & Testing consumes Frontend and Backend to write holistic tests.
- Security & Isolation and DevOps operate in parallel, reviewing at every stage.
