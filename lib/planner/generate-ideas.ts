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
