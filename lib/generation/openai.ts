import OpenAI from 'openai';
import type { GenerationRequest, GenerationResult } from './types';
import { estimateTokens } from './token-counter';
import { estimateCost } from './cost-estimator';

const DEFAULT_MODEL = 'gpt-4o';
const DEFAULT_MAX_TOKENS = 8192;

function getClient(apiKey?: string): OpenAI {
  return new OpenAI({
    apiKey: apiKey || process.env.OPENAI_API_KEY,
  });
}

/**
 * Generate with OpenAI using streaming.
 */
export async function* generateWithOpenAI(
  params: GenerationRequest
): AsyncGenerator<string, GenerationResult> {
  const client = getClient(params.apiKey);
  const model = params.model || DEFAULT_MODEL;
  const maxTokens = params.maxTokens || DEFAULT_MAX_TOKENS;

  const inputTokens = estimateTokens(params.systemPrompt + params.userPrompt);
  let outputText = '';

  const stream = await client.chat.completions.create({
    model,
    max_tokens: maxTokens,
    stream: true,
    messages: [
      { role: 'system', content: params.systemPrompt },
      { role: 'user', content: params.userPrompt },
    ],
  });

  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content;
    if (delta) {
      outputText += delta;
      yield delta;
    }
  }

  const actualOutputTokens = estimateTokens(outputText);

  return {
    text: outputText,
    model,
    inputTokens,
    outputTokens: actualOutputTokens,
    costUsd: estimateCost(model, inputTokens, actualOutputTokens),
  };
}

/**
 * Generate with OpenAI synchronously (non-streaming).
 */
export async function generateWithOpenAISync(
  params: GenerationRequest
): Promise<GenerationResult> {
  const client = getClient(params.apiKey);
  const model = params.model || DEFAULT_MODEL;
  const maxTokens = params.maxTokens || DEFAULT_MAX_TOKENS;

  const completion = await client.chat.completions.create({
    model,
    max_tokens: maxTokens,
    messages: [
      { role: 'system', content: params.systemPrompt },
      { role: 'user', content: params.userPrompt },
    ],
  });

  const text = completion.choices[0]?.message?.content || '';
  const actualInputTokens = completion.usage?.prompt_tokens || estimateTokens(params.systemPrompt + params.userPrompt);
  const actualOutputTokens = completion.usage?.completion_tokens || estimateTokens(text);

  return {
    text,
    model,
    inputTokens: actualInputTokens,
    outputTokens: actualOutputTokens,
    costUsd: estimateCost(model, actualInputTokens, actualOutputTokens),
  };
}
