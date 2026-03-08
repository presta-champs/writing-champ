// -----------------------------------------------------------------------
// SEO Engine — public API
// Import from '@/lib/seo' to access the checker and all sub-modules.
// -----------------------------------------------------------------------

// Types
export type {
  SeoCheckResult,
  SeoAuditResult,
  SeoAuditInput,
  ParsedArticle,
  ParsedHeading,
  ParsedLink,
  ParsedImage,
  KeywordDensityResult,
  ReadabilityResult,
} from './types';

// Orchestrator
export { runSeoAudit } from './checker';

// Individual modules
export { parseArticleHtml } from './html-parser';
export { calculateDensity, containsKeyword, runDensityChecks } from './density';
export { runHeadingChecks } from './headings';
export { runMetaChecks } from './meta';
export { runLinkChecks } from './links';
export { runImageChecks } from './images';
export { calculateReadability, runReadabilityChecks } from './readability';
export { runWordCountCheck } from './word-count';

// Fixes
export {
  addKeywordToMetaTitle,
  addKeywordToMetaDescription,
  addKeywordToFirstH2,
  addAltTextToImages,
  generateMetaDescription,
} from './fixes';
