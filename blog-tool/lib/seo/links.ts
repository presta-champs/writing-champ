// -----------------------------------------------------------------------
// Link Validator
// Counts internal and external links. Verifies internal links exist in
// the content index. Checks minimums from persona settings.
// -----------------------------------------------------------------------

import type { ParsedLink, SeoCheckResult } from './types';

/**
 * Normalise a URL for comparison: lowercase, strip trailing slash, strip
 * protocol prefix, strip "www." prefix.
 */
function normalizeUrl(url: string): string {
  return url
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/+$/, '')
    .trim();
}

/**
 * Check if an internal link URL exists in the content index.
 */
function linkExistsInIndex(
  href: string,
  contentIndex: { url: string; title: string }[],
): boolean {
  const normalized = normalizeUrl(href);
  return contentIndex.some(entry => {
    const entryNormalized = normalizeUrl(entry.url);
    // Check if the href matches the full URL or is a path-only match
    return entryNormalized === normalized ||
      entryNormalized.endsWith(normalized) ||
      normalized.endsWith(entryNormalized);
  });
}

/**
 * Run all link-related checks.
 */
export function runLinkChecks(
  links: ParsedLink[],
  contentIndex: { url: string; title: string }[] = [],
  settings?: {
    seo_internal_linking?: number;
    seo_external_linking?: number;
  },
): SeoCheckResult[] {
  const results: SeoCheckResult[] = [];

  const internalLinks = links.filter(l => l.isInternal);
  const externalLinks = links.filter(l => !l.isInternal);

  const minInternal = settings?.seo_internal_linking ?? 2;
  const minExternal = settings?.seo_external_linking ?? 1;

  // Internal link count
  if (internalLinks.length >= minInternal) {
    results.push({
      id: 'internal-link-count',
      category: 'links',
      label: 'Internal link count',
      status: 'pass',
      message: `${internalLinks.length} internal link(s) found (minimum: ${minInternal}).`,
      details: { count: internalLinks.length, minimum: minInternal },
    });
  } else if (internalLinks.length > 0) {
    results.push({
      id: 'internal-link-count',
      category: 'links',
      label: 'Internal link count',
      status: 'warning',
      message: `Only ${internalLinks.length} internal link(s) found. Recommended minimum: ${minInternal}.`,
      details: { count: internalLinks.length, minimum: minInternal },
    });
  } else {
    results.push({
      id: 'internal-link-count',
      category: 'links',
      label: 'Internal link count',
      status: 'fail',
      message: `No internal links found. Recommended minimum: ${minInternal}.`,
      details: { count: 0, minimum: minInternal },
    });
  }

  // External (outbound) link count
  if (externalLinks.length >= minExternal) {
    results.push({
      id: 'external-link-count',
      category: 'links',
      label: 'Outbound link count',
      status: 'pass',
      message: `${externalLinks.length} outbound link(s) found (minimum: ${minExternal}).`,
      details: { count: externalLinks.length, minimum: minExternal },
    });
  } else if (externalLinks.length > 0) {
    results.push({
      id: 'external-link-count',
      category: 'links',
      label: 'Outbound link count',
      status: 'warning',
      message: `Only ${externalLinks.length} outbound link(s) found. Recommended minimum: ${minExternal}.`,
      details: { count: externalLinks.length, minimum: minExternal },
    });
  } else {
    results.push({
      id: 'external-link-count',
      category: 'links',
      label: 'Outbound link count',
      status: 'fail',
      message: `No outbound links found. Recommended minimum: ${minExternal}.`,
      details: { count: 0, minimum: minExternal },
    });
  }

  // Verify internal links exist in content index (only if index is provided)
  if (contentIndex.length > 0 && internalLinks.length > 0) {
    const broken = internalLinks.filter(l => !linkExistsInIndex(l.href, contentIndex));

    if (broken.length === 0) {
      results.push({
        id: 'internal-links-valid',
        category: 'links',
        label: 'Internal links valid',
        status: 'pass',
        message: 'All internal links point to URLs in the content index.',
      });
    } else {
      results.push({
        id: 'internal-links-valid',
        category: 'links',
        label: 'Internal links valid',
        status: 'warning',
        message: `${broken.length} internal link(s) could not be matched to the content index.`,
        details: {
          brokenLinks: broken.map(l => ({ href: l.href, text: l.text })),
        },
      });
    }
  }

  return results;
}
