import { MODEL_PRICING } from './pricing';

const DEFAULT_PRICING = { inputPerMillion: 3, outputPerMillion: 15 };

/**
 * Calculate the actual cost in USD for a generation call.
 */
export function estimateCost(
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  const pricing = MODEL_PRICING[model] || DEFAULT_PRICING;
  const inputCost = (inputTokens / 1_000_000) * pricing.inputPerMillion;
  const outputCost = (outputTokens / 1_000_000) * pricing.outputPerMillion;
  return Math.round((inputCost + outputCost) * 1_000_000) / 1_000_000; // 6 decimal places
}
