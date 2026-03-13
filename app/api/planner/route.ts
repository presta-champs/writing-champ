import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
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
  const searchParams = request.nextUrl.searchParams;

  // Parse month param
  const now = new Date();
  const monthParam = searchParams.get('month') || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const [yearStr, monthStr] = monthParam.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const monthStart = new Date(year, month - 1, 1).toISOString().slice(0, 10);
  const monthEnd = new Date(year, month, 0).toISOString().slice(0, 10);

  const includeUnscheduled = searchParams.get('include_unscheduled') !== 'false';

  const plannerStatuses = ['idea', 'planned', 'writing', 'approved', 'scheduled', 'done'];

  // Fetch scheduled campaigns for the month
  let campaignsQuery = supabase
    .from('campaigns')
    .select('*, websites(name), personas(name)')
    .eq('organization_id', orgId)
    .in('status', plannerStatuses);

  if (includeUnscheduled) {
    // Get both: scheduled in this month OR unscheduled ideas
    campaignsQuery = campaignsQuery.or(
      `scheduled_at.gte.${monthStart},scheduled_at.lte.${monthEnd},and(status.eq.idea,scheduled_at.is.null)`
    );
  } else {
    campaignsQuery = campaignsQuery
      .gte('scheduled_at', monthStart)
      .lte('scheduled_at', monthEnd);
  }

  const { data: campaigns, error: campaignsError } = await campaignsQuery
    .order('created_at', { ascending: false })
    .limit(200);

  if (campaignsError) {
    return Response.json({ error: campaignsError.message }, { status: 500 });
  }

  // Fetch non-planner articles for the month (for calendar display)
  const { data: articles } = await supabase
    .from('articles')
    .select('id, title, status, created_at, campaign_id, websites(name)')
    .eq('organization_id', orgId)
    .is('campaign_id', null)
    .gte('created_at', `${monthStart}T00:00:00`)
    .lte('created_at', `${monthEnd}T23:59:59`)
    .order('created_at', { ascending: false });

  // Transform campaigns for response
  const campaignList = (campaigns || []).map((c: any) => ({
    id: c.id,
    title: c.title,
    core_idea: c.core_idea,
    format: c.format,
    status: c.status,
    source: c.source,
    scheduled_at: c.scheduled_at,
    website_id: c.website_id,
    website_name: c.websites?.name || null,
    persona_id: c.persona_id,
    persona_name: c.personas?.name || null,
    primary_keyword: c.primary_keyword,
    secondary_keywords: c.secondary_keywords,
    target_length: c.target_length,
    notes: c.notes,
    article_id: c.article_id,
    created_at: c.created_at,
  }));

  const articleList = (articles || []).map((a: any) => ({
    id: a.id,
    title: a.title,
    status: a.status,
    created_at: a.created_at,
    website_name: a.websites?.name || null,
    campaign_id: a.campaign_id,
  }));

  return Response.json({ campaigns: campaignList, articles: articleList });
}

export async function POST(request: NextRequest) {
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

  const body = await request.json();

  if (!body.title || typeof body.title !== 'string' || !body.title.trim()) {
    return Response.json({ error: 'Title is required' }, { status: 400 });
  }

  const status = body.scheduled_at ? 'planned' : 'idea';

  const { data: campaign, error } = await supabase
    .from('campaigns')
    .insert({
      organization_id: membership.organization_id,
      title: body.title.trim(),
      core_idea: body.core_idea || null,
      website_id: body.website_id || null,
      persona_id: body.persona_id || null,
      format: body.format || null,
      primary_keyword: body.primary_keyword || null,
      secondary_keywords: body.secondary_keywords || [],
      target_length: body.target_length || 1500,
      notes: body.notes || null,
      scheduled_at: body.scheduled_at || null,
      source: 'manual',
      status,
      created_by: user.id,
    })
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
