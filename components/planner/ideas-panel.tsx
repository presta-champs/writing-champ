'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { IdeaCard } from './idea-card';
import { GeneratePopover } from './generate-popover';
import type { Campaign } from '@/app/dashboard/planner/planner-dashboard';

type Props = {
  ideas: Campaign[];
  onCardClick: (id: string) => void;
  onIdeasGenerated: (ideas: Campaign[]) => void;
  onUnschedule: (id: string) => void;
  websites: Array<{ id: string; name: string }>;
};

export function IdeasPanel({ ideas, onCardClick, onIdeasGenerated, onUnschedule, websites }: Props) {
  const [collapsed, setCollapsed] = useState(false);

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const campaignId = e.dataTransfer.getData('text/plain');
    if (campaignId) {
      onUnschedule(campaignId);
    }
  }

  if (collapsed) {
    return (
      <div className="flex flex-col items-center py-4">
        <button
          onClick={() => setCollapsed(false)}
          className="p-1.5 rounded-lg transition hover:opacity-80"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
        >
          <ChevronRight size={16} style={{ color: 'var(--text-muted)' }} />
        </button>
      </div>
    );
  }

  return (
    <div
      className="w-[280px] min-w-[280px] flex flex-col rounded-xl overflow-hidden"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Header */}
      <div className="px-4 py-3 flex items-center gap-2" style={{ borderBottom: '1px solid var(--border)' }}>
        <h3 className="text-sm font-semibold flex-1" style={{ color: 'var(--foreground)' }}>
          Ideas <span className="font-normal" style={{ color: 'var(--text-muted)' }}>({ideas.length})</span>
        </h3>
        <GeneratePopover onGenerated={onIdeasGenerated} websites={websites} />
        <button
          onClick={() => onCardClick('__new__')}
          className="p-1 rounded transition hover:opacity-80"
          style={{ color: 'var(--text-muted)' }}
          title="Add manually"
        >
          <Plus size={16} />
        </button>
        <button
          onClick={() => setCollapsed(true)}
          className="p-1 rounded transition hover:opacity-80"
          style={{ color: 'var(--text-muted)' }}
        >
          <ChevronLeft size={16} />
        </button>
      </div>

      {/* Cards */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {ideas.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm mb-3" style={{ color: 'var(--text-muted)' }}>No ideas yet</p>
            <GeneratePopover onGenerated={onIdeasGenerated} websites={websites} />
          </div>
        ) : (
          ideas.map(idea => (
            <IdeaCard
              key={idea.id}
              campaign={idea}
              onClick={() => onCardClick(idea.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}
