'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { ArrowUpDown } from 'lucide-react';
import { formatCostDisplay, getEventTypeDisplayName, getModelDisplayName, getEventTypeColor } from '@/lib/usage-display';

type RecentEvent = {
  id: string;
  createdAt: string;
  eventType: string;
  modelUsed: string | null;
  estimatedCostUsd: number;
  articleId: string | null;
  articleTitle: string | null;
  userName: string | null;
};

type SortKey = 'createdAt' | 'eventType' | 'modelUsed' | 'estimatedCostUsd' | 'userName';
type SortDir = 'asc' | 'desc';

export function RecentActivity({ events }: { events: RecentEvent[] }) {
  const [sortKey, setSortKey] = useState<SortKey>('createdAt');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const sorted = useMemo(() => {
    return [...events].sort((a, b) => {
      const av = a[sortKey] ?? '';
      const bv = b[sortKey] ?? '';
      if (typeof av === 'number' && typeof bv === 'number') {
        return sortDir === 'asc' ? av - bv : bv - av;
      }
      return sortDir === 'asc'
        ? String(av).localeCompare(String(bv))
        : String(bv).localeCompare(String(av));
    });
  }, [events, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  }

  function SortHeader({ label, column, align }: { label: string; column: SortKey; align?: string }) {
    return (
      <th
        className={`${align === 'right' ? 'text-right' : 'text-left'} py-2 font-medium cursor-pointer select-none hover:opacity-70`}
        style={{ color: 'var(--text-muted)' }}
        onClick={() => toggleSort(column)}
      >
        <span className="inline-flex items-center gap-1">
          {label}
          <ArrowUpDown size={12} style={{ opacity: sortKey === column ? 1 : 0.3 }} />
        </span>
      </th>
    );
  }

  return (
    <div className="p-5 rounded-xl" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--foreground)' }}>Recent Activity</h3>
      {events.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No events this month</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <SortHeader label="Date" column="createdAt" />
                <SortHeader label="Type" column="eventType" />
                <SortHeader label="Model" column="modelUsed" />
                <th className="text-left py-2 font-medium" style={{ color: 'var(--text-muted)' }}>Article</th>
                <SortHeader label="User" column="userName" />
                <SortHeader label="Cost" column="estimatedCostUsd" align="right" />
              </tr>
            </thead>
            <tbody>
              {sorted.map((event) => (
                <tr key={event.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td className="py-2.5" style={{ color: 'var(--foreground)' }}>
                    {new Date(event.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    <span className="ml-1" style={{ color: 'var(--text-muted)' }}>
                      {new Date(event.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </td>
                  <td className="py-2.5">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium text-white" style={{ background: getEventTypeColor(event.eventType) }}>
                      {getEventTypeDisplayName(event.eventType)}
                    </span>
                  </td>
                  <td className="py-2.5" style={{ color: 'var(--foreground)' }}>
                    {event.modelUsed ? getModelDisplayName(event.modelUsed) : '\u2014'}
                  </td>
                  <td className="py-2.5">
                    {event.articleId && event.articleTitle ? (
                      <Link href={`/dashboard/articles/${event.articleId}`} className="underline" style={{ color: 'var(--accent)' }}>
                        {event.articleTitle.length > 30 ? event.articleTitle.slice(0, 30) + '...' : event.articleTitle}
                      </Link>
                    ) : (
                      <span style={{ color: 'var(--text-muted)' }}>{'\u2014'}</span>
                    )}
                  </td>
                  <td className="py-2.5" style={{ color: 'var(--foreground)' }}>{event.userName || '\u2014'}</td>
                  <td className="py-2.5 text-right font-medium" style={{ color: 'var(--foreground)' }}>
                    {formatCostDisplay(event.estimatedCostUsd)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
