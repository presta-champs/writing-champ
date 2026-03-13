import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function PATCH(
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

  // Verify campaign belongs to org
  const { data: existing } = await supabase
    .from('campaigns')
    .select('id, status')
    .eq('id', id)
    .eq('organization_id', membership.organization_id)
    .single();

  if (!existing) {
    return Response.json({ error: 'Campaign not found' }, { status: 404 });
  }

  const body = await request.json();
  const allowedFields = [
    'title', 'core_idea', 'website_id', 'persona_id', 'format',
    'primary_keyword', 'secondary_keywords', 'target_length',
    'notes', 'scheduled_at', 'status', 'article_id',
  ];

  const updates: Record<string, any> = {};
  for (const field of allowedFields) {
    if (field in body) {
      updates[field] = body[field];
    }
  }

  // Auto-transition: scheduling an idea makes it planned
  if ('scheduled_at' in updates && updates.scheduled_at && existing.status === 'idea') {
    updates.status = 'planned';
  }
  // Auto-transition: unscheduling a planned item makes it an idea
  if ('scheduled_at' in updates && !updates.scheduled_at && existing.status === 'planned') {
    updates.status = 'idea';
  }

  updates.updated_at = new Date().toISOString();

  const { data: campaign, error } = await supabase
    .from('campaigns')
    .update(updates)
    .eq('id', id)
    .select('*, websites(name), personas(name)')
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({
    id: campaign.id,
    title: campaign.title,
    core_idea: campaign.core_idea,
    format: campaign.format,
    status: campaign.status,
    source: campaign.source,
    scheduled_at: campaign.scheduled_at,
    website_id: campaign.website_id,
    website_name: (campaign as any).websites?.name || null,
    persona_id: campaign.persona_id,
    persona_name: (campaign as any).personas?.name || null,
    primary_keyword: campaign.primary_keyword,
    secondary_keywords: campaign.secondary_keywords,
    target_length: campaign.target_length,
    notes: campaign.notes,
    article_id: campaign.article_id,
    created_at: campaign.created_at,
  });
}

export async function DELETE(
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

  const { error } = await supabase
    .from('campaigns')
    .delete()
    .eq('id', id)
    .eq('organization_id', membership.organization_id);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ success: true });
}
