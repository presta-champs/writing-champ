# Content Planner — Design Spec

## Overview

Add a Content Planner page (`/dashboard/planner`) that lets users generate AI article ideas, organize them on a monthly calendar via drag-and-drop, and launch article creation with pre-filled fields. Split layout: ideas panel on the left, calendar grid on the right.

## Data Source

The existing `campaigns` table already has: `id`, `organization_id`, `website_id`, `persona_id`, `title`, `core_idea`, `status`, `created_by`, `created_at`, `updated_at`, plus news-seed and publishing fields.

## Database Changes

Add columns to the `campaigns` table:

```sql
ALTER TABLE campaigns
  ADD COLUMN format VARCHAR(100),
  ADD COLUMN primary_keyword VARCHAR(255),
  ADD COLUMN secondary_keywords JSONB DEFAULT '[]',
  ADD COLUMN notes TEXT,
  ADD COLUMN source VARCHAR(50) DEFAULT 'manual',
  ADD COLUMN scheduled_at DATE,
  ADD COLUMN target_length INTEGER DEFAULT 1500,
  ADD COLUMN article_id UUID REFERENCES articles(id) ON DELETE SET NULL;
```

- `format`: Article format (how-to, roundup, listicle, explainer, opinion, tutorial, case-study). Validation is application-level only.
- `primary_keyword` / `secondary_keywords`: SEO keywords for the idea
- `notes`: Free-text user notes
- `source`: `'ai'`, `'manual'`, or `'seed'` — how the idea was created
- `scheduled_at`: The calendar date the idea is planned for (NULL = unscheduled)
- `target_length`: Target word count (default 1500)
- `article_id`: Link to the generated article (set when "Write Article" flow completes)

Note: `website_id` and `persona_id` already exist on the `campaigns` table.

New migration file: `20260313_add_planner_columns.sql`

### Status Lifecycle

```
idea → planned → writing → approved → scheduled → done
```

| Status | Meaning | Color |
|--------|---------|-------|
| `idea` | Unscheduled idea in the left panel | Gray |
| `planned` | Scheduled on calendar (has `scheduled_at`) | Blue |
| `writing` | User clicked "Write Article", article in progress | Amber |
| `approved` | Article reviewed and accepted | Green |
| `scheduled` | Queued for auto-publish (future feature, not implemented now) | Purple |
| `done` | Published | Dark green |

The `status` column already exists with default `'draft'`. The planner only queries campaigns with planner statuses (`idea`, `planned`, `writing`, `approved`, `scheduled`, `done`). Existing campaigns with `status = 'draft'` are unaffected. All planner API endpoints explicitly set the status — they never rely on the DB default.

## Component 1: Sidebar Navigation

Add "Planner" nav link to `/dashboard/layout.tsx` sidebar, between "New Article" and "Content Library". Icon: `CalendarDays` from lucide-react.

## Component 2: Planner Page (`/dashboard/planner`)

Split layout, full height of the content area.

### 2a. Ideas Panel (Left, ~280px, collapsible)

**Header:**
- "Ideas" title with count of unscheduled ideas
- "Generate" button (opens generate popover)
- "+" button (opens detail modal for manual creation)
- Collapse/expand toggle

**Generate Ideas Popover:**
- Website dropdown (required)
- Seed topic text input (optional — leave empty for general suggestions)
- Count selector (min 1, default 5, max 10)
- "Generate" button
- Calls `POST /api/planner/generate`

**Idea Cards (scrollable list):**
- Each card shows: title (truncated), format badge, website name
- Cards are draggable (HTML Drag and Drop API)
- Click a card → opens detail modal
- Cards filtered to `status = 'idea'` (unscheduled only)

### 2b. Calendar Grid (Right, flex fill)

**Month Navigation:**
- Prev/Next arrows with month label ("March 2026")
- "Today" button to jump back to current month

**Grid:**
- 7 columns (Mon–Sun), rows for each week of the month
- Each cell shows: day number + idea chips
- Idea chips: colored by status, show truncated title
- Click chip → opens detail modal
- Click empty area of cell → opens detail modal pre-filled with that date

**Drag-and-drop:**
- Drag from ideas panel onto a calendar cell → sets `scheduled_at`, status becomes `planned`
- Drag between calendar cells → updates `scheduled_at`
- Drag from calendar cell back to ideas panel → clears `scheduled_at`, status reverts to `idea` (unschedule)
- Dragging to past dates is allowed (for backfilling content plans)
- Uses HTML Drag and Drop API (no external library needed)

**Past-date behavior:** Planned items on past dates show normally (no special "overdue" styling). Content planning is aspirational — missing a date isn't an error.

**Existing articles:** Articles created outside the planner also appear on their `created_at` date as lighter-styled chips (read-only, click navigates to the article editor).

**Empty states:**
- Ideas panel with zero ideas: "No ideas yet" message with prominent "Generate" and "Add manually" buttons
- Calendar month with no content: Empty cells, no special message needed
- During AI generation: spinner on the "Generate" button, disabled state

### 2c. Idea Detail Modal (Slide-out)

Slide-out panel from the right (same pattern as other modals in the app).

**Fields:**
- Title (text input, required)
- Core idea / description (textarea)
- Website (dropdown, required for "Write Article")
- Persona (dropdown, filtered by selected website, required for "Write Article")
- Format (dropdown: how-to, roundup, listicle, explainer, opinion, tutorial, case-study)
- Primary keyword (text input)
- Secondary keywords (comma-separated text input)
- Target length (number input, default 1500)
- Notes (textarea)
- Scheduled date (date picker)
- Status badge (read-only display)

**Actions:**
- "Save" — saves changes to the campaign
- "Write Article" button — only enabled when website + persona are set. Navigates to `/dashboard/articles/new?campaign=<id>`
- "Delete" — deletes the idea with confirmation

## Component 3: AI Idea Generation

### POST `/api/planner/generate`

Request:
```json
{
  "websiteId": "uuid",
  "seedTopic": "optional string",
  "count": 5
}
```

**Server-side flow:**
1. Auth check + org membership
2. Fetch website details (name, url, niche/description)
3. Fetch existing article titles for the website (to avoid duplicates)
4. Fetch website's content index if available (for gap analysis)
5. Resolve AI provider key (prefer OpenAI, fallback to Anthropic — same pattern as keyword-picker)
6. Call GPT-4o Mini with structured prompt
7. Parse response as JSON array of ideas
8. Insert each idea into `campaigns` with `status = 'idea'`, `source = 'ai'`
9. Log usage event: `event_type = 'idea_generation'`, model used, estimated cost
10. Return the created campaigns

**AI Prompt structure:**
```
You are a content strategist for a website about [niche].
Website: [name] ([url])

Existing articles (avoid duplicates):
- [title 1]
- [title 2]
...

[If seed topic provided:]
Generate {count} article ideas related to: {seedTopic}

[If no seed topic:]
Generate {count} fresh article ideas that would perform well for this website's audience.

For each idea, return JSON:
{
  "title": "Article title",
  "core_idea": "1-2 sentence description",
  "format": "how-to|roundup|listicle|explainer|opinion|tutorial|case-study",
  "primary_keyword": "main keyword",
  "secondary_keywords": ["kw1", "kw2", "kw3"]
}

Return a JSON array of {count} ideas. Focus on topics with search potential.
```

Response:
```json
{
  "ideas": [
    {
      "id": "uuid",
      "title": "...",
      "core_idea": "...",
      "format": "how-to",
      "primary_keyword": "...",
      "secondary_keywords": ["...", "..."],
      "website_id": "uuid",
      "status": "idea",
      "source": "ai"
    }
  ]
}
```

**Error handling:**
- Missing AI provider key → 400 with "No AI provider API key configured"
- AI returns malformed JSON → retry once with a stricter prompt; if still fails, return 500 with "Failed to generate ideas"
- AI returns fewer ideas than requested → return whatever was generated (no error)
- `count` validated: must be integer 1–10
- `websiteId` validated: must be a valid website belonging to the user's org

### Model Selection

Same pattern as `keyword-picker.ts`:
- Fallback order: OpenAI first, then Anthropic
- Default model: `gpt-4o-mini`
- Idea generation is a structured brainstorming task — doesn't need a heavy model

### Usage Tracking

Each generation call logged as:
- `event_type`: `'idea_generation'`
- `model_used`: the model that ran
- `estimated_cost_usd`: calculated from token usage

Add `'idea_generation'` to the display name map in `lib/usage-display.ts`:
```typescript
'idea_generation': 'Idea Generation'
```

## Component 4: Article Page Integration

### Reading campaign query param

Modify `/dashboard/articles/new/page.tsx` to:
1. Check for `campaign` query parameter
2. If present, fetch the campaign record from `campaigns` table
3. Pre-fill the article creation form:
   - `website_id` → auto-select website, pre-fill step 1 (step still visible but pre-selected)
   - `persona_id` → auto-select persona, pre-fill step 2 (step still visible but pre-selected)
   - `topic` ← `title`
   - `format` ← `format`
   - `primaryKeyword` ← `primary_keyword`
   - `secondaryKeywords` ← `secondary_keywords`
   - `targetLength` ← `target_length`
   - `notes` ← `core_idea` (added to the notes/additional context field)
4. Jump to step 3 (brief) with fields pre-populated. Steps 1 and 2 remain accessible via "Back" — user can change website/persona if they want. They are pre-filled, not locked.
5. Update campaign status to `writing` when the page loads with campaign param

### After article creation

When an article is saved (in the generate route or article save logic):
- If the article was created from a campaign (`campaign_id` is set), update the campaign's `article_id` field
- The campaign `status` remains `writing` — user manually changes to `approved` from the planner when they're happy with the article

## API Layer

### Planner CRUD — `/api/planner`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/planner` | List campaigns + articles for calendar |
| POST | `/api/planner` | Create manual idea |
| PATCH | `/api/planner/[id]` | Update campaign fields |
| DELETE | `/api/planner/[id]` | Delete campaign |
| POST | `/api/planner/generate` | AI idea generation |

All queries scoped to `organization_id` from the authenticated user's session.

---

**GET `/api/planner`**

Query params:
- `month` (YYYY-MM, defaults to current month) — filters scheduled campaigns and articles for this month
- `include_unscheduled` (boolean, default true) — whether to include unscheduled ideas (status = `idea`)

The endpoint always returns both scheduled campaigns for the month AND unscheduled ideas (if `include_unscheduled` is true). No separate `status` or `unscheduled` filter needed — the frontend gets everything it needs in one call.

Response:
```json
{
  "campaigns": [
    {
      "id": "uuid",
      "title": "...",
      "core_idea": "...",
      "format": "how-to",
      "status": "planned",
      "source": "ai",
      "scheduled_at": "2026-03-15",
      "website_id": "uuid",
      "website_name": "My Blog",
      "persona_id": "uuid",
      "persona_name": "Tech Writer",
      "primary_keyword": "...",
      "secondary_keywords": ["..."],
      "target_length": 1500,
      "notes": "...",
      "article_id": null,
      "created_at": "..."
    }
  ],
  "articles": [
    {
      "id": "uuid",
      "title": "...",
      "status": "published",
      "created_at": "2026-03-10",
      "website_name": "My Blog",
      "campaign_id": null
    }
  ]
}
```

- `campaigns`: All planner campaigns — unscheduled ideas (for the left panel) + scheduled items for the selected month (for the calendar). JOINs `websites(name)` and `personas(name)` for display names.
- `articles`: Articles created during the selected month (filtered by `created_at`), where `campaign_id IS NULL` (not already linked to a planner campaign). This avoids double-showing articles that came from the planner. Includes all article statuses.
- No pagination — planner is for solo/small team use. Unscheduled ideas panel is capped at 50 most recent.

---

**POST `/api/planner`** (create manual idea)

Request:
```json
{
  "title": "My Article Idea",
  "core_idea": "Optional description",
  "website_id": "uuid (optional)",
  "persona_id": "uuid (optional)",
  "format": "how-to (optional)",
  "primary_keyword": "optional",
  "secondary_keywords": ["optional"],
  "target_length": 1500,
  "notes": "optional",
  "scheduled_at": "2026-03-15 (optional, null = unscheduled)"
}
```

- `title` is required, all other fields optional
- Status set to `idea` if no `scheduled_at`, `planned` if `scheduled_at` is provided
- `source` set to `'manual'`

Response: the created campaign object (same shape as GET response items).

---

**PATCH `/api/planner/[id]`**

Request: any subset of campaign fields:
```json
{
  "title": "Updated title",
  "status": "approved",
  "scheduled_at": "2026-03-20",
  "website_id": "uuid",
  "persona_id": "uuid",
  "format": "roundup",
  "primary_keyword": "...",
  "secondary_keywords": ["..."],
  "target_length": 2000,
  "notes": "...",
  "core_idea": "..."
}
```

- Only provided fields are updated (partial update)
- Setting `scheduled_at` to a date automatically sets status to `planned` if current status is `idea`
- Setting `scheduled_at` to `null` reverts status to `idea` if current status is `planned`
- Status can be manually set to `approved` (from the detail modal after reviewing the article)
- Validates that the campaign belongs to the user's organization

Response: the updated campaign object.

---

**DELETE `/api/planner/[id]`**

- Deletes the campaign record
- Allowed in any status — no restrictions (the linked article, if any, is unaffected since it uses `ON DELETE SET NULL`)
- Validates that the campaign belongs to the user's organization

Response: `{ "success": true }`

## File Structure

```
app/
  api/
    planner/
      route.ts              # GET (list) + POST (create manual)
      [id]/
        route.ts            # PATCH (update) + DELETE
      generate/
        route.ts            # POST — AI idea generation
  dashboard/
    planner/
      page.tsx              # Server component — auth + data fetch
      planner-dashboard.tsx # Client component — orchestrates layout
components/
  planner/
    ideas-panel.tsx         # Left panel with idea cards
    idea-card.tsx           # Draggable idea card
    calendar-grid.tsx       # Monthly calendar with drop zones
    calendar-cell.tsx       # Single day cell
    idea-chip.tsx           # Chip displayed in calendar cell
    idea-detail-modal.tsx   # Slide-out edit modal
    generate-popover.tsx    # AI generation form popover
lib/
  planner/
    generate-ideas.ts       # AI prompt + model routing for idea generation
```

## Drag-and-Drop Implementation

Use the native HTML Drag and Drop API (no external library):

- `idea-card.tsx`: `draggable="true"`, `onDragStart` sets `dataTransfer` with campaign ID
- `calendar-cell.tsx`: `onDragOver` (preventDefault for drop zone), `onDrop` reads campaign ID, calls PATCH to update `scheduled_at` and status
- Visual feedback: drag ghost, drop zone highlight on hover

For drag between calendar cells, same pattern — chips in cells are also draggable.

## Styling

Follow existing project conventions:
- CSS custom properties: `var(--surface)`, `var(--border)`, `var(--foreground)`, `var(--text-muted)`, `var(--accent)`
- Dark mode support via `[data-theme="dark"]`
- Tailwind utility classes for layout
- Slide-out modal pattern matches existing modals in the app
- Status colors use the same palette as the rest of the dashboard

## Security

The `campaigns` table already has RLS policies scoped by `organization_id`. The new columns don't require additional policies — the existing row-level access controls apply. All API endpoints verify org membership before reading or writing.

## Out of Scope

- Auto-publish / scheduling engine (status `scheduled` exists but no automation behind it — future feature)
- News feed integration (the `news_feed_items` table exists but importing feeds is a separate feature)
- Bulk idea operations (select multiple, bulk delete, bulk schedule)
- Content calendar export (PDF/ICS)
- Recurring content templates (e.g., "weekly roundup every Friday")
