import { generateWithClaude } from './claude';
import { generateWithOpenAI } from './openai';
import { generateWithGemini } from './gemini';
import type { GenerationRequest, GenerationResult } from './types';

export type Provider = 'anthropic' | 'openai' | 'gemini';

export type RouterParams = GenerationRequest & {
  /** Resolved API keys per provider, passed from the route handler */
  providerKeys?: Partial<Record<Provider, string>>;
  /** Target word count for max_tokens calibration */
  targetWordCount?: number;
};

/** All models we expose in the UI, grouped by provider */
export const AVAILABLE_MODELS = [
  { id: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4', provider: 'anthropic' as Provider },
  { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5', provider: 'anthropic' as Provider },
  { id: 'gpt-4o', label: 'GPT-4o', provider: 'openai' as Provider },
  { id: 'gpt-4o-mini', label: 'GPT-4o Mini', provider: 'openai' as Provider },
  { id: 'gpt-4.1', label: 'GPT-4.1', provider: 'openai' as Provider },
  { id: 'gpt-4.1-mini', label: 'GPT-4.1 Mini', provider: 'openai' as Provider },
  // Google Gemini
  { id: 'gemini-2.5-pro-preview-06-05', label: 'Gemini 2.5 Pro', provider: 'gemini' as Provider },
  { id: 'gemini-2.5-flash-preview-05-20', label: 'Gemini 2.5 Flash', provider: 'gemini' as Provider },
  { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash', provider: 'gemini' as Provider },
] as const;

export function getProvider(model: string): Provider {
  if (model.startsWith('claude')) return 'anthropic';
  if (model.startsWith('gpt')) return 'openai';
  if (model.startsWith('gemini')) return 'gemini';
  return 'anthropic';
}

/** Fallback order: if the chosen provider's key is missing, try the next one */
const FALLBACK_ORDER: Provider[] = ['anthropic', 'openai', 'gemini'];
const FALLBACK_MODELS: Record<Provider, string> = {
  anthropic: 'claude-sonnet-4-20250514',
  openai: 'gpt-4o',
  gemini: 'gemini-2.0-flash',
};

/**
 * Routes generation to the correct provider.
 * If the selected model's provider has no API key, falls back to the next available provider.
 */
export async function* routeToModel(
  params: RouterParams
): AsyncGenerator<string, GenerationResult> {
  const keys = params.providerKeys || {};
  const requestedModel = params.model || 'claude-sonnet-4-20250514';
  const requestedProvider = getProvider(requestedModel);

  // Find a provider that has a key, preferring the requested one
  let model = requestedModel;
  let apiKey = keys[requestedProvider];

  if (!apiKey) {
    // Fallback: find first provider with a key
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
  const genParams = { ...params, model, apiKey, targetWordCount: params.targetWordCount };

  switch (provider) {
    case 'openai':
      return yield* generateWithOpenAI(genParams);
    case 'gemini':
      return yield* generateWithGemini(genParams);
    case 'anthropic':
    default:
      return yield* generateWithClaude(genParams);
  }
}
