import { NextRequest } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { assemblePrompt } from '@/lib/generation/prompt';
import { routeToModel, getProvider } from '@/lib/generation/model-router';
import type { Provider } from '@/lib/generation/model-router';
import { generatorToStream } from '@/lib/generation/stream';
import { logUsageEvent } from '@/lib/usage';
import { decrypt } from '@/lib/crypto';
import type { GenerationResult } from '@/lib/generation/types';
import { enforceWordCount } from '@/lib/generation/word-count-enforcer';

const GenerateSchema = z.object({
  websiteId: z.string().uuid(),
  personaId: z.string().uuid(),
  topic: z.string().min(1, 'Topic is required'),
  format: z.string().min(1, 'Format is required'),
  targetLength: z.number().int().min(100).max(10000),
  model: z.string().optional(),
  notes: z.string().optional(),
  primaryKeyword: z.string().optional(),
  secondaryKeywords: z.array(z.string()).optional(),
  readabilityTarget: z.number().int().min(20).max(80).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Auth check
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse and validate body
    const body = await request.json();
    const parsed = GenerateSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: parsed.error.issues.map(i => i.message).join(', ') },
        { status: 400 }
      );
    }

    const { websiteId, personaId, topic, format, targetLength, model: requestedModel, notes, primaryKeyword, secondaryKeywords, readabilityTarget } = parsed.data;

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

    // Fetch website (org-scoped)
    const { data: website } = await supabase
      .from('websites')
      .select('*')
      .eq('id', websiteId)
      .eq('organization_id', orgId)
      .single();

    if (!website) {
      return Response.json({ error: 'Website not found' }, { status: 404 });
    }

    // Fetch persona (org-scoped)
    const { data: persona } = await supabase
      .from('personas')
      .select('*')
      .eq('id', personaId)
      .eq('organization_id', orgId)
      .single();

    if (!persona) {
      return Response.json({ error: 'Persona not found' }, { status: 404 });
    }

    // Fetch org editorial guidelines
    const { data: orgRow } = await supabase
      .from('organizations')
      .select('editorial_pov, editorial_person_rules, editorial_commercial_tone, editorial_dos, editorial_donts, editorial_custom_rules')
      .eq('id', orgId)
      .single();

    // Fetch content index for internal linking
    const { data: contentIndexRaw } = await supabase
      .from('website_content_index')
      .select('id, post_title, post_url, post_excerpt')
      .eq('website_id', websiteId)
      .limit(30);

    const contentIndex = (contentIndexRaw ?? []).map((entry: { id: string; post_title: string; post_url: string; post_excerpt: string | null }) => ({
      id: entry.id,
      post_title: entry.post_title,
      post_url: entry.post_url,
      post_excerpt: entry.post_excerpt ?? undefined,
    }));

    // Assemble prompt
    const { systemPrompt, userPrompt } = assemblePrompt({
      organization: orgRow ? {
        editorial_pov: orgRow.editorial_pov,
        editorial_person_rules: orgRow.editorial_person_rules,
        editorial_commercial_tone: orgRow.editorial_commercial_tone,
        editorial_dos: orgRow.editorial_dos,
        editorial_donts: orgRow.editorial_donts,
        editorial_custom_rules: orgRow.editorial_custom_rules,
      } : undefined,
      website: {
        name: website.name,
        url: website.url,
        site_description: website.site_description,
        tone_guardrails: website.tone_guardrails,
        banned_topics: website.banned_topics,
        banned_words: website.banned_words,
        required_elements: website.required_elements,
        content_pillars: website.content_pillars,
      },
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
        // Rich voice fields
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
      contentIndex,
      brief: {
        topic,
        format,
        targetLength,
        notes,
        primaryKeyword,
        secondaryKeywords,
        readabilityTarget,
      },
    });

    // Resolve all available API keys: org-stored (encrypted) → env var fallback
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

    // Resolve the API key that will actually be used (for revision pass)
    const actualProvider = getProvider(requestedModel || 'claude-sonnet-4-20250514');
    const actualApiKey = providerKeys[actualProvider] || Object.values(providerKeys)[0] || '';

    // Start generation — router handles fallback if selected model's provider has no key
    const generator = routeToModel({
      systemPrompt,
      userPrompt,
      model: requestedModel,
      providerKeys,
      targetWordCount: targetLength,
    });

    // Create streaming response
    const stream = generatorToStream(generator, async (result: GenerationResult) => {
      // After streaming completes, enforce word count and save article
      try {
        // Word count enforcement — revision pass if >10% off target
        const enforced = await enforceWordCount({
          result,
          targetWordCount: targetLength,
          apiKey: actualApiKey,
          model: result.model,
        });

        // Parse meta block from model output, then strip it from the article body
        let articleBody = enforced.text;
        let metaTitle = '';
        let metaDescription = '';

        const metaBlockMatch = articleBody.match(/<!--META[\s\S]*?TITLE:\s*(.*?)[\r\n]+\s*DESCRIPTION:\s*(.*?)[\r\n]+\s*META-->/);
        if (metaBlockMatch) {
          metaTitle = metaBlockMatch[1].trim();
          metaDescription = metaBlockMatch[2].trim();
          // Strip the meta block from article body
          articleBody = articleBody.replace(metaBlockMatch[0], '').trim();
        }

        const titleMatch = articleBody.match(/<h2[^>]*>(.*?)<\/h2>/i);
        const title = titleMatch ? titleMatch[1].replace(/<[^>]*>/g, '') : topic;
        const wordCount = articleBody.replace(/<[^>]*>/g, ' ').split(/\s+/).filter(Boolean).length;

        // Fallback meta generation if model didn't output the meta block
        if (!metaTitle) {
          metaTitle = title;
          if (primaryKeyword && !metaTitle.toLowerCase().includes(primaryKeyword.toLowerCase())) {
            metaTitle = `${primaryKeyword.charAt(0).toUpperCase() + primaryKeyword.slice(1)} — ${title}`;
          }
          if (metaTitle.length > 60) {
            metaTitle = metaTitle.slice(0, 57) + '...';
          }
        }

        if (!metaDescription) {
          const pMatch = articleBody.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
          if (pMatch) {
            metaDescription = pMatch[1].replace(/<[^>]*>/g, '').trim();
          }
          if (!metaDescription) {
            metaDescription = articleBody.replace(/<[^>]*>/g, ' ').trim().slice(0, 300);
          }
          if (primaryKeyword && !metaDescription.toLowerCase().includes(primaryKeyword.toLowerCase())) {
            metaDescription = `${primaryKeyword.charAt(0).toUpperCase() + primaryKeyword.slice(1)}: ${metaDescription}`;
          }
          if (metaDescription.length > 155) {
            metaDescription = metaDescription.slice(0, 152).trimEnd() + '...';
          }
        }

        const { data: article } = await supabase
          .from('articles')
          .insert({
            organization_id: orgId,
            title,
            body: articleBody,
            persona_id: personaId,
            website_id: websiteId,
            format,
            word_count: wordCount,
            primary_keyword: primaryKeyword || null,
            secondary_keywords: secondaryKeywords || [],
            model_used: enforced.model,
            prompt_snapshot: JSON.stringify({ systemPrompt, userPrompt }),
            readability_target: readabilityTarget || 50,
            status: 'draft',
            created_by: user.id,
            meta_title: metaTitle,
            meta_description: metaDescription,
          })
          .select('id')
          .single();

        await logUsageEvent({
          organizationId: orgId,
          userId: user.id,
          articleId: article?.id,
          eventType: 'generation',
          modelUsed: enforced.model,
          estimatedCostUsd: enforced.costUsd,
        });

        // Increment persona usage count for this website
        try {
          await supabase.rpc('increment_persona_usage', {
            p_persona_id: personaId,
            p_website_id: websiteId,
          });
        } catch {
          // Fallback: upsert manually if RPC doesn't exist
          await supabase
            .from('persona_website_assignments')
            .upsert(
              { persona_id: personaId, website_id: websiteId, usage_count: 1 },
              { onConflict: 'persona_id,website_id' }
            );
        }
      } catch (error) {
        console.error('Failed to save article after generation:', error);
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
    console.error('Generation error:', error);
    return Response.json(
      { error: 'An unexpected error occurred during generation.' },
      { status: 500 }
    );
  }
}
