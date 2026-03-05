// ---------------------------------------------------------------------------
// Ahrefs API v3 Client — Keywords Explorer
// ---------------------------------------------------------------------------
//
// Calls the Ahrefs REST API for keyword research data.
// Auth: Bearer token in the Authorization header.
// Base URL: https://api.ahrefs.com/v3/
// ---------------------------------------------------------------------------

export type AhrefsKeyword = {
  keyword: string;
  volume: number;
  keyword_difficulty: number;
  cpc: number;
  clicks?: number;
  global_volume?: number;
};

type AhrefsKeywordsExplorerResponse = {
  keywords?: {
    keyword: string;
    volume?: number;
    difficulty?: number;
    cpc?: number;
    clicks?: number;
    global_volume?: number;
  }[];
  error?: string;
};

type AhrefsKeywordOverviewResponse = {
  keywords?: {
    keyword: string;
    volume?: number;
    difficulty?: number;
    cpc?: number;
    clicks?: number;
    global_volume?: number;
  }[];
  error?: string;
};

const BASE_URL = 'https://api.ahrefs.com/v3';
const DEFAULT_LIMIT = 50;

class AhrefsApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'AhrefsApiError';
    this.status = status;
  }
}

async function ahrefsFetch<T>(
  endpoint: string,
  params: Record<string, string | number | string[]>,
  apiKey: string
): Promise<T> {
  const url = new URL(`${BASE_URL}${endpoint}`);

  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      // Ahrefs accepts comma-separated lists for array params
      url.searchParams.set(key, value.join(','));
    } else {
      url.searchParams.set(key, String(value));
    }
  }

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    let message = `Ahrefs API error (${response.status})`;

    try {
      const parsed = JSON.parse(body);
      if (parsed.error) message = parsed.error;
    } catch {
      if (body) message = body;
    }

    throw new AhrefsApiError(message, response.status);
  }

  return response.json() as Promise<T>;
}

function normalizeKeyword(raw: {
  keyword: string;
  volume?: number;
  difficulty?: number;
  cpc?: number;
  clicks?: number;
  global_volume?: number;
}): AhrefsKeyword {
  return {
    keyword: raw.keyword,
    volume: raw.volume ?? 0,
    keyword_difficulty: raw.difficulty ?? 0,
    cpc: raw.cpc ?? 0,
    clicks: raw.clicks,
    global_volume: raw.global_volume,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Search for matching keyword ideas based on a seed keyword.
 * Uses Ahrefs Keywords Explorer "matching terms" endpoint.
 *
 * @param seed - Seed keyword to expand on.
 * @param country - Two-letter country code (e.g. "us", "gb").
 * @param apiKey - Ahrefs API key (Bearer token).
 * @param limit - Max results to return (default 50).
 */
export async function searchKeywords(
  seed: string,
  country: string,
  apiKey: string,
  limit: number = DEFAULT_LIMIT
): Promise<AhrefsKeyword[]> {
  const data = await ahrefsFetch<AhrefsKeywordsExplorerResponse>(
    '/keywords-explorer/matching-terms',
    {
      select: 'keyword,volume,difficulty,cpc,clicks,global_volume',
      keyword: seed,
      country,
      limit,
      order_by: 'volume:desc',
    },
    apiKey
  );

  if (data.error) {
    throw new AhrefsApiError(data.error, 400);
  }

  return (data.keywords || []).map(normalizeKeyword);
}

/**
 * Get metrics overview for a list of specific keywords.
 * Uses Ahrefs Keywords Explorer "overview" endpoint.
 *
 * @param keywords - Array of keywords to look up.
 * @param country - Two-letter country code.
 * @param apiKey - Ahrefs API key.
 */
export async function getKeywordOverview(
  keywords: string[],
  country: string,
  apiKey: string
): Promise<AhrefsKeyword[]> {
  if (keywords.length === 0) return [];

  // Ahrefs accepts up to 100 keywords per request; chunk if needed
  const CHUNK_SIZE = 100;
  const results: AhrefsKeyword[] = [];

  for (let i = 0; i < keywords.length; i += CHUNK_SIZE) {
    const chunk = keywords.slice(i, i + CHUNK_SIZE);

    const data = await ahrefsFetch<AhrefsKeywordOverviewResponse>(
      '/keywords-explorer/overview',
      {
        select: 'keyword,volume,difficulty,cpc,clicks,global_volume',
        keywords: chunk,
        country,
      },
      apiKey
    );

    if (data.error) {
      throw new AhrefsApiError(data.error, 400);
    }

    results.push(...(data.keywords || []).map(normalizeKeyword));
  }

  return results;
}
