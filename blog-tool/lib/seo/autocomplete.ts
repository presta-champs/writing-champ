// ---------------------------------------------------------------------------
// Google Autocomplete Client — Keyword Suggestions
// ---------------------------------------------------------------------------
//
// Fetches real search suggestions from Google Autocomplete (free, no API key).
// Used to generate keyword ideas for SEO-optimized article generation.
// ---------------------------------------------------------------------------

export type RawKeyword = {
  keyword: string;
  volume: number;
  keyword_difficulty: number;
  cpc: number;
};

// Language codes mapped from 2-letter country codes
const COUNTRY_TO_LANG: Record<string, string> = {
  us: 'en',
  gb: 'en',
  de: 'de',
  fr: 'fr',
  es: 'es',
  it: 'it',
  nl: 'nl',
  au: 'en',
  ca: 'en',
};

// Google Autocomplete country param (gl=country)
const COUNTRY_TO_GL: Record<string, string> = {
  us: 'us',
  gb: 'uk',
  de: 'de',
  fr: 'fr',
  es: 'es',
  it: 'it',
  nl: 'nl',
  au: 'au',
  ca: 'ca',
};

const MODIFIERS = [
  '',           // plain seed
  'how to ',
  'best ',
  'what is ',
  ' tips',
  ' guide',
  ' vs ',
  ' for beginners',
];

/**
 * Fetch autocomplete suggestions for a single query.
 * Returns an array of suggestion strings.
 */
async function fetchSuggestions(
  query: string,
  country: string
): Promise<string[]> {
  const hl = COUNTRY_TO_LANG[country] || 'en';
  const gl = COUNTRY_TO_GL[country] || 'us';

  const url = new URL('https://www.google.com/complete/search');
  url.searchParams.set('client', 'firefox');
  url.searchParams.set('q', query);
  url.searchParams.set('hl', hl);
  url.searchParams.set('gl', gl);

  const response = await fetch(url.toString(), {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; WritingChamps/1.0)',
    },
  });

  if (!response.ok) {
    return [];
  }

  // Response format: ["query", ["suggestion1", "suggestion2", ...]]
  const data = await response.json();
  if (Array.isArray(data) && Array.isArray(data[1])) {
    return data[1].filter((s: unknown): s is string => typeof s === 'string');
  }
  return [];
}

/**
 * Search for keyword suggestions using Google Autocomplete.
 *
 * Fires multiple queries (seed + modifiers) in parallel to get a broader
 * set of real search suggestions. Returns deduplicated results.
 *
 * @param seed - Seed keyword to expand on.
 * @param country - Two-letter country code (e.g. "us", "gb").
 * @param limit - Max results to return (default 50).
 */
export async function searchKeywords(
  seed: string,
  country: string,
  limit: number = 50
): Promise<RawKeyword[]> {
  const queries = MODIFIERS.map((mod) => {
    if (mod.endsWith(' ')) return mod + seed;
    if (mod.startsWith(' ')) return seed + mod;
    return seed;
  });

  // Also add alphabet expansion: "seed a", "seed b", etc. for more variety
  const alphaQueries = 'abcdefghijklmnop'.split('').map((c) => `${seed} ${c}`);

  const allQueries = [...new Set([...queries, ...alphaQueries])];

  // Fire all requests in parallel
  const results = await Promise.allSettled(
    allQueries.map((q) => fetchSuggestions(q, country))
  );

  // Collect and deduplicate
  const seen = new Set<string>();
  const keywords: RawKeyword[] = [];

  // Always include the seed itself
  const seedLower = seed.toLowerCase().trim();
  seen.add(seedLower);
  keywords.push({
    keyword: seed.trim(),
    volume: 0,
    keyword_difficulty: 0,
    cpc: 0,
  });

  for (const result of results) {
    if (result.status !== 'fulfilled') continue;
    for (const suggestion of result.value) {
      const normalized = suggestion.toLowerCase().trim();
      if (seen.has(normalized)) continue;
      if (normalized.length < 2) continue;
      seen.add(normalized);
      keywords.push({
        keyword: suggestion.trim(),
        volume: 0,
        keyword_difficulty: 0,
        cpc: 0,
      });
      if (keywords.length >= limit) break;
    }
    if (keywords.length >= limit) break;
  }

  return keywords;
}
