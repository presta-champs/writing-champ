'use client';

import { useState } from 'react';
import { IdeaChip, ArticleChip } from './idea-chip';
import type { Campaign, CalendarArticle } from '@/app/dashboard/planner/planner-dashboard';

type Props = {
  date: string; // YYYY-MM-DD
  dayNumber: number;
  isToday: boolean;
  isCurrentMonth: boolean;
  campaigns: Campaign[];
  articles: CalendarArticle[];
  onDrop: (campaignId: string, date: string) => void;
  onChipClick: (id: string) => void;
  onCellClick: (date: string) => void;
  onArticleClick: (id: string) => void;
};

export function CalendarCell({
  date, dayNumber, isToday, isCurrentMonth, campaigns, articles,
  onDrop, onChipClick, onCellClick, onArticleClick,
}: Props) {
  const [dragOver, setDragOver] = useState(false);

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOver(true);
  }

  function handleDragLeave() {
    setDragOver(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const campaignId = e.dataTransfer.getData('text/plain');
    if (campaignId) {
      onDrop(campaignId, date);
    }
  }

  return (
    <div
      onClick={() => onCellClick(date)}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="min-h-[80px] p-1 rounded-lg transition cursor-pointer"
      style={{
        background: dragOver ? 'var(--accent-light, rgba(99,102,241,0.1))' : 'var(--surface)',
        border: `1px solid ${dragOver ? 'var(--accent)' : isToday ? 'var(--accent)' : 'var(--border)'}`,
        opacity: isCurrentMonth ? 1 : 0.4,
      }}
    >
      <div
        className={`text-xs font-medium mb-1 ${isToday ? 'w-5 h-5 rounded-full flex items-center justify-center' : ''}`}
        style={{
          color: isToday ? 'var(--accent-text, white)' : 'var(--text-muted)',
          background: isToday ? 'var(--accent)' : 'transparent',
        }}
      >
        {dayNumber}
      </div>
      <div className="space-y-0.5">
        {campaigns.map(c => (
          <IdeaChip key={c.id} campaign={c} onClick={() => onChipClick(c.id)} />
        ))}
        {articles.map(a => (
          <ArticleChip key={a.id} article={a} onClick={() => onArticleClick(a.id)} />
        ))}
      </div>
    </div>
  );
}
