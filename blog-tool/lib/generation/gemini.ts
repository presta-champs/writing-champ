import { GoogleGenerativeAI } from '@google/generative-ai';
import type { GenerationRequest, GenerationResult } from './types';
import { estimateTokens, calibrateMaxTokens } from './token-counter';
import { estimateCost } from './cost-estimator';

const DEFAULT_MODEL = 'gemini-2.0-flash';

function getClient(apiKey?: string): GoogleGenerativeAI {
  return new GoogleGenerativeAI(apiKey || process.env.GOOGLE_AI_API_KEY || '');
}

/**
 * Generate with Gemini using streaming.
 */
export async function* generateWithGemini(
  params: GenerationRequest
): AsyncGenerator<string, GenerationResult> {
  const client = getClient(params.apiKey);
  const model = params.model || DEFAULT_MODEL;
  const maxTokens = params.maxTokens || calibrateMaxTokens(params.targetWordCount);

  const inputTokens = estimateTokens(params.systemPrompt + params.userPrompt);
  let outputText = '';

  const generativeModel = client.getGenerativeModel({
    model,
    systemInstruction: params.systemPrompt,
    generationConfig: {
      maxOutputTokens: maxTokens,
    },
  });

  let result;
  try {
    result = await generativeModel.generateContentStream(params.userPrompt);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Gemini API error: ${msg}`);
  }

  for await (const chunk of result.stream) {
    const text = chunk.text();
    if (text) {
      outputText += text;
      yield text;
    }
  }

  const response = await result.response;
  const usage = response.usageMetadata;
  const actualInputTokens = usage?.promptTokenCount || inputTokens;
  const actualOutputTokens = usage?.candidatesTokenCount || estimateTokens(outputText);

  return {
    text: outputText,
    model,
    inputTokens: actualInputTokens,
    outputTokens: actualOutputTokens,
    costUsd: estimateCost(model, actualInputTokens, actualOutputTokens),
  };
}

/**
 * Generate with Gemini synchronously (non-streaming).
 */
export async function generateWithGeminiSync(
  params: GenerationRequest
): Promise<GenerationResult> {
  const client = getClient(params.apiKey);
  const model = params.model || DEFAULT_MODEL;
  const maxTokens = params.maxTokens || calibrateMaxTokens(params.targetWordCount);

  const generativeModel = client.getGenerativeModel({
    model,
    systemInstruction: params.systemPrompt,
    generationConfig: {
      maxOutputTokens: maxTokens,
    },
  });

  const result = await generativeModel.generateContent(params.userPrompt);
  const text = result.response.text();
  const usage = result.response.usageMetadata;
  const actualInputTokens = usage?.promptTokenCount || estimateTokens(params.systemPrompt + params.userPrompt);
  const actualOutputTokens = usage?.candidatesTokenCount || estimateTokens(text);

  return {
    text,
    model,
    inputTokens: actualInputTokens,
    outputTokens: actualOutputTokens,
    costUsd: estimateCost(model, actualInputTokens, actualOutputTokens),
  };
}
