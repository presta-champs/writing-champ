import { NextRequest } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { decrypt } from '@/lib/crypto';
import { generateImage, uploadImageToStorage, IMAGE_GEN_MODELS } from '@/lib/images/generate-image';
import { logUsageEvent } from '@/lib/usage';

const Schema = z.object({
  prompt: z.string().min(1, 'Prompt is required'),
  model: z.string().min(1, 'Model is required'),
  articleId: z.string().uuid().optional(),
});

function resolveKey(stored: Record<string, string>, dbKey: string, envVar: string): string {
  if (stored[dbKey]) {
    try { return decrypt(stored[dbKey]); } catch { /* */ }
  }
  return process.env[envVar] || '';
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const parsed = Schema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: parsed.error.issues.map((i) => i.message).join(', ') }, { status: 400 });
    }

    const modelDef = IMAGE_GEN_MODELS.find((m) => m.id === parsed.data.model);
    if (!modelDef) {
      return Response.json({ error: `Unknown image model: ${parsed.data.model}` }, { status: 400 });
    }

    const { data: membership } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user.id)
      .limit(1)
      .single();

    if (!membership) return Response.json({ error: 'No organization' }, { status: 403 });

    // Resolve API keys
    const { data: orgData } = await supabase
      .from('organizations')
      .select('api_integration_keys')
      .eq('id', membership.organization_id)
      .single();

    const storedKeys: Record<string, string> = orgData?.api_integration_keys || {};

    const keys = {
      gemini: resolveKey(storedKeys, 'google_ai_api_key', 'GOOGLE_AI_API_KEY'),
      openai: resolveKey(storedKeys, 'openai_api_key', 'OPENAI_API_KEY'),
    };

    const image = await generateImage(parsed.data.prompt, parsed.data.model, keys);

    // Upload to Supabase Storage
    const publicUrl = await uploadImageToStorage(
      supabase as unknown as Parameters<typeof uploadImageToStorage>[0],
      image.base64,
      image.mimeType,
      membership.organization_id,
      parsed.data.articleId ? `article-${parsed.data.articleId}-${Date.now()}` : undefined
    );

    await logUsageEvent({
      organizationId: membership.organization_id,
      userId: user.id,
      articleId: parsed.data.articleId,
      eventType: 'image_gen',
      modelUsed: parsed.data.model,
      estimatedCostUsd: modelDef.provider === 'openai' ? 0.04 : 0.02,
    });

    return Response.json({ url: publicUrl, alt: parsed.data.prompt });
  } catch (error) {
    console.error('Image generation error:', error);
    return Response.json(
      { error: error instanceof Error ? error.message : 'Image generation failed' },
      { status: 500 }
    );
  }
}
