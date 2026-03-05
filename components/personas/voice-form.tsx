"use client"

import { useState } from "react"
import { updatePersonaVoice } from "@/app/actions/personas"
import { Persona } from "@/types"
import { Plus, X, ChevronDown, ChevronUp } from "lucide-react"

function CollapsibleSection({ title, subtitle, defaultOpen = false, children }: {
    title: string;
    subtitle?: string;
    defaultOpen?: boolean;
    children: React.ReactNode;
}) {
    const [open, setOpen] = useState(defaultOpen)
    return (
        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
            <button type="button" onClick={() => setOpen(!open)} className="w-full flex items-center justify-between p-4 transition hover:opacity-80" style={{ background: 'var(--surface)' }}>
                <div className="text-left">
                    <h3 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>{title}</h3>
                    {subtitle && <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{subtitle}</p>}
                </div>
                {open ? <ChevronUp size={16} style={{ color: 'var(--text-muted)' }} /> : <ChevronDown size={16} style={{ color: 'var(--text-muted)' }} />}
            </button>
            {open && <div className="px-4 pb-4 pt-4" style={{ borderTop: '1px solid var(--border)' }}>{children}</div>}
        </div>
    )
}

function ListEditor({ name, items, onChange, placeholder }: {
    name: string;
    items: string[];
    onChange: (items: string[]) => void;
    placeholder: string;
}) {
    const [draft, setDraft] = useState("")
    return (
        <div>
            <div className="flex gap-2 mb-2">
                <input
                    type="text"
                    value={draft}
                    onChange={e => setDraft(e.target.value)}
                    onKeyDown={e => {
                        if (e.key === "Enter") {
                            e.preventDefault()
                            if (draft.trim()) {
                                onChange([...items, draft.trim()])
                                setDraft("")
                            }
                        }
                    }}
                    placeholder={placeholder}
                    className="flex-1 rounded-lg px-3 py-1.5 text-sm"
                    style={{ border: '1px solid var(--border)', color: 'var(--foreground)' }}
                />
                <button
                    type="button"
                    onClick={() => {
                        if (draft.trim()) {
                            onChange([...items, draft.trim()])
                            setDraft("")
                        }
                    }}
                    className="px-2"
                    style={{ color: 'var(--accent)' }}
                >
                    <Plus size={16} />
                </button>
            </div>
            {items.length > 0 && (
                <div className="flex flex-wrap gap-2">
                    {items.map((item, i) => (
                        <span key={i} className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full" style={{ background: 'var(--surface-warm)', color: 'var(--text-secondary)' }}>
                            {item}
                            <button type="button" onClick={() => onChange(items.filter((_, j) => j !== i))} style={{ color: 'var(--text-muted)' }} className="hover:opacity-60">
                                <X size={12} />
                            </button>
                        </span>
                    ))}
                </div>
            )}
            <input type="hidden" name={name} value={JSON.stringify(items)} />
        </div>
    )
}

function KeyValueListEditor({ name, items, onChange, keyLabel, keyPlaceholder, valuePlaceholder }: {
    name: string;
    items: { title: string; description: string }[];
    onChange: (items: { title: string; description: string }[]) => void;
    keyLabel: string;
    valueLabel?: string;
    keyPlaceholder: string;
    valuePlaceholder: string;
}) {
    const [draftKey, setDraftKey] = useState("")
    const [draftValue, setDraftValue] = useState("")

    function add() {
        if (draftKey.trim() && draftValue.trim()) {
            onChange([...items, { title: draftKey.trim(), description: draftValue.trim() }])
            setDraftKey("")
            setDraftValue("")
        }
    }

    return (
        <div className="space-y-3">
            {items.map((item, i) => (
                <div key={i} className="rounded-lg p-3 relative group" style={{ background: 'var(--surface-warm)', border: '1px solid var(--border)' }}>
                    <button type="button" onClick={() => onChange(items.filter((_, j) => j !== i))} className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition" style={{ color: 'var(--danger)' }}>
                        <X size={14} />
                    </button>
                    <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>{item.title}</p>
                    <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>{item.description}</p>
                </div>
            ))}
            <div className="space-y-2 pt-3" style={{ borderTop: items.length > 0 ? '1px solid var(--border)' : 'none' }}>
                <input type="text" value={draftKey} onChange={e => setDraftKey(e.target.value)} placeholder={keyPlaceholder} className="w-full rounded-lg px-3 py-1.5 text-sm" style={{ border: '1px solid var(--border)', color: 'var(--foreground)' }} />
                <textarea value={draftValue} onChange={e => setDraftValue(e.target.value)} placeholder={valuePlaceholder} rows={2} className="w-full rounded-lg px-3 py-1.5 text-sm" style={{ border: '1px solid var(--border)', color: 'var(--foreground)' }} />
                <button type="button" onClick={add} disabled={!draftKey.trim() || !draftValue.trim()} className="text-sm flex items-center gap-1 disabled:opacity-30" style={{ color: 'var(--accent)' }}>
                    <Plus size={14} /> Add {keyLabel}
                </button>
            </div>
            <input type="hidden" name={name} value={JSON.stringify(items)} />
        </div>
    )
}

function ExamplePassageEditor({ items, onChange }: {
    items: { title: string; topic: string; text: string }[];
    onChange: (items: { title: string; topic: string; text: string }[]) => void;
}) {
    const [draftTitle, setDraftTitle] = useState("")
    const [draftTopic, setDraftTopic] = useState("")
    const [draftText, setDraftText] = useState("")

    function add() {
        if (draftTitle.trim() && draftText.trim()) {
            onChange([...items, { title: draftTitle.trim(), topic: draftTopic.trim(), text: draftText.trim() }])
            setDraftTitle("")
            setDraftTopic("")
            setDraftText("")
        }
    }

    return (
        <div className="space-y-3">
            {items.map((item, i) => (
                <div key={i} className="rounded-lg p-3 relative group" style={{ background: 'var(--surface-warm)', border: '1px solid var(--border)' }}>
                    <button type="button" onClick={() => onChange(items.filter((_, j) => j !== i))} className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition" style={{ color: 'var(--danger)' }}>
                        <X size={14} />
                    </button>
                    <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>{item.title}</p>
                    {item.topic && <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Topic: {item.topic}</p>}
                    <p className="text-xs mt-2 whitespace-pre-wrap max-h-32 overflow-y-auto" style={{ color: 'var(--text-secondary)' }}>{item.text}</p>
                </div>
            ))}
            <div className="space-y-2 pt-3" style={{ borderTop: items.length > 0 ? '1px solid var(--border)' : 'none' }}>
                <input type="text" value={draftTitle} onChange={e => setDraftTitle(e.target.value)} placeholder="Example title (e.g. 'Testing PrestaShop SEO Modules')" className="w-full rounded-lg px-3 py-1.5 text-sm" style={{ border: '1px solid var(--border)', color: 'var(--foreground)' }} />
                <input type="text" value={draftTopic} onChange={e => setDraftTopic(e.target.value)} placeholder="Topic context (optional)" className="w-full rounded-lg px-3 py-1.5 text-sm" style={{ border: '1px solid var(--border)', color: 'var(--foreground)' }} />
                <textarea value={draftText} onChange={e => setDraftText(e.target.value)} placeholder="Paste the example passage text..." rows={5} className="w-full rounded-lg px-3 py-1.5 text-sm font-mono text-xs" style={{ border: '1px solid var(--border)', color: 'var(--foreground)' }} />
                <button type="button" onClick={add} disabled={!draftTitle.trim() || !draftText.trim()} className="text-sm flex items-center gap-1 disabled:opacity-30" style={{ color: 'var(--accent)' }}>
                    <Plus size={14} /> Add Example Passage
                </button>
            </div>
            <input type="hidden" name="example_passages" value={JSON.stringify(items)} />
        </div>
    )
}

function BadgeInput({ onAdd, existing }: { onAdd: (badge: string) => void; existing: string[] }) {
    const [draft, setDraft] = useState("")
    return (
        <div className="flex gap-2">
            <input
                type="text"
                value={draft}
                onChange={e => setDraft(e.target.value)}
                onKeyDown={e => {
                    if (e.key === "Enter") {
                        e.preventDefault()
                        const val = draft.trim()
                        if (val && !existing.includes(val)) {
                            onAdd(val)
                            setDraft("")
                        }
                    }
                }}
                placeholder="e.g. Dry Wit, Long-Form, Science..."
                className="flex-1 rounded-lg px-3 py-1.5 text-sm"
                style={{ border: '1px solid var(--border)', color: 'var(--foreground)' }}
            />
            <button
                type="button"
                onClick={() => {
                    const val = draft.trim()
                    if (val && !existing.includes(val)) {
                        onAdd(val)
                        setDraft("")
                    }
                }}
                className="text-sm px-3 py-1.5 rounded-lg flex items-center gap-1"
                style={{ color: 'var(--accent)', border: '1px solid var(--border)' }}
            >
                <Plus size={14} /> Add
            </button>
        </div>
    )
}

export function PersonaVoiceForm({ persona }: { persona: Persona }) {
    const [isSaving, setIsSaving] = useState(false)
    const [message, setMessage] = useState("")

    const [voicePrinciples, setVoicePrinciples] = useState<{ title: string; description: string }[]>(persona.voice_principles || [])
    const [sentenceRulesDo, setSentenceRulesDo] = useState<string[]>(persona.sentence_rules_do || [])
    const [sentenceRulesDont, setSentenceRulesDont] = useState<string[]>(persona.sentence_rules_dont || [])
    const [structuralPatterns, setStructuralPatterns] = useState<{ title: string; description: string }[]>(
        (persona.structural_patterns || []).map(p => ({ title: p.name, description: p.description }))
    )
    const [recurringThemes, setRecurringThemes] = useState<string[]>(persona.recurring_themes || [])
    const [examplePassages, setExamplePassages] = useState<{ title: string; topic: string; text: string }[]>(persona.example_passages || [])
    const [badges, setBadges] = useState<string[]>(persona.badges || [])

    async function handleSubmit(formData: FormData) {
        setIsSaving(true)
        setMessage("")
        try {
            await updatePersonaVoice(persona.id, formData)
            setMessage("Voice profile updated successfully.")
        } catch (err) {
            setMessage("Failed to update voice profile.")
            console.error(err)
        } finally {
            setIsSaving(false)
        }
    }

    return (
        <form action={handleSubmit} className="space-y-4 max-w-3xl">
            {/* Identity */}
            <div className="rounded-xl p-6" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--foreground)' }}>Identity</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="name" className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Persona Name</label>
                        <input type="text" id="name" name="name" defaultValue={persona.name} className="w-full rounded-lg px-3 py-2 text-sm" style={{ border: '1px solid var(--border)', color: 'var(--foreground)' }} required />
                    </div>
                    <div>
                        <label htmlFor="methodology" className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Methodology</label>
                        <input type="text" id="methodology" name="methodology" defaultValue={persona.methodology || ""} placeholder="e.g. Tests everything first-hand and reports results" className="w-full rounded-lg px-3 py-2 text-sm" style={{ border: '1px solid var(--border)', color: 'var(--foreground)' }} />
                    </div>
                </div>
                <div className="mt-4">
                    <label htmlFor="bio" className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Biography / Background</label>
                    <textarea id="bio" name="bio" rows={4} defaultValue={persona.bio || ""} placeholder="Who is this person? What's their background, expertise, and what makes their perspective unique?" className="w-full rounded-lg px-3 py-2 text-sm" style={{ border: '1px solid var(--border)', color: 'var(--foreground)' }} />
                </div>
            </div>

            {/* Badges */}
            <div className="rounded-xl p-6" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <h2 className="text-lg font-semibold mb-1" style={{ color: 'var(--foreground)' }}>Badges</h2>
                <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>Short tags that describe this voice — used for filtering and quick identification.</p>
                <input type="hidden" name="badges" value={JSON.stringify(badges)} />
                <div className="flex flex-wrap gap-2 mb-3">
                    {badges.map((badge, i) => (
                        <span key={i} className="text-xs px-2.5 py-1 rounded-full flex items-center gap-1.5" style={{ background: 'var(--surface-warm)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>
                            {badge}
                            <button type="button" onClick={() => setBadges(badges.filter((_, j) => j !== i))} className="hover:opacity-70">
                                <X size={12} />
                            </button>
                        </span>
                    ))}
                </div>
                <BadgeInput onAdd={(b) => setBadges([...badges, b])} existing={badges} />
            </div>

            {/* Tone Settings */}
            <div className="rounded-xl p-6" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--foreground)' }}>Tone</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>Formality</label>
                        <input type="range" name="tone_formal" min="0" max="100" defaultValue={persona.tone_formal} className="w-full" />
                        <div className="flex justify-between text-xs mt-1" style={{ color: 'var(--text-muted)' }}><span>Casual</span><span>Formal</span></div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>Warmth</label>
                        <input type="range" name="tone_warmth" min="0" max="100" defaultValue={persona.tone_warmth} className="w-full" />
                        <div className="flex justify-between text-xs mt-1" style={{ color: 'var(--text-muted)' }}><span>Clinical</span><span>Warm/Empathetic</span></div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>Conciseness</label>
                        <input type="range" name="tone_conciseness" min="0" max="100" defaultValue={persona.tone_conciseness} className="w-full" />
                        <div className="flex justify-between text-xs mt-1" style={{ color: 'var(--text-muted)' }}><span>Verbose</span><span>Direct/Punchy</span></div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>Humor</label>
                        <input type="range" name="tone_humor" min="0" max="100" defaultValue={persona.tone_humor} className="w-full" />
                        <div className="flex justify-between text-xs mt-1" style={{ color: 'var(--text-muted)' }}><span>Serious</span><span>Witty/Funny</span></div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>Brand Loyalty</label>
                        <input type="range" name="tone_brand_loyalty" min="0" max="100" defaultValue={persona.tone_brand_loyalty ?? 50} className="w-full" />
                        <div className="flex justify-between text-xs mt-1" style={{ color: 'var(--text-muted)' }}><span>Zero loyalty</span><span>Brand advocate</span></div>
                    </div>
                    <div>
                        <label htmlFor="tone_authority" className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>Authority Style</label>
                        <select id="tone_authority" name="tone_authority" defaultValue={persona.tone_authority || ""} className="w-full rounded-lg px-3 py-2 text-sm" style={{ border: '1px solid var(--border)', color: 'var(--foreground)', background: 'var(--surface)' }}>
                            <option value="">Default</option>
                            <option value="earned_through_testing">Earned through testing</option>
                            <option value="expert_credentials">Expert credentials</option>
                            <option value="industry_insider">Industry insider</option>
                            <option value="academic_research">Academic/Research</option>
                            <option value="peer_practitioner">Peer practitioner</option>
                        </select>
                    </div>
                </div>
            </div>

            <CollapsibleSection title="Core Voice Principles" subtitle="The fundamental rules that define how this persona writes" defaultOpen={voicePrinciples.length > 0}>
                <KeyValueListEditor
                    name="voice_principles"
                    items={voicePrinciples}
                    onChange={setVoicePrinciples}
                    keyLabel="Principle"
                    keyPlaceholder="e.g. 'She does the thing'"
                    valuePlaceholder="e.g. 'The premise of nearly every piece is that she actually did what other journalists just described...'"
                />
            </CollapsibleSection>

            <CollapsibleSection title="Sentence-Level Rules" subtitle="Specific do's and don'ts for individual sentences" defaultOpen={sentenceRulesDo.length > 0 || sentenceRulesDont.length > 0}>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-2" style={{ color: 'var(--success)' }}>Do</label>
                        <ListEditor name="sentence_rules_do" items={sentenceRulesDo} onChange={setSentenceRulesDo} placeholder="e.g. 'Use exact numbers: durations, counts, prices'" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-2" style={{ color: 'var(--danger)' }}>Don&apos;t</label>
                        <ListEditor name="sentence_rules_dont" items={sentenceRulesDont} onChange={setSentenceRulesDont} placeholder="e.g. 'Announce that something is absurd before describing it'" />
                    </div>
                </div>
            </CollapsibleSection>

            <CollapsibleSection title="Structural Patterns" subtitle="How this persona typically organizes a piece" defaultOpen={structuralPatterns.length > 0}>
                <KeyValueListEditor
                    name="structural_patterns"
                    items={structuralPatterns}
                    onChange={setStructuralPatterns}
                    keyLabel="Pattern"
                    keyPlaceholder="e.g. 'Setup-Commitment-Report'"
                    valuePlaceholder="e.g. 'State the premise, describe what was promised, report what happened, deliver verdict'"
                />
            </CollapsibleSection>

            <CollapsibleSection title="Recurring Themes" subtitle="Topics and perspectives this persona gravitates toward" defaultOpen={recurringThemes.length > 0}>
                <ListEditor name="recurring_themes" items={recurringThemes} onChange={setRecurringThemes} placeholder="e.g. 'AI products tested in practice, not benchmarks'" />
            </CollapsibleSection>

            <CollapsibleSection title="Distinctive Traits" subtitle="Quirks, signature phrases, and forbidden words" defaultOpen={!!(persona.quirks || persona.signature_phrases || persona.forbidden_words)}>
                <div className="space-y-4">
                    <div>
                        <label htmlFor="quirks" className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Stylistic Quirks</label>
                        <textarea id="quirks" name="quirks" rows={2} defaultValue={persona.quirks || ""} placeholder="e.g. Uses parenthetical asides as joke delivery. Ends sections with one-sentence verdicts." className="w-full rounded-lg px-3 py-1.5 text-sm" style={{ border: '1px solid var(--border)', color: 'var(--foreground)' }} />
                    </div>
                    <div>
                        <label htmlFor="signature_phrases" className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Signature Phrases</label>
                        <textarea id="signature_phrases" name="signature_phrases" rows={2} defaultValue={persona.signature_phrases || ""} placeholder="e.g. 'I cannot explain this.' / 'It did not work.'" className="w-full rounded-lg px-3 py-1.5 text-sm" style={{ border: '1px solid var(--border)', color: 'var(--foreground)' }} />
                    </div>
                    <div>
                        <label htmlFor="forbidden_words" className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Forbidden Words & Phrases</label>
                        <textarea id="forbidden_words" name="forbidden_words" rows={2} defaultValue={persona.forbidden_words || ""} placeholder="e.g. 'hilariously', 'bizarrely', 'game-changer', 'it remains to be seen'" className="w-full rounded-lg px-3 py-1.5 text-sm" style={{ border: '1px solid var(--border)', color: 'var(--foreground)' }} />
                    </div>
                </div>
            </CollapsibleSection>

            <CollapsibleSection title="Example Passages" subtitle="Original writing samples that demonstrate the voice" defaultOpen={examplePassages.length > 0}>
                <ExamplePassageEditor items={examplePassages} onChange={setExamplePassages} />
            </CollapsibleSection>

            <CollapsibleSection title="System Prompt Override" subtitle="Custom system prompt block — overrides the auto-generated persona prompt if set">
                <textarea name="system_prompt_override" rows={10} defaultValue={persona.system_prompt_override || ""} placeholder="You are writing in the style of... (Full system prompt that will be used verbatim)" className="w-full rounded-lg px-3 py-2 text-sm font-mono" style={{ border: '1px solid var(--border)', color: 'var(--foreground)' }} />
            </CollapsibleSection>

            <CollapsibleSection title="SEO Preferences" subtitle="How this persona handles keywords, headings, and meta">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Heading Style</label>
                        <input type="text" name="seo_heading_style" defaultValue={persona.seo_heading_style || ""} placeholder="e.g. Declarative statements, not questions" className="w-full rounded-lg px-3 py-1.5 text-sm" style={{ border: '1px solid var(--border)', color: 'var(--foreground)' }} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Meta Description Tone</label>
                        <input type="text" name="seo_meta_tone" defaultValue={persona.seo_meta_tone || ""} placeholder="e.g. First person: 'I tested X so you don't have to'" className="w-full rounded-lg px-3 py-1.5 text-sm" style={{ border: '1px solid var(--border)', color: 'var(--foreground)' }} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Article Length (min words)</label>
                        <input type="number" name="seo_article_length_min" defaultValue={persona.seo_article_length_min ?? 800} className="w-full rounded-lg px-3 py-1.5 text-sm" style={{ border: '1px solid var(--border)', color: 'var(--foreground)' }} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Article Length (max words)</label>
                        <input type="number" name="seo_article_length_max" defaultValue={persona.seo_article_length_max ?? 2000} className="w-full rounded-lg px-3 py-1.5 text-sm" style={{ border: '1px solid var(--border)', color: 'var(--foreground)' }} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Keyword Density</label>
                        <input type="number" name="seo_keyword_density" step="0.1" defaultValue={persona.seo_keyword_density ?? 1.5} className="w-full rounded-lg px-3 py-1.5 text-sm" style={{ border: '1px solid var(--border)', color: 'var(--foreground)' }} />
                    </div>
                    <div className="flex items-center gap-4 pt-5">
                        <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                            <input type="checkbox" name="seo_include_faq" defaultChecked={persona.seo_include_faq} className="rounded" /> Include FAQ
                        </label>
                        <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                            <input type="checkbox" name="seo_include_toc" defaultChecked={persona.seo_include_toc} className="rounded" /> Include TOC
                        </label>
                    </div>
                </div>
            </CollapsibleSection>

            {/* Save */}
            <div className="rounded-xl p-4 flex items-center justify-between sticky bottom-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <p className="text-sm" style={{ color: message.includes("Failed") ? 'var(--danger)' : 'var(--success)' }}>{message}</p>
                <button type="submit" disabled={isSaving} className="px-6 py-2 rounded-lg font-medium text-sm transition hover:opacity-90 disabled:opacity-50" style={{ background: 'var(--accent)', color: 'var(--accent-text)' }}>
                    {isSaving ? "Saving..." : "Save Voice Profile"}
                </button>
            </div>
        </form>
    )
}
