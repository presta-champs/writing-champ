// -----------------------------------------------------------------------
// Flesch-Kincaid Readability Scorer
// Standard formula — no AI involved, purely deterministic.
// -----------------------------------------------------------------------

import type { ReadabilityResult, SeoCheckResult } from './types';

/**
 * Count syllables in a single English word.
 * Uses a heuristic approach: count vowel groups, adjust for silent-e, etc.
 */
function countSyllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, '');
  if (w.length <= 2) return 1;

  let count = 0;
  let prevVowel = false;
  const vowels = 'aeiouy';

  for (let i = 0; i < w.length; i++) {
    const isVowel = vowels.includes(w[i]);
    if (isVowel && !prevVowel) {
      count++;
    }
    prevVowel = isVowel;
  }

  // Silent 'e' at end
  if (w.endsWith('e') && count > 1) {
    count--;
  }

  // Common suffixes that add syllables
  if (w.endsWith('le') && w.length > 2 && !vowels.includes(w[w.length - 3])) {
    count++;
  }

  // Words like "created", "educated"
  if (w.endsWith('ed') && w.length > 3) {
    const beforeEd = w[w.length - 3];
    if (beforeEd === 't' || beforeEd === 'd') {
      count++;
    }
  }

  return Math.max(1, count);
}

/**
 * Split text into sentences. Handles period, exclamation, question mark,
 * and semicolons as sentence-ending punctuation.
 */
function splitSentences(text: string): string[] {
  // Split on sentence-ending punctuation followed by whitespace or end-of-string
  const raw = text
    .replace(/\s+/g, ' ')
    .split(/[.!?;]+/)
    .map(s => s.trim())
    .filter(s => s.length > 0);

  return raw;
}

/**
 * Split text into words (alphabetic tokens only).
 */
function splitWords(text: string): string[] {
  return text
    .replace(/[^a-zA-Z\s'-]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 0 && /[a-zA-Z]/.test(w));
}

/**
 * Calculate Flesch-Kincaid readability metrics.
 *
 * Flesch Reading Ease = 206.835 - (1.015 * ASL) - (84.6 * ASW)
 *   where ASL = average sentence length, ASW = avg syllables per word
 *
 * Flesch-Kincaid Grade Level = (0.39 * ASL) + (11.8 * ASW) - 15.59
 */
export function calculateReadability(text: string): ReadabilityResult {
  const sentences = splitSentences(text);
  const words = splitWords(text);

  const totalSentences = Math.max(1, sentences.length);
  const totalWords = words.length;

  if (totalWords === 0) {
    return {
      fleschKincaidScore: 0,
      gradeLevel: 0,
      averageSentenceLength: 0,
      averageSyllablesPerWord: 0,
      totalSentences: 0,
      totalWords: 0,
      totalSyllables: 0,
    };
  }

  const totalSyllables = words.reduce((sum, w) => sum + countSyllables(w), 0);
  const averageSentenceLength = totalWords / totalSentences;
  const averageSyllablesPerWord = totalSyllables / totalWords;

  const fleschKincaidScore = Math.max(0, Math.min(100,
    206.835 - (1.015 * averageSentenceLength) - (84.6 * averageSyllablesPerWord)
  ));

  const gradeLevel = Math.max(0,
    (0.39 * averageSentenceLength) + (11.8 * averageSyllablesPerWord) - 15.59
  );

  return {
    fleschKincaidScore: Math.round(fleschKincaidScore * 100) / 100,
    gradeLevel: Math.round(gradeLevel * 10) / 10,
    averageSentenceLength: Math.round(averageSentenceLength * 10) / 10,
    averageSyllablesPerWord: Math.round(averageSyllablesPerWord * 100) / 100,
    totalSentences,
    totalWords,
    totalSyllables,
  };
}

/**
 * Get a human-readable label for a Flesch-Kincaid score.
 */
function getReadabilityLabel(score: number): string {
  if (score >= 90) return 'Very Easy (5th grade)';
  if (score >= 80) return 'Easy (6th grade)';
  if (score >= 70) return 'Fairly Easy (7th grade)';
  if (score >= 60) return 'Standard (8th-9th grade)';
  if (score >= 50) return 'Fairly Difficult (10th-12th grade)';
  if (score >= 30) return 'Difficult (college level)';
  return 'Very Difficult (graduate level)';
}

/**
 * Run readability checks and return SeoCheckResults.
 * @param target Flesch-Kincaid score threshold for pass (default 50).
 */
export function runReadabilityChecks(bodyText: string, target = 50): SeoCheckResult[] {
  const result = calculateReadability(bodyText);

  const label = getReadabilityLabel(result.fleschKincaidScore);

  // Pass if score meets the persona's target; warn if within 20 points below; fail otherwise
  let status: 'pass' | 'warning' | 'fail';
  if (result.fleschKincaidScore >= target) {
    status = 'pass';
  } else if (result.fleschKincaidScore >= target - 20) {
    status = 'warning';
  } else {
    status = 'fail';
  }

  return [
    {
      id: 'readability-score',
      category: 'readability',
      label: 'Flesch-Kincaid readability',
      status,
      message: `Readability score: ${result.fleschKincaidScore} — ${label}. Average sentence length: ${result.averageSentenceLength} words. Average syllables per word: ${result.averageSyllablesPerWord}.`,
      details: {
        score: result.fleschKincaidScore,
        gradeLevel: result.gradeLevel,
        averageSentenceLength: result.averageSentenceLength,
        averageSyllablesPerWord: result.averageSyllablesPerWord,
        totalSentences: result.totalSentences,
        totalWords: result.totalWords,
        totalSyllables: result.totalSyllables,
      },
    },
  ];
}

export { countSyllables, splitSentences, splitWords };
