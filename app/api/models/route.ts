import { createClient } from '@/lib/supabase/server';
import { decrypt } from '@/lib/crypto';
import { AVAILABLE_MODELS } from '@/lib/generation/model-router';
import type { Provider } from '@/lib/generation/model-router';

/**
 * Returns the list of models available to the current user's org,
 * based on which provider API keys are configured.
 */
export async function GET() {
  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: membership } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user.id)
      .limit(1)
      .single();

    if (!membership) {
      return Response.json({ models: [] });
    }

    const { data: orgData } = await supabase
      .from('organizations')
      .select('api_integration_keys')
      .eq('id', membership.organization_id)
      .single();

    const storedKeys: Record<string, string> = orgData?.api_integration_keys || {};

    function hasKey(dbKey: string, envVar: string): boolean {
      if (storedKeys[dbKey]) {
        try { return decrypt(storedKeys[dbKey]).length > 0; } catch { /* fall through */ }
      }
      return !!(process.env[envVar]);
    }

    const availableProviders = new Set<Provider>();
    if (hasKey('anthropic_api_key', 'ANTHROPIC_API_KEY')) availableProviders.add('anthropic');
    if (hasKey('openai_api_key', 'OPENAI_API_KEY')) availableProviders.add('openai');

    const models = AVAILABLE_MODELS
      .filter(m => availableProviders.has(m.provider))
      .map(m => ({ id: m.id, label: m.label, provider: m.provider }));

    return Response.json({ models });
  } catch {
    return Response.json({ models: [] });
  }
}
