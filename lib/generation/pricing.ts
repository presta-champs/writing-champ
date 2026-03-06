/**
 * Shared pricing data — used both server-side (cost-estimator.ts) and client-side.
 * Keep this in sync with cost-estimator.ts PRICING table.
 */

export type ModelPricing = {
  inputPerMillion: number;
  outputPerMillion: number;
};

export const MODEL_PRICING: Record<string, ModelPricing> = {
  // Anthropic
  'claude-sonnet-4-20250514': { inputPerMillion: 3, outputPerMillion: 15 },
  'claude-opus-4-20250514': { inputPerMillion: 15, outputPerMillion: 75 },
  'claude-haiku-4-5-20251001': { inputPerMillion: 0.8, outputPerMillion: 4 },
  // OpenAI
  'gpt-4o': { inputPerMillion: 2.5, outputPerMillion: 10 },
  'gpt-4o-mini': { inputPerMillion: 0.15, outputPerMillion: 0.6 },
  'gpt-4.1': { inputPerMillion: 2, outputPerMillion: 8 },
  'gpt-4.1-mini': { inputPerMillion: 0.4, outputPerMillion: 1.6 },
  'gpt-4.1-nano': { inputPerMillion: 0.1, outputPerMillion: 0.4 },
  // Google Gemini
  'gemini-2.5-pro-preview-06-05': { inputPerMillion: 1.25, outputPerMillion: 10 },
  'gemini-2.5-flash-preview-05-20': { inputPerMillion: 0.15, outputPerMillion: 0.6 },
  'gemini-2.0-flash': { inputPerMillion: 0.1, outputPerMillion: 0.4 },
};

const DEFAULT_PRICING: ModelPricing = { inputPerMillion: 3, outputPerMillion: 15 };

/**
 * Estimate cost for a generation call.
 * Input tokens: estimated from a typical prompt (~2000 tokens base + brief overhead).
 * Output tokens: ~2 tokens per target word (1.33 tokens/word * 1.5 HTML overhead).
 */
export function estimateGenerationCost(
  model: string,
  targetWordCount: number,
  estimatedInputTokens = 2500,
): { low: number; high: number; inputTokens: number; outputTokens: number } {
  const pricing = MODEL_PRICING[model] || DEFAULT_PRICING;

  // Output: ~2 tokens per word (includes HTML markup overhead)
  const outputTokens = Math.ceil(targetWordCount * 2);

  const inputCost = (estimatedInputTokens / 1_000_000) * pricing.inputPerMillion;
  const outputCost = (outputTokens / 1_000_000) * pricing.outputPerMillion;
  const baseCost = inputCost + outputCost;

  // Low = 80% of estimate, High = 130% (accounts for revision pass)
  return {
    low: Math.round(baseCost * 0.8 * 1_000_000) / 1_000_000,
    high: Math.round(baseCost * 1.3 * 1_000_000) / 1_000_000,
    inputTokens: estimatedInputTokens,
    outputTokens,
  };
}

/** Format a USD cost for display */
export function formatCost(usd: number): string {
  if (usd < 0.01) return `$${usd.toFixed(4)}`;
  return `$${usd.toFixed(3)}`;
}
