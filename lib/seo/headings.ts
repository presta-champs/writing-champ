// -----------------------------------------------------------------------
// Heading Structure Validator
// Checks heading hierarchy, keyword presence in H2s, and depth limits.
// -----------------------------------------------------------------------

import type { ParsedHeading, SeoCheckResult } from './types';
import { containsKeyword } from './density';

/**
 * Validate that headings follow a logical hierarchy (no skipped levels).
 * For example, H1 -> H3 (skipping H2) is invalid.
 */
function validateHierarchy(headings: ParsedHeading[]): SeoCheckResult {
  if (headings.length === 0) {
    return {
      id: 'heading-hierarchy',
      category: 'structure',
      label: 'Heading hierarchy',
      status: 'warning',
      message: 'No headings found in the article.',
    };
  }

  const skippedLevels: string[] = [];
  let prevLevel = 0;

  for (const heading of headings) {
    if (prevLevel > 0 && heading.level > prevLevel + 1) {
      skippedLevels.push(
        `H${prevLevel} jumps to H${heading.level} ("${heading.text.slice(0, 40)}")`
      );
    }
    prevLevel = heading.level;
  }

  if (skippedLevels.length === 0) {
    return {
      id: 'heading-hierarchy',
      category: 'structure',
      label: 'Heading hierarchy',
      status: 'pass',
      message: 'Headings follow a logical hierarchy with no skipped levels.',
    };
  }

  return {
    id: 'heading-hierarchy',
    category: 'structure',
    label: 'Heading hierarchy',
    status: 'fail',
    message: `Heading hierarchy has skipped levels: ${skippedLevels.join('; ')}.`,
    details: { skippedLevels },
  };
}

/**
 * Check that the primary keyword appears in at least one H2.
 */
function validateKeywordInH2(
  headings: ParsedHeading[],
  primaryKeyword: string,
): SeoCheckResult {
  const h2s = headings.filter(h => h.level === 2);

  if (h2s.length === 0) {
    return {
      id: 'keyword-in-h2',
      category: 'structure',
      label: 'Primary keyword in H2',
      status: 'fail',
      message: 'No H2 headings found in the article.',
      fixable: true,
    };
  }

  const hasKeyword = h2s.some(h => containsKeyword(h.text, primaryKeyword));

  if (hasKeyword) {
    return {
      id: 'keyword-in-h2',
      category: 'structure',
      label: 'Primary keyword in H2',
      status: 'pass',
      message: `Primary keyword "${primaryKeyword}" found in at least one H2.`,
    };
  }

  return {
    id: 'keyword-in-h2',
    category: 'structure',
    label: 'Primary keyword in H2',
    status: 'fail',
    message: `Primary keyword "${primaryKeyword}" not found in any H2 heading.`,
    fixable: true,
  };
}

/**
 * Check that heading depth does not exceed persona setting.
 * For example, if seo_heading_depth is "h3", no H4/H5/H6 should appear.
 */
function validateHeadingDepth(
  headings: ParsedHeading[],
  maxDepthSetting?: string | number,
): SeoCheckResult {
  if (maxDepthSetting === undefined || maxDepthSetting === null) {
    return {
      id: 'heading-depth',
      category: 'structure',
      label: 'Heading depth',
      status: 'pass',
      message: 'No heading depth limit configured.',
    };
  }

  // Parse setting like "h3" or "3" to get max level
  const depthMatch = String(maxDepthSetting).match(/(\d)/);
  if (!depthMatch) {
    return {
      id: 'heading-depth',
      category: 'structure',
      label: 'Heading depth',
      status: 'pass',
      message: `Could not parse heading depth setting "${maxDepthSetting}".`,
    };
  }

  const maxLevel = parseInt(depthMatch[1], 10);
  const tooDeep = headings.filter(h => h.level > maxLevel);

  if (tooDeep.length === 0) {
    return {
      id: 'heading-depth',
      category: 'structure',
      label: 'Heading depth',
      status: 'pass',
      message: `All headings are within the configured depth (H${maxLevel} max).`,
    };
  }

  return {
    id: 'heading-depth',
    category: 'structure',
    label: 'Heading depth',
    status: 'warning',
    message: `${tooDeep.length} heading(s) exceed the configured max depth of H${maxLevel}.`,
    details: {
      maxLevel,
      violations: tooDeep.map(h => ({ level: h.level, text: h.text.slice(0, 60) })),
    },
  };
}

/**
 * Check that H1 is used only once (as the title).
 */
function validateSingleH1(headings: ParsedHeading[]): SeoCheckResult {
  const h1s = headings.filter(h => h.level === 1);

  if (h1s.length === 0) {
    return {
      id: 'single-h1',
      category: 'structure',
      label: 'Single H1 tag',
      status: 'warning',
      message: 'No H1 heading found. The article should have exactly one H1 as the title.',
    };
  }

  if (h1s.length === 1) {
    return {
      id: 'single-h1',
      category: 'structure',
      label: 'Single H1 tag',
      status: 'pass',
      message: 'Article has exactly one H1 heading.',
    };
  }

  return {
    id: 'single-h1',
    category: 'structure',
    label: 'Single H1 tag',
    status: 'warning',
    message: `Article has ${h1s.length} H1 headings. Best practice is to have exactly one.`,
    details: { h1Texts: h1s.map(h => h.text) },
  };
}

/**
 * Run all heading checks and return an array of SeoCheckResults.
 */
export function runHeadingChecks(
  headings: ParsedHeading[],
  primaryKeyword: string,
  maxDepthSetting?: string | number,
): SeoCheckResult[] {
  return [
    validateHierarchy(headings),
    validateKeywordInH2(headings, primaryKeyword),
    validateHeadingDepth(headings, maxDepthSetting),
    validateSingleH1(headings),
  ];
}
