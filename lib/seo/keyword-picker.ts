// ---------------------------------------------------------------------------
// AI-based Keyword Role Assignment
// ---------------------------------------------------------------------------
//
// Uses Claude/OpenAI (via the sync generation pattern from voice-analysis.ts)
// to assign strategic roles to keywords: primary, secondary, or ignore.
// ---------------------------------------------------------------------------

import { generateWithClaudeSync } from '@/lib/generation/claude';
import { generateWithOpenAISync } from '@/lib/generation/openai';
import { getProvider, type Provider } from '@/lib/generation/model-router';
import type { GenerationResult } from '@/lib/generation/types';
import type { KeywordData } from './keywords';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type KeywordRole = 'primary' | 'secondary' | 'ignore';

export type KeywordAssignment = KeywordData & {
  role: KeywordRole;
  reason?: string;
};

export type KeywordPickerResult = {
  assignments: KeywordAssignment[];
  generation: GenerationResult;
};

// ---------------------------------------------------------------------------
// Sync model router (mirrors voice-analysis.ts pattern)
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
  model?: string;
  providerKeys: Partial<Record<Provider, string>>;
  maxTokens?: number;
}): Promise<GenerationResult> {
  const keys = params.providerKeys;
  const requestedModel = params.model || 'gpt-4o-mini';
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

const SYSTEM_PROMPT = `You are an expert SEO strategist. Your job is to analyze a list of keywords for a given topic and assign each keyword a strategic role.

You MUST respond with a single JSON object — no markdown fences, no explanation before or after. The JSON must be an array of objects following this schema:

[
  {
    "keyword": "<the exact keyword string>",
    "role": "primary" | "secondary" | "ignore",
    "reason": "<1 sentence explaining why>"
  }
]

Rules:
- Assign exactly 1 keyword as "primary". This should be the keyword with the best combination of: relevance to the topic, search volume, reasonable difficulty, and commercial intent.
- Assign 3-5 keywords as "secondary". These should complement the primary keyword, cover related sub-topics, and help the article rank for additional queries.
- All remaining keywords should be "ignore".
- Consider search intent alignment — the primary keyword should match informational or transactional intent that fits article content.
- Prefer keywords where the topic naturally answers the searcher's question.
- Every keyword from the input list MUST appear in the output.`;

function buildUserPrompt(keywords: KeywordData[], topic: string): string {
  const kwList = keywords
    .map(
      (kw) =>
        `- "${kw.keyword}" (vol: ${kw.volume}, KD: ${kw.difficulty}, CPC: $${kw.cpc.toFixed(2)})`
    )
    .join('\n');

  return `Topic: "${topic}"

Keywords to assign roles to:
${kwList}

Respond with the JSON array.`;
}

// ---------------------------------------------------------------------------
// Main function
// ---------------------------------------------------------------------------

/**
 * Use AI to assign strategic roles (primary / secondary / ignore) to keywords.
 *
 * @param keywords - Filtered keyword data to evaluate.
 * @param topic - The article topic for context.
 * @param providerKeys - Resolved API keys per provider.
 * @param model - Optional model override.
 */
export async function assignKeywordRoles(
  keywords: KeywordData[],
  topic: string,
  providerKeys: Partial<Record<Provider, string>>,
  model?: string
): Promise<KeywordPickerResult> {
  if (keywords.length === 0) {
    return { assignments: [], generation: { text: '[]', model: '', inputTokens: 0, outputTokens: 0, costUsd: 0 } };
  }

  // Cap to 30 keywords to keep prompt size reasonable
  const MAX_KEYWORDS = 30;
  const inputKeywords = keywords.slice(0, MAX_KEYWORDS);

  const userPrompt = buildUserPrompt(inputKeywords, topic);

  const result = await generateSync({
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
    model,
    providerKeys,
    maxTokens: 2048,
  });

  const parsed = parseAssignmentResponse(result.text, inputKeywords);

  // Any keywords beyond MAX_KEYWORDS are auto-ignored
  const overflow: KeywordAssignment[] = keywords.slice(MAX_KEYWORDS).map((kw) => ({
    ...kw,
    role: 'ignore' as const,
    reason: 'Not evaluated (overflow)',
  }));

  return {
    assignments: [...parsed, ...overflow],
    generation: result,
  };
}

// ---------------------------------------------------------------------------
// JSON parsing
// ---------------------------------------------------------------------------

type RawAssignment = {
  keyword: string;
  role: string;
  reason?: string;
};

function parseAssignmentResponse(
  text: string,
  inputKeywords: KeywordData[]
): KeywordAssignment[] {
  // Strip markdown fences
  let cleaned = text.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    const jsonMatch = cleaned.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error('Keyword role assignment did not return valid JSON. Please try again.');
    }
    parsed = JSON.parse(jsonMatch[0]);
  }

  if (!Array.isArray(parsed)) {
    throw new Error('Expected a JSON array from keyword assignment.');
  }

  const rawAssignments = parsed as RawAssignment[];

  // Build a lookup from keyword string to its data
  const kwMap = new Map<string, KeywordData>();
  for (const kw of inputKeywords) {
    kwMap.set(kw.keyword.toLowerCase(), kw);
  }

  const assignments: KeywordAssignment[] = [];
  const seen = new Set<string>();

  for (const raw of rawAssignments) {
    if (!raw.keyword) continue;
    const key = raw.keyword.toLowerCase();
    const kwData = kwMap.get(key);
    if (!kwData) continue;

    seen.add(key);

    const role: KeywordRole =
      raw.role === 'primary' || raw.role === 'secondary' || raw.role === 'ignore'
        ? raw.role
        : 'ignore';

    assignments.push({
      ...kwData,
      role,
      reason: raw.reason || undefined,
    });
  }

  // Ensure every input keyword appears in output (assign "ignore" to any missing)
  for (const kw of inputKeywords) {
    if (!seen.has(kw.keyword.toLowerCase())) {
      assignments.push({
        ...kw,
        role: 'ignore',
        reason: 'Not assigned by AI',
      });
    }
  }

  // Validate exactly one primary
  const primaries = assignments.filter((a) => a.role === 'primary');
  if (primaries.length === 0 && assignments.length > 0) {
    // Promote the highest-volume keyword to primary
    const sorted = [...assignments].sort((a, b) => b.volume - a.volume);
    const best = sorted[0];
    const idx = assignments.findIndex(
      (a) => a.keyword.toLowerCase() === best.keyword.toLowerCase()
    );
    if (idx >= 0) {
      assignments[idx].role = 'primary';
      assignments[idx].reason = 'Auto-promoted (highest volume)';
    }
  } else if (primaries.length > 1) {
    // Keep only the first primary, demote others to secondary
    let foundFirst = false;
    for (const a of assignments) {
      if (a.role === 'primary') {
        if (!foundFirst) {
          foundFirst = true;
        } else {
          a.role = 'secondary';
          a.reason = (a.reason || '') + ' (demoted from duplicate primary)';
        }
      }
    }
  }

  return assignments;
}
