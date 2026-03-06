// -----------------------------------------------------------------------
// SEO Audit Orchestrator
// Runs ALL SEO checks and returns a unified SeoAuditResult.
// -----------------------------------------------------------------------

import type { SeoAuditInput, SeoAuditResult, SeoCheckResult } from './types';
import { parseArticleHtml } from './html-parser';
import { runDensityChecks, containsKeyword } from './density';
import { runHeadingChecks } from './headings';
import { runMetaChecks } from './meta';
import { runLinkChecks } from './links';
import { runImageChecks } from './images';
import { runReadabilityChecks } from './readability';
import { runWordCountCheck } from './word-count';

/**
 * Run a full SEO audit on an article.
 *
 * All checks are warnings — they inform, they never prevent publishing.
 * Each check returns status (pass/warning/fail), a plain-English message,
 * and an optional fix action.
 */
export function runSeoAudit(input: SeoAuditInput): SeoAuditResult {
  const {
    html,
    metaTitle: inputMetaTitle,
    metaDescription: inputMetaDescription,
    primaryKeyword,
    secondaryKeywords = [],
    targetWordCount,
    contentIndex = [],
    personaSeoSettings,
  } = input;

  // Step 1: Parse the HTML
  const parsed = parseArticleHtml(html);

  // Use explicit meta values if provided, otherwise fall back to parsed HTML
  const metaTitle = inputMetaTitle ?? parsed.metaTitle;
  const metaDescription = inputMetaDescription ?? parsed.metaDescription;

  const checks: SeoCheckResult[] = [];

  // -----------------------------------------------------------------------
  // Keyword checks
  // -----------------------------------------------------------------------

  // Primary keyword in title (H1 or meta title)
  const titleText = parsed.headings.find(h => h.level === 1)?.text ?? metaTitle;
  checks.push({
    id: 'keyword-in-title',
    category: 'keywords',
    label: 'Primary keyword in title',
    status: containsKeyword(titleText, primaryKeyword) ? 'pass' : 'fail',
    message: containsKeyword(titleText, primaryKeyword)
      ? `Primary keyword "${primaryKeyword}" found in the article title.`
      : `Primary keyword "${primaryKeyword}" not found in the article title.`,
    fixable: !containsKeyword(titleText, primaryKeyword),
  });

  // Primary keyword in first paragraph
  const firstParagraph = parsed.paragraphs[0] ?? '';
  checks.push({
    id: 'keyword-in-first-paragraph',
    category: 'keywords',
    label: 'Primary keyword in first paragraph',
    status: containsKeyword(firstParagraph, primaryKeyword) ? 'pass' : 'warning',
    message: containsKeyword(firstParagraph, primaryKeyword)
      ? `Primary keyword "${primaryKeyword}" found in the first paragraph.`
      : `Primary keyword "${primaryKeyword}" not found in the first paragraph. Consider adding it early in the article.`,
  });

  // Keyword density checks
  const densityTarget = personaSeoSettings?.seo_keyword_density ?? 1.5;
  checks.push(...runDensityChecks(parsed.bodyText, primaryKeyword, secondaryKeywords, densityTarget));

  // -----------------------------------------------------------------------
  // Structure checks (headings)
  // -----------------------------------------------------------------------
  checks.push(...runHeadingChecks(
    parsed.headings,
    primaryKeyword,
    personaSeoSettings?.seo_heading_depth,
  ));

  // -----------------------------------------------------------------------
  // Meta checks
  // -----------------------------------------------------------------------
  checks.push(...runMetaChecks(metaTitle, metaDescription, primaryKeyword));

  // -----------------------------------------------------------------------
  // Link checks
  // -----------------------------------------------------------------------
  checks.push(...runLinkChecks(parsed.links, contentIndex, {
    seo_internal_linking: personaSeoSettings?.seo_internal_linking,
    seo_external_linking: personaSeoSettings?.seo_external_linking,
  }));

  // -----------------------------------------------------------------------
  // Image checks
  // -----------------------------------------------------------------------
  checks.push(...runImageChecks(parsed.images, primaryKeyword));

  // -----------------------------------------------------------------------
  // Readability
  // -----------------------------------------------------------------------
  checks.push(...runReadabilityChecks(parsed.bodyText, personaSeoSettings?.seo_readability_target));

  // -----------------------------------------------------------------------
  // Word count
  // -----------------------------------------------------------------------
  checks.push(runWordCountCheck(parsed.wordCount, targetWordCount));

  // -----------------------------------------------------------------------
  // Calculate summary and score
  // -----------------------------------------------------------------------
  const summary = {
    pass: checks.filter(c => c.status === 'pass').length,
    warning: checks.filter(c => c.status === 'warning').length,
    fail: checks.filter(c => c.status === 'fail').length,
  };

  const total = checks.length;
  // Score: pass = full points, warning = half points, fail = 0
  const score = total > 0
    ? Math.round(((summary.pass + summary.warning * 0.5) / total) * 100)
    : 0;

  return { score, checks, summary };
}

export type { SeoAuditInput, SeoAuditResult, SeoCheckResult };
