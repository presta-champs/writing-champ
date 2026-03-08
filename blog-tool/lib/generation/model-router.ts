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
  { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', provider: 'gemini' as Provider },
  { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', provider: 'gemini' as Provider },
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

/** Check if an error is transient (worth retrying same provider) */
function isTransientError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  return (
    msg.includes('rate limit') ||
    msg.includes('429') ||
    msg.includes('timeout') ||
    msg.includes('econnreset') ||
    msg.includes('socket hang up') ||
    msg.includes('503') ||
    msg.includes('overloaded')
  );
}

/** Call the correct provider's generator */
function callProvider(
  provider: Provider,
  genParams: GenerationRequest & { model: string; apiKey: string; targetWordCount?: number }
): AsyncGenerator<string, GenerationResult> {
  switch (provider) {
    case 'openai':
      return generateWithOpenAI(genParams);
    case 'gemini':
      return generateWithGemini(genParams);
    case 'anthropic':
    default:
      return generateWithClaude(genParams);
  }
}

/**
 * Build ordered list of (provider, model, apiKey) to try.
 * Starts with the requested provider, then falls back to others that have keys.
 */
function buildProviderQueue(
  requestedModel: string,
  keys: Partial<Record<Provider, string>>
): { provider: Provider; model: string; apiKey: string }[] {
  const requestedProvider = getProvider(requestedModel);
  const queue: { provider: Provider; model: string; apiKey: string }[] = [];

  // Requested provider first
  if (keys[requestedProvider]) {
    queue.push({ provider: requestedProvider, model: requestedModel, apiKey: keys[requestedProvider]! });
  }

  // Then fallbacks in order
  for (const fallback of FALLBACK_ORDER) {
    if (fallback !== requestedProvider && keys[fallback]) {
      queue.push({ provider: fallback, model: FALLBACK_MODELS[fallback], apiKey: keys[fallback]! });
    }
  }

  return queue;
}

const MAX_RETRIES_SAME_PROVIDER = 1;

/**
 * Routes generation to the correct provider.
 * - If the selected model's provider has no API key, falls back to the next available provider.
 * - On transient errors (rate limit, timeout), retries once on the same provider.
 * - On persistent errors, fails over to the next available provider.
 */
export async function* routeToModel(
  params: RouterParams
): AsyncGenerator<string, GenerationResult> {
  const keys = params.providerKeys || {};
  const requestedModel = params.model || 'claude-sonnet-4-20250514';

  const queue = buildProviderQueue(requestedModel, keys);

  if (queue.length === 0) {
    throw new Error('No API key configured for any AI provider. Add one in Settings.');
  }

  const errors: string[] = [];

  for (const { provider, model, apiKey } of queue) {
    const genParams = { ...params, model, apiKey, targetWordCount: params.targetWordCount };

    for (let attempt = 0; attempt <= MAX_RETRIES_SAME_PROVIDER; attempt++) {
      try {
        return yield* callProvider(provider, genParams);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`${provider}/${model}: ${msg}`);

        if (isTransientError(err) && attempt < MAX_RETRIES_SAME_PROVIDER) {
          // Wait briefly before retry
          await new Promise((r) => setTimeout(r, 2000));
          continue;
        }
        // Persistent error or retry exhausted — try next provider
        break;
      }
    }
  }

  throw new Error(
    `All providers failed:\n${errors.map((e) => `  - ${e}`).join('\n')}`
  );
}
