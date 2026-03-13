'use client';

import dynamic from 'next/dynamic';

const PlannerDashboard = dynamic(
  () => import('./planner-dashboard').then(m => m.PlannerDashboard),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin h-6 w-6 border-2 border-current border-t-transparent rounded-full" style={{ color: 'var(--text-muted)' }} />
      </div>
    ),
  }
);

export function PlannerLoader() {
  return <PlannerDashboard />;
}
