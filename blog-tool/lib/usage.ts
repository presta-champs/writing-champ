import { createClient } from '@/lib/supabase/server';

type UsageEventType =
  | 'generation'
  | 'image_gen'
  | 'stock_search'
  | 'kw_research'
  | 'seo_check'
  | 'mcp_publish'
  | 'news_fetch'
  | 'voice_analysis';

/**
 * Log a usage event. Never throws — logging failures
 * should not break the main application flow.
 */
export async function logUsageEvent(params: {
  organizationId: string;
  userId: string;
  articleId?: string;
  eventType: UsageEventType;
  modelUsed?: string;
  estimatedCostUsd?: number;
}): Promise<void> {
  try {
    const supabase = await createClient();
    await supabase.from('usage_events').insert({
      organization_id: params.organizationId,
      user_id: params.userId,
      article_id: params.articleId || null,
      event_type: params.eventType,
      model_used: params.modelUsed || null,
      estimated_cost_usd: params.estimatedCostUsd || 0,
    });
  } catch (error) {
    console.error('Failed to log usage event:', error);
  }
}
