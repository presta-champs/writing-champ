// -----------------------------------------------------------------------
// Meta Title & Description Checker
// Validates character limits and keyword presence.
// -----------------------------------------------------------------------

import type { SeoCheckResult } from './types';
import { containsKeyword } from './density';

const META_TITLE_MIN = 30;
const META_TITLE_IDEAL_MIN = 50;
const META_TITLE_IDEAL_MAX = 60;
const META_TITLE_MAX = 70;

const META_DESC_MIN = 70;
const META_DESC_IDEAL_MIN = 120;
const META_DESC_IDEAL_MAX = 160;
const META_DESC_MAX = 200;

/**
 * Check meta title length and keyword presence.
 */
function checkMetaTitle(metaTitle: string, primaryKeyword: string): SeoCheckResult[] {
  const results: SeoCheckResult[] = [];
  const len = metaTitle.length;

  // Length check
  if (len === 0) {
    results.push({
      id: 'meta-title-length',
      category: 'meta',
      label: 'Meta title length',
      status: 'fail',
      message: 'Meta title is missing.',
      fixable: true,
    });
  } else if (len >= META_TITLE_IDEAL_MIN && len <= META_TITLE_IDEAL_MAX) {
    results.push({
      id: 'meta-title-length',
      category: 'meta',
      label: 'Meta title length',
      status: 'pass',
      message: `Meta title is ${len} characters (ideal range: ${META_TITLE_IDEAL_MIN}-${META_TITLE_IDEAL_MAX}).`,
      details: { length: len },
    });
  } else if (len < META_TITLE_MIN) {
    results.push({
      id: 'meta-title-length',
      category: 'meta',
      label: 'Meta title length',
      status: 'fail',
      message: `Meta title is only ${len} characters. Minimum recommended: ${META_TITLE_IDEAL_MIN}.`,
      details: { length: len },
    });
  } else if (len > META_TITLE_MAX) {
    results.push({
      id: 'meta-title-length',
      category: 'meta',
      label: 'Meta title length',
      status: 'fail',
      message: `Meta title is ${len} characters. It will be truncated in search results (max ${META_TITLE_IDEAL_MAX}).`,
      details: { length: len },
    });
  } else {
    // Between min and ideal-min, or between ideal-max and max
    results.push({
      id: 'meta-title-length',
      category: 'meta',
      label: 'Meta title length',
      status: 'warning',
      message: `Meta title is ${len} characters. Ideal range is ${META_TITLE_IDEAL_MIN}-${META_TITLE_IDEAL_MAX}.`,
      details: { length: len },
    });
  }

  // Keyword presence
  if (len > 0) {
    const hasKeyword = containsKeyword(metaTitle, primaryKeyword);
    results.push({
      id: 'meta-title-keyword',
      category: 'meta',
      label: 'Primary keyword in meta title',
      status: hasKeyword ? 'pass' : 'fail',
      message: hasKeyword
        ? `Primary keyword "${primaryKeyword}" found in meta title.`
        : `Primary keyword "${primaryKeyword}" not found in meta title.`,
      fixable: !hasKeyword,
    });
  }

  return results;
}

/**
 * Check meta description length and keyword presence.
 */
function checkMetaDescription(metaDescription: string, primaryKeyword: string): SeoCheckResult[] {
  const results: SeoCheckResult[] = [];
  const len = metaDescription.length;

  // Length check
  if (len === 0) {
    results.push({
      id: 'meta-desc-length',
      category: 'meta',
      label: 'Meta description length',
      status: 'fail',
      message: 'Meta description is missing.',
      fixable: true,
    });
  } else if (len >= META_DESC_IDEAL_MIN && len <= META_DESC_IDEAL_MAX) {
    results.push({
      id: 'meta-desc-length',
      category: 'meta',
      label: 'Meta description length',
      status: 'pass',
      message: `Meta description is ${len} characters (ideal range: ${META_DESC_IDEAL_MIN}-${META_DESC_IDEAL_MAX}).`,
      details: { length: len },
    });
  } else if (len < META_DESC_MIN) {
    results.push({
      id: 'meta-desc-length',
      category: 'meta',
      label: 'Meta description length',
      status: 'fail',
      message: `Meta description is only ${len} characters. Minimum recommended: ${META_DESC_IDEAL_MIN}.`,
      details: { length: len },
    });
  } else if (len > META_DESC_MAX) {
    results.push({
      id: 'meta-desc-length',
      category: 'meta',
      label: 'Meta description length',
      status: 'fail',
      message: `Meta description is ${len} characters. It will be truncated in search results (max ${META_DESC_IDEAL_MAX}).`,
      details: { length: len },
    });
  } else {
    results.push({
      id: 'meta-desc-length',
      category: 'meta',
      label: 'Meta description length',
      status: 'warning',
      message: `Meta description is ${len} characters. Ideal range is ${META_DESC_IDEAL_MIN}-${META_DESC_IDEAL_MAX}.`,
      details: { length: len },
    });
  }

  // Keyword presence
  if (len > 0) {
    const hasKeyword = containsKeyword(metaDescription, primaryKeyword);
    results.push({
      id: 'meta-desc-keyword',
      category: 'meta',
      label: 'Primary keyword in meta description',
      status: hasKeyword ? 'pass' : 'fail',
      message: hasKeyword
        ? `Primary keyword "${primaryKeyword}" found in meta description.`
        : `Primary keyword "${primaryKeyword}" not found in meta description.`,
      fixable: !hasKeyword,
    });
  }

  return results;
}

/**
 * Run all meta checks.
 */
export function runMetaChecks(
  metaTitle: string,
  metaDescription: string,
  primaryKeyword: string,
): SeoCheckResult[] {
  return [
    ...checkMetaTitle(metaTitle, primaryKeyword),
    ...checkMetaDescription(metaDescription, primaryKeyword),
  ];
}
