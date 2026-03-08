// -----------------------------------------------------------------------
// Image Alt Text Checker
// Verifies all images have alt text and keyword presence.
// -----------------------------------------------------------------------

import type { ParsedImage, SeoCheckResult } from './types';
import { containsKeyword } from './density';

/**
 * Run all image-related SEO checks.
 */
export function runImageChecks(
  images: ParsedImage[],
  primaryKeyword: string,
): SeoCheckResult[] {
  const results: SeoCheckResult[] = [];

  if (images.length === 0) {
    results.push({
      id: 'images-present',
      category: 'images',
      label: 'Images present',
      status: 'warning',
      message: 'No images found in the article.',
    });
    return results;
  }

  // Check all images have alt text
  const missingAlt = images.filter(img => !img.alt || img.alt.trim().length === 0);

  if (missingAlt.length === 0) {
    results.push({
      id: 'images-alt-text',
      category: 'images',
      label: 'All images have alt text',
      status: 'pass',
      message: `All ${images.length} image(s) have alt text.`,
    });
  } else {
    results.push({
      id: 'images-alt-text',
      category: 'images',
      label: 'All images have alt text',
      status: 'fail',
      message: `${missingAlt.length} of ${images.length} image(s) are missing alt text.`,
      fixable: true,
      details: {
        missingCount: missingAlt.length,
        totalImages: images.length,
        missingSrcs: missingAlt.map(img => img.src),
      },
    });
  }

  // Check keyword appears in at least one alt tag
  const hasKeywordInAlt = images.some(
    img => img.alt && containsKeyword(img.alt, primaryKeyword),
  );

  results.push({
    id: 'images-keyword-alt',
    category: 'images',
    label: 'Primary keyword in image alt text',
    status: hasKeywordInAlt ? 'pass' : 'warning',
    message: hasKeywordInAlt
      ? `Primary keyword "${primaryKeyword}" found in at least one image alt text.`
      : `Primary keyword "${primaryKeyword}" not found in any image alt text.`,
    fixable: !hasKeywordInAlt,
  });

  return results;
}
