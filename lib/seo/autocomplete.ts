type KeywordResult = {
  keyword: string;
  volume?: number;
  difficulty?: number;
  cpc?: number;
};

/**
 * Search for keyword suggestions using Google Autocomplete API.
 * Falls back to a simple prefix expansion if the API is unavailable.
 */
export async function searchKeywords(
  seed: string,
  country: string = "us",
  limit: number = 10
): Promise<KeywordResult[]> {
  if (!seed.trim()) return [];

  try {
    // Google Suggest (public, no auth needed)
    const url = `https://suggestqueries.google.com/complete/search?client=firefox&q=${encodeURIComponent(seed)}&hl=${country}`;
    const res = await fetch(url, {
      signal: AbortSignal.timeout(5000),
      headers: { "User-Agent": "Mozilla/5.0" },
    });

    if (!res.ok) {
      return fallbackSuggestions(seed, limit);
    }

    const data = await res.json();
    const suggestions: string[] = data[1] || [];

    return suggestions.slice(0, limit).map((kw) => ({
      keyword: kw,
    }));
  } catch {
    return fallbackSuggestions(seed, limit);
  }
}

function fallbackSuggestions(seed: string, limit: number): KeywordResult[] {
  const suffixes = [
    "",
    " guide",
    " tips",
    " best practices",
    " examples",
    " how to",
    " tutorial",
    " vs",
    " benefits",
    " tools",
  ];

  return suffixes.slice(0, limit).map((suffix) => ({
    keyword: seed.trim() + suffix,
  }));
}
