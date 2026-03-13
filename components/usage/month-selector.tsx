'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';

type Props = {
  currentMonth: string; // YYYY-MM
  earliestMonth: string; // YYYY-MM
  onChange: (month: string) => void;
};

function formatMonthLabel(yyyymm: string): string {
  const [y, m] = yyyymm.split('-').map(Number);
  const date = new Date(y, m - 1);
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function prevMonth(yyyymm: string): string {
  const [y, m] = yyyymm.split('-').map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function nextMonth(yyyymm: string): string {
  const [y, m] = yyyymm.split('-').map(Number);
  const d = new Date(y, m, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function MonthSelector({ currentMonth, earliestMonth, onChange }: Props) {
  const now = new Date();
  const currentMaxMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const canGoPrev = currentMonth > earliestMonth;
  const canGoNext = currentMonth < currentMaxMonth;

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={() => canGoPrev && onChange(prevMonth(currentMonth))}
        disabled={!canGoPrev}
        className="p-1.5 rounded-lg transition hover:opacity-80 disabled:opacity-30"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
      >
        <ChevronLeft size={18} />
      </button>
      <span className="text-sm font-semibold min-w-[160px] text-center" style={{ color: 'var(--foreground)' }}>
        {formatMonthLabel(currentMonth)}
      </span>
      <button
        onClick={() => canGoNext && onChange(nextMonth(currentMonth))}
        disabled={!canGoNext}
        className="p-1.5 rounded-lg transition hover:opacity-80 disabled:opacity-30"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
      >
        <ChevronRight size={18} />
      </button>
    </div>
  );
}
