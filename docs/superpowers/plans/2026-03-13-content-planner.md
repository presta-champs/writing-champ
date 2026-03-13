# Content Planner Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Content Planner page with AI idea generation, monthly calendar with drag-and-drop, and article creation pre-fill.

**Architecture:** Extends the existing `campaigns` table with planner-specific columns. Split-panel layout: ideas panel (left) + calendar grid (right). AI generation uses the same sync model routing pattern as keyword-picker. Article page reads a `campaign` query param to pre-fill the wizard.

**Tech Stack:** Next.js 16 (Turbopack), TypeScript, Supabase, Tailwind, HTML Drag and Drop API, GPT-4o Mini (via existing OpenAI sync generation)

**Spec:** `docs/superpowers/specs/2026-03-13-content-planner-design.md`

---

## Chunk 1: Database, Usage Tracking, and AI Generation

### Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/20260313_add_planner_columns.sql`

- [ ] **Step 1: Create migration file**

```sql
-- Add planner-specific columns to campaigns table
ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS format VARCHAR(100),
  ADD COLUMN IF NOT EXISTS primary_keyword VARCHAR(255),
  ADD COLUMN IF NOT EXISTS secondary_keywords JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS source VARCHAR(50) DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS scheduled_at DATE,
  ADD COLUMN IF NOT EXISTS target_length INTEGER DEFAULT 1500,
  ADD COLUMN IF NOT EXISTS article_id UUID REFERENCES articles(id) ON DELETE SET NULL;

-- Index for calendar queries (scheduled items by month)
CREATE INDEX IF NOT EXISTS idx_campaigns_scheduled ON campaigns(organization_id, scheduled_at)
  WHERE scheduled_at IS NOT NULL;

-- Index for unscheduled ideas
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(organization_id, status)
  WHERE status IN ('idea', 'planned', 'writing', 'approved', 'scheduled', 'done');
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/20260313_add_planner_columns.sql
git commit -m "feat(planner): add planner columns to campaigns table"
```

---

### Task 2: Update Usage Tracking

**Files:**
- Modify: `lib/usage.ts`
- Modify: `lib/usage-display.ts`

- [ ] **Step 1: Add `idea_generation` to UsageEventType**

In `lib/usage.ts`, add `'idea_generation'` to the `UsageEventType` union:

```typescript
type UsageEventType =
  | 'generation'
  | 'image_gen'
  | 'stock_search'
  | 'kw_research'
  | 'seo_check'
  | 'mcp_publish'
  | 'news_fetch'
  | 'voice_analysis'
  | 'idea_generation';
```

- [ ] **Step 2: Add display name and color for `idea_generation`**

In `lib/usage-display.ts`, add to `EVENT_TYPE_DISPLAY_NAMES`:

```typescript
'idea_generation': 'Idea Generation',
```

Add to `EVENT_TYPE_COLORS`:

```typescript
'idea_generation': '#f59e0b',
```

- [ ] **Step 3: Update daily chart bucket in usage API**

In `app/api/usage/route.ts`, the daily breakdown buckets events into `generation`, `image_gen`, `kw_research`, `seo_check`, and `other`. The new `idea_generation` event type will automatically fall into `other`, which is correct — no change needed.

- [ ] **Step 4: Commit**

```bash
git add lib/usage.ts lib/usage-display.ts
git commit -m "feat(planner): add idea_generation usage event type"
```

---

### Task 3: AI Idea Generation Logic

**Files:**
- Create: `lib/planner/generate-ideas.ts`

This file mirrors the pattern from `lib/seo/keyword-picker.ts` — sync model routing with OpenAI-first fallback.

- [ ] **Step 1: Create the generation module**

```typescript
import { generateWithClaudeSync } from '@/lib/generation/claude';
import { generateWithOpenAISync } from '@/lib/generation/openai';
import { getProvider, type Provider } from '@/lib/generation/model-router';
import type { GenerationResult } from '@/lib/generation/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type GeneratedIdea = {
  title: string;
  core_idea: string;
  format: string;
  primary_keyword: string;
  secondary_keywords: string[];
};

export type IdeaGenerationResult = {
  ideas: GeneratedIdea[];
  generation: GenerationResult;
};

// ---------------------------------------------------------------------------
// Sync model router (same pattern as keyword-picker.ts)
// ---------------------------------------------------------------------------

const FALLBACK_ORDER: Provider[] = ['openai', 'anthropic'];
const FALLBACK_MODELS: Record<Provider, string> = {
  openai: 'gpt-4o-mini',
  anthropic: 'claude-sonnet-4-20250514',
  gemini: 'gemini-pro',
};

async function generateSync(params: {
  systemPrompt: string;
  userPrompt: string;
  providerKeys: Partial<Record<Provider, string>>;
  maxTokens?: number;
}): Promise<GenerationResult> {
  const keys = params.providerKeys;
  const requestedModel = 'gpt-4o-mini';
  const requestedProvider = getProvider(requestedModel);

  let model = requestedModel;
  let apiKey = keys[requestedProvider];

  if (!apiKey) {
    for (const fallback of FALLBACK_ORDER) {
      if (fallback !== requestedProvider && keys[fallback]) {
        apiKey = keys[fallback];
        model = FALLBACK_MODELS[fallback];
        break;
      }
    }
  }

  if (!apiKey) {
    throw new Error('No AI provider API key configured. Add one in Settings.');
  }

  const provider = getProvider(model);
  const genParams = {
    systemPrompt: params.systemPrompt,
    userPrompt: params.userPrompt,
    model,
    apiKey,
    maxTokens: params.maxTokens || 2048,
  };

  switch (provider) {
    case 'openai':
      return generateWithOpenAISync(genParams);
    case 'anthropic':
    default:
      return generateWithClaudeSync(genParams);
  }
}

// ---------------------------------------------------------------------------
// Prompt
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are a content strategist who generates article ideas for websites. You respond ONLY with a JSON array — no markdown fences, no explanation before or after.

Each idea must follow this exact schema:
{
  "title": "Article title that would work as an H1",
  "core_idea": "1-2 sentence description of the article angle",
  "format": "how-to" | "roundup" | "listicle" | "explainer" | "opinion" | "tutorial" | "case-study",
  "primary_keyword": "main target keyword",
  "secondary_keywords": ["keyword1", "keyword2", "keyword3"]
}

Focus on topics with search potential. Vary the formats. Make titles specific and compelling, not generic.`;

// ---------------------------------------------------------------------------
// Generate
// ---------------------------------------------------------------------------

export async function generateIdeas(params: {
  websiteName: string;
  websiteUrl: string;
  websiteDescription?: string;
  existingTitles: string[];
  seedTopic?: string;
  count: number;
  providerKeys: Partial<Record<Provider, string>>;
}): Promise<IdeaGenerationResult> {
  const { websiteName, websiteUrl, websiteDescription, existingTitles, seedTopic, count, providerKeys } = params;

  let userPrompt = `Website: ${websiteName} (${websiteUrl})`;
  if (websiteDescription) {
    userPrompt += `\nDescription: ${websiteDescription}`;
  }

  if (existingTitles.length > 0) {
    userPrompt += `\n\nExisting articles (avoid duplicates):\n${existingTitles.map(t => `- ${t}`).join('\n')}`;
  }

  if (seedTopic) {
    userPrompt += `\n\nGenerate ${count} article ideas related to: ${seedTopic}`;
  } else {
    userPrompt += `\n\nGenerate ${count} fresh article ideas that would perform well for this website's audience.`;
  }

  userPrompt += `\n\nReturn a JSON array of exactly ${count} ideas.`;

  const generation = await generateSync({
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
    providerKeys,
    maxTokens: 2048,
  });

  // Parse the JSON response
  const text = generation.text.trim();
  let ideas: GeneratedIdea[];

  try {
    // Handle possible markdown fences
    const jsonStr = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    const parsed = JSON.parse(jsonStr);
    ideas = Array.isArray(parsed) ? parsed : [];
  } catch {
    // Retry with stricter prompt on parse failure
    try {
      const retry = await generateSync({
        systemPrompt: SYSTEM_PROMPT + '\n\nCRITICAL: Return ONLY valid JSON. No text before or after the array.',
        userPrompt,
        providerKeys,
        maxTokens: 2048,
      });
      const retryText = retry.text.trim().replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
      ideas = JSON.parse(retryText);
      // Use retry generation result for cost tracking
      return { ideas, generation: retry };
    } catch {
      throw new Error('Failed to generate ideas — AI returned invalid JSON');
    }
  }

  // Validate and clean each idea
  ideas = ideas
    .filter(idea => idea.title && typeof idea.title === 'string')
    .map(idea => ({
      title: idea.title,
      core_idea: idea.core_idea || '',
      format: ['how-to', 'roundup', 'listicle', 'explainer', 'opinion', 'tutorial', 'case-study'].includes(idea.format)
        ? idea.format
        : 'how-to',
      primary_keyword: idea.primary_keyword || '',
      secondary_keywords: Array.isArray(idea.secondary_keywords) ? idea.secondary_keywords : [],
    }));

  return { ideas, generation };
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/planner/generate-ideas.ts
git commit -m "feat(planner): add AI idea generation module"
```

---

### Task 4: Planner API — GET and POST

**Files:**
- Create: `app/api/planner/route.ts`

- [ ] **Step 1: Create the GET + POST endpoint**

```typescript
import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const supabase = await createClient();

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
  const searchParams = request.nextUrl.searchParams;

  // Parse month param
  const now = new Date();
  const monthParam = searchParams.get('month') || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const [yearStr, monthStr] = monthParam.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const monthStart = new Date(year, month - 1, 1).toISOString().slice(0, 10);
  const monthEnd = new Date(year, month, 0).toISOString().slice(0, 10);

  const includeUnscheduled = searchParams.get('include_unscheduled') !== 'false';

  const plannerStatuses = ['idea', 'planned', 'writing', 'approved', 'scheduled', 'done'];

  // Fetch scheduled campaigns for the month
  let campaignsQuery = supabase
    .from('campaigns')
    .select('*, websites(name), personas(name)')
    .eq('organization_id', orgId)
    .in('status', plannerStatuses);

  if (includeUnscheduled) {
    // Get both: scheduled in this month OR unscheduled ideas
    campaignsQuery = campaignsQuery.or(
      `scheduled_at.gte.${monthStart},scheduled_at.lte.${monthEnd},and(status.eq.idea,scheduled_at.is.null)`
    );
  } else {
    campaignsQuery = campaignsQuery
      .gte('scheduled_at', monthStart)
      .lte('scheduled_at', monthEnd);
  }

  const { data: campaigns, error: campaignsError } = await campaignsQuery
    .order('created_at', { ascending: false })
    .limit(200);

  if (campaignsError) {
    return Response.json({ error: campaignsError.message }, { status: 500 });
  }

  // Fetch non-planner articles for the month (for calendar display)
  const { data: articles } = await supabase
    .from('articles')
    .select('id, title, status, created_at, campaign_id, websites(name)')
    .eq('organization_id', orgId)
    .is('campaign_id', null)
    .gte('created_at', `${monthStart}T00:00:00`)
    .lte('created_at', `${monthEnd}T23:59:59`)
    .order('created_at', { ascending: false });

  // Transform campaigns for response
  const campaignList = (campaigns || []).map((c: any) => ({
    id: c.id,
    title: c.title,
    core_idea: c.core_idea,
    format: c.format,
    status: c.status,
    source: c.source,
    scheduled_at: c.scheduled_at,
    website_id: c.website_id,
    website_name: c.websites?.name || null,
    persona_id: c.persona_id,
    persona_name: c.personas?.name || null,
    primary_keyword: c.primary_keyword,
    secondary_keywords: c.secondary_keywords,
    target_length: c.target_length,
    notes: c.notes,
    article_id: c.article_id,
    created_at: c.created_at,
  }));

  const articleList = (articles || []).map((a: any) => ({
    id: a.id,
    title: a.title,
    status: a.status,
    created_at: a.created_at,
    website_name: a.websites?.name || null,
    campaign_id: a.campaign_id,
  }));

  return Response.json({ campaigns: campaignList, articles: articleList });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();

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

  const body = await request.json();

  if (!body.title || typeof body.title !== 'string' || !body.title.trim()) {
    return Response.json({ error: 'Title is required' }, { status: 400 });
  }

  const status = body.scheduled_at ? 'planned' : 'idea';

  const { data: campaign, error } = await supabase
    .from('campaigns')
    .insert({
      organization_id: membership.organization_id,
      title: body.title.trim(),
      core_idea: body.core_idea || null,
      website_id: body.website_id || null,
      persona_id: body.persona_id || null,
      format: body.format || null,
      primary_keyword: body.primary_keyword || null,
      secondary_keywords: body.secondary_keywords || [],
      target_length: body.target_length || 1500,
      notes: body.notes || null,
      scheduled_at: body.scheduled_at || null,
      source: 'manual',
      status,
      created_by: user.id,
    })
    .select('*, websites(name), personas(name)')
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({
    id: campaign.id,
    title: campaign.title,
    core_idea: campaign.core_idea,
    format: campaign.format,
    status: campaign.status,
    source: campaign.source,
    scheduled_at: campaign.scheduled_at,
    website_id: campaign.website_id,
    website_name: (campaign as any).websites?.name || null,
    persona_id: campaign.persona_id,
    persona_name: (campaign as any).personas?.name || null,
    primary_keyword: campaign.primary_keyword,
    secondary_keywords: campaign.secondary_keywords,
    target_length: campaign.target_length,
    notes: campaign.notes,
    article_id: campaign.article_id,
    created_at: campaign.created_at,
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/planner/route.ts
git commit -m "feat(planner): add GET and POST /api/planner endpoints"
```

---

### Task 5: Planner API — PATCH and DELETE

**Files:**
- Create: `app/api/planner/[id]/route.ts`

- [ ] **Step 1: Create the PATCH + DELETE endpoint**

```typescript
import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

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

  // Verify campaign belongs to org
  const { data: existing } = await supabase
    .from('campaigns')
    .select('id, status')
    .eq('id', id)
    .eq('organization_id', membership.organization_id)
    .single();

  if (!existing) {
    return Response.json({ error: 'Campaign not found' }, { status: 404 });
  }

  const body = await request.json();
  const allowedFields = [
    'title', 'core_idea', 'website_id', 'persona_id', 'format',
    'primary_keyword', 'secondary_keywords', 'target_length',
    'notes', 'scheduled_at', 'status',
  ];

  const updates: Record<string, any> = {};
  for (const field of allowedFields) {
    if (field in body) {
      updates[field] = body[field];
    }
  }

  // Auto-transition: scheduling an idea makes it planned
  if ('scheduled_at' in updates && updates.scheduled_at && existing.status === 'idea') {
    updates.status = 'planned';
  }
  // Auto-transition: unscheduling a planned item makes it an idea
  if ('scheduled_at' in updates && !updates.scheduled_at && existing.status === 'planned') {
    updates.status = 'idea';
  }

  updates.updated_at = new Date().toISOString();

  const { data: campaign, error } = await supabase
    .from('campaigns')
    .update(updates)
    .eq('id', id)
    .select('*, websites(name), personas(name)')
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({
    id: campaign.id,
    title: campaign.title,
    core_idea: campaign.core_idea,
    format: campaign.format,
    status: campaign.status,
    source: campaign.source,
    scheduled_at: campaign.scheduled_at,
    website_id: campaign.website_id,
    website_name: (campaign as any).websites?.name || null,
    persona_id: campaign.persona_id,
    persona_name: (campaign as any).personas?.name || null,
    primary_keyword: campaign.primary_keyword,
    secondary_keywords: campaign.secondary_keywords,
    target_length: campaign.target_length,
    notes: campaign.notes,
    article_id: campaign.article_id,
    created_at: campaign.created_at,
  });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

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

  const { error } = await supabase
    .from('campaigns')
    .delete()
    .eq('id', id)
    .eq('organization_id', membership.organization_id);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ success: true });
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/planner/[id]/route.ts
git commit -m "feat(planner): add PATCH and DELETE /api/planner/[id] endpoints"
```

---

### Task 6: Planner API — AI Generate

**Files:**
- Create: `app/api/planner/generate/route.ts`

- [ ] **Step 1: Create the generate endpoint**

```typescript
import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { decrypt } from '@/lib/crypto';
import { generateIdeas } from '@/lib/planner/generate-ideas';
import { logUsageEvent } from '@/lib/usage';
import type { Provider } from '@/lib/generation/model-router';

export async function POST(request: NextRequest) {
  const supabase = await createClient();

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
  const body = await request.json();

  // Validate
  const { websiteId, seedTopic, count: rawCount } = body;
  if (!websiteId) {
    return Response.json({ error: 'websiteId is required' }, { status: 400 });
  }

  const count = Math.max(1, Math.min(10, parseInt(rawCount, 10) || 5));

  // Verify website belongs to org
  const { data: website } = await supabase
    .from('websites')
    .select('id, name, url, description')
    .eq('id', websiteId)
    .eq('organization_id', orgId)
    .single();

  if (!website) {
    return Response.json({ error: 'Website not found' }, { status: 404 });
  }

  // Fetch existing article titles to avoid duplicates
  const { data: existingArticles } = await supabase
    .from('articles')
    .select('title')
    .eq('organization_id', orgId)
    .eq('website_id', websiteId)
    .order('created_at', { ascending: false })
    .limit(50);

  const existingTitles = (existingArticles || []).map((a: any) => a.title);

  // Also include existing campaign titles
  const { data: existingCampaigns } = await supabase
    .from('campaigns')
    .select('title')
    .eq('organization_id', orgId)
    .eq('website_id', websiteId)
    .order('created_at', { ascending: false })
    .limit(50);

  const campaignTitles = (existingCampaigns || []).map((c: any) => c.title);
  const allExistingTitles = [...existingTitles, ...campaignTitles];

  // Resolve API keys (same pattern as keywords route)
  const { data: orgData } = await supabase
    .from('organizations')
    .select('api_integration_keys')
    .eq('id', orgId)
    .single();

  const storedKeys: Record<string, string> = orgData?.api_integration_keys || {};

  function resolveKey(dbKey: string, envVar: string): string | undefined {
    if (storedKeys[dbKey]) {
      try { return decrypt(storedKeys[dbKey]); } catch { /* fall through */ }
    }
    return process.env[envVar] || undefined;
  }

  const providerKeys: Partial<Record<Provider, string>> = {};
  const openaiKey = resolveKey('openai_api_key', 'OPENAI_API_KEY');
  const anthropicKey = resolveKey('anthropic_api_key', 'ANTHROPIC_API_KEY');
  if (openaiKey) providerKeys.openai = openaiKey;
  if (anthropicKey) providerKeys.anthropic = anthropicKey;

  if (!Object.keys(providerKeys).length) {
    return Response.json(
      { error: 'No AI provider API key configured. Add one in Settings.' },
      { status: 400 }
    );
  }

  // Generate ideas
  try {
    const result = await generateIdeas({
      websiteName: website.name,
      websiteUrl: website.url,
      websiteDescription: website.description,
      existingTitles: allExistingTitles,
      seedTopic: seedTopic || undefined,
      count,
      providerKeys,
    });

    // Insert ideas into campaigns table
    const inserts = result.ideas.map(idea => ({
      organization_id: orgId,
      website_id: websiteId,
      title: idea.title,
      core_idea: idea.core_idea,
      format: idea.format,
      primary_keyword: idea.primary_keyword,
      secondary_keywords: idea.secondary_keywords,
      source: 'ai',
      status: 'idea',
      created_by: user.id,
    }));

    const { data: created, error: insertError } = await supabase
      .from('campaigns')
      .insert(inserts)
      .select('*, websites(name), personas(name)');

    if (insertError) {
      return Response.json({ error: insertError.message }, { status: 500 });
    }

    // Log usage
    await logUsageEvent({
      organizationId: orgId,
      userId: user.id,
      eventType: 'idea_generation',
      modelUsed: result.generation.model,
      estimatedCostUsd: result.generation.costUsd,
    });

    // Transform response
    const ideas = (created || []).map((c: any) => ({
      id: c.id,
      title: c.title,
      core_idea: c.core_idea,
      format: c.format,
      status: c.status,
      source: c.source,
      scheduled_at: c.scheduled_at,
      website_id: c.website_id,
      website_name: c.websites?.name || null,
      persona_id: c.persona_id,
      persona_name: c.personas?.name || null,
      primary_keyword: c.primary_keyword,
      secondary_keywords: c.secondary_keywords,
      target_length: c.target_length,
      notes: c.notes,
      article_id: c.article_id,
      created_at: c.created_at,
    }));

    return Response.json({ ideas });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to generate ideas';
    return Response.json({ error: message }, { status: 500 });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/planner/generate/route.ts
git commit -m "feat(planner): add POST /api/planner/generate endpoint"
```

---

## Chunk 2: Sidebar Navigation and Page Shell

### Task 7: Add Planner to Sidebar Navigation

**Files:**
- Modify: `app/dashboard/layout.tsx`

- [ ] **Step 1: Add CalendarDays import and Planner nav link**

Add `CalendarDays` to the lucide-react import. Add the Planner link between "New Article" and "Content Library":

```tsx
<Link href="/dashboard/planner" ...>
  <CalendarDays size={18} />
  <span>Planner</span>
</Link>
```

Follow the exact same pattern as the existing nav links (same classes, same styles).

- [ ] **Step 2: Commit**

```bash
git add app/dashboard/layout.tsx
git commit -m "feat(planner): add Planner to sidebar navigation"
```

---

### Task 8: Planner Page Shell

**Files:**
- Create: `app/dashboard/planner/page.tsx`
- Create: `app/dashboard/planner/planner-dashboard.tsx`
- Create: `app/dashboard/planner/planner-loader.tsx`

- [ ] **Step 1: Create the server component page**

`app/dashboard/planner/page.tsx`:

```typescript
import { useUser } from '@/lib/hooks/use-user';
import { useOrganization } from '@/lib/hooks/use-organization';
import { redirect } from 'next/navigation';
import { PlannerLoader } from './planner-loader';

export default async function PlannerPage() {
  const user = await useUser();
  const org = await useOrganization();

  if (!user || !org) {
    redirect('/login');
  }

  return <PlannerLoader />;
}
```

- [ ] **Step 2: Create the client loader (dynamic import to avoid SSR issues)**

`app/dashboard/planner/planner-loader.tsx`:

```typescript
'use client';

import dynamic from 'next/dynamic';

const PlannerDashboard = dynamic(
  () => import('./planner-dashboard').then(m => m.PlannerDashboard),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin h-6 w-6 border-2 border-current border-t-transparent rounded-full" style={{ color: 'var(--text-muted)' }} />
      </div>
    ),
  }
);

export function PlannerLoader() {
  return <PlannerDashboard />;
}
```

- [ ] **Step 3: Create the client component orchestrator**

`app/dashboard/planner/planner-dashboard.tsx`:

```typescript
'use client';

import { useState, useEffect, useCallback } from 'react';
import { IdeasPanel } from '@/components/planner/ideas-panel';
import { CalendarGrid } from '@/components/planner/calendar-grid';
import { IdeaDetailModal } from '@/components/planner/idea-detail-modal';
import { Loader2 } from 'lucide-react';

export type Campaign = {
  id: string;
  title: string;
  core_idea: string | null;
  format: string | null;
  status: string;
  source: string | null;
  scheduled_at: string | null;
  website_id: string | null;
  website_name: string | null;
  persona_id: string | null;
  persona_name: string | null;
  primary_keyword: string | null;
  secondary_keywords: string[];
  target_length: number;
  notes: string | null;
  article_id: string | null;
  created_at: string;
};

export type CalendarArticle = {
  id: string;
  title: string;
  status: string;
  created_at: string;
  website_name: string | null;
  campaign_id: string | null;
};

export function PlannerDashboard() {
  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const [month, setMonth] = useState(defaultMonth);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [articles, setArticles] = useState<CalendarArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [showNewIdea, setShowNewIdea] = useState(false);
  const [newIdeaDate, setNewIdeaDate] = useState<string | null>(null);

  const fetchData = useCallback(async (m: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/planner?month=${m}`);
      if (!res.ok) throw new Error('Failed to load planner data');
      const json = await res.json();
      setCampaigns(json.campaigns || []);
      setArticles(json.articles || []);
    } catch (e) {
      console.error('Planner fetch error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(month);
  }, [month, fetchData]);

  const unscheduledIdeas = campaigns.filter(c => c.status === 'idea' && !c.scheduled_at);
  const scheduledCampaigns = campaigns.filter(c => c.scheduled_at);

  const selectedCampaign = selectedCampaignId
    ? campaigns.find(c => c.id === selectedCampaignId) || null
    : null;

  async function handleDrop(campaignId: string, date: string) {
    // Optimistic update
    setCampaigns(prev =>
      prev.map(c =>
        c.id === campaignId
          ? { ...c, scheduled_at: date, status: c.status === 'idea' ? 'planned' : c.status }
          : c
      )
    );

    await fetch(`/api/planner/${campaignId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scheduled_at: date }),
    });
  }

  async function handleUnschedule(campaignId: string) {
    setCampaigns(prev =>
      prev.map(c =>
        c.id === campaignId
          ? { ...c, scheduled_at: null, status: 'idea' }
          : c
      )
    );

    await fetch(`/api/planner/${campaignId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scheduled_at: null }),
    });
  }

  function handleCellClick(date: string) {
    setNewIdeaDate(date);
    setShowNewIdea(true);
  }

  function handleIdeasGenerated(newIdeas: Campaign[]) {
    setCampaigns(prev => [...newIdeas, ...prev]);
  }

  async function handleSaveCampaign(updated: Campaign) {
    setCampaigns(prev => prev.map(c => c.id === updated.id ? updated : c));
    setSelectedCampaignId(null);
  }

  async function handleDeleteCampaign(id: string) {
    setCampaigns(prev => prev.filter(c => c.id !== id));
    setSelectedCampaignId(null);
    await fetch(`/api/planner/${id}`, { method: 'DELETE' });
  }

  function handleNewIdeaCreated(idea: Campaign) {
    setCampaigns(prev => [idea, ...prev]);
    setShowNewIdea(false);
    setNewIdeaDate(null);
  }

  if (loading && campaigns.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={24} className="animate-spin" style={{ color: 'var(--text-muted)' }} />
      </div>
    );
  }

  return (
    <div className="flex gap-4 h-[calc(100vh-120px)]">
      <IdeasPanel
        ideas={unscheduledIdeas}
        onCardClick={setSelectedCampaignId}
        onIdeasGenerated={handleIdeasGenerated}
        onUnschedule={handleUnschedule}
      />
      <CalendarGrid
        month={month}
        onMonthChange={setMonth}
        campaigns={scheduledCampaigns}
        articles={articles}
        onDrop={handleDrop}
        onChipClick={setSelectedCampaignId}
        onCellClick={handleCellClick}
        onArticleClick={(id) => window.location.href = `/dashboard/articles/${id}`}
      />

      {selectedCampaign && (
        <IdeaDetailModal
          campaign={selectedCampaign}
          onSave={handleSaveCampaign}
          onDelete={handleDeleteCampaign}
          onClose={() => setSelectedCampaignId(null)}
        />
      )}

      {showNewIdea && (
        <IdeaDetailModal
          campaign={null}
          defaultDate={newIdeaDate}
          onSave={handleNewIdeaCreated}
          onDelete={() => {}}
          onClose={() => { setShowNewIdea(false); setNewIdeaDate(null); }}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add app/dashboard/planner/page.tsx app/dashboard/planner/planner-loader.tsx app/dashboard/planner/planner-dashboard.tsx
git commit -m "feat(planner): add planner page shell with orchestrator"
```

---

## Chunk 3: UI Components — Ideas Panel and Calendar

### Task 9: Ideas Panel Component

**Files:**
- Create: `components/planner/ideas-panel.tsx`
- Create: `components/planner/idea-card.tsx`
- Create: `components/planner/generate-popover.tsx`

- [ ] **Step 1: Create the idea card**

`components/planner/idea-card.tsx`:

```typescript
'use client';

import type { Campaign } from '@/app/dashboard/planner/planner-dashboard';

const FORMAT_COLORS: Record<string, string> = {
  'how-to': '#6366f1',
  'roundup': '#8b5cf6',
  'listicle': '#3b82f6',
  'explainer': '#10b981',
  'opinion': '#f59e0b',
  'tutorial': '#ec4899',
  'case-study': '#6b7280',
};

export function IdeaCard({ campaign, onClick }: { campaign: Campaign; onClick: () => void }) {
  function handleDragStart(e: React.DragEvent) {
    e.dataTransfer.setData('text/plain', campaign.id);
    e.dataTransfer.effectAllowed = 'move';
  }

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onClick={onClick}
      className="p-3 rounded-lg cursor-grab active:cursor-grabbing transition hover:shadow-sm"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
    >
      <p className="text-sm font-medium line-clamp-2" style={{ color: 'var(--foreground)' }}>
        {campaign.title}
      </p>
      <div className="flex items-center gap-2 mt-1.5">
        {campaign.format && (
          <span
            className="text-[10px] px-1.5 py-0.5 rounded font-medium text-white"
            style={{ background: FORMAT_COLORS[campaign.format] || '#6b7280' }}
          >
            {campaign.format}
          </span>
        )}
        {campaign.website_name && (
          <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
            {campaign.website_name}
          </span>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create the generate popover**

`components/planner/generate-popover.tsx`:

```typescript
'use client';

import { useState, useEffect, useRef } from 'react';
import { Sparkles, Loader2 } from 'lucide-react';
import type { Campaign } from '@/app/dashboard/planner/planner-dashboard';

type Props = {
  onGenerated: (ideas: Campaign[]) => void;
};

export function GeneratePopover({ onGenerated }: Props) {
  const [open, setOpen] = useState(false);
  const [websites, setWebsites] = useState<Array<{ id: string; name: string }>>([]);
  const [websiteId, setWebsiteId] = useState('');
  const [seedTopic, setSeedTopic] = useState('');
  const [count, setCount] = useState(5);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && websites.length === 0) {
      fetch('/api/planner?include_unscheduled=false&month=2000-01')
        .catch(() => null);
      // Fetch websites separately
      fetch('/api/planner').then(r => r.json()).catch(() => null);
    }
  }, [open, websites.length]);

  // Load websites on first open
  useEffect(() => {
    async function loadWebsites() {
      try {
        const res = await fetch('/api/planner?include_unscheduled=false&month=2000-01');
        // We need a separate websites endpoint — use the existing sites page pattern
        // Actually, let's fetch from the sites API
        const sitesRes = await fetch('/api/planner');
        // For now, we'll extract unique websites from campaigns
        // Better approach: fetch from a lightweight endpoint
      } catch { /* ignore */ }
    }
    if (open) loadWebsites();
  }, [open]);

  // Simpler: fetch websites from supabase directly via a lightweight call
  useEffect(() => {
    if (!open) return;
    (async () => {
      try {
        // Use the existing websites data from the dashboard
        const res = await fetch('/api/planner/generate', {
          method: 'OPTIONS',
        });
        // Actually, we'll pass websites from the parent. But for simplicity,
        // let's make a dedicated fetch.
      } catch { /* ignore */ }
    })();
  }, [open]);

  // Load websites on mount (simpler approach)
  useEffect(() => {
    (async () => {
      try {
        // There's no dedicated /api/websites endpoint, so we'll use supabase client-side
        // Actually the simplest thing: pass websites as a prop from the parent
      } catch { /* ignore */ }
    })();
  }, []);

  async function handleGenerate() {
    if (!websiteId) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/planner/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ websiteId, seedTopic: seedTopic || undefined, count }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Generation failed');
      }

      const data = await res.json();
      onGenerated(data.ideas);
      setOpen(false);
      setSeedTopic('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to generate');
    } finally {
      setLoading(false);
    }
  }

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition"
        style={{ background: 'var(--accent)', color: 'var(--accent-text)' }}
      >
        <Sparkles size={13} />
        Generate
      </button>

      {open && (
        <div
          className="absolute left-0 top-full mt-2 w-72 p-4 rounded-xl shadow-lg z-50 space-y-3"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
        >
          <div>
            <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-muted)' }}>Website *</label>
            <select
              value={websiteId}
              onChange={e => setWebsiteId(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg text-sm"
              style={{ background: 'var(--background)', border: '1px solid var(--border)', color: 'var(--foreground)' }}
            >
              <option value="">Select website...</option>
              {websites.map(w => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-muted)' }}>Seed Topic (optional)</label>
            <input
              type="text"
              value={seedTopic}
              onChange={e => setSeedTopic(e.target.value)}
              placeholder="e.g., AI writing tools"
              className="w-full px-2.5 py-1.5 rounded-lg text-sm"
              style={{ background: 'var(--background)', border: '1px solid var(--border)', color: 'var(--foreground)' }}
            />
          </div>

          <div>
            <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-muted)' }}>Ideas to generate</label>
            <input
              type="number"
              min={1}
              max={10}
              value={count}
              onChange={e => setCount(parseInt(e.target.value, 10) || 5)}
              className="w-20 px-2.5 py-1.5 rounded-lg text-sm"
              style={{ background: 'var(--background)', border: '1px solid var(--border)', color: 'var(--foreground)' }}
            />
          </div>

          {error && <p className="text-xs" style={{ color: 'var(--danger)' }}>{error}</p>}

          <button
            onClick={handleGenerate}
            disabled={!websiteId || loading}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50"
            style={{ background: 'var(--accent)', color: 'var(--accent-text)' }}
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            {loading ? 'Generating...' : 'Generate Ideas'}
          </button>
        </div>
      )}
    </div>
  );
}
```

Note: The generate popover needs a list of websites. The implementer should add a `websites` prop passed from the parent (fetched once in `planner-dashboard.tsx` or via an inline fetch). The simplest approach is to fetch websites in the `PlannerDashboard` and pass them down.

- [ ] **Step 3: Create the ideas panel**

`components/planner/ideas-panel.tsx`:

```typescript
'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { IdeaCard } from './idea-card';
import { GeneratePopover } from './generate-popover';
import type { Campaign } from '@/app/dashboard/planner/planner-dashboard';

type Props = {
  ideas: Campaign[];
  onCardClick: (id: string) => void;
  onIdeasGenerated: (ideas: Campaign[]) => void;
  onUnschedule: (id: string) => void;
};

export function IdeasPanel({ ideas, onCardClick, onIdeasGenerated, onUnschedule }: Props) {
  const [collapsed, setCollapsed] = useState(false);

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const campaignId = e.dataTransfer.getData('text/plain');
    if (campaignId) {
      onUnschedule(campaignId);
    }
  }

  if (collapsed) {
    return (
      <div className="flex flex-col items-center py-4">
        <button
          onClick={() => setCollapsed(false)}
          className="p-1.5 rounded-lg transition hover:opacity-80"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
        >
          <ChevronRight size={16} style={{ color: 'var(--text-muted)' }} />
        </button>
      </div>
    );
  }

  return (
    <div
      className="w-[280px] min-w-[280px] flex flex-col rounded-xl overflow-hidden"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Header */}
      <div className="px-4 py-3 flex items-center gap-2" style={{ borderBottom: '1px solid var(--border)' }}>
        <h3 className="text-sm font-semibold flex-1" style={{ color: 'var(--foreground)' }}>
          Ideas <span className="font-normal" style={{ color: 'var(--text-muted)' }}>({ideas.length})</span>
        </h3>
        <GeneratePopover onGenerated={onIdeasGenerated} />
        <button
          onClick={() => onCardClick('__new__')}
          className="p-1 rounded transition hover:opacity-80"
          style={{ color: 'var(--text-muted)' }}
          title="Add manually"
        >
          <Plus size={16} />
        </button>
        <button
          onClick={() => setCollapsed(true)}
          className="p-1 rounded transition hover:opacity-80"
          style={{ color: 'var(--text-muted)' }}
        >
          <ChevronLeft size={16} />
        </button>
      </div>

      {/* Cards */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {ideas.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm mb-3" style={{ color: 'var(--text-muted)' }}>No ideas yet</p>
            <GeneratePopover onGenerated={onIdeasGenerated} />
          </div>
        ) : (
          ideas.map(idea => (
            <IdeaCard
              key={idea.id}
              campaign={idea}
              onClick={() => onCardClick(idea.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add components/planner/ideas-panel.tsx components/planner/idea-card.tsx components/planner/generate-popover.tsx
git commit -m "feat(planner): add ideas panel with cards and generate popover"
```

---

### Task 10: Calendar Grid Component

**Files:**
- Create: `components/planner/calendar-grid.tsx`
- Create: `components/planner/calendar-cell.tsx`
- Create: `components/planner/idea-chip.tsx`

- [ ] **Step 1: Create the idea chip**

`components/planner/idea-chip.tsx`:

```typescript
'use client';

import type { Campaign, CalendarArticle } from '@/app/dashboard/planner/planner-dashboard';

const STATUS_COLORS: Record<string, string> = {
  idea: '#9ca3af',
  planned: '#3b82f6',
  writing: '#f59e0b',
  approved: '#10b981',
  scheduled: '#8b5cf6',
  done: '#065f46',
};

export function IdeaChip({
  campaign,
  onClick,
}: {
  campaign: Campaign;
  onClick: () => void;
}) {
  function handleDragStart(e: React.DragEvent) {
    e.dataTransfer.setData('text/plain', campaign.id);
    e.dataTransfer.effectAllowed = 'move';
    e.stopPropagation();
  }

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className="text-[10px] px-1.5 py-0.5 rounded cursor-grab active:cursor-grabbing text-white truncate"
      style={{ background: STATUS_COLORS[campaign.status] || '#9ca3af' }}
      title={campaign.title}
    >
      {campaign.title}
    </div>
  );
}

export function ArticleChip({
  article,
  onClick,
}: {
  article: CalendarArticle;
  onClick: () => void;
}) {
  return (
    <div
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className="text-[10px] px-1.5 py-0.5 rounded cursor-pointer truncate"
      style={{ background: 'var(--surface-warm)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
      title={article.title}
    >
      {article.title}
    </div>
  );
}
```

- [ ] **Step 2: Create the calendar cell**

`components/planner/calendar-cell.tsx`:

```typescript
'use client';

import { useState } from 'react';
import { IdeaChip, ArticleChip } from './idea-chip';
import type { Campaign, CalendarArticle } from '@/app/dashboard/planner/planner-dashboard';

type Props = {
  date: string; // YYYY-MM-DD
  dayNumber: number;
  isToday: boolean;
  isCurrentMonth: boolean;
  campaigns: Campaign[];
  articles: CalendarArticle[];
  onDrop: (campaignId: string, date: string) => void;
  onChipClick: (id: string) => void;
  onCellClick: (date: string) => void;
  onArticleClick: (id: string) => void;
};

export function CalendarCell({
  date, dayNumber, isToday, isCurrentMonth, campaigns, articles,
  onDrop, onChipClick, onCellClick, onArticleClick,
}: Props) {
  const [dragOver, setDragOver] = useState(false);

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOver(true);
  }

  function handleDragLeave() {
    setDragOver(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const campaignId = e.dataTransfer.getData('text/plain');
    if (campaignId) {
      onDrop(campaignId, date);
    }
  }

  return (
    <div
      onClick={() => onCellClick(date)}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="min-h-[80px] p-1 rounded-lg transition cursor-pointer"
      style={{
        background: dragOver ? 'var(--accent-light)' : 'var(--surface)',
        border: `1px solid ${dragOver ? 'var(--accent)' : isToday ? 'var(--accent)' : 'var(--border)'}`,
        opacity: isCurrentMonth ? 1 : 0.4,
      }}
    >
      <div
        className={`text-xs font-medium mb-1 ${isToday ? 'w-5 h-5 rounded-full flex items-center justify-center' : ''}`}
        style={{
          color: isToday ? 'var(--accent-text)' : 'var(--text-muted)',
          background: isToday ? 'var(--accent)' : 'transparent',
        }}
      >
        {dayNumber}
      </div>
      <div className="space-y-0.5">
        {campaigns.map(c => (
          <IdeaChip key={c.id} campaign={c} onClick={() => onChipClick(c.id)} />
        ))}
        {articles.map(a => (
          <ArticleChip key={a.id} article={a} onClick={() => onArticleClick(a.id)} />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create the calendar grid**

`components/planner/calendar-grid.tsx`:

```typescript
'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { CalendarCell } from './calendar-cell';
import type { Campaign, CalendarArticle } from '@/app/dashboard/planner/planner-dashboard';

type Props = {
  month: string; // YYYY-MM
  onMonthChange: (month: string) => void;
  campaigns: Campaign[];
  articles: CalendarArticle[];
  onDrop: (campaignId: string, date: string) => void;
  onChipClick: (id: string) => void;
  onCellClick: (date: string) => void;
  onArticleClick: (id: string) => void;
};

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function getCalendarDays(year: number, month: number) {
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);

  // Monday = 0 ... Sunday = 6
  let startDow = firstDay.getDay() - 1;
  if (startDow < 0) startDow = 6;

  const days: Array<{ date: string; dayNumber: number; isCurrentMonth: boolean }> = [];

  // Previous month fill
  for (let i = startDow - 1; i >= 0; i--) {
    const d = new Date(year, month - 1, -i);
    days.push({
      date: d.toISOString().slice(0, 10),
      dayNumber: d.getDate(),
      isCurrentMonth: false,
    });
  }

  // Current month
  for (let d = 1; d <= lastDay.getDate(); d++) {
    const date = new Date(year, month - 1, d);
    days.push({
      date: date.toISOString().slice(0, 10),
      dayNumber: d,
      isCurrentMonth: true,
    });
  }

  // Next month fill
  while (days.length % 7 !== 0) {
    const d = new Date(year, month, days.length - lastDay.getDate() - startDow + 1);
    days.push({
      date: d.toISOString().slice(0, 10),
      dayNumber: d.getDate(),
      isCurrentMonth: false,
    });
  }

  return days;
}

function formatMonthLabel(month: string): string {
  const [y, m] = month.split('-');
  const date = new Date(parseInt(y), parseInt(m) - 1);
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function prevMonth(month: string): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function nextMonth(month: string): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function CalendarGrid({
  month, onMonthChange, campaigns, articles,
  onDrop, onChipClick, onCellClick, onArticleClick,
}: Props) {
  const [yearStr, monthStr] = month.split('-');
  const year = parseInt(yearStr, 10);
  const monthNum = parseInt(monthStr, 10);
  const calendarDays = getCalendarDays(year, monthNum);
  const today = new Date().toISOString().slice(0, 10);

  // Now
  const nowMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;

  return (
    <div className="flex-1 flex flex-col min-w-0">
      {/* Month nav */}
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={() => onMonthChange(prevMonth(month))}
          className="p-1.5 rounded-lg transition hover:opacity-80"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
        >
          <ChevronLeft size={16} style={{ color: 'var(--foreground)' }} />
        </button>
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold" style={{ color: 'var(--foreground)' }}>
            {formatMonthLabel(month)}
          </h2>
          {month !== nowMonth && (
            <button
              onClick={() => onMonthChange(nowMonth)}
              className="text-xs px-2 py-0.5 rounded transition"
              style={{ background: 'var(--accent-light)', color: 'var(--accent)' }}
            >
              Today
            </button>
          )}
        </div>
        <button
          onClick={() => onMonthChange(nextMonth(month))}
          className="p-1.5 rounded-lg transition hover:opacity-80"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
        >
          <ChevronRight size={16} style={{ color: 'var(--foreground)' }} />
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {DAYS.map(d => (
          <div key={d} className="text-center text-xs font-medium py-1" style={{ color: 'var(--text-muted)' }}>
            {d}
          </div>
        ))}
      </div>

      {/* Calendar cells */}
      <div className="grid grid-cols-7 gap-1 flex-1">
        {calendarDays.map(day => {
          const dayCampaigns = campaigns.filter(c => c.scheduled_at === day.date);
          const dayArticles = articles.filter(a => a.created_at.slice(0, 10) === day.date);

          return (
            <CalendarCell
              key={day.date}
              date={day.date}
              dayNumber={day.dayNumber}
              isToday={day.date === today}
              isCurrentMonth={day.isCurrentMonth}
              campaigns={dayCampaigns}
              articles={dayArticles}
              onDrop={onDrop}
              onChipClick={onChipClick}
              onCellClick={onCellClick}
              onArticleClick={onArticleClick}
            />
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add components/planner/calendar-grid.tsx components/planner/calendar-cell.tsx components/planner/idea-chip.tsx
git commit -m "feat(planner): add calendar grid with drag-and-drop"
```

---

## Chunk 4: Detail Modal, Article Integration, and Polish

### Task 11: Idea Detail Modal

**Files:**
- Create: `components/planner/idea-detail-modal.tsx`

- [ ] **Step 1: Create the detail modal**

```typescript
'use client';

import { useState, useEffect } from 'react';
import { X, Trash2, PenTool } from 'lucide-react';
import type { Campaign } from '@/app/dashboard/planner/planner-dashboard';

type Props = {
  campaign: Campaign | null; // null = creating new
  defaultDate?: string | null;
  onSave: (campaign: Campaign) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
};

export function IdeaDetailModal({ campaign, defaultDate, onSave, onDelete, onClose }: Props) {
  const isNew = !campaign;

  const [title, setTitle] = useState(campaign?.title || '');
  const [coreIdea, setCoreIdea] = useState(campaign?.core_idea || '');
  const [websiteId, setWebsiteId] = useState(campaign?.website_id || '');
  const [personaId, setPersonaId] = useState(campaign?.persona_id || '');
  const [format, setFormat] = useState(campaign?.format || '');
  const [primaryKeyword, setPrimaryKeyword] = useState(campaign?.primary_keyword || '');
  const [secondaryKeywords, setSecondaryKeywords] = useState(
    campaign?.secondary_keywords?.join(', ') || ''
  );
  const [targetLength, setTargetLength] = useState(campaign?.target_length || 1500);
  const [notes, setNotes] = useState(campaign?.notes || '');
  const [scheduledAt, setScheduledAt] = useState(campaign?.scheduled_at || defaultDate || '');
  const [saving, setSaving] = useState(false);

  const [websites, setWebsites] = useState<Array<{ id: string; name: string }>>([]);
  const [personas, setPersonas] = useState<Array<{ id: string; name: string }>>([]);

  // Load websites
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/planner?include_unscheduled=false&month=2000-01');
        if (res.ok) {
          // We need a websites list — extract from a simple query
          // Better: fetch directly
        }
      } catch { /* ignore */ }
    })();
  }, []);

  // Note for implementer: websites and personas should be fetched from
  // Supabase via a lightweight API or passed as props from the parent.
  // The simplest approach is to add a useEffect that fetches them.

  const canWrite = websiteId && personaId;

  async function handleSave() {
    if (!title.trim()) return;
    setSaving(true);

    const payload = {
      title: title.trim(),
      core_idea: coreIdea || null,
      website_id: websiteId || null,
      persona_id: personaId || null,
      format: format || null,
      primary_keyword: primaryKeyword || null,
      secondary_keywords: secondaryKeywords
        ? secondaryKeywords.split(',').map(s => s.trim()).filter(Boolean)
        : [],
      target_length: targetLength,
      notes: notes || null,
      scheduled_at: scheduledAt || null,
    };

    try {
      let res;
      if (isNew) {
        res = await fetch('/api/planner', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch(`/api/planner/${campaign.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }

      if (res.ok) {
        const updated = await res.json();
        onSave(updated);
      }
    } catch (e) {
      console.error('Save error:', e);
    } finally {
      setSaving(false);
    }
  }

  function handleWrite() {
    if (!campaign || !canWrite) return;
    window.location.href = `/dashboard/articles/new?campaign=${campaign.id}`;
  }

  const FORMATS = ['how-to', 'roundup', 'listicle', 'explainer', 'opinion', 'tutorial', 'case-study'];

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />

      {/* Panel */}
      <div
        className="relative w-[400px] max-w-full h-full overflow-y-auto p-6 space-y-4"
        style={{ background: 'var(--background)' }}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold" style={{ color: 'var(--foreground)' }}>
            {isNew ? 'New Idea' : 'Edit Idea'}
          </h2>
          <button onClick={onClose} className="p-1 rounded" style={{ color: 'var(--text-muted)' }}>
            <X size={18} />
          </button>
        </div>

        {/* Status badge */}
        {campaign && (
          <div className="flex items-center gap-2">
            <span className="text-xs px-2 py-0.5 rounded-full font-medium capitalize"
              style={{ background: 'var(--surface-warm)', color: 'var(--text-secondary)' }}>
              {campaign.status}
            </span>
            {campaign.source && (
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Source: {campaign.source}
              </span>
            )}
          </div>
        )}

        {/* Title */}
        <div>
          <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-muted)' }}>Title *</label>
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            className="w-full px-3 py-2 rounded-lg text-sm"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--foreground)' }}
          />
        </div>

        {/* Core Idea */}
        <div>
          <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-muted)' }}>Description</label>
          <textarea
            value={coreIdea}
            onChange={e => setCoreIdea(e.target.value)}
            rows={2}
            className="w-full px-3 py-2 rounded-lg text-sm resize-none"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--foreground)' }}
          />
        </div>

        {/* Website */}
        <div>
          <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-muted)' }}>Website</label>
          <select
            value={websiteId}
            onChange={e => { setWebsiteId(e.target.value); setPersonaId(''); }}
            className="w-full px-3 py-2 rounded-lg text-sm"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--foreground)' }}
          >
            <option value="">Select website...</option>
            {websites.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        </div>

        {/* Persona */}
        <div>
          <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-muted)' }}>Persona</label>
          <select
            value={personaId}
            onChange={e => setPersonaId(e.target.value)}
            className="w-full px-3 py-2 rounded-lg text-sm"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--foreground)' }}
          >
            <option value="">Select persona...</option>
            {personas.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>

        {/* Format */}
        <div>
          <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-muted)' }}>Format</label>
          <select
            value={format}
            onChange={e => setFormat(e.target.value)}
            className="w-full px-3 py-2 rounded-lg text-sm"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--foreground)' }}
          >
            <option value="">Select format...</option>
            {FORMATS.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>

        {/* Keywords */}
        <div>
          <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-muted)' }}>Primary Keyword</label>
          <input
            value={primaryKeyword}
            onChange={e => setPrimaryKeyword(e.target.value)}
            className="w-full px-3 py-2 rounded-lg text-sm"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--foreground)' }}
          />
        </div>

        <div>
          <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-muted)' }}>Secondary Keywords (comma-separated)</label>
          <input
            value={secondaryKeywords}
            onChange={e => setSecondaryKeywords(e.target.value)}
            className="w-full px-3 py-2 rounded-lg text-sm"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--foreground)' }}
          />
        </div>

        {/* Target Length */}
        <div>
          <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-muted)' }}>Target Length (words)</label>
          <input
            type="number"
            value={targetLength}
            onChange={e => setTargetLength(parseInt(e.target.value, 10) || 1500)}
            min={300}
            max={5000}
            className="w-32 px-3 py-2 rounded-lg text-sm"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--foreground)' }}
          />
        </div>

        {/* Notes */}
        <div>
          <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-muted)' }}>Notes</label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={2}
            className="w-full px-3 py-2 rounded-lg text-sm resize-none"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--foreground)' }}
          />
        </div>

        {/* Scheduled Date */}
        <div>
          <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-muted)' }}>Scheduled Date</label>
          <input
            type="date"
            value={scheduledAt}
            onChange={e => setScheduledAt(e.target.value)}
            className="w-full px-3 py-2 rounded-lg text-sm"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--foreground)' }}
          />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 pt-2" style={{ borderTop: '1px solid var(--border)' }}>
          <button
            onClick={handleSave}
            disabled={!title.trim() || saving}
            className="flex-1 px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50"
            style={{ background: 'var(--accent)', color: 'var(--accent-text)' }}
          >
            {saving ? 'Saving...' : 'Save'}
          </button>

          {!isNew && canWrite && (
            <button
              onClick={handleWrite}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition"
              style={{ background: 'var(--success)', color: 'white' }}
            >
              <PenTool size={14} />
              Write Article
            </button>
          )}

          {!isNew && (
            <button
              onClick={() => { if (confirm('Delete this idea?')) onDelete(campaign!.id); }}
              className="p-2 rounded-lg transition"
              style={{ color: 'var(--danger)' }}
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/planner/idea-detail-modal.tsx
git commit -m "feat(planner): add idea detail modal"
```

---

### Task 12: Article Page — Campaign Query Param Support

**Files:**
- Modify: `app/dashboard/articles/new/page.tsx`

- [ ] **Step 1: Add campaign query param handling**

In the article creation page, add logic to:

1. Read `campaign` from `useSearchParams()`
2. If present, fetch the campaign record from Supabase
3. Pre-fill state: `selectedWebsite`, `selectedPersona`, `topic`, `format`, `primaryKeyword`, `secondaryKeywords`, `targetLength`, `notes`
4. Auto-advance to step 3 ("brief")
5. Update campaign status to `writing` via PATCH

Add this near the top of the component (after existing state declarations):

```typescript
const searchParams = useSearchParams();
const campaignId = searchParams.get('campaign');

useEffect(() => {
  if (!campaignId) return;

  (async () => {
    try {
      const res = await fetch(`/api/planner/${campaignId}`);
      if (!res.ok) return;
      const campaign = await res.json();

      // Pre-fill form
      if (campaign.website_id) {
        // Find and select the website (assumes websites are already loaded)
        setSelectedWebsite(campaign.website_id);
      }
      if (campaign.persona_id) {
        setSelectedPersona(campaign.persona_id);
      }
      if (campaign.title) setTopic(campaign.title);
      if (campaign.format) setFormat(campaign.format);
      if (campaign.primary_keyword) setPrimaryKeyword(campaign.primary_keyword);
      if (campaign.secondary_keywords?.length) {
        setSecondaryKeywords(campaign.secondary_keywords);
      }
      if (campaign.target_length) setTargetLength(campaign.target_length);
      if (campaign.core_idea) setNotes(campaign.core_idea);

      // Jump to brief step
      setStep('brief');

      // Update campaign status to writing
      await fetch(`/api/planner/${campaignId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'writing' }),
      });
    } catch (e) {
      console.error('Failed to load campaign:', e);
    }
  })();
}, [campaignId]);
```

Note: The implementer must read the actual page file to understand the exact state variable names and adapt the code above. The state names above (`setSelectedWebsite`, `setTopic`, etc.) are approximations — match the actual names used in the file.

- [ ] **Step 2: After article is generated, link it to the campaign**

In the article generation/save logic, if a `campaignId` is present, include it as `campaign_id` in the article insert and update the campaign's `article_id`:

```typescript
// After article is created with id `articleId`:
if (campaignId) {
  await fetch(`/api/planner/${campaignId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ article_id: articleId }),
  });
}
```

The implementer needs to find where articles are saved in the generation flow and add this linking logic.

- [ ] **Step 3: Commit**

```bash
git add app/dashboard/articles/new/page.tsx
git commit -m "feat(planner): add campaign query param support to article creation"
```

---

### Task 13: Websites Fetch for Generate Popover and Detail Modal

**Files:**
- Modify: `app/dashboard/planner/planner-dashboard.tsx`
- Modify: `components/planner/generate-popover.tsx`
- Modify: `components/planner/idea-detail-modal.tsx`

- [ ] **Step 1: Fetch websites and personas in planner-dashboard and pass as props**

In `planner-dashboard.tsx`, add state for websites and personas. Fetch them on mount:

```typescript
const [websites, setWebsites] = useState<Array<{ id: string; name: string }>>([]);
const [personas, setPersonas] = useState<Array<{ id: string; name: string; website_ids: string[] }>>([]);

useEffect(() => {
  (async () => {
    // Fetch websites
    const sitesRes = await fetch('/api/planner/websites');
    if (sitesRes.ok) {
      const data = await sitesRes.json();
      setWebsites(data.websites || []);
      setPersonas(data.personas || []);
    }
  })();
}, []);
```

- [ ] **Step 2: Create lightweight websites/personas endpoint**

Create `app/api/planner/websites/route.ts`:

```typescript
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createClient();

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

  const [{ data: websites }, { data: personas }] = await Promise.all([
    supabase
      .from('websites')
      .select('id, name')
      .eq('organization_id', orgId)
      .order('name'),
    supabase
      .from('personas')
      .select('id, name, persona_website_assignments(website_id)')
      .eq('organization_id', orgId)
      .order('name'),
  ]);

  return Response.json({
    websites: websites || [],
    personas: (personas || []).map((p: any) => ({
      id: p.id,
      name: p.name,
      website_ids: (p.persona_website_assignments || []).map((a: any) => a.website_id),
    })),
  });
}
```

- [ ] **Step 3: Pass websites and personas as props to GeneratePopover and IdeaDetailModal**

Update the `GeneratePopover` and `IdeaDetailModal` components to accept `websites` and `personas` as props instead of fetching internally. Update the `IdeasPanel` and `PlannerDashboard` to thread them through.

- [ ] **Step 4: Commit**

```bash
git add app/api/planner/websites/route.ts app/dashboard/planner/planner-dashboard.tsx components/planner/generate-popover.tsx components/planner/idea-detail-modal.tsx components/planner/ideas-panel.tsx
git commit -m "feat(planner): add websites/personas endpoint and prop threading"
```

---

### Task 14: Build Verification and Polish

**Files:**
- Various (fix any TypeScript errors)

- [ ] **Step 1: Run the build**

```bash
cd d:\Downloads\writing-champ-master\writing-champ-master && npx next build
```

Fix any TypeScript errors that come up. Common issues:
- Import paths
- Type mismatches between props
- Missing `'use client'` directives

- [ ] **Step 2: Start dev server and test**

```bash
npx next dev --port 3001
```

Verify:
- `/dashboard/planner` loads without errors
- Ideas panel shows (empty state)
- Calendar grid renders with correct month
- Month navigation works
- Clicking calendar cells opens the modal

- [ ] **Step 3: Commit any fixes**

```bash
git add -A
git commit -m "fix(planner): resolve build errors and polish"
```
