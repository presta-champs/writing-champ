import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getModelDisplayName, getEventTypeDisplayName } from '@/lib/usage-display';

export async function GET(request: NextRequest) {
  const supabase = await createClient();

  // Auth
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

  // Parse month param (YYYY-MM)
  const searchParams = request.nextUrl.searchParams;
  const now = new Date();
  const monthParam = searchParams.get('month') || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const [yearStr, monthStr] = monthParam.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 0); // last day of month
  const daysInMonth = monthEnd.getDate();

  const monthStartISO = monthStart.toISOString();
  const monthEndISO = new Date(year, month, 0, 23, 59, 59, 999).toISOString();

  // Today boundaries
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).toISOString();

  // Fetch org for budget (columns may not exist if migration hasn't run)
  let org: { monthly_budget: number | null; budget_warning_threshold: number } | null = null;
  try {
    const { data, error: orgError } = await supabase
      .from('organizations')
      .select('monthly_budget, budget_warning_threshold')
      .eq('id', orgId)
      .single();
    if (!orgError) org = data;
  } catch {
    // Budget columns don't exist yet — that's fine
  }

  // Fetch all usage events for the month
  const { data: events, error: eventsError } = await supabase
    .from('usage_events')
    .select('id, event_type, model_used, estimated_cost_usd, created_at, article_id, user_id')
    .eq('organization_id', orgId)
    .gte('created_at', monthStartISO)
    .lte('created_at', monthEndISO)
    .order('created_at', { ascending: false });

  if (eventsError) {
    return Response.json({ error: eventsError.message }, { status: 500 });
  }

  const allEvents = events || [];

  // Summary
  const totalCost = allEvents.reduce((sum, e) => sum + (e.estimated_cost_usd || 0), 0);
  const todayCost = allEvents
    .filter(e => e.created_at >= todayStart && e.created_at <= todayEnd)
    .reduce((sum, e) => sum + (e.estimated_cost_usd || 0), 0);
  const eventCount = allEvents.length;
  const monthlyBudget = org?.monthly_budget ?? null;
  const budgetWarningThreshold = org?.budget_warning_threshold ?? 0.8;
  const budgetUsedPercent = monthlyBudget ? (totalCost / monthlyBudget) * 100 : null;

  // Daily breakdown
  const dailyMap: Record<string, Record<string, number>> = {};
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${yearStr}-${monthStr}-${String(d).padStart(2, '0')}`;
    dailyMap[dateStr] = { generation: 0, image_gen: 0, kw_research: 0, seo_check: 0, other: 0, total: 0 };
  }
  for (const e of allEvents) {
    const dateStr = e.created_at.slice(0, 10);
    if (!dailyMap[dateStr]) continue;
    const cost = e.estimated_cost_usd || 0;
    const bucket = ['generation', 'image_gen', 'kw_research', 'seo_check'].includes(e.event_type)
      ? e.event_type
      : 'other';
    dailyMap[dateStr][bucket] += cost;
    dailyMap[dateStr].total += cost;
  }
  const daily = Object.entries(dailyMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, costs]) => ({ date, ...costs }));

  // By model
  const modelMap: Record<string, number> = {};
  for (const e of allEvents) {
    const model = e.model_used || 'unknown';
    modelMap[model] = (modelMap[model] || 0) + (e.estimated_cost_usd || 0);
  }
  const byModel = Object.entries(modelMap)
    .map(([model, cost]) => ({
      model,
      displayName: getModelDisplayName(model),
      cost,
      percent: totalCost > 0 ? (cost / totalCost) * 100 : 0,
    }))
    .sort((a, b) => b.cost - a.cost);

  // By event type
  const typeMap: Record<string, { cost: number; count: number }> = {};
  for (const e of allEvents) {
    if (!typeMap[e.event_type]) typeMap[e.event_type] = { cost: 0, count: 0 };
    typeMap[e.event_type].cost += e.estimated_cost_usd || 0;
    typeMap[e.event_type].count += 1;
  }
  const byEventType = Object.entries(typeMap)
    .map(([eventType, { cost, count }]) => ({
      eventType,
      displayName: getEventTypeDisplayName(eventType),
      cost,
      count,
      percent: totalCost > 0 ? (cost / totalCost) * 100 : 0,
    }))
    .sort((a, b) => b.cost - a.cost);

  // Recent events (already sorted desc, take 20)
  const recentRaw = allEvents.slice(0, 20);
  const articleIds = [...new Set(recentRaw.filter(e => e.article_id).map(e => e.article_id))];
  const userIds = [...new Set(recentRaw.filter(e => e.user_id).map(e => e.user_id))];

  let articleTitles: Record<string, string> = {};
  if (articleIds.length > 0) {
    const { data: articles } = await supabase
      .from('articles')
      .select('id, title')
      .in('id', articleIds);
    if (articles) {
      articleTitles = Object.fromEntries(articles.map(a => [a.id, a.title]));
    }
  }

  let userNames: Record<string, string> = {};
  if (userIds.length > 0) {
    const { data: users } = await supabase
      .from('users')
      .select('id, name')
      .in('id', userIds);
    if (users) {
      userNames = Object.fromEntries(users.map(u => [u.id, u.name || 'Unknown']));
    }
  }

  const recentEvents = recentRaw.map(e => ({
    id: e.id,
    createdAt: e.created_at,
    eventType: e.event_type,
    modelUsed: e.model_used,
    estimatedCostUsd: e.estimated_cost_usd,
    articleId: e.article_id,
    articleTitle: e.article_id ? (articleTitles[e.article_id] || null) : null,
    userName: e.user_id ? (userNames[e.user_id] || 'Unknown') : null,
  }));

  // Earliest month (for month selector bounds)
  const { data: earliestEvent } = await supabase
    .from('usage_events')
    .select('created_at')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: true })
    .limit(1)
    .single();

  const earliestMonth = earliestEvent
    ? earliestEvent.created_at.slice(0, 7)
    : monthParam;

  return Response.json({
    summary: {
      totalCost,
      todayCost,
      eventCount,
      monthlyBudget,
      budgetWarningThreshold,
      budgetUsedPercent,
    },
    daily,
    byModel,
    byEventType,
    recentEvents,
    earliestMonth,
    currentMonth: monthParam,
  });
}
