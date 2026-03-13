'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { formatCostDisplay } from '@/lib/usage-display';

type ModelEntry = {
  model: string;
  displayName: string;
  cost: number;
  percent: number;
};

const COLORS = ['#6366f1', '#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#6b7280'];

export function ModelBreakdown({ data }: { data: ModelEntry[] }) {
  return (
    <div className="p-5 rounded-xl" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--foreground)' }}>By Model</h3>
      {data.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No usage data</p>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie data={data} dataKey="cost" nameKey="displayName" cx="50%" cy="50%" innerRadius={40} outerRadius={65}>
                {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(value: any) => formatCostDisplay(Number(value))} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-2 mt-3">
            {data.map((entry, i) => (
              <div key={entry.model} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                  <span style={{ color: 'var(--foreground)' }}>{entry.displayName}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span style={{ color: 'var(--text-muted)' }}>{entry.percent.toFixed(0)}%</span>
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
