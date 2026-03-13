'use client';

import { useState } from 'react';
import { X, Trash2, PenTool } from 'lucide-react';
import type { Campaign } from '@/app/dashboard/planner/planner-dashboard';

type Props = {
  campaign: Campaign | null; // null = creating new
  defaultDate?: string | null;
  onSave: (campaign: Campaign) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
  websites: Array<{ id: string; name: string }>;
  personas: Array<{ id: string; name: string; website_ids: string[] }>;
};

export function IdeaDetailModal({ campaign, defaultDate, onSave, onDelete, onClose, websites, personas }: Props) {
  const isNew = !campaign;

  const [title, setTitle] = useState(campaign?.title || '');
  const [coreIdea, setCoreIdea] = useState(campaign?.core_idea || '');
  const [websiteId, setWebsiteId] = useState(campaign?.website_id || '');
  const [personaId, setPersonaId] = useState(campaign?.persona_id || '');
  const [format, setFormat] = useState(campaign?.format || '');
  const [primaryKeyword, setPrimaryKeyword] = useState(campaign?.primary_keyword || '');
  const [secondaryKeywords, setSecondaryKeywords] = useState(
    campaign?.secondary_keywords?.join(', ') || ''
  );
  const [targetLength, setTargetLength] = useState(campaign?.target_length || 1500);
  const [notes, setNotes] = useState(campaign?.notes || '');
  const [scheduledAt, setScheduledAt] = useState(campaign?.scheduled_at || defaultDate || '');
  const [saving, setSaving] = useState(false);

  // Filter personas by selected website
  const filteredPersonas = websiteId
    ? personas.filter(p => p.website_ids.includes(websiteId))
    : personas;

  const canWrite = websiteId && personaId;

  async function handleSave() {
    if (!title.trim()) return;
    setSaving(true);

    const payload = {
      title: title.trim(),
      core_idea: coreIdea || null,
      website_id: websiteId || null,
      persona_id: personaId || null,
      format: format || null,
      primary_keyword: primaryKeyword || null,
      secondary_keywords: secondaryKeywords
        ? secondaryKeywords.split(',').map(s => s.trim()).filter(Boolean)
        : [],
      target_length: targetLength,
      notes: notes || null,
      scheduled_at: scheduledAt || null,
    };

    try {
      let res;
      if (isNew) {
        res = await fetch('/api/planner', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch(`/api/planner/${campaign.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }

      if (res.ok) {
        const updated = await res.json();
        onSave(updated);
      }
    } catch (e) {
      console.error('Save error:', e);
    } finally {
      setSaving(false);
    }
  }

  function handleWrite() {
    if (!campaign || !canWrite) return;
    window.location.href = `/dashboard/articles/new?campaign=${campaign.id}`;
  }

  const FORMATS = ['how-to', 'roundup', 'listicle', 'explainer', 'opinion', 'tutorial', 'case-study'];

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />

      {/* Panel */}
      <div
        className="relative w-[400px] max-w-full h-full overflow-y-auto p-6 space-y-4"
        style={{ background: 'var(--background)' }}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold" style={{ color: 'var(--foreground)' }}>
            {isNew ? 'New Idea' : 'Edit Idea'}
          </h2>
          <button onClick={onClose} className="p-1 rounded" style={{ color: 'var(--text-muted)' }}>
            <X size={18} />
          </button>
        </div>

        {/* Status badge */}
        {campaign && (
          <div className="flex items-center gap-2">
            <span className="text-xs px-2 py-0.5 rounded-full font-medium capitalize"
              style={{ background: 'var(--surface)', color: 'var(--text-secondary)' }}>
              {campaign.status}
            </span>
            {campaign.source && (
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Source: {campaign.source}
              </span>
            )}
          </div>
        )}

        {/* Title */}
        <div>
          <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-muted)' }}>Title *</label>
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            className="w-full px-3 py-2 rounded-lg text-sm"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--foreground)' }}
          />
        </div>

        {/* Core Idea */}
        <div>
          <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-muted)' }}>Description</label>
          <textarea
            value={coreIdea}
            onChange={e => setCoreIdea(e.target.value)}
            rows={2}
            className="w-full px-3 py-2 rounded-lg text-sm resize-none"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--foreground)' }}
          />
        </div>

        {/* Website */}
        <div>
          <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-muted)' }}>Website</label>
          <select
            value={websiteId}
            onChange={e => { setWebsiteId(e.target.value); setPersonaId(''); }}
            className="w-full px-3 py-2 rounded-lg text-sm"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--foreground)' }}
          >
            <option value="">Select website...</option>
            {websites.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        </div>

        {/* Persona */}
        <div>
          <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-muted)' }}>Persona</label>
          <select
            value={personaId}
            onChange={e => setPersonaId(e.target.value)}
            className="w-full px-3 py-2 rounded-lg text-sm"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--foreground)' }}
          >
            <option value="">Select persona...</option>
            {filteredPersonas.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>

        {/* Format */}
        <div>
          <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-muted)' }}>Format</label>
          <select
            value={format}
            onChange={e => setFormat(e.target.value)}
            className="w-full px-3 py-2 rounded-lg text-sm"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--foreground)' }}
          >
            <option value="">Select format...</option>
            {FORMATS.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>

        {/* Keywords */}
        <div>
          <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-muted)' }}>Primary Keyword</label>
          <input
            value={primaryKeyword}
            onChange={e => setPrimaryKeyword(e.target.value)}
            className="w-full px-3 py-2 rounded-lg text-sm"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--foreground)' }}
          />
        </div>

        <div>
          <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-muted)' }}>Secondary Keywords (comma-separated)</label>
          <input
            value={secondaryKeywords}
            onChange={e => setSecondaryKeywords(e.target.value)}
            className="w-full px-3 py-2 rounded-lg text-sm"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--foreground)' }}
          />
        </div>

        {/* Target Length */}
        <div>
          <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-muted)' }}>Target Length (words)</label>
          <input
            type="number"
            value={targetLength}
            onChange={e => setTargetLength(parseInt(e.target.value, 10) || 1500)}
            min={300}
            max={5000}
            className="w-32 px-3 py-2 rounded-lg text-sm"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--foreground)' }}
          />
        </div>

        {/* Notes */}
        <div>
          <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-muted)' }}>Notes</label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={2}
            className="w-full px-3 py-2 rounded-lg text-sm resize-none"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--foreground)' }}
          />
        </div>

        {/* Scheduled Date */}
        <div>
          <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-muted)' }}>Scheduled Date</label>
          <input
            type="date"
            value={scheduledAt}
            onChange={e => setScheduledAt(e.target.value)}
            className="w-full px-3 py-2 rounded-lg text-sm"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--foreground)' }}
          />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 pt-2" style={{ borderTop: '1px solid var(--border)' }}>
          <button
            onClick={handleSave}
            disabled={!title.trim() || saving}
            className="flex-1 px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50"
            style={{ background: 'var(--accent)', color: 'var(--accent-text)' }}
          >
            {saving ? 'Saving...' : 'Save'}
          </button>

          {!isNew && canWrite && (
            <button
              onClick={handleWrite}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition"
              style={{ background: 'var(--success, #10b981)', color: 'white' }}
            >
              <PenTool size={14} />
              Write Article
            </button>
          )}

          {!isNew && (
            <button
              onClick={() => { if (confirm('Delete this idea?')) onDelete(campaign!.id); }}
              className="p-2 rounded-lg transition"
              style={{ color: 'var(--danger)' }}
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
