export const MODEL_DISPLAY_NAMES: Record<string, string> = {
  'claude-sonnet-4-20250514': 'Claude Sonnet 4',
  'claude-opus-4-20250514': 'Claude Opus 4',
  'claude-haiku-4-5-20251001': 'Claude Haiku 4.5',
  'gpt-4o': 'GPT-4o',
  'gpt-4o-mini': 'GPT-4o Mini',
  'gpt-4.1': 'GPT-4.1',
  'gemini-2.5-pro-preview-06-05': 'Gemini 2.5 Pro',
  'gemini-2.5-flash-preview-05-20': 'Gemini 2.5 Flash',
};

export const EVENT_TYPE_DISPLAY_NAMES: Record<string, string> = {
  'generation': 'Article Generation',
  'image_gen': 'Image Generation',
  'stock_search': 'Stock Image Search',
  'kw_research': 'Keyword Research',
  'seo_check': 'SEO Check',
  'mcp_publish': 'Publishing',
  'news_fetch': 'News Fetch',
  'voice_analysis': 'Voice Analysis',
  'idea_generation': 'Idea Generation',
};

export const EVENT_TYPE_COLORS: Record<string, string> = {
  'generation': '#6366f1',
  'image_gen': '#8b5cf6',
  'kw_research': '#3b82f6',
  'seo_check': '#10b981',
  'stock_search': '#6b7280',
  'mcp_publish': '#6b7280',
  'news_fetch': '#6b7280',
  'voice_analysis': '#6b7280',
  'idea_generation': '#f59e0b',
};

export function getModelDisplayName(model: string): string {
  return MODEL_DISPLAY_NAMES[model] || model;
}

export function getEventTypeDisplayName(eventType: string): string {
  return EVENT_TYPE_DISPLAY_NAMES[eventType] || eventType;
}

export function getEventTypeColor(eventType: string): string {
  return EVENT_TYPE_COLORS[eventType] || '#6b7280';
}

export function formatCostDisplay(usd: number): string {
  if (usd < 0.01) return `$${usd.toFixed(4)}`;
  if (usd < 1) return `$${usd.toFixed(3)}`;
  return `$${usd.toFixed(2)}`;
}
