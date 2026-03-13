'use client';

import type { Campaign, CalendarArticle } from '@/app/dashboard/planner/planner-dashboard';

const STATUS_COLORS: Record<string, string> = {
  idea: '#9ca3af',
  planned: '#3b82f6',
  writing: '#f59e0b',
  approved: '#10b981',
  scheduled: '#8b5cf6',
  done: '#065f46',
};

export function IdeaChip({
  campaign,
  onClick,
}: {
  campaign: Campaign;
  onClick: () => void;
}) {
  function handleDragStart(e: React.DragEvent) {
    e.dataTransfer.setData('text/plain', campaign.id);
    e.dataTransfer.effectAllowed = 'move';
    e.stopPropagation();
  }

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className="text-[10px] px-1.5 py-0.5 rounded cursor-grab active:cursor-grabbing text-white truncate"
      style={{ background: STATUS_COLORS[campaign.status] || '#9ca3af' }}
      title={campaign.title}
    >
      {campaign.title}
    </div>
  );
}

export function ArticleChip({
  article,
  onClick,
}: {
  article: CalendarArticle;
  onClick: () => void;
}) {
  return (
    <div
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className="text-[10px] px-1.5 py-0.5 rounded cursor-pointer truncate"
      style={{ background: 'var(--surface-warm, var(--surface))', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
      title={article.title}
    >
      {article.title}
    </div>
  );
}
