import { GoogleGenerativeAI } from '@google/generative-ai';

/**
 * Generate alt text for an image using Gemini vision.
 */
export async function generateAltText(
  imageUrl: string,
  articleContext: string,
  primaryKeyword?: string,
  apiKey?: string
): Promise<string> {
  const key = apiKey || process.env.GOOGLE_AI_API_KEY;
  if (!key) throw new Error('Google AI API key required for alt text generation');

  const client = new GoogleGenerativeAI(key);
  const model = client.getGenerativeModel({ model: 'gemini-2.0-flash' });

  // Download image and convert to base64
  const imgRes = await fetch(imageUrl);
  if (!imgRes.ok) throw new Error(`Failed to fetch image: ${imgRes.status}`);
  const buffer = Buffer.from(await imgRes.arrayBuffer());
  const base64 = buffer.toString('base64');
  const mimeType = imgRes.headers.get('content-type') || 'image/jpeg';

  const keywordHint = primaryKeyword
    ? ` Naturally include the keyword "${primaryKeyword}" if it fits.`
    : '';

  const result = await model.generateContent([
    {
      inlineData: { data: base64, mimeType },
    },
    {
      text: `Generate concise, descriptive alt text for this image. The image appears in a blog article about: ${articleContext}.${keywordHint} Keep it under 125 characters. Return ONLY the alt text, nothing else.`,
    },
  ]);

  return result.response.text().trim();
}

/**
 * Find all images in HTML that are missing alt text and generate it.
 */
export async function generateAltTextsForArticle(
  html: string,
  articleTitle: string,
  primaryKeyword?: string,
  apiKey?: string
): Promise<{ src: string; alt: string }[]> {
  const imgRegex = /<img\s+[^>]*src=["']([^"']+)["'][^>]*>/gi;
  const results: { src: string; alt: string }[] = [];
  let match;

  while ((match = imgRegex.exec(html)) !== null) {
    const fullTag = match[0];
    const src = match[1];

    // Check if alt is missing or empty
    const altMatch = fullTag.match(/alt=["']([^"']*)["']/i);
    if (altMatch && altMatch[1].trim()) continue; // Already has alt text

    try {
      const alt = await generateAltText(src, articleTitle, primaryKeyword, apiKey);
      results.push({ src, alt });
    } catch {
      // If we can't generate alt text for one image, skip and continue
      results.push({ src, alt: primaryKeyword || articleTitle });
    }
  }

  return results;
}
