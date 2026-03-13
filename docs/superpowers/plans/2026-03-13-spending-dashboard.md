# Spending Dashboard Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a usage/spending dashboard that surfaces all cost data from the `usage_events` table — a home widget + dedicated `/dashboard/usage` page with charts, breakdowns, and budget controls.

**Architecture:** Server component fetches aggregated usage data via Supabase queries. Client components render Recharts visualizations. Budget settings saved via server action to `organizations` table. Single API route (`GET /api/usage`) provides all data in one response.

**Tech Stack:** Next.js 16, Supabase (server client), Recharts (new dependency), lucide-react, TypeScript, Tailwind + CSS custom properties.

**Spec:** `docs/superpowers/specs/2026-03-13-spending-dashboard-design.md`

---

## File Structure

```
New files:
  supabase/migrations/20260313_add_budget_columns.sql   — DB migration
  lib/usage-display.ts                                   — Display name maps, formatters
  app/api/usage/route.ts                                 — GET /api/usage endpoint
  app/actions/budget.ts                                  — Server action for budget save
  app/dashboard/usage/page.tsx                           — Usage page (server component)
  app/dashboard/usage/usage-dashboard.tsx                — Client wrapper (data fetching + assembly)
  components/usage/summary-cards.tsx                     — 4 summary cards (client)
  components/usage/month-selector.tsx                    — Prev/Next month picker (client)
  components/usage/daily-chart.tsx                       — Stacked bar chart (client)
  components/usage/model-breakdown.tsx                   — Donut + table (client)
  components/usage/event-type-breakdown.tsx              — Donut + table (client)
  components/usage/recent-activity.tsx                   — Events table (client)
  components/usage/budget-settings.tsx                   — Budget input + threshold (client)

Modified files:
  package.json                                           — Add recharts dependency
  app/dashboard/layout.tsx                               — Add Usage nav link
  app/dashboard/page.tsx                                 — Add spending widget card
```

---

## Chunk 1: Foundation (DB + Dependencies + Display Utils)

### Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/20260313_add_budget_columns.sql`

- [ ] **Step 1: Write migration file**

```sql
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS monthly_budget FLOAT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS budget_warning_threshold FLOAT DEFAULT 0.8;
```

- [ ] **Step 2: Apply migration**

Run: `npx supabase db push` (or apply via Supabase dashboard if using hosted)

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260313_add_budget_columns.sql
git commit -m "feat: add budget columns to organizations table"
```

---

### Task 2: Install Recharts

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install recharts**

```bash
npm install recharts
```

- [ ] **Step 2: Verify installation**

```bash
node -e "require('recharts'); console.log('recharts OK')"
```

Expected: `recharts OK`

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "feat: add recharts dependency for usage charts"
```

---

### Task 3: Display Name Utilities

**Files:**
- Create: `lib/usage-display.ts`

- [ ] **Step 1: Create the display utilities file**

```typescript
export const MODEL_DISPLAY_NAMES: Record<string, string> = {
  'claude-sonnet-4-20250514': 'Claude Sonnet 4',
  'claude-opus-4-20250514': 'Claude Opus 4',
  'claude-haiku-4-5-20251001': 'Claude Haiku 4.5',
  'gpt-4o': 'GPT-4o',
  'gpt-4o-mini': 'GPT-4o Mini',
  'gpt-4.1': 'GPT-4.1',
  'gemini-2.5-pro-preview-06-05': 'Gemini 2.5 Pro',
  'gemini-2.5-flash-preview-05-20': 'Gemini 2.5 Flash',
};

export const EVENT_TYPE_DISPLAY_NAMES: Record<string, string> = {
  'generation': 'Article Generation',
  'image_gen': 'Image Generation',
  'stock_search': 'Stock Image Search',
  'kw_research': 'Keyword Research',
  'seo_check': 'SEO Check',
  'mcp_publish': 'Publishing',
  'news_fetch': 'News Fetch',
  'voice_analysis': 'Voice Analysis',
};

export const EVENT_TYPE_COLORS: Record<string, string> = {
  'generation': '#6366f1',
  'image_gen': '#8b5cf6',
  'kw_research': '#3b82f6',
  'seo_check': '#10b981',
  'stock_search': '#6b7280',
  'mcp_publish': '#6b7280',
  'news_fetch': '#6b7280',
  'voice_analysis': '#6b7280',
};

export function getModelDisplayName(model: string): string {
  return MODEL_DISPLAY_NAMES[model] || model;
}

export function getEventTypeDisplayName(eventType: string): string {
  return EVENT_TYPE_DISPLAY_NAMES[eventType] || eventType;
}

export function getEventTypeColor(eventType: string): string {
  return EVENT_TYPE_COLORS[eventType] || '#6b7280';
}

export function formatCostDisplay(usd: number): string {
  if (usd < 0.01) return `$${usd.toFixed(4)}`;
  if (usd < 1) return `$${usd.toFixed(3)}`;
  return `$${usd.toFixed(2)}`;
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/usage-display.ts
git commit -m "feat: add usage display name maps and formatters"
```

---

## Chunk 2: API Route

### Task 4: Usage API Endpoint

**Files:**
- Create: `app/api/usage/route.ts`

This is the main data endpoint. It returns all usage data for a given month in a single response.

- [ ] **Step 1: Create the API route**

```typescript
import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getModelDisplayName, getEventTypeDisplayName } from '@/lib/usage-display';

export async function GET(request: NextRequest) {
  const supabase = await createClient();

  // Auth
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: membership } = await supabase
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', user.id)
    .limit(1)
    .single();

  if (!membership) {
    return Response.json({ error: 'No organization found' }, { status: 403 });
  }

  const orgId = membership.organization_id;

  // Parse month param (YYYY-MM)
  const searchParams = request.nextUrl.searchParams;
  const now = new Date();
  const monthParam = searchParams.get('month') || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const [yearStr, monthStr] = monthParam.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 0); // last day of month
  const daysInMonth = monthEnd.getDate();

  const monthStartISO = monthStart.toISOString();
  const monthEndISO = new Date(year, month, 0, 23, 59, 59, 999).toISOString();

  // Today boundaries
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).toISOString();

  // Fetch org for budget
  const { data: org } = await supabase
    .from('organizations')
    .select('monthly_budget, budget_warning_threshold')
    .eq('id', orgId)
    .single();

  // Fetch all usage events for the month
  const { data: events, error: eventsError } = await supabase
    .from('usage_events')
    .select('id, event_type, model_used, estimated_cost_usd, created_at, article_id, user_id')
    .eq('organization_id', orgId)
    .gte('created_at', monthStartISO)
    .lte('created_at', monthEndISO)
    .order('created_at', { ascending: false });

  if (eventsError) {
    return Response.json({ error: eventsError.message }, { status: 500 });
  }

  const allEvents = events || [];

  // Summary
  const totalCost = allEvents.reduce((sum, e) => sum + (e.estimated_cost_usd || 0), 0);
  const todayCost = allEvents
    .filter(e => e.created_at >= todayStart && e.created_at <= todayEnd)
    .reduce((sum, e) => sum + (e.estimated_cost_usd || 0), 0);
  const eventCount = allEvents.length;
  const monthlyBudget = org?.monthly_budget ?? null;
  const budgetWarningThreshold = org?.budget_warning_threshold ?? 0.8;
  const budgetUsedPercent = monthlyBudget ? (totalCost / monthlyBudget) * 100 : null;

  // Daily breakdown
  const dailyMap: Record<string, Record<string, number>> = {};
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${yearStr}-${monthStr}-${String(d).padStart(2, '0')}`;
    dailyMap[dateStr] = { generation: 0, image_gen: 0, kw_research: 0, seo_check: 0, other: 0, total: 0 };
  }
  for (const e of allEvents) {
    const dateStr = e.created_at.slice(0, 10); // YYYY-MM-DD
    if (!dailyMap[dateStr]) continue;
    const cost = e.estimated_cost_usd || 0;
    const bucket = ['generation', 'image_gen', 'kw_research', 'seo_check'].includes(e.event_type)
      ? e.event_type
      : 'other';
    dailyMap[dateStr][bucket] += cost;
    dailyMap[dateStr].total += cost;
  }
  const daily = Object.entries(dailyMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, costs]) => ({ date, ...costs }));

  // By model
  const modelMap: Record<string, number> = {};
  for (const e of allEvents) {
    const model = e.model_used || 'unknown';
    modelMap[model] = (modelMap[model] || 0) + (e.estimated_cost_usd || 0);
  }
  const byModel = Object.entries(modelMap)
    .map(([model, cost]) => ({
      model,
      displayName: getModelDisplayName(model),
      cost,
      percent: totalCost > 0 ? (cost / totalCost) * 100 : 0,
    }))
    .sort((a, b) => b.cost - a.cost);

  // By event type
  const typeMap: Record<string, { cost: number; count: number }> = {};
  for (const e of allEvents) {
    if (!typeMap[e.event_type]) typeMap[e.event_type] = { cost: 0, count: 0 };
    typeMap[e.event_type].cost += e.estimated_cost_usd || 0;
    typeMap[e.event_type].count += 1;
  }
  const byEventType = Object.entries(typeMap)
    .map(([eventType, { cost, count }]) => ({
      eventType,
      displayName: getEventTypeDisplayName(eventType),
      cost,
      count,
      percent: totalCost > 0 ? (cost / totalCost) * 100 : 0,
    }))
    .sort((a, b) => b.cost - a.cost);

  // Recent events (already sorted desc, take 20)
  // Fetch article titles and user names for the recent events
  const recentRaw = allEvents.slice(0, 20);
  const articleIds = [...new Set(recentRaw.filter(e => e.article_id).map(e => e.article_id))];
  const userIds = [...new Set(recentRaw.filter(e => e.user_id).map(e => e.user_id))];

  let articleTitles: Record<string, string> = {};
  if (articleIds.length > 0) {
    const { data: articles } = await supabase
      .from('articles')
      .select('id, title')
      .in('id', articleIds);
    if (articles) {
      articleTitles = Object.fromEntries(articles.map(a => [a.id, a.title]));
    }
  }

  let userNames: Record<string, string> = {};
  if (userIds.length > 0) {
    const { data: users } = await supabase
      .from('users')
      .select('id, name')
      .in('id', userIds);
    if (users) {
      userNames = Object.fromEntries(users.map(u => [u.id, u.name || 'Unknown']));
    }
  }

  const recentEvents = recentRaw.map(e => ({
    id: e.id,
    createdAt: e.created_at,
    eventType: e.event_type,
    modelUsed: e.model_used,
    estimatedCostUsd: e.estimated_cost_usd,
    articleId: e.article_id,
    articleTitle: e.article_id ? (articleTitles[e.article_id] || null) : null,
    userName: e.user_id ? (userNames[e.user_id] || 'Unknown') : null,
  }));

  // Earliest month (for month selector bounds)
  const { data: earliestEvent } = await supabase
    .from('usage_events')
    .select('created_at')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: true })
    .limit(1)
    .single();

  const earliestMonth = earliestEvent
    ? earliestEvent.created_at.slice(0, 7)
    : monthParam;

  return Response.json({
    summary: {
      totalCost,
      todayCost,
      eventCount,
      monthlyBudget,
      budgetWarningThreshold,
      budgetUsedPercent,
    },
    daily,
    byModel,
    byEventType,
    recentEvents,
    earliestMonth,
    currentMonth: monthParam,
  });
}
```

- [ ] **Step 2: Verify the route compiles**

```bash
npx next build --no-lint 2>&1 | head -20
```

Expected: No TypeScript errors related to the usage route.

- [ ] **Step 3: Commit**

```bash
git add app/api/usage/route.ts
git commit -m "feat: add GET /api/usage endpoint for spending data"
```

---

## Chunk 3: Budget Server Action + Sidebar Nav

### Task 5: Budget Save Action

**Files:**
- Create: `app/actions/budget.ts`

- [ ] **Step 1: Create the server action**

```typescript
'use server';

import { createClient } from '@/lib/supabase/server';
import { useUser } from '@/lib/hooks/use-user';
import { useOrganization } from '@/lib/hooks/use-organization';
import { revalidatePath } from 'next/cache';

export async function updateBudgetSettings(
  monthlyBudget: number | null,
  warningThreshold: number
): Promise<{ success: boolean; error?: string }> {
  const user = await useUser();
  const org = await useOrganization();

  if (!user || !org) return { success: false, error: 'Not authorized' };
  if (org.role !== 'admin') return { success: false, error: 'Only admins can change budget settings' };

  if (monthlyBudget !== null && (monthlyBudget < 0 || !isFinite(monthlyBudget))) {
    return { success: false, error: 'Budget must be a positive number' };
  }
  if (warningThreshold < 0.5 || warningThreshold > 0.95) {
    return { success: false, error: 'Warning threshold must be between 50% and 95%' };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('organizations')
    .update({
      monthly_budget: monthlyBudget,
      budget_warning_threshold: warningThreshold,
    })
    .eq('id', org.id);

  if (error) return { success: false, error: error.message };

  revalidatePath('/dashboard');
  revalidatePath('/dashboard/usage');
  return { success: true };
}
```

- [ ] **Step 2: Commit**

```bash
git add app/actions/budget.ts
git commit -m "feat: add server action for budget settings"
```

---

### Task 6: Add Usage Link to Sidebar

**Files:**
- Modify: `app/dashboard/layout.tsx`

- [ ] **Step 1: Add DollarSign import**

Add `DollarSign` to the existing lucide-react import line.

- [ ] **Step 2: Add nav link between Library and Settings**

```tsx
<Link href="/dashboard/usage" className="flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg hover:opacity-80 transition" style={{ color: 'var(--text-secondary)' }}>
    <DollarSign size={18} /> Usage
</Link>
```

- [ ] **Step 3: Commit**

```bash
git add app/dashboard/layout.tsx
git commit -m "feat: add Usage nav link to sidebar"
```

---

## Chunk 4: Home Dashboard Spending Widget

### Task 7: Spending Widget on Dashboard Home

**Files:**
- Modify: `app/dashboard/page.tsx`

- [ ] **Step 1: Add spending query to the existing `Promise.all`**

Add this query to the existing `Promise.all` array in `DashboardHome`:

```typescript
supabase
    .from('usage_events')
    .select('estimated_cost_usd')
    .eq('organization_id', org.id)
    .gte('created_at', monthStart),
```

And fetch org budget:
```typescript
supabase
    .from('organizations')
    .select('monthly_budget, budget_warning_threshold')
    .eq('id', org.id)
    .single(),
```

- [ ] **Step 2: Update destructuring and calculate spending total**

Update the destructuring from:
```typescript
const [sitesResult, personasResult, articlesThisMonthResult, recentArticlesResult] = await Promise.all([
```
to:
```typescript
const [sitesResult, personasResult, articlesThisMonthResult, recentArticlesResult, spendingResult, orgBudgetResult] = await Promise.all([
```

Then add after the existing variable declarations:

```typescript
const spendingEvents = spendingResult.data ?? [];
const totalSpend = spendingEvents.reduce((sum, e) => sum + (e.estimated_cost_usd || 0), 0);
const budget = orgBudgetResult.data?.monthly_budget ?? null;
const budgetThreshold = orgBudgetResult.data?.budget_warning_threshold ?? 0.8;
const budgetPercent = budget ? (totalSpend / budget) * 100 : null;
const isOverThreshold = budgetPercent !== null && budgetPercent >= budgetThreshold * 100;
```

- [ ] **Step 3: Change grid to responsive 4 columns + import formatCostDisplay**

Update the grid class from `md:grid-cols-3` to `md:grid-cols-2 lg:grid-cols-4` for the stats card row. Also add the import at the top: `import { formatCostDisplay } from '@/lib/usage-display';`

- [ ] **Step 4: Add spending card**

Add after the "Articles This Month" card:

```tsx
<Link href="/dashboard/usage" className="p-6 rounded-xl transition hover:shadow-sm" style={{
    background: isOverThreshold ? 'var(--warning-bg, #fef3c7)' : 'var(--surface)',
    border: `1px solid ${isOverThreshold ? 'var(--warning-border, #f59e0b)' : 'var(--border)'}`,
}}>
    <h3 className="text-sm font-medium mb-2" style={{ color: 'var(--text-muted)' }}>
        Spending This Month
        {isOverThreshold && <span className="ml-1">&#9888;</span>}
    </h3>
    <p className="text-3xl font-bold" style={{ color: 'var(--foreground)' }}>
        {formatCostDisplay(totalSpend)}
    </p>
    {budget !== null && (
        <>
            <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                / ${budget.toFixed(2)}
            </p>
            <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                <div
                    className="h-full rounded-full transition-all"
                    style={{
                        width: `${Math.min(budgetPercent!, 100)}%`,
                        background: budgetPercent! >= 100 ? '#ef4444' : isOverThreshold ? '#f59e0b' : '#10b981',
                    }}
                />
            </div>
        </>
    )}
    {budget === null && (
        <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>No budget set</p>
    )}
</Link>
```

- [ ] **Step 5: Also update the quick-action buttons grid below from 3 to 4 columns**

The second grid row (New Article, Add Site, Settings) should also be `md:grid-cols-4` or remain at 3 — keep at 3 since there are only 3 action buttons.

- [ ] **Step 6: Verify the page renders**

```bash
npx next build --no-lint 2>&1 | head -20
```

- [ ] **Step 7: Commit**

```bash
git add app/dashboard/page.tsx
git commit -m "feat: add spending widget to dashboard home"
```

---

## Chunk 5: Usage Page — Server Component + Summary + Month Selector

### Task 8: Summary Cards Component

**Files:**
- Create: `components/usage/summary-cards.tsx`

- [ ] **Step 1: Create summary cards client component**

```tsx
'use client';

import { formatCostDisplay } from '@/lib/usage-display';

type SummaryData = {
  totalCost: number;
  todayCost: number;
  eventCount: number;
  monthlyBudget: number | null;
  budgetWarningThreshold: number;
  budgetUsedPercent: number | null;
};

export function SummaryCards({ data }: { data: SummaryData }) {
  const isOverThreshold = data.budgetUsedPercent !== null
    && data.budgetUsedPercent >= data.budgetWarningThreshold * 100;
  const isOverBudget = data.budgetUsedPercent !== null && data.budgetUsedPercent >= 100;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
      <div className="p-5 rounded-xl" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>This Month</p>
        <p className="text-2xl font-bold" style={{ color: '#10b981' }}>{formatCostDisplay(data.totalCost)}</p>
      </div>
      <div className="p-5 rounded-xl" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Today</p>
        <p className="text-2xl font-bold" style={{ color: '#3b82f6' }}>{formatCostDisplay(data.todayCost)}</p>
      </div>
      <div className="p-5 rounded-xl" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Total Events</p>
        <p className="text-2xl font-bold" style={{ color: '#8b5cf6' }}>{data.eventCount}</p>
      </div>
      <div className="p-5 rounded-xl" style={{
        background: isOverThreshold ? 'var(--warning-bg, #fef3c7)' : 'var(--surface)',
        border: `1px solid ${isOverThreshold ? 'var(--warning-border, #f59e0b)' : 'var(--border)'}`,
      }}>
        <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Budget Used</p>
        {data.monthlyBudget !== null ? (
          <>
            <p className="text-2xl font-bold" style={{
              color: isOverBudget ? '#ef4444' : isOverThreshold ? '#f59e0b' : '#10b981',
            }}>
              {data.budgetUsedPercent!.toFixed(0)}%
            </p>
            <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
              <div className="h-full rounded-full transition-all" style={{
                width: `${Math.min(data.budgetUsedPercent!, 100)}%`,
                background: isOverBudget ? '#ef4444' : isOverThreshold ? '#f59e0b' : '#10b981',
              }} />
            </div>
          </>
        ) : (
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            No budget set — <a href="#budget-settings" className="underline">configure</a>
          </p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/usage/summary-cards.tsx
git commit -m "feat: add usage summary cards component"
```

---

### Task 9: Month Selector Component

**Files:**
- Create: `components/usage/month-selector.tsx`

- [ ] **Step 1: Create month selector client component**

```tsx
'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';

type Props = {
  currentMonth: string; // YYYY-MM
  earliestMonth: string; // YYYY-MM
  onChange: (month: string) => void;
};

function formatMonthLabel(yyyymm: string): string {
  const [y, m] = yyyymm.split('-').map(Number);
  const date = new Date(y, m - 1);
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function prevMonth(yyyymm: string): string {
  const [y, m] = yyyymm.split('-').map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function nextMonth(yyyymm: string): string {
  const [y, m] = yyyymm.split('-').map(Number);
  const d = new Date(y, m, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function MonthSelector({ currentMonth, earliestMonth, onChange }: Props) {
  const now = new Date();
  const currentMaxMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const canGoPrev = currentMonth > earliestMonth;
  const canGoNext = currentMonth < currentMaxMonth;

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={() => canGoPrev && onChange(prevMonth(currentMonth))}
        disabled={!canGoPrev}
        className="p-1.5 rounded-lg transition hover:opacity-80 disabled:opacity-30"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
      >
        <ChevronLeft size={18} />
      </button>
      <span className="text-sm font-semibold min-w-[160px] text-center" style={{ color: 'var(--foreground)' }}>
        {formatMonthLabel(currentMonth)}
      </span>
      <button
        onClick={() => canGoNext && onChange(nextMonth(currentMonth))}
        disabled={!canGoNext}
        className="p-1.5 rounded-lg transition hover:opacity-80 disabled:opacity-30"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
      >
        <ChevronRight size={18} />
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/usage/month-selector.tsx
git commit -m "feat: add month selector component"
```

---

## Chunk 6: Charts — Daily Spending + Breakdowns

### Task 10: Daily Spending Chart

**Files:**
- Create: `components/usage/daily-chart.tsx`

- [ ] **Step 1: Create daily stacked bar chart component**

```tsx
'use client';

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Legend,
} from 'recharts';
import { EVENT_TYPE_COLORS } from '@/lib/usage-display';

type DailyEntry = {
  date: string;
  generation: number;
  image_gen: number;
  kw_research: number;
  seo_check: number;
  other: number;
  total: number;
};

type Props = {
  data: DailyEntry[];
  budgetPaceLine: number | null; // monthly_budget / daysInMonth, or null
};

function formatDay(dateStr: string): string {
  return dateStr.split('-')[2].replace(/^0/, '');
}

function formatTooltipValue(value: number): string {
  return `$${value.toFixed(3)}`;
}

export function DailyChart({ data, budgetPaceLine }: Props) {
  return (
    <div className="p-5 rounded-xl" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--foreground)' }}>
        Daily Spending
      </h3>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="date" tickFormatter={formatDay} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
          <YAxis tickFormatter={(v: number) => `$${v.toFixed(2)}`} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} width={50} />
          <Tooltip
            formatter={formatTooltipValue}
            labelFormatter={(label: string) => {
              const d = new Date(label + 'T00:00:00');
              return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
            }}
            contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey="generation" name="Generation" stackId="a" fill={EVENT_TYPE_COLORS.generation} radius={[0, 0, 0, 0]} />
          <Bar dataKey="image_gen" name="Images" stackId="a" fill={EVENT_TYPE_COLORS.image_gen} />
          <Bar dataKey="kw_research" name="Keywords" stackId="a" fill={EVENT_TYPE_COLORS.kw_research} />
          <Bar dataKey="seo_check" name="SEO" stackId="a" fill={EVENT_TYPE_COLORS.seo_check} />
          <Bar dataKey="other" name="Other" stackId="a" fill={EVENT_TYPE_COLORS.stock_search} radius={[2, 2, 0, 0]} />
          {budgetPaceLine !== null && (
            <ReferenceLine
              y={budgetPaceLine}
              stroke="#f59e0b"
              strokeDasharray="6 3"
              label={{ value: 'Budget pace', position: 'right', fontSize: 10, fill: '#f59e0b' }}
            />
          )}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/usage/daily-chart.tsx
git commit -m "feat: add daily spending stacked bar chart"
```

---

### Task 11: Model Breakdown Component

**Files:**
- Create: `components/usage/model-breakdown.tsx`

- [ ] **Step 1: Create model breakdown with donut chart**

```tsx
'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { formatCostDisplay } from '@/lib/usage-display';

type ModelEntry = {
  model: string;
  displayName: string;
  cost: number;
  percent: number;
};

const COLORS = ['#6366f1', '#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#6b7280'];

export function ModelBreakdown({ data }: { data: ModelEntry[] }) {
  return (
    <div className="p-5 rounded-xl" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--foreground)' }}>By Model</h3>
      {data.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No usage data</p>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie data={data} dataKey="cost" nameKey="displayName" cx="50%" cy="50%" innerRadius={40} outerRadius={65}>
                {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(value: number) => formatCostDisplay(value)} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-2 mt-3">
            {data.map((entry, i) => (
              <div key={entry.model} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                  <span style={{ color: 'var(--foreground)' }}>{entry.displayName}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span style={{ color: 'var(--text-muted)' }}>{entry.percent.toFixed(0)}%</span>
                  <span className="font-medium" style={{ color: 'var(--foreground)' }}>{formatCostDisplay(entry.cost)}</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/usage/model-breakdown.tsx
git commit -m "feat: add model breakdown donut chart"
```

---

### Task 12: Event Type Breakdown Component

**Files:**
- Create: `components/usage/event-type-breakdown.tsx`

- [ ] **Step 1: Create event type breakdown with donut chart**

```tsx
'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { formatCostDisplay, getEventTypeColor } from '@/lib/usage-display';

type EventTypeEntry = {
  eventType: string;
  displayName: string;
  cost: number;
  count: number;
  percent: number;
};

export function EventTypeBreakdown({ data }: { data: EventTypeEntry[] }) {
  return (
    <div className="p-5 rounded-xl" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--foreground)' }}>By Event Type</h3>
      {data.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No usage data</p>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie data={data} dataKey="cost" nameKey="displayName" cx="50%" cy="50%" innerRadius={40} outerRadius={65}>
                {data.map((entry) => <Cell key={entry.eventType} fill={getEventTypeColor(entry.eventType)} />)}
              </Pie>
              <Tooltip formatter={(value: number) => formatCostDisplay(value)} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-2 mt-3">
            {data.map((entry) => (
              <div key={entry.eventType} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: getEventTypeColor(entry.eventType) }} />
                  <span style={{ color: 'var(--foreground)' }}>{entry.displayName}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span style={{ color: 'var(--text-muted)' }}>{entry.count} events</span>
                  <span className="font-medium" style={{ color: 'var(--foreground)' }}>{formatCostDisplay(entry.cost)}</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/usage/event-type-breakdown.tsx
git commit -m "feat: add event type breakdown donut chart"
```

---

## Chunk 7: Recent Activity + Budget Settings + Usage Page Assembly

### Task 13: Recent Activity Table

**Files:**
- Create: `components/usage/recent-activity.tsx`

- [ ] **Step 1: Create recent activity table component**

```tsx
'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { ArrowUpDown } from 'lucide-react';
import { formatCostDisplay, getEventTypeDisplayName, getModelDisplayName, getEventTypeColor } from '@/lib/usage-display';

type RecentEvent = {
  id: string;
  createdAt: string;
  eventType: string;
  modelUsed: string | null;
  estimatedCostUsd: number;
  articleId: string | null;
  articleTitle: string | null;
  userName: string | null;
};

type SortKey = 'createdAt' | 'eventType' | 'modelUsed' | 'estimatedCostUsd' | 'userName';
type SortDir = 'asc' | 'desc';

export function RecentActivity({ events }: { events: RecentEvent[] }) {
  const [sortKey, setSortKey] = useState<SortKey>('createdAt');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const sorted = useMemo(() => {
    return [...events].sort((a, b) => {
      const av = a[sortKey] ?? '';
      const bv = b[sortKey] ?? '';
      if (typeof av === 'number' && typeof bv === 'number') {
        return sortDir === 'asc' ? av - bv : bv - av;
      }
      return sortDir === 'asc'
        ? String(av).localeCompare(String(bv))
        : String(bv).localeCompare(String(av));
    });
  }, [events, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  }

  function SortHeader({ label, column, align }: { label: string; column: SortKey; align?: string }) {
    return (
      <th
        className={`${align === 'right' ? 'text-right' : 'text-left'} py-2 font-medium cursor-pointer select-none hover:opacity-70`}
        style={{ color: 'var(--text-muted)' }}
        onClick={() => toggleSort(column)}
      >
        <span className="inline-flex items-center gap-1">
          {label}
          <ArrowUpDown size={12} style={{ opacity: sortKey === column ? 1 : 0.3 }} />
        </span>
      </th>
    );
  }

  return (
    <div className="p-5 rounded-xl" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--foreground)' }}>Recent Activity</h3>
      {events.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No events this month</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <SortHeader label="Date" column="createdAt" />
                <SortHeader label="Type" column="eventType" />
                <SortHeader label="Model" column="modelUsed" />
                <th className="text-left py-2 font-medium" style={{ color: 'var(--text-muted)' }}>Article</th>
                <SortHeader label="User" column="userName" />
                <SortHeader label="Cost" column="estimatedCostUsd" align="right" />
              </tr>
            </thead>
            <tbody>
              {sorted.map((event) => (
                <tr key={event.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td className="py-2.5" style={{ color: 'var(--foreground)' }}>
                    {new Date(event.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    <span className="ml-1" style={{ color: 'var(--text-muted)' }}>
                      {new Date(event.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </td>
                  <td className="py-2.5">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium text-white" style={{ background: getEventTypeColor(event.eventType) }}>
                      {getEventTypeDisplayName(event.eventType)}
                    </span>
                  </td>
                  <td className="py-2.5" style={{ color: 'var(--foreground)' }}>
                    {event.modelUsed ? getModelDisplayName(event.modelUsed) : '—'}
                  </td>
                  <td className="py-2.5">
                    {event.articleId && event.articleTitle ? (
                      <Link href={`/dashboard/articles/${event.articleId}`} className="underline" style={{ color: 'var(--accent)' }}>
                        {event.articleTitle.length > 30 ? event.articleTitle.slice(0, 30) + '...' : event.articleTitle}
                      </Link>
                    ) : (
                      <span style={{ color: 'var(--text-muted)' }}>—</span>
                    )}
                  </td>
                  <td className="py-2.5" style={{ color: 'var(--foreground)' }}>{event.userName || '—'}</td>
                  <td className="py-2.5 text-right font-medium" style={{ color: 'var(--foreground)' }}>
                    {formatCostDisplay(event.estimatedCostUsd)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/usage/recent-activity.tsx
git commit -m "feat: add recent activity table component"
```

---

### Task 14: Budget Settings Component

**Files:**
- Create: `components/usage/budget-settings.tsx`

- [ ] **Step 1: Create budget settings client component**

```tsx
'use client';

import { useState } from 'react';
import { updateBudgetSettings } from '@/app/actions/budget';
import { Settings } from 'lucide-react';

type Props = {
  currentBudget: number | null;
  currentThreshold: number;
};

export function BudgetSettings({ currentBudget, currentThreshold }: Props) {
  const [budget, setBudget] = useState<string>(currentBudget?.toString() || '');
  const [threshold, setThreshold] = useState(Math.round(currentThreshold * 100));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  async function handleSave() {
    setSaving(true);
    setMessage(null);

    const budgetValue = budget.trim() === '' ? null : parseFloat(budget);
    if (budgetValue !== null && (isNaN(budgetValue) || budgetValue < 0)) {
      setMessage({ type: 'error', text: 'Budget must be a positive number' });
      setSaving(false);
      return;
    }

    const result = await updateBudgetSettings(budgetValue, threshold / 100);
    if (result.success) {
      setMessage({ type: 'success', text: 'Budget settings saved' });
    } else {
      setMessage({ type: 'error', text: result.error || 'Failed to save' });
    }
    setSaving(false);
  }

  return (
    <div id="budget-settings" className="p-5 rounded-xl" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <div className="flex items-center gap-2 mb-4">
        <Settings size={18} style={{ color: 'var(--accent)' }} />
        <h3 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Budget Settings</h3>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
            Monthly Budget (USD)
          </label>
          <input
            type="number"
            min="0"
            step="1"
            value={budget}
            onChange={(e) => setBudget(e.target.value)}
            placeholder="No limit"
            className="w-full px-3 py-2 rounded-lg text-sm outline-none"
            style={{ background: 'var(--background)', border: '1px solid var(--border)', color: 'var(--foreground)' }}
          />
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Leave empty for no budget limit</p>
        </div>
        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
            Warning Threshold: {threshold}%
          </label>
          <input
            type="range"
            min="50"
            max="95"
            step="5"
            value={threshold}
            onChange={(e) => setThreshold(parseInt(e.target.value, 10))}
            className="w-full"
          />
          <div className="flex justify-between text-xs" style={{ color: 'var(--text-muted)' }}>
            <span>50%</span>
            <span>95%</span>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3 mt-4">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 rounded-lg text-sm font-medium transition hover:opacity-90 disabled:opacity-50"
          style={{ background: 'var(--accent)', color: 'var(--accent-text)' }}
        >
          {saving ? 'Saving...' : 'Save Budget Settings'}
        </button>
        {message && (
          <span className="text-sm" style={{ color: message.type === 'success' ? '#10b981' : '#ef4444' }}>
            {message.text}
          </span>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/usage/budget-settings.tsx
git commit -m "feat: add budget settings component"
```

---

### Task 15: Usage Page Assembly

**Files:**
- Create: `app/dashboard/usage/page.tsx`

- [ ] **Step 1: Create the usage page (server + client wrapper)**

```tsx
import { useUser } from '@/lib/hooks/use-user';
import { useOrganization } from '@/lib/hooks/use-organization';
import { redirect } from 'next/navigation';
import { UsageDashboard } from './usage-dashboard';

export default async function UsagePage() {
  const user = await useUser();
  const org = await useOrganization();

  if (!user || !org) {
    redirect('/login');
  }

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>Usage & Spending</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Track your AI generation costs and set budget limits.</p>
      </div>
      <UsageDashboard />
    </div>
  );
}
```

- [ ] **Step 2: Create the client wrapper that fetches and renders all sections**

Create `app/dashboard/usage/usage-dashboard.tsx`:

```tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { SummaryCards } from '@/components/usage/summary-cards';
import { MonthSelector } from '@/components/usage/month-selector';
import { DailyChart } from '@/components/usage/daily-chart';
import { ModelBreakdown } from '@/components/usage/model-breakdown';
import { EventTypeBreakdown } from '@/components/usage/event-type-breakdown';
import { RecentActivity } from '@/components/usage/recent-activity';
import { BudgetSettings } from '@/components/usage/budget-settings';
import { Loader2 } from 'lucide-react';

type UsageData = {
  summary: {
    totalCost: number;
    todayCost: number;
    eventCount: number;
    monthlyBudget: number | null;
    budgetWarningThreshold: number;
    budgetUsedPercent: number | null;
  };
  daily: Array<{
    date: string;
    generation: number;
    image_gen: number;
    kw_research: number;
    seo_check: number;
    other: number;
    total: number;
  }>;
  byModel: Array<{ model: string; displayName: string; cost: number; percent: number }>;
  byEventType: Array<{ eventType: string; displayName: string; cost: number; count: number; percent: number }>;
  recentEvents: Array<{
    id: string;
    createdAt: string;
    eventType: string;
    modelUsed: string | null;
    estimatedCostUsd: number;
    articleId: string | null;
    articleTitle: string | null;
    userName: string | null;
  }>;
  earliestMonth: string;
  currentMonth: string;
};

export function UsageDashboard() {
  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const [month, setMonth] = useState(defaultMonth);
  const [data, setData] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async (m: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/usage?month=${m}`);
      if (!res.ok) throw new Error('Failed to load usage data');
      const json = await res.json();
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(month);
  }, [month, fetchData]);

  function handleMonthChange(newMonth: string) {
    setMonth(newMonth);
  }

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={24} className="animate-spin" style={{ color: 'var(--text-muted)' }} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-5 rounded-xl" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <p className="text-sm" style={{ color: '#ef4444' }}>Error: {error}</p>
      </div>
    );
  }

  if (!data) return null;

  const budgetPaceLine = data.summary.monthlyBudget
    ? data.summary.monthlyBudget / data.daily.length
    : null;

  const isOverThreshold = data.summary.budgetUsedPercent !== null
    && data.summary.budgetUsedPercent >= data.summary.budgetWarningThreshold * 100;

  return (
    <div className="space-y-6">
      {/* Budget warning banner */}
      {isOverThreshold && data.summary.monthlyBudget && (
        <div className="p-3 rounded-lg text-sm font-medium" style={{ background: '#fef3c7', color: '#92400e', border: '1px solid #f59e0b' }}>
          &#9888; You&apos;ve used {data.summary.budgetUsedPercent!.toFixed(0)}% of your ${data.summary.monthlyBudget.toFixed(2)} monthly budget
        </div>
      )}

      <div className="flex items-center justify-between">
        <MonthSelector
          currentMonth={data.currentMonth}
          earliestMonth={data.earliestMonth}
          onChange={handleMonthChange}
        />
        {loading && <Loader2 size={16} className="animate-spin" style={{ color: 'var(--text-muted)' }} />}
      </div>

      <SummaryCards data={data.summary} />

      <DailyChart data={data.daily} budgetPaceLine={budgetPaceLine} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ModelBreakdown data={data.byModel} />
        <EventTypeBreakdown data={data.byEventType} />
      </div>

      <RecentActivity events={data.recentEvents} />

      <BudgetSettings
        currentBudget={data.summary.monthlyBudget}
        currentThreshold={data.summary.budgetWarningThreshold}
      />
    </div>
  );
}
```

- [ ] **Step 3: Verify the build compiles**

```bash
npx next build --no-lint 2>&1 | tail -10
```

Expected: Build succeeds with no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add app/dashboard/usage/page.tsx app/dashboard/usage/usage-dashboard.tsx
git commit -m "feat: assemble usage dashboard page with all components"
```

---

## Chunk 8: Final Verification

### Task 16: End-to-End Verification

- [ ] **Step 1: Start dev server and verify all pages load**

```bash
npm run dev -- --port 3001
```

Visit:
- `http://localhost:3001/dashboard` — verify 4th spending card appears
- `http://localhost:3001/dashboard/usage` — verify full usage page renders
- Check sidebar has "Usage" nav link

- [ ] **Step 2: Verify budget save works**

On the usage page, enter a budget amount and threshold, click save, verify toast shows success.

- [ ] **Step 3: Final commit with all files**

```bash
git add -A
git status
git commit -m "feat: complete spending dashboard with charts, breakdowns, and budget controls"
```
