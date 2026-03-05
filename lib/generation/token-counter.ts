/**
 * Simple token estimation.
 * English text averages ~4 characters per token.
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

export function estimateInputTokens(systemPrompt: string, userPrompt: string): number {
  return estimateTokens(systemPrompt) + estimateTokens(userPrompt);
}

/**
 * Calculate calibrated max_tokens from a target word count.
 * English averages ~1.33 tokens per word, but HTML markup adds ~25% overhead.
 * We add a 20% buffer above the target to allow natural variation without
 * giving the model enough room to wildly overshoot.
 *
 * Floor: 1024 tokens (for very short articles)
 * Ceiling: 16384 tokens (for very long articles)
 */
export function calibrateMaxTokens(targetWordCount?: number, fallback = 8192): number {
  if (!targetWordCount || targetWordCount <= 0) return fallback;
  // ~1.33 tokens/word * 1.25 HTML overhead * 1.20 buffer = ~2.0 tokens per target word
  const calculated = Math.ceil(targetWordCount * 2.0);
  return Math.max(1024, Math.min(16384, calculated));
}
