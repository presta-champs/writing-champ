import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: membership } = await supabase
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', user.id)
    .limit(1)
    .single();

  if (!membership) {
    return Response.json({ error: 'No organization found' }, { status: 403 });
  }

  const { data: article } = await supabase
    .from('articles')
    .select('*, personas(name), websites(name, url)')
    .eq('id', id)
    .eq('organization_id', membership.organization_id)
    .single();

  if (!article) {
    return Response.json({ error: 'Article not found' }, { status: 404 });
  }

  return Response.json(article);
}
