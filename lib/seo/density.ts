// -----------------------------------------------------------------------
// Keyword Density Calculator
// Counts keyword occurrences and computes density as a percentage of
// total words. Supports basic stemming for English.
// -----------------------------------------------------------------------

import type { KeywordDensityResult, SeoCheckResult } from './types';

/**
 * Basic English stemming — strips common suffixes so "running" matches
 * "run", "optimization" matches "optimize", etc. This is intentionally
 * simple; we are not pulling in a full NLP library.
 */
function basicStem(word: string): string {
  let w = word.toLowerCase();
  // Order matters: longest suffixes first
  if (w.endsWith('ation')) w = w.slice(0, -5);
  else if (w.endsWith('izing')) w = w.slice(0, -3);
  else if (w.endsWith('ised') || w.endsWith('ized')) w = w.slice(0, -1);
  else if (w.endsWith('ting')) w = w.slice(0, -4);
  else if (w.endsWith('ning')) w = w.slice(0, -4);
  else if (w.endsWith('ness')) w = w.slice(0, -4);
  else if (w.endsWith('ment')) w = w.slice(0, -4);
  else if (w.endsWith('able') || w.endsWith('ible')) w = w.slice(0, -4);
  else if (w.endsWith('ally')) w = w.slice(0, -4);
  else if (w.endsWith('ing')) w = w.slice(0, -3);
  else if (w.endsWith('ies')) w = w.slice(0, -3) + 'y';
  else if (w.endsWith('ous')) w = w.slice(0, -3);
  else if (w.endsWith('ful')) w = w.slice(0, -3);
  else if (w.endsWith('ed')) w = w.slice(0, -2);
  else if (w.endsWith('ly')) w = w.slice(0, -2);
  else if (w.endsWith('er')) w = w.slice(0, -2);
  else if (w.endsWith('es')) w = w.slice(0, -2);
  else if (w.endsWith('s') && !w.endsWith('ss')) w = w.slice(0, -1);
  return w;
}

/**
 * Tokenise text into lowercase words, stripping punctuation.
 */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s'-]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 0);
}

/**
 * Count how many times a keyword phrase appears in the body text.
 * Uses case-insensitive matching with basic stemming.
 */
function countKeywordOccurrences(bodyText: string, keyword: string): number {
  const bodyTokens = tokenize(bodyText);
  const keywordTokens = tokenize(keyword);

  if (keywordTokens.length === 0) return 0;

  const stemmedKeyword = keywordTokens.map(basicStem);
  let count = 0;

  for (let i = 0; i <= bodyTokens.length - stemmedKeyword.length; i++) {
    let matched = true;
    for (let j = 0; j < stemmedKeyword.length; j++) {
      if (basicStem(bodyTokens[i + j]) !== stemmedKeyword[j]) {
        matched = false;
        break;
      }
    }
    if (matched) count++;
  }

  return count;
}

/**
 * Calculate keyword density.
 *
 * @param bodyText  Full visible text of the article
 * @param keyword   The keyword or keyphrase to check
 * @param targetDensity  Target density percentage (default 1.5%)
 * @returns KeywordDensityResult
 */
export function calculateDensity(
  bodyText: string,
  keyword: string,
  targetDensity: number = 1.5,
): KeywordDensityResult {
  const totalWords = tokenize(bodyText).length;
  const occurrences = countKeywordOccurrences(bodyText, keyword);
  const keywordWordCount = tokenize(keyword).length;
  const density = totalWords > 0
    ? (occurrences * keywordWordCount / totalWords) * 100
    : 0;

  const lowerBound = targetDensity * 0.5;
  const upperBound = targetDensity * 2.0;

  let status: 'pass' | 'warning' | 'fail';
  let message: string;

  if (density >= lowerBound && density <= upperBound) {
    status = 'pass';
    message = `Keyword "${keyword}" density is ${density.toFixed(2)}% (${occurrences} occurrences). Within target range.`;
  } else if (density < lowerBound) {
    status = density === 0 ? 'fail' : 'warning';
    message = `Keyword "${keyword}" density is ${density.toFixed(2)}% (${occurrences} occurrences). Below target of ${targetDensity}%.`;
  } else {
    status = 'warning';
    message = `Keyword "${keyword}" density is ${density.toFixed(2)}% (${occurrences} occurrences). Above target of ${targetDensity}% — may appear over-optimized.`;
  }

  return { keyword, occurrences, density, status, message };
}

/**
 * Check whether the primary keyword appears in a given text (case-insensitive, stemmed).
 */
export function containsKeyword(text: string, keyword: string): boolean {
  return countKeywordOccurrences(text, keyword) > 0;
}

/**
 * Run density checks for primary and secondary keywords and return SeoCheckResults.
 */
export function runDensityChecks(
  bodyText: string,
  primaryKeyword: string,
  secondaryKeywords: string[],
  targetDensity: number = 1.5,
): SeoCheckResult[] {
  const results: SeoCheckResult[] = [];

  // Primary keyword density
  const primary = calculateDensity(bodyText, primaryKeyword, targetDensity);
  results.push({
    id: 'keyword-density-primary',
    category: 'keywords',
    label: 'Primary keyword density',
    status: primary.status,
    message: primary.message,
    details: {
      keyword: primaryKeyword,
      occurrences: primary.occurrences,
      density: primary.density,
      targetDensity,
    },
  });

  // Secondary keywords: check they are distributed
  for (const kw of secondaryKeywords) {
    const result = calculateDensity(bodyText, kw, targetDensity * 0.5);
    results.push({
      id: `keyword-density-secondary-${kw.replace(/\s+/g, '-').toLowerCase()}`,
      category: 'keywords',
      label: `Secondary keyword: "${kw}"`,
      status: result.occurrences > 0 ? 'pass' : 'warning',
      message: result.occurrences > 0
        ? `Secondary keyword "${kw}" found ${result.occurrences} time(s).`
        : `Secondary keyword "${kw}" not found in the article.`,
      details: {
        keyword: kw,
        occurrences: result.occurrences,
        density: result.density,
      },
    });
  }

  return results;
}

export { countKeywordOccurrences, tokenize, basicStem };
