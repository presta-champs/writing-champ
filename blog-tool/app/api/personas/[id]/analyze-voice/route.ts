import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { decrypt } from '@/lib/crypto';
import { analyzeVoice } from '@/lib/persona/voice-analysis';
import { logUsageEvent } from '@/lib/usage';
import type { Provider } from '@/lib/generation/model-router';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: personaId } = await params;
    const supabase = await createClient();

    // -----------------------------------------------------------------------
    // Auth
    // -----------------------------------------------------------------------
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // -----------------------------------------------------------------------
    // Org membership
    // -----------------------------------------------------------------------
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

    // -----------------------------------------------------------------------
    // Fetch persona (org-scoped)
    // -----------------------------------------------------------------------
    const { data: persona, error: personaError } = await supabase
      .from('personas')
      .select('id, name, organization_id')
      .eq('id', personaId)
      .eq('organization_id', orgId)
      .single();

    if (personaError || !persona) {
      return Response.json({ error: 'Persona not found' }, { status: 404 });
    }

    // -----------------------------------------------------------------------
    // Fetch writing samples
    // -----------------------------------------------------------------------
    const { data: samples, error: samplesError } = await supabase
      .from('persona_writing_samples')
      .select('extracted_text')
      .eq('persona_id', personaId)
      .not('extracted_text', 'is', null);

    if (samplesError) {
      return Response.json(
        { error: 'Failed to fetch writing samples' },
        { status: 500 }
      );
    }

    const sampleTexts = (samples || [])
      .map((s) => s.extracted_text)
      .filter((t): t is string => typeof t === 'string' && t.trim().length > 0);

    if (sampleTexts.length === 0) {
      return Response.json(
        { error: 'No writing samples with extracted text found. Upload samples first.' },
        { status: 400 }
      );
    }

    // -----------------------------------------------------------------------
    // Resolve API keys (same pattern as app/api/generate/route.ts)
    // -----------------------------------------------------------------------
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
        { error: 'No API key configured for any AI provider. Add one in Settings.' },
        { status: 400 }
      );
    }

    // -----------------------------------------------------------------------
    // Optional: allow caller to request a specific model
    // -----------------------------------------------------------------------
    let requestedModel: string | undefined;
    try {
      const body = await request.json();
      requestedModel = body?.model;
    } catch {
      // No body or invalid JSON — that's fine, we'll use default
    }

    // -----------------------------------------------------------------------
    // Run voice analysis
    // -----------------------------------------------------------------------
    const { analysis, generation } = await analyzeVoice(
      sampleTexts,
      providerKeys,
      requestedModel
    );

    // -----------------------------------------------------------------------
    // Update persona with analysis results
    // -----------------------------------------------------------------------
    const { data: updatedPersona, error: updateError } = await supabase
      .from('personas')
      .update({
        voice_summary: analysis.voice_summary,
        voice_principles: analysis.voice_principles,
        sentence_rules_do: analysis.sentence_rules_do,
        sentence_rules_dont: analysis.sentence_rules_dont,
        recurring_themes: analysis.recurring_themes,
        tone_formal: analysis.tone_formal,
        tone_warmth: analysis.tone_warmth,
        tone_conciseness: analysis.tone_conciseness,
        tone_humor: analysis.tone_humor,
      })
      .eq('id', personaId)
      .eq('organization_id', orgId)
      .select('*')
      .single();

    if (updateError) {
      console.error('Failed to update persona with voice analysis:', updateError);
      return Response.json(
        { error: 'Voice analysis succeeded but failed to save results.' },
        { status: 500 }
      );
    }

    // -----------------------------------------------------------------------
    // Log usage
    // -----------------------------------------------------------------------
    await logUsageEvent({
      organizationId: orgId,
      userId: user.id,
      eventType: 'voice_analysis',
      modelUsed: generation.model,
      estimatedCostUsd: generation.costUsd,
    });

    // -----------------------------------------------------------------------
    // Response
    // -----------------------------------------------------------------------
    return Response.json({
      persona: updatedPersona,
      analysis,
      usage: {
        model: generation.model,
        inputTokens: generation.inputTokens,
        outputTokens: generation.outputTokens,
        costUsd: generation.costUsd,
      },
    });
  } catch (error) {
    console.error('Voice analysis error:', error);
    return Response.json(
      { error: 'Voice analysis failed. Please try again.' },
      { status: 500 }
    );
  }
}
