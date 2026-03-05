// -----------------------------------------------------------------------
// One-Click Fix Handlers
// Pure string transformations that apply quick fixes to article content.
// -----------------------------------------------------------------------

import { stripTags } from './html-parser';

/**
 * Add the primary keyword to a meta title. Appends " — {keyword}" if the
 * keyword is not already present. Truncates to maxLength if needed.
 */
export function addKeywordToMetaTitle(
  title: string,
  keyword: string,
  maxLength: number = 60,
): string {
  if (title.toLowerCase().includes(keyword.toLowerCase())) {
    return title;
  }

  const separator = ' — ';
  const appended = `${title}${separator}${capitalizeFirst(keyword)}`;

  if (appended.length <= maxLength) {
    return appended;
  }

  // Truncate the original title to fit keyword
  const keywordPart = `${separator}${capitalizeFirst(keyword)}`;
  const available = maxLength - keywordPart.length;
  if (available > 10) {
    return `${title.slice(0, available).trimEnd()}${keywordPart}`;
  }

  // If there is not enough room, just prepend keyword
  const prefixed = `${capitalizeFirst(keyword)}: ${title}`;
  return prefixed.slice(0, maxLength);
}

/**
 * Add the primary keyword to a meta description. Prepends a sentence
 * containing the keyword if not already present.
 */
export function addKeywordToMetaDescription(
  desc: string,
  keyword: string,
  maxLength: number = 160,
): string {
  if (desc.toLowerCase().includes(keyword.toLowerCase())) {
    return desc;
  }

  const prefix = `Learn about ${keyword}. `;
  const result = `${prefix}${desc}`;

  if (result.length <= maxLength) {
    return result;
  }

  // Trim the end to fit
  return result.slice(0, maxLength - 3).trimEnd() + '...';
}

/**
 * Add the primary keyword to the first H2 heading in the HTML.
 * Prepends the keyword to the first H2's text content.
 */
export function addKeywordToFirstH2(html: string, keyword: string): string {
  const h2Regex = /(<h2[^>]*>)([\s\S]*?)(<\/h2>)/i;
  const match = html.match(h2Regex);

  if (!match) {
    return html;
  }

  const existingText = stripTags(match[2]);
  if (existingText.toLowerCase().includes(keyword.toLowerCase())) {
    return html;
  }

  const newText = `${capitalizeFirst(keyword)}: ${match[2]}`;
  return html.replace(h2Regex, `$1${newText}$3`);
}

/**
 * Add alt text to images that are missing it. Uses the primary keyword
 * for the first image, and "Article image" for subsequent ones.
 */
export function addAltTextToImages(html: string, keyword: string): string {
  let firstMissing = true;

  return html.replace(/<img\s([^>]*?)\/?>/gi, (fullMatch, attrs: string) => {
    const hasAlt = /alt\s*=\s*["'][^"']*["']/i.test(attrs);
    const hasNonEmptyAlt = /alt\s*=\s*["'][^"']+["']/i.test(attrs);

    if (hasNonEmptyAlt) {
      return fullMatch;
    }

    let altText: string;
    if (firstMissing) {
      altText = capitalizeFirst(keyword);
      firstMissing = false;
    } else {
      altText = `Article image related to ${keyword}`;
    }

    if (hasAlt) {
      // Replace empty alt with keyword alt
      return fullMatch.replace(/alt\s*=\s*["'][^"']*["']/i, `alt="${altText}"`);
    }

    // Add alt attribute
    return `<img alt="${altText}" ${attrs}/>`;
  });
}

/**
 * Generate a meta description from the article HTML by extracting the
 * first paragraph text and ensuring the keyword is included.
 */
export function generateMetaDescription(
  html: string,
  keyword: string,
  maxLength: number = 155,
): string {
  // Extract first paragraph
  const pMatch = html.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
  let text = pMatch ? stripTags(pMatch[1]) : '';

  if (!text) {
    // Fallback: strip all tags and take first chunk
    text = stripTags(html).slice(0, 300);
  }

  // Ensure keyword is present
  if (!text.toLowerCase().includes(keyword.toLowerCase())) {
    text = `${capitalizeFirst(keyword)}: ${text}`;
  }

  // Truncate to maxLength, ending at a word boundary
  if (text.length > maxLength) {
    text = text.slice(0, maxLength);
    const lastSpace = text.lastIndexOf(' ');
    if (lastSpace > maxLength * 0.7) {
      text = text.slice(0, lastSpace);
    }
    text = text.trimEnd() + '...';
  }

  return text;
}

/**
 * Capitalize the first letter of a string.
 */
function capitalizeFirst(str: string): string {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}
