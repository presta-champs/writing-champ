/**
 * Check article content with Surfer SEO external grader.
 * Requires a Surfer SEO API key.
 */
export async function checkWithSurfer(
  apiKey: string,
  html: string,
  primaryKeyword: string
): Promise<{ score: number; suggestions: string[]; error?: string }> {
  if (!apiKey) {
    return { score: 0, suggestions: [], error: "No Surfer SEO API key provided" };
  }

  try {
    // Strip HTML to plain text for content analysis
    const text = html
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    const res = await fetch("https://api.surferseo.com/v1/content_editor/audit", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        keyword: primaryKeyword,
        content: text,
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      return {
        score: 0,
        suggestions: [],
        error: `Surfer API error: ${res.status} ${errBody}`,
      };
    }

    const data = await res.json();

    return {
      score: data.score ?? data.content_score ?? 0,
      suggestions: data.suggestions ?? data.recommendations ?? [],
    };
  } catch (err) {
    return {
      score: 0,
      suggestions: [],
      error: err instanceof Error ? err.message : "Surfer check failed",
    };
  }
}
