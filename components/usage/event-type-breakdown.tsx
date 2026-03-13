'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { formatCostDisplay, getEventTypeColor } from '@/lib/usage-display';

type EventTypeEntry = {
  eventType: string;
  displayName: string;
  cost: number;
  count: number;
  percent: number;
};

export function EventTypeBreakdown({ data }: { data: EventTypeEntry[] }) {
  return (
    <div className="p-5 rounded-xl" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--foreground)' }}>By Event Type</h3>
      {data.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No usage data</p>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie data={data} dataKey="cost" nameKey="displayName" cx="50%" cy="50%" innerRadius={40} outerRadius={65}>
                {data.map((entry) => <Cell key={entry.eventType} fill={getEventTypeColor(entry.eventType)} />)}
              </Pie>
              <Tooltip formatter={(value: any) => formatCostDisplay(Number(value))} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-2 mt-3">
            {data.map((entry) => (
              <div key={entry.eventType} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: getEventTypeColor(entry.eventType) }} />
                  <span style={{ color: 'var(--foreground)' }}>{entry.displayName}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span style={{ color: 'var(--text-muted)' }}>{entry.count} events</span>
                  <span className="font-medium" style={{ color: 'var(--foreground)' }}>{formatCostDisplay(entry.cost)}</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
