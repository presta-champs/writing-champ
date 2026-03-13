'use client';

import dynamic from 'next/dynamic';

const UsageDashboard = dynamic(
  () => import('./usage-dashboard').then(m => m.UsageDashboard),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin h-6 w-6 border-2 border-current border-t-transparent rounded-full" style={{ color: 'var(--text-muted)' }} />
      </div>
    ),
  }
);

export function UsageDashboardLoader() {
  return <UsageDashboard />;
}
