'use client';

import { formatCostDisplay } from '@/lib/usage-display';

type SummaryData = {
  totalCost: number;
  todayCost: number;
  eventCount: number;
  monthlyBudget: number | null;
  budgetWarningThreshold: number;
  budgetUsedPercent: number | null;
};

export function SummaryCards({ data }: { data: SummaryData }) {
  const isOverThreshold = data.budgetUsedPercent !== null
    && data.budgetUsedPercent >= data.budgetWarningThreshold * 100;
  const isOverBudget = data.budgetUsedPercent !== null && data.budgetUsedPercent >= 100;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
      <div className="p-5 rounded-xl" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>This Month</p>
        <p className="text-2xl font-bold" style={{ color: '#10b981' }}>{formatCostDisplay(data.totalCost)}</p>
      </div>
      <div className="p-5 rounded-xl" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Today</p>
        <p className="text-2xl font-bold" style={{ color: '#3b82f6' }}>{formatCostDisplay(data.todayCost)}</p>
      </div>
      <div className="p-5 rounded-xl" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Total Events</p>
        <p className="text-2xl font-bold" style={{ color: '#8b5cf6' }}>{data.eventCount}</p>
      </div>
      <div className="p-5 rounded-xl" style={{
        background: isOverThreshold ? 'var(--warning-bg, #fef3c7)' : 'var(--surface)',
        border: `1px solid ${isOverThreshold ? 'var(--warning-border, #f59e0b)' : 'var(--border)'}`,
      }}>
        <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Budget Used</p>
        {data.monthlyBudget !== null ? (
          <>
            <p className="text-2xl font-bold" style={{
              color: isOverBudget ? '#ef4444' : isOverThreshold ? '#f59e0b' : '#10b981',
            }}>
              {data.budgetUsedPercent!.toFixed(0)}%
            </p>
            <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
              <div className="h-full rounded-full transition-all" style={{
                width: `${Math.min(data.budgetUsedPercent!, 100)}%`,
                background: isOverBudget ? '#ef4444' : isOverThreshold ? '#f59e0b' : '#10b981',
              }} />
            </div>
          </>
        ) : (
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            No budget set — <a href="#budget-settings" className="underline">configure</a>
          </p>
        )}
      </div>
    </div>
  );
}
