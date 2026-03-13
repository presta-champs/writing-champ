'use client';

import { useState, useEffect, useRef } from 'react';
import { Sparkles, Loader2 } from 'lucide-react';
import type { Campaign } from '@/app/dashboard/planner/planner-dashboard';

type Props = {
  onGenerated: (ideas: Campaign[]) => void;
  websites: Array<{ id: string; name: string }>;
};

export function GeneratePopover({ onGenerated, websites }: Props) {
  const [open, setOpen] = useState(false);
  const [websiteId, setWebsiteId] = useState('');
  const [seedTopic, setSeedTopic] = useState('');
  const [count, setCount] = useState(5);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  async function handleGenerate() {
    if (!websiteId) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/planner/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ websiteId, seedTopic: seedTopic || undefined, count }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Generation failed');
      }

      const data = await res.json();
      onGenerated(data.ideas);
      setOpen(false);
      setSeedTopic('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to generate');
    } finally {
      setLoading(false);
    }
  }

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition"
        style={{ background: 'var(--accent)', color: 'var(--accent-text)' }}
      >
        <Sparkles size={13} />
        Generate
      </button>

      {open && (
        <div
          className="absolute left-0 top-full mt-2 w-[260px] p-4 rounded-xl shadow-lg z-50 space-y-3"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
        >
          <div>
            <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-muted)' }}>Website *</label>
            <select
              value={websiteId}
              onChange={e => setWebsiteId(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg text-sm"
              style={{ background: 'var(--background)', border: '1px solid var(--border)', color: 'var(--foreground)' }}
            >
              <option value="">Select website...</option>
              {websites.map(w => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-muted)' }}>Seed Topic (optional)</label>
            <input
              type="text"
              value={seedTopic}
              onChange={e => setSeedTopic(e.target.value)}
              placeholder="e.g., AI writing tools"
              className="w-full px-2.5 py-1.5 rounded-lg text-sm"
              style={{ background: 'var(--background)', border: '1px solid var(--border)', color: 'var(--foreground)' }}
            />
          </div>

          <div>
            <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-muted)' }}>Ideas to generate</label>
            <input
              type="number"
              min={1}
              max={10}
              value={count}
              onChange={e => setCount(parseInt(e.target.value, 10) || 5)}
              className="w-20 px-2.5 py-1.5 rounded-lg text-sm"
              style={{ background: 'var(--background)', border: '1px solid var(--border)', color: 'var(--foreground)' }}
            />
          </div>

          {error && <p className="text-xs" style={{ color: 'var(--danger)' }}>{error}</p>}

          <button
            onClick={handleGenerate}
            disabled={!websiteId || loading}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50"
            style={{ background: 'var(--accent)', color: 'var(--accent-text)' }}
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            {loading ? 'Generating...' : 'Generate Ideas'}
          </button>
        </div>
      )}
    </div>
  );
}
