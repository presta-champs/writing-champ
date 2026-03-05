import { NextRequest } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { decrypt } from '@/lib/crypto';
import { logUsageEvent } from '@/lib/usage';
import { searchKeywords } from '@/lib/seo/ahrefs';
import { filterKeywords, clusterKeywords, toKeywordData } from '@/lib/seo/keywords';
import type { KeywordFilterOptions } from '@/lib/seo/keywords';
import { assignKeywordRoles } from '@/lib/seo/keyword-picker';
import type { Provider } from '@/lib/generation/model-router';

// ---------------------------------------------------------------------------
// Request validation
// ---------------------------------------------------------------------------

const KeywordResearchSchema = z.object({
  seed: z.string().min(1, 'Seed keyword is required'),
  country: z.string().length(2).default('us'),
  topic: z.string().min(1, 'Topic is required'),
  filters: z
    .object({
      minVolume: z.number().int().min(0).optional(),
      maxVolume: z.number().int().min(0).optional(),
      maxDifficulty: z.number().int().min(0).max(100).optional(),
      minCpc: z.number().min(0).optional(),
    })
    .optional(),
  model: z.string().optional(),
  limit: z.number().int().min(1).max(200).optional(),
});

// ---------------------------------------------------------------------------
// Ahrefs API cost estimation
// ---------------------------------------------------------------------------

// Ahrefs charges per API row returned. This is a rough per-call estimate
// based on their standard plan pricing (~$0.01 per row returned).
const AHREFS_COST_PER_CALL_USD = 0.50;

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

    const { seed, country, topic, filters, model, limit } = parsed.data;

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

    // ---- Resolve API keys ----
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

    // Ahrefs key
    const ahrefsKey = resolveKey('ahrefs_api_key', 'AHREFS_API_KEY');
    if (!ahrefsKey) {
      return Response.json(
        { error: 'No Ahrefs API key configured. Add one in Settings.' },
        { status: 400 }
      );
    }

    // AI provider keys (for keyword role assignment)
    const providerKeys: Partial<Record<Provider, string>> = {};
    const anthropicKey = resolveKey('anthropic_api_key', 'ANTHROPIC_API_KEY');
    const openaiKey = resolveKey('openai_api_key', 'OPENAI_API_KEY');
    if (anthropicKey) providerKeys.anthropic = anthropicKey;
    if (openaiKey) providerKeys.openai = openaiKey;

    if (!Object.keys(providerKeys).length) {
      return Response.json(
        { error: 'No AI provider API key configured. Add one in Settings to enable keyword role assignment.' },
        { status: 400 }
      );
    }

    // ---- Step 1: Call Ahrefs API ----
    const ahrefsResults = await searchKeywords(seed, country, ahrefsKey, limit || 50);
    const allKeywords = ahrefsResults.map(toKeywordData);

    // ---- Step 2: Filter ----
    const filterOptions: KeywordFilterOptions = filters || {};
    const filtered = filterKeywords(allKeywords, filterOptions);

    // ---- Step 3: Cluster ----
    const clusters = clusterKeywords(filtered);

    // ---- Step 4: AI role assignment on the filtered set ----
    const { assignments, generation } = await assignKeywordRoles(
      filtered,
      topic,
      providerKeys,
      model
    );

    // ---- Step 5: Log usage ----
    // Log the Ahrefs call
    await logUsageEvent({
      organizationId: orgId,
      userId: user.id,
      eventType: 'kw_research',
      estimatedCostUsd: AHREFS_COST_PER_CALL_USD,
    });

    // Log the AI generation cost for role assignment
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
    // Attach role info to clusters
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

    // Extract the primary and secondary keywords for convenience
    const primary = assignments.find((a) => a.role === 'primary') || null;
    const secondary = assignments.filter((a) => a.role === 'secondary');

    return Response.json({
      seed,
      country,
      topic,
      totalFound: ahrefsResults.length,
      totalAfterFilter: filtered.length,
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

    // Return clean error messages for known error types
    if (error instanceof Error) {
      if (error.name === 'AhrefsApiError') {
        return Response.json(
          { error: `Ahrefs API error: ${error.message}` },
          { status: 502 }
        );
      }
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json(
      { error: 'An unexpected error occurred during keyword research.' },
      { status: 500 }
    );
  }
}
