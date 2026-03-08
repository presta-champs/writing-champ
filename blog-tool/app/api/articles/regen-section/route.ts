import { NextRequest } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { buildSectionRegenPrompt } from '@/lib/generation/section-regen';
import type { SectionRegenNudge } from '@/lib/generation/section-regen';
import { routeToModel } from '@/lib/generation/model-router';
import type { Provider } from '@/lib/generation/model-router';
import { logUsageEvent } from '@/lib/usage';
import { decrypt } from '@/lib/crypto';

// ---------------------------------------------------------------------------
// Request validation
// ---------------------------------------------------------------------------

const VALID_NUDGES: SectionRegenNudge[] = [
  'shorter', 'longer', 'more formal', 'more casual', 'simpler', 'more detailed',
];

const RegenSectionSchema = z.object({
  articleId: z.string().uuid('Invalid article ID'),
  sectionHtml: z.string().min(1, 'Section HTML is required'),
  nudge: z.enum(VALID_NUDGES as [SectionRegenNudge, ...SectionRegenNudge[]]).optional(),
  model: z.string().optional(),
});

// ---------------------------------------------------------------------------
// POST /api/articles/regen-section
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
    const parsed = RegenSectionSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        { error: parsed.error.issues.map((i) => i.message).join(', ') },
        { status: 400 }
      );
    }

    const { articleId, sectionHtml, nudge, model: requestedModel } = parsed.data;

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

    // ---- Fetch article with persona and website joins (org-scoped) ----
    const { data: article } = await supabase
      .from('articles')
      .select(`
        id, body, primary_keyword, organization_id,
        persona:personas!articles_persona_id_fkey(
          id, name, bio, tone_formal, tone_warmth, tone_conciseness, tone_humor,
          quirks, forbidden_words, signature_phrases, voice_summary,
          voice_principles, sentence_rules_do, sentence_rules_dont,
          structural_patterns, recurring_themes, example_passages,
          system_prompt_override, methodology, tone_authority
        ),
        website:websites!articles_website_id_fkey(
          id, name, url, site_description, tone_guardrails, banned_topics, banned_words
        )
      `)
      .eq('id', articleId)
      .eq('organization_id', orgId)
      .single();

    if (!article) {
      return Response.json({ error: 'Article not found' }, { status: 404 });
    }

    if (!article.body) {
      return Response.json({ error: 'Article has no content to regenerate from' }, { status: 400 });
    }

    // Supabase returns joined relations as objects (single) or arrays
    const persona = Array.isArray(article.persona) ? article.persona[0] : article.persona;
    const website = Array.isArray(article.website) ? article.website[0] : article.website;

    if (!persona) {
      return Response.json({ error: 'Article persona not found' }, { status: 404 });
    }

    // ---- Fetch org editorial settings + API keys in one query ----
    const { data: orgData } = await supabase
      .from('organizations')
      .select(
        'api_integration_keys, editorial_pov, editorial_person_rules, ' +
        'editorial_commercial_tone, editorial_dos, editorial_donts, editorial_custom_rules'
      )
      .eq('id', orgId)
      .single();

    // ---- Resolve AI provider keys ----
    const orgRecord = orgData as Record<string, unknown> | null;
    const storedKeys: Record<string, string> = (orgRecord?.api_integration_keys as Record<string, string>) || {};

    function resolveKey(dbKey: string, envVar: string): string | undefined {
      if (storedKeys[dbKey]) {
        try {
          return decrypt(storedKeys[dbKey]);
        } catch {
          /* fall through to env var */
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
        { error: 'No AI provider API key configured. Add one in Settings.' },
        { status: 400 }
      );
    }

    // ---- Build prompts ----
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
      },
      organization: orgRecord
        ? {
            editorial_pov: orgRecord.editorial_pov as 'first_person' | 'second_person' | 'third_person' | null | undefined,
            editorial_person_rules: orgRecord.editorial_person_rules as string | undefined,
            editorial_commercial_tone: orgRecord.editorial_commercial_tone as string | undefined,
            editorial_dos: orgRecord.editorial_dos as string[] | undefined,
            editorial_donts: orgRecord.editorial_donts as string[] | undefined,
            editorial_custom_rules: orgRecord.editorial_custom_rules as string | undefined,
          }
        : undefined,
      website: website
        ? {
            name: website.name,
            url: website.url,
            site_description: website.site_description,
            tone_guardrails: website.tone_guardrails,
            banned_topics: website.banned_topics,
            banned_words: website.banned_words,
          }
        : undefined,
      nudge,
      primaryKeyword: article.primary_keyword ?? undefined,
    });

    // ---- Generate via model router (collect full result) ----
    const generator = routeToModel({
      systemPrompt,
      userPrompt,
      model: requestedModel,
      providerKeys,
    });

    let resultText = '';
    let genResult;
    while (true) {
      const { value, done } = await generator.next();
      if (done) {
        genResult = value;
        break;
      }
      resultText += value;
    }

    if (!genResult) {
      return Response.json(
        { error: 'Generation completed without a result.' },
        { status: 500 }
      );
    }

    // ---- Log usage ----
    await logUsageEvent({
      organizationId: orgId,
      userId: user.id,
      articleId: article.id,
      eventType: 'generation',
      modelUsed: genResult.model,
      estimatedCostUsd: genResult.costUsd,
    });

    // ---- Return result ----
    return Response.json({
      html: genResult.text || resultText,
      model: genResult.model,
      costUsd: genResult.costUsd,
    });
  } catch (error) {
    console.error('Section regeneration error:', error);
    return Response.json(
      { error: 'An unexpected error occurred during section regeneration.' },
      { status: 500 }
    );
  }
}
