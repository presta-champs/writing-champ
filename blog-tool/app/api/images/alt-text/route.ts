import { NextRequest } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { decrypt } from '@/lib/crypto';
import { generateAltText, generateAltTextsForArticle } from '@/lib/images/alt-text';
import { logUsageEvent } from '@/lib/usage';

const SingleSchema = z.object({
  imageUrl: z.string().url(),
  context: z.string().optional(),
  primaryKeyword: z.string().optional(),
});

const BulkSchema = z.object({
  html: z.string().min(1),
  articleTitle: z.string().min(1),
  primaryKeyword: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: membership } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user.id)
      .limit(1)
      .single();

    if (!membership) return Response.json({ error: 'No organization' }, { status: 403 });

    // Resolve Google AI API key
    const { data: orgData } = await supabase
      .from('organizations')
      .select('api_integration_keys')
      .eq('id', membership.organization_id)
      .single();

    const storedKeys: Record<string, string> = orgData?.api_integration_keys || {};
    let apiKey = '';
    if (storedKeys.google_ai_api_key) {
      try { apiKey = decrypt(storedKeys.google_ai_api_key); } catch { /* */ }
    }
    if (!apiKey) apiKey = process.env.GOOGLE_AI_API_KEY || '';

    if (!apiKey) {
      return Response.json(
        { error: 'Google AI API key required for alt text generation. Add one in Settings.' },
        { status: 400 }
      );
    }

    const body = await request.json();

    // Bulk mode: generate alt text for all images in HTML
    if (body.html) {
      const parsed = BulkSchema.safeParse(body);
      if (!parsed.success) {
        return Response.json({ error: parsed.error.issues.map((i) => i.message).join(', ') }, { status: 400 });
      }

      const images = await generateAltTextsForArticle(
        parsed.data.html,
        parsed.data.articleTitle,
        parsed.data.primaryKeyword,
        apiKey
      );

      await logUsageEvent({
        organizationId: membership.organization_id,
        userId: user.id,
        eventType: 'image_gen',
        modelUsed: 'gemini-2.0-flash',
        estimatedCostUsd: images.length * 0.002,
      });

      return Response.json({ images });
    }

    // Single mode: generate alt text for one image
    const parsed = SingleSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: parsed.error.issues.map((i) => i.message).join(', ') }, { status: 400 });
    }

    const alt = await generateAltText(
      parsed.data.imageUrl,
      parsed.data.context || '',
      parsed.data.primaryKeyword,
      apiKey
    );

    await logUsageEvent({
      organizationId: membership.organization_id,
      userId: user.id,
      eventType: 'image_gen',
      modelUsed: 'gemini-2.0-flash',
      estimatedCostUsd: 0.002,
    });

    return Response.json({ alt });
  } catch (error) {
    console.error('Alt text generation error:', error);
    return Response.json(
      { error: 'Alt text generation failed. Please try again.' },
      { status: 500 }
    );
  }
}
