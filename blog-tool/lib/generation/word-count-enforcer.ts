import { generateWithClaudeSync } from './claude';
import { generateWithOpenAISync } from './openai';
import { getProvider } from './model-router';
import type { GenerationResult } from './types';

const TOLERANCE = 0.10; // 10% margin

function countWords(html: string): number {
  return html.replace(/<[^>]*>/g, ' ').split(/\s+/).filter(Boolean).length;
}

/**
 * Check if the generated article is within acceptable word count range.
 * If not, makes a single revision call to expand or trim.
 * Returns the original result if within tolerance, or the revised result.
 */
export async function enforceWordCount(params: {
  result: GenerationResult;
  targetWordCount: number;
  apiKey: string;
  model: string;
}): Promise<GenerationResult> {
  const { result, targetWordCount, apiKey, model } = params;
  const actualWords = countWords(result.text);
  const minWords = Math.round(targetWordCount * (1 - TOLERANCE));
  const maxWords = Math.round(targetWordCount * (1 + TOLERANCE));

  // Within tolerance — no revision needed
  if (actualWords >= minWords && actualWords <= maxWords) {
    return result;
  }

  const isTooShort = actualWords < minWords;
  const diff = isTooShort ? targetWordCount - actualWords : actualWords - targetWordCount;
  const direction = isTooShort ? 'expand' : 'trim';

  const systemPrompt = `You are a precise article editor. Your ONLY job is to ${direction} the given HTML article to hit a specific word count target. Maintain the same voice, style, structure, and HTML formatting. Do not add new sections or remove sections — ${isTooShort ? 'flesh out existing paragraphs with more detail, examples, or explanation' : 'tighten sentences, remove redundancy, and cut filler'}. Output ONLY the revised HTML — no commentary.`;

  const userPrompt = `Current word count: ${actualWords} words.
Target word count: ${targetWordCount} words (${minWords}–${maxWords} acceptable range).
You need to ${direction} by approximately ${diff} words.

Here is the article HTML to revise:

${result.text}`;

  const provider = getProvider(model);
  const revisionParams = {
    systemPrompt,
    userPrompt,
    model,
    apiKey,
    targetWordCount,
  };

  try {
    let revised: GenerationResult;
    if (provider === 'openai') {
      revised = await generateWithOpenAISync(revisionParams);
    } else {
      revised = await generateWithClaudeSync(revisionParams);
    }

    // Verify the revision actually improved things
    const revisedWords = countWords(revised.text);
    const revisedDelta = Math.abs(revisedWords - targetWordCount);
    const originalDelta = Math.abs(actualWords - targetWordCount);

    if (revisedDelta < originalDelta) {
      // Revision improved word count — use it
      return {
        text: revised.text,
        model: revised.model,
        inputTokens: result.inputTokens + revised.inputTokens,
        outputTokens: result.outputTokens + revised.outputTokens,
        costUsd: result.costUsd + revised.costUsd,
      };
    }

    // Revision didn't help — keep original
    return result;
  } catch (error) {
    console.error('Word count revision failed, keeping original:', error);
    return result;
  }
}
