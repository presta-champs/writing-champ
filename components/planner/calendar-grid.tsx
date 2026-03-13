'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { CalendarCell } from './calendar-cell';
import type { Campaign, CalendarArticle } from '@/app/dashboard/planner/planner-dashboard';

type Props = {
  month: string; // YYYY-MM
  onMonthChange: (month: string) => void;
  campaigns: Campaign[];
  articles: CalendarArticle[];
  onDrop: (campaignId: string, date: string) => void;
  onChipClick: (id: string) => void;
  onCellClick: (date: string) => void;
  onArticleClick: (id: string) => void;
};

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function getCalendarDays(year: number, month: number) {
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);

  // Monday = 0 ... Sunday = 6
  let startDow = firstDay.getDay() - 1;
  if (startDow < 0) startDow = 6;

  const days: Array<{ date: string; dayNumber: number; isCurrentMonth: boolean }> = [];

  // Previous month fill
  for (let i = startDow - 1; i >= 0; i--) {
    const d = new Date(year, month - 1, -i);
    days.push({
      date: d.toISOString().slice(0, 10),
      dayNumber: d.getDate(),
      isCurrentMonth: false,
    });
  }

  // Current month
  for (let d = 1; d <= lastDay.getDate(); d++) {
    const date = new Date(year, month - 1, d);
    days.push({
      date: date.toISOString().slice(0, 10),
      dayNumber: d,
      isCurrentMonth: true,
    });
  }

  // Next month fill
  while (days.length % 7 !== 0) {
    const d = new Date(year, month, days.length - lastDay.getDate() - startDow + 1);
    days.push({
      date: d.toISOString().slice(0, 10),
      dayNumber: d.getDate(),
      isCurrentMonth: false,
    });
  }

  return days;
}

function formatMonthLabel(month: string): string {
  const [y, m] = month.split('-');
  const date = new Date(parseInt(y), parseInt(m) - 1);
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function prevMonth(month: string): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function nextMonth(month: string): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function CalendarGrid({
  month, onMonthChange, campaigns, articles,
  onDrop, onChipClick, onCellClick, onArticleClick,
}: Props) {
  const [yearStr, monthStr] = month.split('-');
  const year = parseInt(yearStr, 10);
  const monthNum = parseInt(monthStr, 10);
  const calendarDays = getCalendarDays(year, monthNum);
  const today = new Date().toISOString().slice(0, 10);

  const nowMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;

  return (
    <div className="flex-1 flex flex-col min-w-0">
      {/* Month nav */}
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={() => onMonthChange(prevMonth(month))}
          className="p-1.5 rounded-lg transition hover:opacity-80"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
        >
          <ChevronLeft size={16} style={{ color: 'var(--foreground)' }} />
        </button>
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold" style={{ color: 'var(--foreground)' }}>
            {formatMonthLabel(month)}
          </h2>
          {month !== nowMonth && (
            <button
              onClick={() => onMonthChange(nowMonth)}
              className="text-xs px-2 py-0.5 rounded transition"
              style={{ background: 'var(--accent-light, rgba(99,102,241,0.1))', color: 'var(--accent)' }}
            >
              Today
            </button>
          )}
        </div>
        <button
          onClick={() => onMonthChange(nextMonth(month))}
          className="p-1.5 rounded-lg transition hover:opacity-80"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
        >
          <ChevronRight size={16} style={{ color: 'var(--foreground)' }} />
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {DAYS.map(d => (
          <div key={d} className="text-center text-xs font-medium py-1" style={{ color: 'var(--text-muted)' }}>
            {d}
          </div>
        ))}
      </div>

      {/* Calendar cells */}
      <div className="grid grid-cols-7 gap-1 flex-1">
        {calendarDays.map(day => {
          const dayCampaigns = campaigns.filter(c => c.scheduled_at === day.date);
          const dayArticles = articles.filter(a => a.created_at.slice(0, 10) === day.date);

          return (
            <CalendarCell
              key={day.date}
              date={day.date}
              dayNumber={day.dayNumber}
              isToday={day.date === today}
              isCurrentMonth={day.isCurrentMonth}
              campaigns={dayCampaigns}
              articles={dayArticles}
              onDrop={onDrop}
              onChipClick={onChipClick}
              onCellClick={onCellClick}
              onArticleClick={onArticleClick}
            />
          );
        })}
      </div>
    </div>
  );
}
