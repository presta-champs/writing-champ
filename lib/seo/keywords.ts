// ---------------------------------------------------------------------------
// Keyword Filtering and Clustering
// ---------------------------------------------------------------------------
//
// Pure utility functions — no API calls, no side effects.
// ---------------------------------------------------------------------------

import type { AhrefsKeyword } from './ahrefs';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type KeywordData = {
  keyword: string;
  volume: number;
  difficulty: number;
  cpc: number;
  clicks?: number;
  global_volume?: number;
};

export type KeywordCluster = {
  label: string;
  keywords: KeywordData[];
};

export type KeywordFilterOptions = {
  minVolume?: number;
  maxVolume?: number;
  maxDifficulty?: number;
  minCpc?: number;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Convert AhrefsKeyword to our normalized KeywordData shape.
 */
export function toKeywordData(ak: AhrefsKeyword): KeywordData {
  return {
    keyword: ak.keyword,
    volume: ak.volume,
    difficulty: ak.keyword_difficulty,
    cpc: ak.cpc,
    clicks: ak.clicks,
    global_volume: ak.global_volume,
  };
}

/**
 * Tokenize a keyword into lowercase words, stripping common stop words.
 */
const STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'it', 'its', 'this', 'that', 'how', 'what', 'which', 'who', 'when',
  'where', 'why', 'do', 'does', 'did', 'can', 'could', 'will', 'would',
  'should', 'has', 'have', 'had', 'not', 'no', 'so', 'if', 'as', 'from',
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOP_WORDS.has(w));
}

/**
 * Compute word-overlap similarity between two token sets (Jaccard index).
 */
function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  let intersection = 0;
  for (const word of a) {
    if (b.has(word)) intersection++;
  }
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Filter keywords by volume, difficulty, and CPC thresholds.
 */
export function filterKeywords(
  keywords: KeywordData[],
  options: KeywordFilterOptions
): KeywordData[] {
  return keywords.filter((kw) => {
    if (options.minVolume !== undefined && kw.volume < options.minVolume) return false;
    if (options.maxVolume !== undefined && kw.volume > options.maxVolume) return false;
    if (options.maxDifficulty !== undefined && kw.difficulty > options.maxDifficulty) return false;
    if (options.minCpc !== undefined && kw.cpc < options.minCpc) return false;
    return true;
  });
}

/**
 * Cluster keywords into groups of semantically similar terms using
 * simple word-overlap scoring (Jaccard similarity).
 *
 * Algorithm:
 * 1. Tokenize each keyword.
 * 2. Iterate through keywords in order of descending volume.
 * 3. For each keyword, either assign to an existing cluster (if similarity
 *    to the cluster label is above threshold) or create a new cluster.
 *
 * @param keywords - Keywords to cluster.
 * @param threshold - Minimum Jaccard similarity to join an existing cluster (default 0.3).
 */
export function clusterKeywords(
  keywords: KeywordData[],
  threshold: number = 0.3
): KeywordCluster[] {
  if (keywords.length === 0) return [];

  // Sort by volume descending — highest-volume keyword becomes cluster label
  const sorted = [...keywords].sort((a, b) => b.volume - a.volume);

  const clusters: {
    label: string;
    labelTokens: Set<string>;
    keywords: KeywordData[];
  }[] = [];

  for (const kw of sorted) {
    const kwTokens = new Set(tokenize(kw.keyword));

    let bestCluster: (typeof clusters)[number] | null = null;
    let bestSimilarity = 0;

    for (const cluster of clusters) {
      const similarity = jaccardSimilarity(kwTokens, cluster.labelTokens);
      if (similarity > bestSimilarity) {
        bestSimilarity = similarity;
        bestCluster = cluster;
      }
    }

    if (bestCluster && bestSimilarity >= threshold) {
      bestCluster.keywords.push(kw);
    } else {
      // Start a new cluster with this keyword as the label
      clusters.push({
        label: kw.keyword,
        labelTokens: kwTokens,
        keywords: [kw],
      });
    }
  }

  return clusters.map((c) => ({
    label: c.label,
    keywords: c.keywords,
  }));
}
