import Anthropic from '@anthropic-ai/sdk';
import type { GenerationRequest, GenerationResult } from './types';
import { estimateTokens } from './token-counter';
import { estimateCost } from './cost-estimator';

const DEFAULT_MODEL = 'claude-sonnet-4-20250514';
const DEFAULT_MAX_TOKENS = 8192;

function getClient(apiKey?: string): Anthropic {
  return new Anthropic({
    apiKey: apiKey || process.env.ANTHROPIC_API_KEY,
  });
}

/**
 * Generate with Claude using streaming.
 * Returns an async iterator of text chunks plus a final result.
 */
export async function* generateWithClaude(
  params: GenerationRequest
): AsyncGenerator<string, GenerationResult> {
  const client = getClient(params.apiKey);
  const model = params.model || DEFAULT_MODEL;
  const maxTokens = params.maxTokens || DEFAULT_MAX_TOKENS;

  const inputTokens = estimateTokens(params.systemPrompt + params.userPrompt);
  let outputText = '';

  const stream = client.messages.stream({
    model,
    max_tokens: maxTokens,
    system: params.systemPrompt,
    messages: [{ role: 'user', content: params.userPrompt }],
  });

  for await (const event of stream) {
    if (
      event.type === 'content_block_delta' &&
      event.delta.type === 'text_delta'
    ) {
      outputText += event.delta.text;
      yield event.delta.text;
    }
  }

  const finalMessage = await stream.finalMessage();
  const actualInputTokens = finalMessage.usage?.input_tokens || inputTokens;
  const actualOutputTokens = finalMessage.usage?.output_tokens || estimateTokens(outputText);

  return {
    text: outputText,
    model,
    inputTokens: actualInputTokens,
    outputTokens: actualOutputTokens,
    costUsd: estimateCost(model, actualInputTokens, actualOutputTokens),
  };
}

/**
 * Generate with Claude synchronously (non-streaming).
 * Used for short tasks like voice analysis or alt text.
 */
export async function generateWithClaudeSync(
  params: GenerationRequest
): Promise<GenerationResult> {
  const client = getClient(params.apiKey);
  const model = params.model || DEFAULT_MODEL;
  const maxTokens = params.maxTokens || DEFAULT_MAX_TOKENS;

  const message = await client.messages.create({
    model,
    max_tokens: maxTokens,
    system: params.systemPrompt,
    messages: [{ role: 'user', content: params.userPrompt }],
  });

  const text = message.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('');

  const actualInputTokens = message.usage?.input_tokens || estimateTokens(params.systemPrompt + params.userPrompt);
  const actualOutputTokens = message.usage?.output_tokens || estimateTokens(text);

  return {
    text,
    model,
    inputTokens: actualInputTokens,
    outputTokens: actualOutputTokens,
    costUsd: estimateCost(model, actualInputTokens, actualOutputTokens),
  };
}
