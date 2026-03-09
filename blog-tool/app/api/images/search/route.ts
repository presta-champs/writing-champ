import { createClient } from '@/lib/supabase/server';
import { decrypt } from '@/lib/crypto';
import { searchStockPhotos, triggerUnsplashDownload } from '@/lib/images/stock-search';
import { logUsageEvent } from '@/lib/usage';
import { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
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

    const { searchParams } = request.nextUrl;
    const query = searchParams.get('q');
    const page = parseInt(searchParams.get('page') || '1');
    const perPage = parseInt(searchParams.get('per_page') || '12');

    if (!query) return Response.json({ error: 'Query parameter "q" is required' }, { status: 400 });

    // Resolve API keys
    const { data: orgData } = await supabase
      .from('organizations')
      .select('api_integration_keys')
      .eq('id', membership.organization_id)
      .single();

    const storedKeys: Record<string, string> = orgData?.api_integration_keys || {};

    function resolveKey(dbKey: string, envVar: string): string | undefined {
      if (storedKeys[dbKey]) {
        try { return decrypt(storedKeys[dbKey]); } catch { /* fall through */ }
      }
      return process.env[envVar] || undefined;
    }

    const keys = {
      unsplash: resolveKey('unsplash_access_key', 'UNSPLASH_ACCESS_KEY'),
      pexels: resolveKey('pexels_api_key', 'PEXELS_API_KEY'),
    };

    if (!keys.unsplash && !keys.pexels) {
      return Response.json(
        { error: 'No stock photo API key configured. Add an Unsplash or Pexels key in Settings.' },
        { status: 400 }
      );
    }

    const result = await searchStockPhotos(query, page, perPage, keys);

    await logUsageEvent({
      organizationId: membership.organization_id,
      userId: user.id,
      eventType: 'stock_search',
    });

    return Response.json(result);
  } catch (error) {
    console.error('Stock search error:', error);
    return Response.json(
      { error: error instanceof Error ? error.message : 'Search failed' },
      { status: 500 }
    );
  }
}

/**
 * POST: Trigger Unsplash download tracking (API requirement).
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { downloadUrl } = await request.json();
    if (!downloadUrl) return Response.json({ error: 'downloadUrl required' }, { status: 400 });

    const { data: membership } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user.id)
      .limit(1)
      .single();

    if (!membership) return Response.json({ error: 'No organization' }, { status: 403 });

    const { data: orgData } = await supabase
      .from('organizations')
      .select('api_integration_keys')
      .eq('id', membership.organization_id)
      .single();

    const storedKeys: Record<string, string> = orgData?.api_integration_keys || {};
    let unsplashKey = '';
    if (storedKeys.unsplash_access_key) {
      try { unsplashKey = decrypt(storedKeys.unsplash_access_key); } catch { /* */ }
    }
    if (!unsplashKey) unsplashKey = process.env.UNSPLASH_ACCESS_KEY || '';

    if (unsplashKey) {
      await triggerUnsplashDownload(downloadUrl, unsplashKey);
    }

    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: true }); // Don't fail on download tracking
  }
}
