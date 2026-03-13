'use client';

import { useState, useEffect, useCallback } from 'react';
import { IdeasPanel } from '@/components/planner/ideas-panel';
import { CalendarGrid } from '@/components/planner/calendar-grid';
import { IdeaDetailModal } from '@/components/planner/idea-detail-modal';
import { Loader2 } from 'lucide-react';

export type Campaign = {
  id: string;
  title: string;
  core_idea: string | null;
  format: string | null;
  status: string;
  source: string | null;
  scheduled_at: string | null;
  website_id: string | null;
  website_name: string | null;
  persona_id: string | null;
  persona_name: string | null;
  primary_keyword: string | null;
  secondary_keywords: string[];
  target_length: number;
  notes: string | null;
  article_id: string | null;
  created_at: string;
};

export type CalendarArticle = {
  id: string;
  title: string;
  status: string;
  created_at: string;
  website_name: string | null;
  campaign_id: string | null;
};

export function PlannerDashboard() {
  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const [month, setMonth] = useState(defaultMonth);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [articles, setArticles] = useState<CalendarArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [showNewIdea, setShowNewIdea] = useState(false);
  const [newIdeaDate, setNewIdeaDate] = useState<string | null>(null);
  const [websites, setWebsites] = useState<Array<{ id: string; name: string }>>([]);
  const [personas, setPersonas] = useState<Array<{ id: string; name: string; website_ids: string[] }>>([]);

  const fetchData = useCallback(async (m: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/planner?month=${m}`);
      if (!res.ok) throw new Error('Failed to load planner data');
      const json = await res.json();
      setCampaigns(json.campaigns || []);
      setArticles(json.articles || []);
    } catch (e) {
      console.error('Planner fetch error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(month);
  }, [month, fetchData]);

  // Fetch websites and personas once on mount
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/planner/websites');
        if (res.ok) {
          const data = await res.json();
          setWebsites(data.websites || []);
          setPersonas(data.personas || []);
        }
      } catch { /* ignore */ }
    })();
  }, []);

  const unscheduledIdeas = campaigns.filter(c => c.status === 'idea' && !c.scheduled_at);
  const scheduledCampaigns = campaigns.filter(c => c.scheduled_at);

  const selectedCampaign = selectedCampaignId
    ? campaigns.find(c => c.id === selectedCampaignId) || null
    : null;

  async function handleDrop(campaignId: string, date: string) {
    // Optimistic update
    setCampaigns(prev =>
      prev.map(c =>
        c.id === campaignId
          ? { ...c, scheduled_at: date, status: c.status === 'idea' ? 'planned' : c.status }
          : c
      )
    );

    await fetch(`/api/planner/${campaignId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scheduled_at: date }),
    });
  }

  async function handleUnschedule(campaignId: string) {
    setCampaigns(prev =>
      prev.map(c =>
        c.id === campaignId
          ? { ...c, scheduled_at: null, status: 'idea' }
          : c
      )
    );

    await fetch(`/api/planner/${campaignId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scheduled_at: null }),
    });
  }

  function handleCellClick(date: string) {
    setNewIdeaDate(date);
    setShowNewIdea(true);
  }

  function handleIdeasGenerated(newIdeas: Campaign[]) {
    setCampaigns(prev => [...newIdeas, ...prev]);
  }

  async function handleSaveCampaign(updated: Campaign) {
    setCampaigns(prev => prev.map(c => c.id === updated.id ? updated : c));
    setSelectedCampaignId(null);
  }

  async function handleDeleteCampaign(id: string) {
    setCampaigns(prev => prev.filter(c => c.id !== id));
    setSelectedCampaignId(null);
    await fetch(`/api/planner/${id}`, { method: 'DELETE' });
  }

  function handleNewIdeaCreated(idea: Campaign) {
    setCampaigns(prev => [idea, ...prev]);
    setShowNewIdea(false);
    setNewIdeaDate(null);
  }

  if (loading && campaigns.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={24} className="animate-spin" style={{ color: 'var(--text-muted)' }} />
      </div>
    );
  }

  return (
    <div className="flex gap-4 h-[calc(100vh-120px)]">
      <IdeasPanel
        ideas={unscheduledIdeas}
        onCardClick={setSelectedCampaignId}
        onIdeasGenerated={handleIdeasGenerated}
        onUnschedule={handleUnschedule}
        websites={websites}
      />
      <CalendarGrid
        month={month}
        onMonthChange={setMonth}
        campaigns={scheduledCampaigns}
        articles={articles}
        onDrop={handleDrop}
        onChipClick={setSelectedCampaignId}
        onCellClick={handleCellClick}
        onArticleClick={(id) => window.location.href = `/dashboard/articles/${id}`}
      />

      {selectedCampaign && (
        <IdeaDetailModal
          campaign={selectedCampaign}
          onSave={handleSaveCampaign}
          onDelete={handleDeleteCampaign}
          onClose={() => setSelectedCampaignId(null)}
          websites={websites}
          personas={personas}
        />
      )}

      {showNewIdea && (
        <IdeaDetailModal
          campaign={null}
          defaultDate={newIdeaDate}
          onSave={handleNewIdeaCreated}
          onDelete={() => {}}
          onClose={() => { setShowNewIdea(false); setNewIdeaDate(null); }}
          websites={websites}
          personas={personas}
        />
      )}
    </div>
  );
}
