# Spending Dashboard — Design Spec

## Overview

Add a usage/spending dashboard to WritingChamps that surfaces all cost data already tracked in the `usage_events` table. Two touch points: a summary widget on the dashboard home and a dedicated `/dashboard/usage` page with charts, breakdowns, and budget controls.

## Data Source

The `usage_events` table already captures every billable action:

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| organization_id | UUID | FK → organizations |
| article_id | UUID | FK → articles (nullable) |
| user_id | UUID | FK → users (nullable) |
| event_type | VARCHAR(100) | generation, image_gen, stock_search, kw_research, seo_check, mcp_publish, news_fetch, voice_analysis |
| model_used | VARCHAR(50) | e.g., claude-sonnet-4-20250514 |
| estimated_cost_usd | FLOAT | Cost in USD |
| created_at | TIMESTAMPTZ | Event timestamp |

No new tracking code needed — the dashboard reads what's already there.

## Chart Library

**Recharts** — React-native, lightweight, widely used in Next.js projects. No heavier alternatives needed.

## Component 1: Dashboard Home Widget

Add a 4th card to the existing 3-card grid on `/dashboard/page.tsx`.

- **Label**: "Spending This Month"
- **Primary value**: Total cost from `usage_events` for current month (e.g., `$12.48`)
- **Secondary text**: `/ $20.00` (monthly budget) or "No budget set"
- **Progress bar**: Underneath the value, shows budget usage percentage
  - Green: < 80% of budget
  - Amber: 80-99% of budget (with warning icon)
  - Red: >= 100% of budget
  - Hidden if no budget set
- **Link**: Entire card clicks through to `/dashboard/usage`

**Data query**: Single aggregate — `SUM(estimated_cost_usd)` from `usage_events` WHERE `organization_id` = current org AND `created_at` >= first of current month.

## Component 2: Sidebar Navigation

Add "Usage" nav link to `/dashboard/layout.tsx` sidebar, between "Library" and "Settings". Icon: `DollarSign` from lucide-react.

## Component 3: Usage Page (`/dashboard/usage`)

Single scrollable page. Server component for initial data load. Sections top to bottom:

### 3a. Summary Cards (4-card grid)

| Card | Value | Color |
|------|-------|-------|
| This Month | SUM cost for selected month | Green |
| Today | SUM cost for today | Blue |
| Total Events | COUNT for selected month | Purple |
| Budget Used | (cost / monthly_budget) * 100, with progress bar | Amber/Green |

The "Budget Used" card shows "No budget set" with a "Set budget" link if no budget is configured.

### 3b. Month Selector

- Prev/Next arrow buttons with month label ("March 2026")
- Defaults to current month
- Changing month reloads all data on the page for that month
- Client component that updates query params

### 3c. Daily Spending Bar Chart

- **Type**: Stacked bar chart (Recharts `<BarChart>` with `<Bar stackId>`)
- **X-axis**: Days of the month (1–31)
- **Y-axis**: Cost in USD
- **Stacked segments by event type**:
  - generation: indigo (#6366f1)
  - image_gen: purple (#8b5cf6)
  - kw_research: blue (#3b82f6)
  - seo_check: emerald (#10b981)
  - other (stock_search, mcp_publish, news_fetch, voice_analysis): gray (#6b7280)
- **Budget pace line**: Horizontal dashed line at `monthly_budget / days_in_month` (only shown if budget is set)
- **Tooltip on hover**: Shows day total + per-type breakdown
- **Responsive**: Full width of content area

### 3d. Breakdown Cards (2-column grid)

**Left: By Model**
- Table: Model name | Cost | Percentage
- Small donut chart (Recharts `<PieChart>`) above the table
- Sorted by cost descending
- Model names cleaned up for display (e.g., "claude-sonnet-4-20250514" → "Claude Sonnet 4")

**Right: By Event Type**
- Table: Event type | Cost | Count
- Small donut chart above the table
- Sorted by cost descending
- Event types cleaned up for display (e.g., "kw_research" → "Keyword Research")

### 3e. Recent Activity Table

- Last 20 usage events for the selected month
- Columns: Date/Time | Event Type | Model | Article (linked to editor) | User | Cost
- Sortable by any column (client-side sort)
- Event type shown as colored badge
- Cost right-aligned, formatted to appropriate decimal places via existing `formatCost()`

### 3f. Budget Settings Section

- **Monthly Budget**: Number input field (USD), with save button
- **Warning Threshold**: Slider, 50%–95%, default 80%, with save button
- Saved to `organizations` table
- Visual confirmation on save (toast)

## Database Changes

Add two columns to the `organizations` table:

```sql
ALTER TABLE organizations
  ADD COLUMN monthly_budget FLOAT DEFAULT NULL,
  ADD COLUMN budget_warning_threshold FLOAT DEFAULT 0.8;
```

- `monthly_budget`: NULL means no budget set. Any positive number is the limit in USD.
- `budget_warning_threshold`: Fraction (0.5–0.95) at which the warning appears. Default 0.8 (80%).

New Supabase migration file: `20260313_add_budget_columns.sql`

## API Layer

### GET `/api/usage`

Query params:
- `month` (string, YYYY-MM format, defaults to current month)

Response:
```json
{
  "summary": {
    "totalCost": 12.48,
    "todayCost": 0.82,
    "eventCount": 47,
    "monthlyBudget": 20.00,
    "budgetWarningThreshold": 0.8,
    "budgetUsedPercent": 62.4
  },
  "daily": [
    { "date": "2026-03-01", "generation": 0.45, "image_gen": 0.12, "kw_research": 0.08, "seo_check": 0.0, "other": 0.0, "total": 0.65 },
    ...
  ],
  "byModel": [
    { "model": "claude-sonnet-4-20250514", "displayName": "Claude Sonnet 4", "cost": 8.20, "percent": 65.7 },
    ...
  ],
  "byEventType": [
    { "eventType": "generation", "displayName": "Article Generation", "cost": 10.40, "count": 32, "percent": 83.3 },
    ...
  ],
  "recentEvents": [
    {
      "id": "uuid",
      "createdAt": "2026-03-13T10:30:00Z",
      "eventType": "generation",
      "modelUsed": "claude-sonnet-4-20250514",
      "estimatedCostUsd": 0.045,
      "articleId": "uuid-or-null",
      "articleTitle": "How to Optimize...",
      "userName": "Alida"
    },
    ...
  ]
}
```

All queries scoped to `organization_id` from the authenticated user's session.

### PATCH `/api/organization` (existing pattern)

Add support for `monthly_budget` and `budget_warning_threshold` fields in the existing organization update endpoint.

## Budget Warning Behavior

- **Home widget**: Card turns amber background with warning icon when threshold is exceeded
- **Usage page**: Alert banner at top: "You've used 82% of your $20.00 monthly budget"
- **No hard block**: Warnings only, generation is never prevented
- **No budget set**: No warnings shown, "Budget Used" card shows "No budget set" with link to settings section

## Implementation Notes

- **Unknown models**: If a model string isn't in the display name map, fall back to the raw `model_used` value.
- **Month selector bounds**: Stop at the earliest month that has any `usage_events` record. Don't allow navigating into empty months.
- **Daily array shape**: The API returns an entry for every day in the month (1–28/29/30/31), with zeroes for days with no events. This ensures consistent x-axis rendering in Recharts.
- **Recent events cap**: Limited to 20 events, no pagination. Acceptable for solo/small team usage.
- **Budget authorization**: Uses existing org-level auth — whoever can PATCH the organization can set the budget.

## Model Display Name Mapping

```typescript
const MODEL_DISPLAY_NAMES: Record<string, string> = {
  'claude-sonnet-4-20250514': 'Claude Sonnet 4',
  'claude-opus-4-20250514': 'Claude Opus 4',
  'claude-haiku-4-5-20251001': 'Claude Haiku 4.5',
  'gpt-4o': 'GPT-4o',
  'gpt-4o-mini': 'GPT-4o Mini',
  'gpt-4.1': 'GPT-4.1',
  'gemini-2.5-pro-preview-06-05': 'Gemini 2.5 Pro',
  'gemini-2.5-flash-preview-05-20': 'Gemini 2.5 Flash',
};
```

## Event Type Display Name Mapping

```typescript
const EVENT_TYPE_DISPLAY_NAMES: Record<string, string> = {
  'generation': 'Article Generation',
  'image_gen': 'Image Generation',
  'stock_search': 'Stock Image Search',
  'kw_research': 'Keyword Research',
  'seo_check': 'SEO Check',
  'mcp_publish': 'Publishing',
  'news_fetch': 'News Fetch',
  'voice_analysis': 'Voice Analysis',
};
```

## File Structure

```
app/
  api/
    usage/
      route.ts              # GET /api/usage endpoint
  dashboard/
    usage/
      page.tsx              # Server component — data fetching
components/
  usage/
    spending-widget.tsx     # Home dashboard card
    summary-cards.tsx       # 4 summary cards
    month-selector.tsx      # Prev/Next month picker
    daily-chart.tsx         # Stacked bar chart (Recharts)
    model-breakdown.tsx     # Donut + table
    event-type-breakdown.tsx # Donut + table
    recent-activity.tsx     # Events table
    budget-settings.tsx     # Budget input + threshold slider
lib/
  usage-display.ts          # Display name maps, formatting helpers
```

## Styling

Follow existing project conventions:
- CSS custom properties: `var(--surface)`, `var(--border)`, `var(--foreground)`, `var(--text-muted)`, `var(--accent)`
- Dark mode support via `[data-theme="dark"]`
- Tailwind utility classes for layout
- Inline `style={{ }}` for CSS variable references (existing pattern in dashboard pages)
- Responsive: 4-col grid → 2-col on tablet → 1-col on mobile

## Out of Scope

- Per-user budget limits (solo/small team — not needed now)
- Email/notification alerts (visual warnings only)
- Stripe billing integration
- Historical month-over-month comparison charts
- CSV export of usage data
