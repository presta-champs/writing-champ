'use client';

import { useState } from 'react';
import { updateBudgetSettings } from '@/app/actions/budget';
import { Settings } from 'lucide-react';

type Props = {
  currentBudget: number | null;
  currentThreshold: number;
};

export function BudgetSettings({ currentBudget, currentThreshold }: Props) {
  const [budget, setBudget] = useState<string>(currentBudget?.toString() || '');
  const [threshold, setThreshold] = useState(Math.round(currentThreshold * 100));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  async function handleSave() {
    setSaving(true);
    setMessage(null);

    const budgetValue = budget.trim() === '' ? null : parseFloat(budget);
    if (budgetValue !== null && (isNaN(budgetValue) || budgetValue < 0)) {
      setMessage({ type: 'error', text: 'Budget must be a positive number' });
      setSaving(false);
      return;
    }

    const result = await updateBudgetSettings(budgetValue, threshold / 100);
    if (result.success) {
      setMessage({ type: 'success', text: 'Budget settings saved' });
    } else {
      setMessage({ type: 'error', text: result.error || 'Failed to save' });
    }
    setSaving(false);
  }

  return (
    <div id="budget-settings" className="p-5 rounded-xl" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <div className="flex items-center gap-2 mb-4">
        <Settings size={18} style={{ color: 'var(--accent)' }} />
        <h3 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Budget Settings</h3>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
            Monthly Budget (USD)
          </label>
          <input
            type="number"
            min="0"
            step="1"
            value={budget}
            onChange={(e) => setBudget(e.target.value)}
            placeholder="No limit"
            className="w-full px-3 py-2 rounded-lg text-sm outline-none"
            style={{ background: 'var(--background)', border: '1px solid var(--border)', color: 'var(--foreground)' }}
          />
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Leave empty for no budget limit</p>
        </div>
        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
            Warning Threshold: {threshold}%
          </label>
          <input
            type="range"
            min="50"
            max="95"
            step="5"
            value={threshold}
            onChange={(e) => setThreshold(parseInt(e.target.value, 10))}
            className="w-full"
          />
          <div className="flex justify-between text-xs" style={{ color: 'var(--text-muted)' }}>
            <span>50%</span>
            <span>95%</span>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3 mt-4">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 rounded-lg text-sm font-medium transition hover:opacity-90 disabled:opacity-50"
          style={{ background: 'var(--accent)', color: 'var(--accent-text)' }}
        >
          {saving ? 'Saving...' : 'Save Budget Settings'}
        </button>
        {message && (
          <span className="text-sm" style={{ color: message.type === 'success' ? '#10b981' : '#ef4444' }}>
            {message.text}
          </span>
        )}
      </div>
    </div>
  );
}
