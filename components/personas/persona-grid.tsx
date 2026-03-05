"use client"

import { useState, useMemo } from "react"
import Link from "next/link"

type Persona = {
    id: string
    name: string
    bio: string | null
    is_builtin: boolean
    badges: string[] | null
}

const FILTER_ROW_LIMIT = 8
const CARD_BADGE_LIMIT = 3

export function PersonaGrid({ personas }: { personas: Persona[] }) {
    const [activeFilter, setActiveFilter] = useState<string | null>(null)
    const [filtersExpanded, setFiltersExpanded] = useState(false)

    const allBadges = useMemo(() => {
        const set = new Set<string>()
        for (const p of personas) {
            if (p.badges) p.badges.forEach(b => set.add(b))
        }
        return Array.from(set).sort()
    }, [personas])

    const filtered = activeFilter
        ? personas.filter(p => p.badges?.includes(activeFilter))
        : personas

    const visibleFilters = filtersExpanded ? allBadges : allBadges.slice(0, FILTER_ROW_LIMIT)
    const hiddenFilterCount = allBadges.length - FILTER_ROW_LIMIT

    return (
        <div>
            {allBadges.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-6 items-center">
                    <button
                        onClick={() => setActiveFilter(null)}
                        className="text-xs px-3 py-1.5 rounded-full transition font-medium whitespace-nowrap"
                        style={{
                            background: activeFilter === null ? 'var(--accent)' : 'var(--surface)',
                            color: activeFilter === null ? 'var(--accent-text)' : 'var(--text-secondary)',
                            border: activeFilter === null ? '1px solid var(--accent)' : '1px solid var(--border)',
                        }}
                    >
                        All
                    </button>
                    {visibleFilters.map(badge => (
                        <button
                            key={badge}
                            onClick={() => setActiveFilter(activeFilter === badge ? null : badge)}
                            className="text-xs px-3 py-1.5 rounded-full transition font-medium whitespace-nowrap"
                            style={{
                                background: activeFilter === badge ? 'var(--accent)' : 'var(--surface)',
                                color: activeFilter === badge ? 'var(--accent-text)' : 'var(--text-secondary)',
                                border: activeFilter === badge ? '1px solid var(--accent)' : '1px solid var(--border)',
                            }}
                        >
                            {badge}
                        </button>
                    ))}
                    {!filtersExpanded && hiddenFilterCount > 0 && (
                        <button
                            onClick={() => setFiltersExpanded(true)}
                            className="text-xs px-3 py-1.5 rounded-full transition font-medium whitespace-nowrap"
                            style={{ color: 'var(--accent)', border: '1px dashed var(--border)' }}
                        >
                            +{hiddenFilterCount} more
                        </button>
                    )}
                    {filtersExpanded && hiddenFilterCount > 0 && (
                        <button
                            onClick={() => setFiltersExpanded(false)}
                            className="text-xs px-3 py-1.5 rounded-full transition font-medium whitespace-nowrap"
                            style={{ color: 'var(--text-muted)', border: '1px dashed var(--border)' }}
                        >
                            Show less
                        </button>
                    )}
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filtered.map((persona) => (
                    <PersonaCard key={persona.id} persona={persona} />
                ))}
            </div>

            {filtered.length === 0 && activeFilter && (
                <div className="text-center py-8">
                    <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No personas match &ldquo;{activeFilter}&rdquo;</p>
                </div>
            )}
        </div>
    )
}

function PersonaCard({ persona }: { persona: Persona }) {
    const [badgesExpanded, setBadgesExpanded] = useState(false)
    const badges = persona.badges || []
    const visibleBadges = badgesExpanded ? badges : badges.slice(0, CARD_BADGE_LIMIT)
    const hiddenCount = badges.length - CARD_BADGE_LIMIT

    return (
        <div className="rounded-xl p-6 transition hover:shadow-sm" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div className="flex items-center gap-2 flex-wrap mb-3">
                <h3 className="text-lg font-semibold" style={{ color: 'var(--foreground)' }}>{persona.name}</h3>
                {persona.is_builtin && (
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--accent-light)', color: 'var(--accent)' }}>
                        Built-in
                    </span>
                )}
            </div>

            {badges.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-4 items-center">
                    {visibleBadges.map(badge => (
                        <span
                            key={badge}
                            className="text-xs px-2 py-0.5 rounded-full whitespace-nowrap"
                            style={{ background: 'var(--surface-warm)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
                        >
                            {badge}
                        </span>
                    ))}
                    {!badgesExpanded && hiddenCount > 0 && (
                        <button
                            onClick={() => setBadgesExpanded(true)}
                            className="text-xs px-2 py-0.5 rounded-full whitespace-nowrap"
                            style={{ color: 'var(--accent)', border: '1px dashed var(--border)' }}
                        >
                            +{hiddenCount}
                        </button>
                    )}
                </div>
            )}

            <p className="text-sm mb-6 line-clamp-3" style={{ color: 'var(--text-secondary)' }}>
                {persona.bio || "No biography provided."}
            </p>
            <Link
                href={`/dashboard/personas/${persona.id}`}
                className="text-sm font-medium hover:underline"
                style={{ color: 'var(--accent)' }}
            >
                Edit Profile &rarr;
            </Link>
        </div>
    )
}
