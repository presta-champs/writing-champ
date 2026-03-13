import { useUser } from '@/lib/hooks/use-user';
import { useOrganization } from '@/lib/hooks/use-organization';
import { redirect } from 'next/navigation';
import { PlannerLoader } from './planner-loader';

export default async function PlannerPage() {
  const user = await useUser();
  const org = await useOrganization();

  if (!user || !org) {
    redirect('/login');
  }

  return <PlannerLoader />;
}
