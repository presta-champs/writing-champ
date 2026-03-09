import { NextRequest } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { decrypt } from '@/lib/crypto';
import { logUsageEvent } from '@/lib/usage';
import { searchKeywords } from '@/lib/seo/autocomplete';
import { clusterKeywords, toKeywordData } from '@/lib/seo/keywords';
import { assignKeywordRoles } from '@/lib/seo/keyword-picker';
import type { Provider } from '@/lib/generation/model-router';

// ---------------------------------------------------------------------------
// Request validation
// ---------------------------------------------------------------------------

const KeywordResearchSchema = z.object({
  seed: z.string().min(1, 'Seed keyword is required'),
  country: z.string().length(2).default('us'),
  topic: z.string().min(1, 'Topic is required'),
  model: z.string().optional(),
  limit: z.number().int().min(1).max(200).optional(),
});

// ---------------------------------------------------------------------------
// POST /api/keywords
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // ---- Auth check ----
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // ---- Parse and validate body ----
    const body = await request.json();
    const parsed = KeywordResearchSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        { error: parsed.error.issues.map((i) => i.message).join(', ') },
        { status: 400 }
      );
    }

    const { seed, country, topic, model, limit } = parsed.data;

    // ---- Org membership check ----
    const { data: membership } = await supabase
      .from('organization_members')
      .select('organization_id, role')
      .eq('user_id', user.id)
      .limit(1)
      .single();

    if (!membership) {
      return Response.json({ error: 'No organization found' }, { status: 403 });
    }

    const orgId = membership.organization_id;

    // ---- Resolve AI provider keys (for role assignment) ----
    const { data: orgData } = await supabase
      .from('organizations')
      .select('api_integration_keys')
      .eq('id', orgId)
      .single();

    const storedKeys: Record<string, string> = orgData?.api_integration_keys || {};

    function resolveKey(dbKey: string, envVar: string): string | undefined {
      if (storedKeys[dbKey]) {
        try {
          return decrypt(storedKeys[dbKey]);
        } catch {
          /* fall through */
        }
      }
      return process.env[envVar] || undefined;
    }

    const providerKeys: Partial<Record<Provider, string>> = {};
    const anthropicKey = resolveKey('anthropic_api_key', 'ANTHROPIC_API_KEY');
    const openaiKey = resolveKey('openai_api_key', 'OPENAI_API_KEY');
    const geminiKey = resolveKey('google_ai_api_key', 'GOOGLE_AI_API_KEY');
    if (anthropicKey) providerKeys.anthropic = anthropicKey;
    if (openaiKey) providerKeys.openai = openaiKey;
    if (geminiKey) providerKeys.gemini = geminiKey;

    if (!Object.keys(providerKeys).length) {
      return Response.json(
        { error: 'No AI provider API key configured. Add one in Settings to enable keyword research.' },
        { status: 400 }
      );
    }

    // ---- Step 1: Google Autocomplete suggestions (free, no API key) ----
    const autocompleteResults = await searchKeywords(seed, country, limit || 50);
    const allKeywords = autocompleteResults.map(toKeywordData);

    // ---- Step 2: Cluster ----
    const clusters = clusterKeywords(allKeywords);

    // ---- Step 3: AI role assignment ----
    const { assignments, generation } = await assignKeywordRoles(
      allKeywords,
      topic,
      providerKeys,
      model
    );

    // ---- Step 4: Log AI usage ----
    if (generation.costUsd > 0) {
      await logUsageEvent({
        organizationId: orgId,
        userId: user.id,
        eventType: 'kw_research',
        modelUsed: generation.model,
        estimatedCostUsd: generation.costUsd,
      });
    }

    // ---- Build response ----
    const assignmentMap = new Map(
      assignments.map((a) => [a.keyword.toLowerCase(), a])
    );

    const clustersWithRoles = clusters.map((cluster) => ({
      label: cluster.label,
      keywords: cluster.keywords.map((kw) => {
        const assignment = assignmentMap.get(kw.keyword.toLowerCase());
        return {
          ...kw,
          role: assignment?.role || ('ignore' as const),
          reason: assignment?.reason,
        };
      }),
    }));

    const primary = assignments.find((a) => a.role === 'primary') || null;
    const secondary = assignments.filter((a) => a.role === 'secondary');

    return Response.json({
      seed,
      country,
      topic,
      totalFound: autocompleteResults.length,
      totalAfterFilter: allKeywords.length,
      primary: primary
        ? {
            keyword: primary.keyword,
            volume: primary.volume,
            difficulty: primary.difficulty,
            cpc: primary.cpc,
            reason: primary.reason,
          }
        : null,
      secondary: secondary.map((s) => ({
        keyword: s.keyword,
        volume: s.volume,
        difficulty: s.difficulty,
        cpc: s.cpc,
        reason: s.reason,
      })),
      clusters: clustersWithRoles,
      assignments,
    });
  } catch (error) {
    console.error('Keyword research error:', error);
    return Response.json(
      { error: 'Keyword research failed. Please try again.' },
      { status: 500 }
    );
  }
}
