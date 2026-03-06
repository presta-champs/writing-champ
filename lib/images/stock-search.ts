export type StockPhoto = {
  id: string;
  source: 'unsplash' | 'pexels';
  url: string;
  thumbUrl: string;
  alt: string;
  photographer: string;
  photographerUrl: string;
  width: number;
  height: number;
  downloadUrl?: string;
};

export type StockSearchResult = {
  photos: StockPhoto[];
  totalResults: number;
};

export async function searchUnsplash(
  query: string,
  page: number,
  perPage: number,
  apiKey: string
): Promise<StockSearchResult> {
  const url = new URL('https://api.unsplash.com/search/photos');
  url.searchParams.set('query', query);
  url.searchParams.set('page', String(page));
  url.searchParams.set('per_page', String(perPage));
  url.searchParams.set('orientation', 'landscape');

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Client-ID ${apiKey}` },
  });

  if (!res.ok) {
    throw new Error(`Unsplash API error: ${res.status}`);
  }

  const data = await res.json();

  return {
    totalResults: data.total || 0,
    photos: (data.results || []).map((p: Record<string, unknown>) => ({
      id: `unsplash-${p.id}`,
      source: 'unsplash' as const,
      url: (p.urls as Record<string, string>).regular,
      thumbUrl: (p.urls as Record<string, string>).small,
      alt: (p.alt_description as string) || (p.description as string) || query,
      photographer: (p.user as Record<string, string>).name,
      photographerUrl: (p.user as Record<string, Record<string, string>>).links?.html || '',
      width: p.width as number,
      height: p.height as number,
      downloadUrl: (p.links as Record<string, string>).download_location,
    })),
  };
}

export async function searchPexels(
  query: string,
  page: number,
  perPage: number,
  apiKey: string
): Promise<StockSearchResult> {
  const url = new URL('https://api.pexels.com/v1/search');
  url.searchParams.set('query', query);
  url.searchParams.set('page', String(page));
  url.searchParams.set('per_page', String(perPage));
  url.searchParams.set('orientation', 'landscape');

  const res = await fetch(url.toString(), {
    headers: { Authorization: apiKey },
  });

  if (!res.ok) {
    throw new Error(`Pexels API error: ${res.status}`);
  }

  const data = await res.json();

  return {
    totalResults: data.total_results || 0,
    photos: (data.photos || []).map((p: Record<string, unknown>) => ({
      id: `pexels-${p.id}`,
      source: 'pexels' as const,
      url: (p.src as Record<string, string>).large,
      thumbUrl: (p.src as Record<string, string>).medium,
      alt: (p.alt as string) || query,
      photographer: p.photographer as string,
      photographerUrl: p.photographer_url as string,
      width: p.width as number,
      height: p.height as number,
    })),
  };
}

/**
 * Search both Unsplash and Pexels, merge results interleaved.
 */
export async function searchStockPhotos(
  query: string,
  page: number,
  perPage: number,
  keys: { unsplash?: string; pexels?: string }
): Promise<StockSearchResult> {
  const halfPer = Math.ceil(perPage / 2);
  const promises: Promise<StockSearchResult>[] = [];

  if (keys.unsplash) promises.push(searchUnsplash(query, page, halfPer, keys.unsplash).catch(() => ({ photos: [], totalResults: 0 })));
  if (keys.pexels) promises.push(searchPexels(query, page, halfPer, keys.pexels).catch(() => ({ photos: [], totalResults: 0 })));

  if (promises.length === 0) {
    throw new Error('No stock photo API keys configured. Add Unsplash or Pexels key in Settings.');
  }

  const results = await Promise.all(promises);
  const merged: StockPhoto[] = [];
  const maxLen = Math.max(...results.map((r) => r.photos.length));

  for (let i = 0; i < maxLen; i++) {
    for (const r of results) {
      if (i < r.photos.length) merged.push(r.photos[i]);
    }
  }

  return {
    photos: merged.slice(0, perPage),
    totalResults: results.reduce((sum, r) => sum + r.totalResults, 0),
  };
}

/**
 * Trigger Unsplash download tracking (required by API guidelines).
 */
export async function triggerUnsplashDownload(downloadUrl: string, apiKey: string): Promise<void> {
  await fetch(downloadUrl, {
    headers: { Authorization: `Client-ID ${apiKey}` },
  }).catch(() => {});
}
