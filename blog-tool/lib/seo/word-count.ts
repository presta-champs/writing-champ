// -----------------------------------------------------------------------
// Word Count Checker
// Validates article length is within 10% of target.
// -----------------------------------------------------------------------

import type { SeoCheckResult } from './types';

/**
 * Check that word count is within acceptable range of the target.
 *
 * @param actualWordCount  The article's word count
 * @param targetWordCount  The target word count (from brief or persona settings)
 * @param tolerance        Tolerance percentage (default 10%)
 */
export function runWordCountCheck(
  actualWordCount: number,
  targetWordCount?: number,
): SeoCheckResult {
  if (!targetWordCount || targetWordCount <= 0) {
    return {
      id: 'word-count',
      category: 'readability',
      label: 'Article length',
      status: 'pass',
      message: `Article is ${actualWordCount} words. No target word count configured.`,
      details: { actual: actualWordCount },
    };
  }

  const tolerance = 0.10; // 10%
  const lowerBound = Math.floor(targetWordCount * (1 - tolerance));
  const upperBound = Math.ceil(targetWordCount * (1 + tolerance));
  const diff = actualWordCount - targetWordCount;
  const diffPercent = Math.round((Math.abs(diff) / targetWordCount) * 100);

  if (actualWordCount >= lowerBound && actualWordCount <= upperBound) {
    return {
      id: 'word-count',
      category: 'readability',
      label: 'Article length',
      status: 'pass',
      message: `Article is ${actualWordCount} words (target: ${targetWordCount}). Within the 10% tolerance.`,
      details: { actual: actualWordCount, target: targetWordCount, diff, diffPercent },
    };
  }

  if (actualWordCount < lowerBound) {
    return {
      id: 'word-count',
      category: 'readability',
      label: 'Article length',
      status: actualWordCount < targetWordCount * 0.75 ? 'fail' : 'warning',
      message: `Article is ${actualWordCount} words — ${diffPercent}% below the target of ${targetWordCount}.`,
      details: { actual: actualWordCount, target: targetWordCount, diff, diffPercent },
    };
  }

  return {
    id: 'word-count',
    category: 'readability',
    label: 'Article length',
    status: actualWordCount > targetWordCount * 1.25 ? 'fail' : 'warning',
    message: `Article is ${actualWordCount} words — ${diffPercent}% above the target of ${targetWordCount}.`,
    details: { actual: actualWordCount, target: targetWordCount, diff, diffPercent },
  };
}
