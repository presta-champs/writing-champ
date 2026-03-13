'use client';

import type { Campaign } from '@/app/dashboard/planner/planner-dashboard';

const FORMAT_COLORS: Record<string, string> = {
  'how-to': '#6366f1',
  'roundup': '#8b5cf6',
  'listicle': '#3b82f6',
  'explainer': '#10b981',
  'opinion': '#f59e0b',
  'tutorial': '#ec4899',
  'case-study': '#6b7280',
};

export function IdeaCard({ campaign, onClick }: { campaign: Campaign; onClick: () => void }) {
  function handleDragStart(e: React.DragEvent) {
    e.dataTransfer.setData('text/plain', campaign.id);
    e.dataTransfer.effectAllowed = 'move';
  }

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onClick={onClick}
      className="p-3 rounded-lg cursor-grab active:cursor-grabbing transition hover:shadow-sm"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
    >
      <p className="text-sm font-medium line-clamp-2" style={{ color: 'var(--foreground)' }}>
        {campaign.title}
      </p>
      <div className="flex items-center gap-2 mt-1.5">
        {campaign.format && (
          <span
            className="text-[10px] px-1.5 py-0.5 rounded font-medium text-white"
            style={{ background: FORMAT_COLORS[campaign.format] || '#6b7280' }}
          >
            {campaign.format}
          </span>
        )}
        {campaign.website_name && (
          <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
            {campaign.website_name}
          </span>
        )}
      </div>
    </div>
  );
}
