// -----------------------------------------------------------------------
// SEO Engine Types
// Shared across all SEO checker modules.
// -----------------------------------------------------------------------

/** Result of a single SEO check. */
export type SeoCheckResult = {
  id: string;
  category: 'keywords' | 'structure' | 'meta' | 'links' | 'readability' | 'images';
  label: string;
  status: 'pass' | 'warning' | 'fail';
  message: string;
  fixable?: boolean;
  details?: Record<string, unknown>;
};

/** Aggregated result from a full SEO audit. */
export type SeoAuditResult = {
  score: number; // 0-100
  checks: SeoCheckResult[];
  summary: { pass: number; warning: number; fail: number };
};

/** Input to the SEO audit orchestrator. */
export type SeoAuditInput = {
  html: string;
  metaTitle?: string;
  metaDescription?: string;
  primaryKeyword: string;
  secondaryKeywords?: string[];
  targetWordCount?: number;
  contentIndex?: { url: string; title: string }[];
  personaSeoSettings?: {
    seo_internal_linking?: number;
    seo_external_linking?: number;
    seo_keyword_density?: number;
    seo_heading_depth?: string | number;
    seo_readability_target?: number;
    seo_min_word_count?: number;
    seo_max_word_count?: number;
  };
};

// -----------------------------------------------------------------------
// HTML parser output types
// -----------------------------------------------------------------------

export type ParsedHeading = {
  level: number; // 1-6
  text: string;
};

export type ParsedLink = {
  href: string;
  text: string;
  isInternal: boolean;
};

export type ParsedImage = {
  src: string;
  alt: string;
};

export type ParsedArticle = {
  headings: ParsedHeading[];
  links: ParsedLink[];
  paragraphs: string[];
  images: ParsedImage[];
  metaTitle: string;
  metaDescription: string;
  bodyText: string; // all visible text concatenated
  wordCount: number;
};

// -----------------------------------------------------------------------
// Density analysis types
// -----------------------------------------------------------------------

export type KeywordDensityResult = {
  keyword: string;
  occurrences: number;
  density: number; // percentage
  status: 'pass' | 'warning' | 'fail';
  message: string;
};

// -----------------------------------------------------------------------
// Readability types
// -----------------------------------------------------------------------

export type ReadabilityResult = {
  fleschKincaidScore: number;
  gradeLevel: number;
  averageSentenceLength: number;
  averageSyllablesPerWord: number;
  totalSentences: number;
  totalWords: number;
  totalSyllables: number;
};
