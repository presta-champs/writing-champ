'use server';

import { createClient } from '@/lib/supabase/server';
import { useUser } from '@/lib/hooks/use-user';
import { useOrganization } from '@/lib/hooks/use-organization';
import { revalidatePath } from 'next/cache';

export async function updateBudgetSettings(
  monthlyBudget: number | null,
  warningThreshold: number
): Promise<{ success: boolean; error?: string }> {
  const user = await useUser();
  const org = await useOrganization();

  if (!user || !org) return { success: false, error: 'Not authorized' };
  if (org.role !== 'admin') return { success: false, error: 'Only admins can change budget settings' };

  if (monthlyBudget !== null && (monthlyBudget < 0 || !isFinite(monthlyBudget))) {
    return { success: false, error: 'Budget must be a positive number' };
  }
  if (warningThreshold < 0.5 || warningThreshold > 0.95) {
    return { success: false, error: 'Warning threshold must be between 50% and 95%' };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('organizations')
    .update({
      monthly_budget: monthlyBudget,
      budget_warning_threshold: warningThreshold,
    })
    .eq('id', org.id);

  if (error) return { success: false, error: error.message };

  revalidatePath('/dashboard');
  revalidatePath('/dashboard/usage');
  return { success: true };
}
