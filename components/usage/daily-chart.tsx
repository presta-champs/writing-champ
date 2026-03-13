'use client';

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Legend,
} from 'recharts';
import { EVENT_TYPE_COLORS } from '@/lib/usage-display';

type DailyEntry = {
  date: string;
  generation: number;
  image_gen: number;
  kw_research: number;
  seo_check: number;
  other: number;
  total: number;
};

type Props = {
  data: DailyEntry[];
  budgetPaceLine: number | null;
};

function formatDay(dateStr: string): string {
  return dateStr.split('-')[2].replace(/^0/, '');
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function formatTooltipValue(value: any): string {
  return `$${Number(value).toFixed(3)}`;
}

export function DailyChart({ data, budgetPaceLine }: Props) {
  return (
    <div className="p-5 rounded-xl" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--foreground)' }}>
        Daily Spending
      </h3>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="date" tickFormatter={formatDay} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
          <YAxis tickFormatter={(v: number) => `$${v.toFixed(2)}`} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} width={50} />
          <Tooltip
            formatter={formatTooltipValue}
            labelFormatter={(label: any) => {
              const d = new Date(String(label) + 'T00:00:00');
              return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
            }}
            contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey="generation" name="Generation" stackId="a" fill={EVENT_TYPE_COLORS.generation} radius={[0, 0, 0, 0]} />
          <Bar dataKey="image_gen" name="Images" stackId="a" fill={EVENT_TYPE_COLORS.image_gen} />
          <Bar dataKey="kw_research" name="Keywords" stackId="a" fill={EVENT_TYPE_COLORS.kw_research} />
          <Bar dataKey="seo_check" name="SEO" stackId="a" fill={EVENT_TYPE_COLORS.seo_check} />
          <Bar dataKey="other" name="Other" stackId="a" fill={EVENT_TYPE_COLORS.stock_search} radius={[2, 2, 0, 0]} />
          {budgetPaceLine !== null && (
            <ReferenceLine
              y={budgetPaceLine}
              stroke="#f59e0b"
              strokeDasharray="6 3"
              label={{ value: 'Budget pace', position: 'right', fontSize: 10, fill: '#f59e0b' }}
            />
          )}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
