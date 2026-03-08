export type GeneratedImage = {
  base64: string;
  mimeType: string;
  prompt: string;
};

export type ImageGenModel = {
  id: string;
  label: string;
  provider: 'gemini' | 'openai';
  /** Approximate cost per image in USD */
  costPerImage: number;
};

export const IMAGE_GEN_MODELS: ImageGenModel[] = [
  // Google Imagen models (dedicated image generation)
  { id: 'imagen-3.0-generate-002', label: 'Imagen 3', provider: 'gemini', costPerImage: 0.03 },
  { id: 'imagen-3.0-fast-generate-001', label: 'Imagen 3 Fast', provider: 'gemini', costPerImage: 0.02 },
  // OpenAI models
  { id: 'gpt-image-1', label: 'GPT Image 1', provider: 'openai', costPerImage: 0.04 },
  { id: 'dall-e-3', label: 'DALL·E 3', provider: 'openai', costPerImage: 0.08 },
  { id: 'dall-e-2', label: 'DALL·E 2', provider: 'openai', costPerImage: 0.02 },
];

/**
 * Generate an image using the specified model.
 */
export async function generateImage(
  prompt: string,
  modelId: string,
  keys: { gemini?: string; openai?: string }
): Promise<GeneratedImage> {
  const model = IMAGE_GEN_MODELS.find((m) => m.id === modelId);
  if (!model) throw new Error(`Unknown image model: ${modelId}`);

  if (model.provider === 'openai') {
    if (!keys.openai) throw new Error('OpenAI API key required for this model. Add one in Settings.');
    return generateWithOpenAI(prompt, modelId, keys.openai);
  }

  if (!keys.gemini) throw new Error('Google AI API key required for this model. Add one in Settings.');

  // Imagen models use the dedicated generateImages endpoint
  if (modelId.startsWith('imagen-')) {
    return generateWithImagen(prompt, modelId, keys.gemini);
  }

  // Gemini models use generateContent with IMAGE modality
  return generateWithGeminiContent(prompt, modelId, keys.gemini);
}

/**
 * Generate with Google Imagen 3 via the dedicated generateImages endpoint.
 * This is the primary method for image generation with Google AI keys.
 */
async function generateWithImagen(
  prompt: string,
  modelId: string,
  apiKey: string
): Promise<GeneratedImage> {
  const promptText = `Professional blog article image: ${prompt}. High quality, well-composed, suitable as a blog post header. No text overlays, no watermarks.`;

  // Try the generateImages endpoint (Google AI / AI Studio keys)
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateImages?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: promptText,
        config: {
          numberOfImages: 1,
        },
      }),
    }
  );

  if (!res.ok) {
    const errText = await res.text();
    console.error(`Imagen generateImages failed (${modelId}):`, res.status, errText.slice(0, 500));

    // Parse structured error if possible
    let hint = '';
    try {
      const errJson = JSON.parse(errText);
      const msg = errJson.error?.message || '';
      if (msg.includes('API key not valid') || msg.includes('API_KEY_INVALID')) {
        hint = ' Your API key may not have access to Imagen. Try creating a new key at https://aistudio.google.com/apikey';
      } else if (msg.includes('not found') || msg.includes('does not exist')) {
        hint = ' This model may not be available in your region or API plan.';
      } else if (msg.includes('billing')) {
        hint = ' Image generation may require a billing-enabled Google Cloud project.';
      }
    } catch { /* not JSON */ }

    throw new Error(`Imagen image generation failed (${modelId}): ${res.status}.${hint || ` Response: ${errText.slice(0, 200)}`}`);
  }

  const data = await res.json();

  // Response format: { generatedImages: [{ image: { imageBytes: "base64..." }, ... }] }
  const images = data.generatedImages || data.predictions || [];
  const first = images[0];

  if (first?.image?.imageBytes) {
    return {
      base64: first.image.imageBytes,
      mimeType: first.image.mimeType || 'image/png',
      prompt,
    };
  }

  // Fallback: Vertex-style response
  if (first?.bytesBase64Encoded) {
    return {
      base64: first.bytesBase64Encoded,
      mimeType: first.mimeType || 'image/png',
      prompt,
    };
  }

  throw new Error(`Imagen returned no image data. The model may not be available with your API key.`);
}

/**
 * Generate with Gemini generateContent using IMAGE response modality.
 * This is a fallback — only some Gemini model variants support this.
 */
async function generateWithGeminiContent(
  prompt: string,
  modelId: string,
  apiKey: string
): Promise<GeneratedImage> {
  const promptText = `Generate a high-quality, professional photograph or illustration for a blog article. The image should be: ${prompt}. Make it visually appealing, well-composed, and suitable as a blog post image. No text overlays.`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: promptText }] }],
        generationConfig: {
          responseModalities: ['TEXT', 'IMAGE'],
        },
      }),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini image generation failed (${modelId}): ${res.status} - ${err.slice(0, 300)}`);
  }

  const data = await res.json();
  const parts = data.candidates?.[0]?.content?.parts || [];

  for (const part of parts) {
    if (part.inlineData) {
      return {
        base64: part.inlineData.data,
        mimeType: part.inlineData.mimeType || 'image/png',
        prompt,
      };
    }
  }

  throw new Error(`Model ${modelId} did not return an image. It may not support image generation.`);
}

/**
 * Generate with OpenAI DALL-E or GPT Image.
 */
async function generateWithOpenAI(
  prompt: string,
  modelId: string,
  apiKey: string
): Promise<GeneratedImage> {
  const promptText = `Professional blog article image: ${prompt}. High quality, well-composed, suitable as a blog post header. No text overlays.`;

  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: modelId,
      prompt: promptText,
      n: 1,
      size: modelId === 'dall-e-3' || modelId === 'gpt-image-1' ? '1792x1024' : '1024x1024',
      response_format: 'b64_json',
      ...(modelId === 'dall-e-3' ? { quality: 'standard' } : {}),
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI image generation failed: ${res.status} - ${err.slice(0, 300)}`);
  }

  const data = await res.json();
  const imageData = data.data?.[0]?.b64_json;

  if (!imageData) {
    throw new Error('OpenAI did not return image data.');
  }

  return {
    base64: imageData,
    mimeType: 'image/png',
    prompt,
  };
}

/**
 * Upload a base64 image to Supabase Storage and return the public URL.
 */
export async function uploadImageToStorage(
  supabase: { storage: { from: (bucket: string) => { upload: (path: string, data: Buffer, options: Record<string, string>) => Promise<{ data: { path: string } | null; error: { message: string } | null }>; getPublicUrl: (path: string) => { data: { publicUrl: string } } } } },
  base64: string,
  mimeType: string,
  orgId: string,
  fileName?: string
): Promise<string> {
  const ext = mimeType.includes('png') ? 'png' : 'jpg';
  const path = `${orgId}/${fileName || `img-${Date.now()}`}.${ext}`;
  const buffer = Buffer.from(base64, 'base64');

  try {
    const { error } = await supabase.storage
      .from('article-images')
      .upload(path, buffer, { contentType: mimeType });

    if (error) throw error;

    const { data: urlData } = supabase.storage
      .from('article-images')
      .getPublicUrl(path);

    return urlData.publicUrl;
  } catch {
    // Storage unavailable (e.g. local dev) — return data URL as fallback
    return `data:${mimeType};base64,${base64}`;
  }
}
