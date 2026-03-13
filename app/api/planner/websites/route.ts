import { createClient } from '@/lib/supabase/server';

export async function GET() {
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

  const orgId = membership.organization_id;

  const [{ data: websites }, { data: personas }] = await Promise.all([
    supabase
      .from('websites')
      .select('id, name')
      .eq('organization_id', orgId)
      .order('name'),
    supabase
      .from('personas')
      .select('id, name')
      .eq('organization_id', orgId)
      .eq('archived', false)
      .order('name'),
  ]);

  return Response.json({
    websites: websites || [],
    personas: (personas || []).map((p: any) => ({
      id: p.id,
      name: p.name,
    })),
  });
}
