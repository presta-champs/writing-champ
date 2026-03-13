'use client';

import { useState, useEffect, useCallback } from 'react';
import { SummaryCards } from '@/components/usage/summary-cards';
import { MonthSelector } from '@/components/usage/month-selector';
import { DailyChart } from '@/components/usage/daily-chart';
import { ModelBreakdown } from '@/components/usage/model-breakdown';
import { EventTypeBreakdown } from '@/components/usage/event-type-breakdown';
import { RecentActivity } from '@/components/usage/recent-activity';
import { BudgetSettings } from '@/components/usage/budget-settings';
import { Loader2 } from 'lucide-react';

type UsageData = {
  summary: {
    totalCost: number;
    todayCost: number;
    eventCount: number;
    monthlyBudget: number | null;
    budgetWarningThreshold: number;
    budgetUsedPercent: number | null;
  };
  daily: Array<{
    date: string;
    generation: number;
    image_gen: number;
    kw_research: number;
    seo_check: number;
    other: number;
    total: number;
  }>;
  byModel: Array<{ model: string; displayName: string; cost: number; percent: number }>;
  byEventType: Array<{ eventType: string; displayName: string; cost: number; count: number; percent: number }>;
  recentEvents: Array<{
    id: string;
    createdAt: string;
    eventType: string;
    modelUsed: string | null;
    estimatedCostUsd: number;
    articleId: string | null;
    articleTitle: string | null;
    userName: string | null;
  }>;
  earliestMonth: string;
  currentMonth: string;
};

export function UsageDashboard() {
  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const [month, setMonth] = useState(defaultMonth);
  const [data, setData] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async (m: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/usage?month=${m}`);
      if (!res.ok) throw new Error('Failed to load usage data');
      const json = await res.json();
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(month);
  }, [month, fetchData]);

  function handleMonthChange(newMonth: string) {
    setMonth(newMonth);
  }

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={24} className="animate-spin" style={{ color: 'var(--text-muted)' }} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-5 rounded-xl" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <p className="text-sm" style={{ color: '#ef4444' }}>Error: {error}</p>
      </div>
    );
  }

  if (!data) return null;

  const budgetPaceLine = data.summary.monthlyBudget
    ? data.summary.monthlyBudget / data.daily.length
    : null;

  const isOverThreshold = data.summary.budgetUsedPercent !== null
    && data.summary.budgetUsedPercent >= data.summary.budgetWarningThreshold * 100;

  return (
    <div className="space-y-6">
      {/* Budget warning banner */}
      {isOverThreshold && data.summary.monthlyBudget && (
        <div className="p-3 rounded-lg text-sm font-medium" style={{ background: '#fef3c7', color: '#92400e', border: '1px solid #f59e0b' }}>
          &#9888; You&apos;ve used {data.summary.budgetUsedPercent!.toFixed(0)}% of your ${data.summary.monthlyBudget.toFixed(2)} monthly budget
        </div>
      )}

      <div className="flex items-center justify-between">
        <MonthSelector
          currentMonth={data.currentMonth}
          earliestMonth={data.earliestMonth}
          onChange={handleMonthChange}
        />
        {loading && <Loader2 size={16} className="animate-spin" style={{ color: 'var(--text-muted)' }} />}
      </div>

      <SummaryCards data={data.summary} />

      <DailyChart data={data.daily} budgetPaceLine={budgetPaceLine} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ModelBreakdown data={data.byModel} />
        <EventTypeBreakdown data={data.byEventType} />
      </div>

      <RecentActivity events={data.recentEvents} />

      <BudgetSettings
        currentBudget={data.summary.monthlyBudget}
        currentThreshold={data.summary.budgetWarningThreshold}
      />
    </div>
  );
}
