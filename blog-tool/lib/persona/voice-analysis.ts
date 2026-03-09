import { generateWithClaudeSync } from '@/lib/generation/claude';
import { generateWithOpenAISync } from '@/lib/generation/openai';
import { getProvider, type Provider } from '@/lib/generation/model-router';
import type { GenerationResult } from '@/lib/generation/types';
import type { VoicePrinciple } from '@/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type VoiceAnalysisResult = {
  voice_summary: string;
  voice_principles: VoicePrinciple[];
  sentence_rules_do: string[];
  sentence_rules_dont: string[];
  recurring_themes: string[];
  tone_formal: number;
  tone_warmth: number;
  tone_conciseness: number;
  tone_humor: number;
};

export type VoiceAnalysisResponse = {
  analysis: VoiceAnalysisResult;
  generation: GenerationResult;
};

// ---------------------------------------------------------------------------
// Sync model router (non-streaming, for short tasks)
// ---------------------------------------------------------------------------

const FALLBACK_ORDER: Provider[] = ['anthropic', 'openai'];
const FALLBACK_MODELS: Record<Provider, string> = {
  anthropic: 'claude-sonnet-4-20250514',
  openai: 'gpt-4o',
  gemini: 'gemini-pro',
};

async function generateSync(params: {
  systemPrompt: string;
  userPrompt: string;
  model?: string;
  providerKeys: Partial<Record<Provider, string>>;
  maxTokens?: number;
}): Promise<GenerationResult> {
  const keys = params.providerKeys;
  const requestedModel = params.model || 'claude-sonnet-4-20250514';
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
    throw new Error('No API key configured for any AI provider. Add one in Settings.');
  }

  const provider = getProvider(model);
  const genParams = {
    systemPrompt: params.systemPrompt,
    userPrompt: params.userPrompt,
    model,
    apiKey,
    maxTokens: params.maxTokens || 4096,
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
// Voice analysis prompt
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are an expert writing-style analyst. Your job is to deeply analyze writing samples and produce a precise, actionable voice profile.

You MUST respond with a single JSON object — no markdown fences, no explanation before or after. The JSON must strictly follow this schema:

{
  "voice_summary": "<string: 2-3 paragraph plain-English summary of the writer's voice, style, rhythm, and personality>",
  "voice_principles": [
    { "title": "<short label>", "description": "<1-2 sentence explanation>" }
  ],
  "sentence_rules_do": ["<things this writer consistently does>"],
  "sentence_rules_dont": ["<things this writer consistently avoids>"],
  "recurring_themes": ["<topics, motifs, or ideas that recur across samples>"],
  "tone_formal": <number 0-100, where 0 is very casual and 100 is very formal>,
  "tone_warmth": <number 0-100, where 0 is cold/detached and 100 is very warm/empathetic>,
  "tone_conciseness": <number 0-100, where 0 is verbose and 100 is extremely concise>,
  "tone_humor": <number 0-100, where 0 is serious and 100 is very humorous>
}

Guidelines for analysis:
- voice_principles should have 4-8 items, each capturing a distinct aspect of the voice
- sentence_rules_do and sentence_rules_dont should each have 4-8 items
- recurring_themes should have 3-6 items
- The voice_summary should be specific enough that another writer could imitate this voice
- Tone scores should reflect the actual writing, not aspirational values
- Look for: sentence length patterns, vocabulary level, use of metaphors, paragraph structure, how they open and close pieces, rhetorical devices, punctuation habits, personal pronouns, narrative perspective`;

function buildUserPrompt(samples: string[]): string {
  const combined = samples
    .map((s, i) => `--- WRITING SAMPLE ${i + 1} ---\n${s}`)
    .join('\n\n');

  return `Analyze the following writing samples and produce the voice profile JSON.\n\n${combined}`;
}

// ---------------------------------------------------------------------------
// Main function
// ---------------------------------------------------------------------------

/**
 * Analyze writing samples and return a structured voice profile.
 *
 * @param samples Array of extracted text from writing samples.
 * @param providerKeys Resolved API keys per provider (from org DB keys + env fallback).
 * @param model Optional model override.
 */
export async function analyzeVoice(
  samples: string[],
  providerKeys: Partial<Record<Provider, string>>,
  model?: string
): Promise<VoiceAnalysisResponse> {
  if (!samples.length) {
    throw new Error('At least one writing sample is required for voice analysis.');
  }

  // Truncate excessively long samples to stay within context limits.
  // ~4000 chars per sample keeps total prompt well under 128k tokens.
  const MAX_CHARS_PER_SAMPLE = 4000;
  const MAX_SAMPLES = 10;
  const trimmedSamples = samples.slice(0, MAX_SAMPLES).map((s) =>
    s.length > MAX_CHARS_PER_SAMPLE ? s.slice(0, MAX_CHARS_PER_SAMPLE) + '\n[...truncated]' : s
  );

  const userPrompt = buildUserPrompt(trimmedSamples);

  const result = await generateSync({
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
    model,
    providerKeys,
    maxTokens: 4096,
  });

  const analysis = parseAnalysisResponse(result.text);

  return { analysis, generation: result };
}

// ---------------------------------------------------------------------------
// JSON parsing with resilience
// ---------------------------------------------------------------------------

function parseAnalysisResponse(text: string): VoiceAnalysisResult {
  // Strip markdown code fences if the model adds them despite instructions
  let cleaned = text.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    // Try to extract JSON from surrounding text
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Voice analysis did not return valid JSON. Please try again.');
    }
    parsed = JSON.parse(jsonMatch[0]);
  }

  const obj = parsed as Record<string, unknown>;

  // Validate and coerce fields with sensible defaults
  return {
    voice_summary: ensureString(obj.voice_summary, 'No voice summary generated.'),
    voice_principles: ensureArrayOf<VoicePrinciple>(
      obj.voice_principles,
      (item) =>
        typeof item === 'object' &&
        item !== null &&
        typeof (item as VoicePrinciple).title === 'string' &&
        typeof (item as VoicePrinciple).description === 'string'
    ),
    sentence_rules_do: ensureStringArray(obj.sentence_rules_do),
    sentence_rules_dont: ensureStringArray(obj.sentence_rules_dont),
    recurring_themes: ensureStringArray(obj.recurring_themes),
    tone_formal: clampNumber(obj.tone_formal, 50),
    tone_warmth: clampNumber(obj.tone_warmth, 50),
    tone_conciseness: clampNumber(obj.tone_conciseness, 50),
    tone_humor: clampNumber(obj.tone_humor, 50),
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ensureString(val: unknown, fallback: string): string {
  return typeof val === 'string' && val.length > 0 ? val : fallback;
}

function ensureStringArray(val: unknown): string[] {
  if (!Array.isArray(val)) return [];
  return val.filter((item): item is string => typeof item === 'string' && item.length > 0);
}

function ensureArrayOf<T>(val: unknown, guard: (item: unknown) => boolean): T[] {
  if (!Array.isArray(val)) return [];
  return val.filter(guard) as T[];
}

function clampNumber(val: unknown, fallback: number): number {
  if (typeof val === 'number' && !Number.isNaN(val)) {
    return Math.max(0, Math.min(100, Math.round(val)));
  }
  return fallback;
}
