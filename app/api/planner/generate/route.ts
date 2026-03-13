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
    .select('id, name, url, site_description')
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
      websiteDescription: website.site_description,
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
