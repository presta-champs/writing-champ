// -----------------------------------------------------------------------
// HTML Parser — extracts structured data from article HTML
// Uses regex-based parsing (no browser DOMParser, no external deps).
// -----------------------------------------------------------------------

import type { ParsedArticle, ParsedHeading, ParsedLink, ParsedImage } from './types';

/**
 * Strip all HTML tags and decode common HTML entities.
 */
function stripTags(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extract all headings (h1-h6) from HTML.
 */
function extractHeadings(html: string): ParsedHeading[] {
  const headings: ParsedHeading[] = [];
  const regex = /<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(html)) !== null) {
    headings.push({
      level: parseInt(match[1], 10),
      text: stripTags(match[2]),
    });
  }

  return headings;
}

/**
 * Determine if a URL is internal. A link is internal if:
 * - It starts with "/" (relative)
 * - It starts with "#" (anchor)
 * - It matches the site's own domain (handled externally; here we use heuristics)
 */
function isInternalLink(href: string): boolean {
  if (!href) return false;
  const trimmed = href.trim();
  if (trimmed.startsWith('/') || trimmed.startsWith('#') || trimmed.startsWith('./') || trimmed.startsWith('../')) {
    return true;
  }
  // Absolute URLs starting with http(s) are external
  if (/^https?:\/\//i.test(trimmed)) {
    return false;
  }
  // Anything else (e.g. "page.html") is treated as internal
  return true;
}

/**
 * Extract all links from HTML.
 */
function extractLinks(html: string): ParsedLink[] {
  const links: ParsedLink[] = [];
  const regex = /<a\s[^>]*href\s*=\s*["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(html)) !== null) {
    links.push({
      href: match[1],
      text: stripTags(match[2]),
      isInternal: isInternalLink(match[1]),
    });
  }

  return links;
}

/**
 * Extract all paragraphs from HTML.
 */
function extractParagraphs(html: string): string[] {
  const paragraphs: string[] = [];
  const regex = /<p[^>]*>([\s\S]*?)<\/p>/gi;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(html)) !== null) {
    const text = stripTags(match[1]);
    if (text.length > 0) {
      paragraphs.push(text);
    }
  }

  return paragraphs;
}

/**
 * Extract all images from HTML.
 */
function extractImages(html: string): ParsedImage[] {
  const images: ParsedImage[] = [];
  // Handle both self-closing and non-self-closing img tags
  const regex = /<img\s[^>]*?\/?>/gi;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(html)) !== null) {
    const tag = match[0];
    const srcMatch = tag.match(/src\s*=\s*["']([^"']*)["']/i);
    const altMatch = tag.match(/alt\s*=\s*["']([^"']*)["']/i);

    images.push({
      src: srcMatch ? srcMatch[1] : '',
      alt: altMatch ? altMatch[1] : '',
    });
  }

  return images;
}

/**
 * Extract meta title from <title> tag.
 */
function extractMetaTitle(html: string): string {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? stripTags(match[1]) : '';
}

/**
 * Extract meta description from <meta name="description"> tag.
 */
function extractMetaDescription(html: string): string {
  const match = html.match(/<meta\s[^>]*name\s*=\s*["']description["'][^>]*content\s*=\s*["']([^"']*)["'][^>]*\/?>/i);
  if (match) return match[1];

  // Try reversed attribute order (content before name)
  const reversed = html.match(/<meta\s[^>]*content\s*=\s*["']([^"']*)["'][^>]*name\s*=\s*["']description["'][^>]*\/?>/i);
  return reversed ? reversed[1] : '';
}

/**
 * Count words in a text string.
 */
function countWords(text: string): number {
  const words = text.split(/\s+/).filter(w => w.length > 0);
  return words.length;
}

/**
 * Parse an HTML article into structured data.
 */
export function parseArticleHtml(html: string): ParsedArticle {
  const headings = extractHeadings(html);
  const links = extractLinks(html);
  const paragraphs = extractParagraphs(html);
  const images = extractImages(html);
  const metaTitle = extractMetaTitle(html);
  const metaDescription = extractMetaDescription(html);

  // Body text: strip all HTML from the body (or entire document)
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  const bodyHtml = bodyMatch ? bodyMatch[1] : html;
  const bodyText = stripTags(bodyHtml);
  const wordCount = countWords(bodyText);

  return {
    headings,
    links,
    paragraphs,
    images,
    metaTitle,
    metaDescription,
    bodyText,
    wordCount,
  };
}

export { stripTags, countWords };
