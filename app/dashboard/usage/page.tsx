import { useUser } from '@/lib/hooks/use-user';
import { useOrganization } from '@/lib/hooks/use-organization';
import { redirect } from 'next/navigation';
import { UsageDashboardLoader } from './usage-dashboard-loader';

export default async function UsagePage() {
  const user = await useUser();
  const org = await useOrganization();

  if (!user || !org) {
    redirect('/login');
  }

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>Usage & Spending</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Track your AI generation costs and set budget limits.</p>
      </div>
      <UsageDashboardLoader />
    </div>
  );
}
