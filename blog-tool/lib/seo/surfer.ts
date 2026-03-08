// -----------------------------------------------------------------------
// Surfer SEO External Grader Integration
// Optional — calls Surfer SEO's Content Editor API to get a content score
// and actionable suggestions. Best-effort: errors are swallowed and
// returned as `{ score: 0, suggestions: [], error: "..." }`.
// -----------------------------------------------------------------------

export type SurferResult = {
  score: number;
  suggestions: string[];
  error?: string;
};

/**
 * Audit content against Surfer SEO's Content Editor API.
 *
 * This is a fire-and-forget companion to the internal SEO checker.
 * If the API is unreachable or returns an error, we degrade gracefully
 * and return an error message — we never throw.
 */
export async function checkWithSurfer(
  apiKey: string,
  content: string,
  primaryKeyword: string,
): Promise<SurferResult> {
  const SURFER_ENDPOINT = 'https://api.surferseo.com/v1/content_editors/audit';

  try {
    const res = await fetch(SURFER_ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        content,
        keyword: primaryKeyword,
      }),
      signal: AbortSignal.timeout(15_000), // 15 s timeout
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return {
        score: 0,
        suggestions: [],
        error: `Surfer SEO API returned ${res.status}${text ? `: ${text}` : ''}.`,
      };
    }

    const data = await res.json();

    // Surfer returns `content_score` (0-100) and a `suggestions` array.
    const score =
      typeof data.content_score === 'number'
        ? Math.round(data.content_score)
        : 0;

    const suggestions: string[] = Array.isArray(data.suggestions)
      ? data.suggestions
          .map((s: unknown) => (typeof s === 'string' ? s : (s as { text?: string })?.text ?? ''))
          .filter(Boolean)
      : [];

    return { score, suggestions };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Unknown error contacting Surfer SEO.';
    return { score: 0, suggestions: [], error: message };
  }
}
