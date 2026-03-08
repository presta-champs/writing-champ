import { NextRequest } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { buildSectionRegenPrompt } from '@/lib/generation/section-regen';
import type { SectionRegenNudge } from '@/lib/generation/section-regen';
import { routeToModel, getProvider } from '@/lib/generation/model-router';
import type { Provider } from '@/lib/generation/model-router';
import { generatorToStream } from '@/lib/generation/stream';
import { logUsageEvent } from '@/lib/usage';
import { decrypt } from '@/lib/crypto';
import type { GenerationResult } from '@/lib/generation/types';

const VALID_NUDGES: SectionRegenNudge[] = [
  'shorter', 'longer', 'more formal', 'more casual', 'simpler', 'more detailed',
];

const RegenSectionSchema = z.object({
  sectionHtml: z.string().min(1, 'Section HTML is required'),
  nudge: z.enum(VALID_NUDGES as [SectionRegenNudge, ...SectionRegenNudge[]]).optional(),
  model: z.string().optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: articleId } = await params;
    const supabase = await createClient();

    // Auth check
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse body
    const body = await request.json();
    const parsed = RegenSectionSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: parsed.error.issues.map(i => i.message).join(', ') },
        { status: 400 }
      );
    }

    const { sectionHtml, nudge, model: requestedModel } = parsed.data;

    // Get user's org
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

    // Fetch article (org-scoped)
    const { data: article } = await supabase
      .from('articles')
      .select('id, body, primary_keyword, persona_id, website_id')
      .eq('id', articleId)
      .eq('organization_id', orgId)
      .single();

    if (!article) {
      return Response.json({ error: 'Article not found' }, { status: 404 });
    }

    if (!article.body) {
      return Response.json({ error: 'Article has no content' }, { status: 400 });
    }

    // Fetch persona
    const { data: persona } = await supabase
      .from('personas')
      .select('*')
      .eq('id', article.persona_id)
      .eq('organization_id', orgId)
      .single();

    if (!persona) {
      return Response.json({ error: 'Persona not found' }, { status: 404 });
    }

    // Fetch website
    const { data: website } = await supabase
      .from('websites')
      .select('*')
      .eq('id', article.website_id)
      .eq('organization_id', orgId)
      .single();

    // Fetch org editorial guidelines
    const { data: orgRow } = await supabase
      .from('organizations')
      .select('editorial_pov, editorial_person_rules, editorial_commercial_tone, editorial_dos, editorial_donts, editorial_custom_rules')
      .eq('id', orgId)
      .single();

    // Build section regeneration prompt
    const { systemPrompt, userPrompt } = buildSectionRegenPrompt({
      fullArticleHtml: article.body,
      sectionHtml,
      persona: {
        name: persona.name,
        bio: persona.bio,
        tone_formal: persona.tone_formal,
        tone_warmth: persona.tone_warmth,
        tone_conciseness: persona.tone_conciseness,
        tone_humor: persona.tone_humor,
        quirks: persona.quirks,
        forbidden_words: persona.forbidden_words,
        signature_phrases: persona.signature_phrases,
        voice_summary: persona.voice_summary,
        voice_principles: persona.voice_principles,
        sentence_rules_do: persona.sentence_rules_do,
        sentence_rules_dont: persona.sentence_rules_dont,
        structural_patterns: persona.structural_patterns,
        recurring_themes: persona.recurring_themes,
        example_passages: persona.example_passages,
        system_prompt_override: persona.system_prompt_override,
        methodology: persona.methodology,
        tone_authority: persona.tone_authority,
        tone_brand_loyalty: persona.tone_brand_loyalty,
        seo_heading_style: persona.seo_heading_style,
        seo_meta_tone: persona.seo_meta_tone,
        seo_article_length_min: persona.seo_article_length_min,
        seo_article_length_max: persona.seo_article_length_max,
        seo_keyword_density: persona.seo_keyword_density,
        seo_include_faq: persona.seo_include_faq,
        seo_include_toc: persona.seo_include_toc,
        seo_internal_linking: persona.seo_internal_links,
        seo_external_linking: persona.seo_outbound_links,
      },
      organization: orgRow ? {
        editorial_pov: orgRow.editorial_pov,
        editorial_person_rules: orgRow.editorial_person_rules,
        editorial_commercial_tone: orgRow.editorial_commercial_tone,
        editorial_dos: orgRow.editorial_dos,
        editorial_donts: orgRow.editorial_donts,
        editorial_custom_rules: orgRow.editorial_custom_rules,
      } : undefined,
      website: website ? {
        name: website.name,
        url: website.url,
        site_description: website.site_description,
        tone_guardrails: website.tone_guardrails,
        banned_topics: website.banned_topics,
        banned_words: website.banned_words,
        required_elements: website.required_elements,
        content_pillars: website.content_pillars,
      } : undefined,
      nudge,
      primaryKeyword: article.primary_keyword ?? undefined,
    });

    // Resolve API keys (same pattern as generate route)
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
    const anthropicKey = resolveKey('anthropic_api_key', 'ANTHROPIC_API_KEY');
    const openaiKey = resolveKey('openai_api_key', 'OPENAI_API_KEY');
    const geminiKey = resolveKey('google_ai_api_key', 'GOOGLE_AI_API_KEY');
    if (anthropicKey) providerKeys.anthropic = anthropicKey;
    if (openaiKey) providerKeys.openai = openaiKey;
    if (geminiKey) providerKeys.gemini = geminiKey;

    if (!Object.keys(providerKeys).length) {
      return Response.json(
        { error: 'No API key configured for any AI provider. Add one in Settings.' },
        { status: 400 }
      );
    }

    // Route to model with streaming
    const generator = routeToModel({
      systemPrompt,
      userPrompt,
      model: requestedModel,
      providerKeys,
    });

    const stream = generatorToStream(generator, async (result: GenerationResult) => {
      // Log usage after streaming completes
      try {
        await logUsageEvent({
          organizationId: orgId,
          userId: user.id,
          articleId: article.id,
          eventType: 'generation',
          modelUsed: result.model,
          estimatedCostUsd: result.costUsd,
        });
      } catch (error) {
        console.error('Failed to log section regen usage:', error);
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Transfer-Encoding': 'chunked',
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error) {
    console.error('Section regeneration error:', error);
    return Response.json(
      { error: 'An unexpected error occurred during section regeneration.' },
      { status: 500 }
    );
  }
}
