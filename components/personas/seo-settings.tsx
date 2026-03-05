"use client"

import { useState } from "react"
import { updatePersonaSeo } from "@/app/actions/personas"
import { Persona } from "@/types"
import { Link2, ExternalLink, Hash, Heading, List, BookOpen, FileText, Ruler } from "lucide-react"

function SliderField({
    name,
    label,
    description,
    min,
    max,
    value,
    onChange,
    leftLabel,
    rightLabel,
    icon,
}: {
    name: string
    label: string
    description?: string
    min: number
    max: number
    value: number
    onChange: (v: number) => void
    leftLabel: string
    rightLabel: string
    icon?: React.ReactNode
}) {
    return (
        <div
            className="rounded-xl p-5"
            style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
        >
            <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                    {icon && (
                        <span
                            className="flex items-center justify-center w-7 h-7 rounded-lg"
                            style={{ background: "var(--accent-light)", color: "var(--accent)" }}
                        >
                            {icon}
                        </span>
                    )}
                    <div>
                        <label className="block text-sm font-semibold" style={{ color: "var(--foreground)" }}>
                            {label}
                        </label>
                        {description && (
                            <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                                {description}
                            </p>
                        )}
                    </div>
                </div>
                <span
                    className="text-sm font-bold tabular-nums min-w-[2.5rem] text-center px-2 py-0.5 rounded-lg"
                    style={{ background: "var(--surface-warm)", color: "var(--accent)" }}
                >
                    {value}
                </span>
            </div>
            <input
                type="range"
                name={name}
                min={min}
                max={max}
                value={value}
                onChange={(e) => onChange(parseInt(e.target.value))}
                className="w-full accent-[var(--accent)]"
                style={{ accentColor: "var(--accent)" }}
            />
            <div className="flex justify-between text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                <span>{leftLabel}</span>
                <span>{rightLabel}</span>
            </div>
        </div>
    )
}

function ToggleField({
    name,
    label,
    description,
    checked,
    onChange,
    icon,
}: {
    name: string
    label: string
    description: string
    checked: boolean
    onChange: (v: boolean) => void
    icon?: React.ReactNode
}) {
    return (
        <div
            className="rounded-xl p-5 flex items-center justify-between gap-4"
            style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
        >
            <div className="flex items-center gap-3">
                {icon && (
                    <span
                        className="flex items-center justify-center w-7 h-7 rounded-lg flex-shrink-0"
                        style={{ background: "var(--accent-light)", color: "var(--accent)" }}
                    >
                        {icon}
                    </span>
                )}
                <div>
                    <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
                        {label}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                        {description}
                    </p>
                </div>
            </div>
            <button
                type="button"
                role="switch"
                aria-checked={checked}
                onClick={() => onChange(!checked)}
                className="relative flex-shrink-0 w-11 h-6 rounded-full transition-colors duration-200"
                style={{
                    background: checked ? "var(--accent)" : "var(--border)",
                }}
            >
                <span
                    className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200"
                    style={{
                        transform: checked ? "translateX(20px)" : "translateX(0)",
                    }}
                />
            </button>
            <input type="hidden" name={name} value={checked ? "on" : "off"} />
        </div>
    )
}

export function SeoSettings({ persona }: { persona: Persona }) {
    const [isSaving, setIsSaving] = useState(false)
    const [message, setMessage] = useState("")

    // Slider states
    const [internalLinking, setInternalLinking] = useState(persona.seo_internal_links ?? 3)
    const [externalLinking, setExternalLinking] = useState(persona.seo_outbound_links ?? 3)

    // Toggle states
    const [faqSection, setFaqSection] = useState(persona.seo_include_faq ?? false)
    const [toc, setToc] = useState(persona.seo_include_toc ?? false)

    async function handleSubmit(formData: FormData) {
        setIsSaving(true)
        setMessage("")
        try {
            await updatePersonaSeo(persona.id, formData)
            setMessage("SEO settings saved successfully.")
        } catch (err) {
            setMessage("Failed to save SEO settings.")
            console.error(err)
        } finally {
            setIsSaving(false)
        }
    }

    return (
        <form action={handleSubmit} className="space-y-6 max-w-3xl">
            {/* Linking Strategy */}
            <div>
                <h2 className="text-base font-semibold mb-1" style={{ color: "var(--foreground)" }}>
                    Linking Strategy
                </h2>
                <p className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>
                    Control how aggressively articles link to internal and external content.
                </p>
                <div className="space-y-4">
                    <SliderField
                        name="seo_internal_links"
                        label="Internal Linking"
                        description="How many links to other articles on the same site"
                        min={0}
                        max={10}
                        value={internalLinking}
                        onChange={setInternalLinking}
                        leftLabel="None"
                        rightLabel="Aggressive"
                        icon={<Link2 size={14} />}
                    />
                    <SliderField
                        name="seo_outbound_links"
                        label="External Linking"
                        description="How many outbound links to authoritative sources"
                        min={0}
                        max={10}
                        value={externalLinking}
                        onChange={setExternalLinking}
                        leftLabel="None"
                        rightLabel="Generous"
                        icon={<ExternalLink size={14} />}
                    />
                </div>
            </div>

            {/* Content Structure */}
            <div>
                <h2 className="text-base font-semibold mb-1" style={{ color: "var(--foreground)" }}>
                    Content Structure
                </h2>
                <p className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>
                    Define the structural elements that appear in generated articles.
                </p>
                <div className="space-y-4">
                    <div
                        className="rounded-xl p-5"
                        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
                    >
                        <div className="flex items-center gap-2 mb-3">
                            <span
                                className="flex items-center justify-center w-7 h-7 rounded-lg"
                                style={{ background: "var(--accent-light)", color: "var(--accent)" }}
                            >
                                <Heading size={14} />
                            </span>
                            <div>
                                <label
                                    htmlFor="seo_heading_depth"
                                    className="block text-sm font-semibold"
                                    style={{ color: "var(--foreground)" }}
                                >
                                    Heading Depth
                                </label>
                                <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                                    How deep the heading hierarchy goes
                                </p>
                            </div>
                        </div>
                        <select
                            id="seo_heading_depth"
                            name="seo_heading_depth"
                            defaultValue={persona.seo_heading_depth ?? 3}
                            className="w-full rounded-lg px-3 py-2 text-sm"
                            style={{
                                border: "1px solid var(--border)",
                                color: "var(--foreground)",
                                background: "var(--surface)",
                            }}
                        >
                            <option value={2}>H2 only</option>
                            <option value={3}>H2 + H3</option>
                            <option value={4}>H2 + H3 + H4</option>
                        </select>
                    </div>

                    <ToggleField
                        name="seo_include_faq"
                        label="FAQ Section"
                        description="Append a frequently asked questions section at the end of articles"
                        checked={faqSection}
                        onChange={setFaqSection}
                        icon={<List size={14} />}
                    />

                    <ToggleField
                        name="seo_include_toc"
                        label="Table of Contents"
                        description="Include a table of contents at the top of longer articles"
                        checked={toc}
                        onChange={setToc}
                        icon={<BookOpen size={14} />}
                    />
                </div>
            </div>

            {/* Keyword & Density */}
            <div>
                <h2 className="text-base font-semibold mb-1" style={{ color: "var(--foreground)" }}>
                    Keyword Settings
                </h2>
                <p className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>
                    Target density for the primary keyword throughout the article.
                </p>
                <div
                    className="rounded-xl p-5"
                    style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
                >
                    <div className="flex items-center gap-2 mb-3">
                        <span
                            className="flex items-center justify-center w-7 h-7 rounded-lg"
                            style={{ background: "var(--accent-light)", color: "var(--accent)" }}
                        >
                            <Hash size={14} />
                        </span>
                        <div>
                            <label
                                htmlFor="seo_keyword_density"
                                className="block text-sm font-semibold"
                                style={{ color: "var(--foreground)" }}
                            >
                                Keyword Density Target
                            </label>
                            <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                                Percentage of keyword occurrences relative to total word count
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <input
                            type="number"
                            id="seo_keyword_density"
                            name="seo_keyword_density"
                            step="0.1"
                            min="0"
                            max="5"
                            defaultValue={persona.seo_keyword_density ?? 1.5}
                            className="w-24 rounded-lg px-3 py-2 text-sm"
                            style={{
                                border: "1px solid var(--border)",
                                color: "var(--foreground)",
                            }}
                        />
                        <span className="text-sm" style={{ color: "var(--text-muted)" }}>
                            %
                        </span>
                    </div>
                </div>
            </div>

            {/* Meta & Title */}
            <div>
                <h2 className="text-base font-semibold mb-1" style={{ color: "var(--foreground)" }}>
                    Meta Information
                </h2>
                <p className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>
                    Control how titles and descriptions are generated for search engines.
                </p>
                <div className="space-y-4">
                    <div
                        className="rounded-xl p-5"
                        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
                    >
                        <div className="flex items-center gap-2 mb-3">
                            <span
                                className="flex items-center justify-center w-7 h-7 rounded-lg"
                                style={{ background: "var(--accent-light)", color: "var(--accent)" }}
                            >
                                <FileText size={14} />
                            </span>
                            <label
                                htmlFor="seo_title_tag_format"
                                className="block text-sm font-semibold"
                                style={{ color: "var(--foreground)" }}
                            >
                                Meta Title Format
                            </label>
                        </div>
                        <input
                            type="text"
                            id="seo_title_tag_format"
                            name="seo_title_tag_format"
                            defaultValue={persona.seo_title_tag_format || ""}
                            placeholder="{title} | {site_name}"
                            className="w-full rounded-lg px-3 py-2 text-sm"
                            style={{
                                border: "1px solid var(--border)",
                                color: "var(--foreground)",
                            }}
                        />
                        <p className="text-xs mt-2" style={{ color: "var(--text-muted)" }}>
                            Use {"{title}"} for the article title and {"{site_name}"} for the website name.
                        </p>
                    </div>

                    <div
                        className="rounded-xl p-5"
                        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
                    >
                        <div className="flex items-center gap-2 mb-3">
                            <span
                                className="flex items-center justify-center w-7 h-7 rounded-lg"
                                style={{ background: "var(--accent-light)", color: "var(--accent)" }}
                            >
                                <Ruler size={14} />
                            </span>
                            <div>
                                <label
                                    htmlFor="seo_meta_description_length"
                                    className="block text-sm font-semibold"
                                    style={{ color: "var(--foreground)" }}
                                >
                                    Meta Description Length
                                </label>
                                <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                                    Maximum character count for generated meta descriptions
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <input
                                type="number"
                                id="seo_meta_description_length"
                                name="seo_meta_description_length"
                                min={50}
                                max={320}
                                defaultValue={persona.seo_meta_description_length ?? 155}
                                className="w-24 rounded-lg px-3 py-2 text-sm"
                                style={{
                                    border: "1px solid var(--border)",
                                    color: "var(--foreground)",
                                }}
                            />
                            <span className="text-sm" style={{ color: "var(--text-muted)" }}>
                                characters
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Word Count */}
            <div>
                <h2 className="text-base font-semibold mb-1" style={{ color: "var(--foreground)" }}>
                    Article Length
                </h2>
                <p className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>
                    Set minimum and maximum word counts for generated articles.
                </p>
                <div
                    className="rounded-xl p-5"
                    style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
                >
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <div>
                            <label
                                htmlFor="seo_article_length_min"
                                className="block text-sm font-medium mb-2"
                                style={{ color: "var(--text-secondary)" }}
                            >
                                Minimum Words
                            </label>
                            <input
                                type="number"
                                id="seo_article_length_min"
                                name="seo_article_length_min"
                                min={300}
                                max={10000}
                                step={100}
                                defaultValue={persona.seo_article_length_min ?? 1500}
                                className="w-full rounded-lg px-3 py-2 text-sm"
                                style={{
                                    border: "1px solid var(--border)",
                                    color: "var(--foreground)",
                                }}
                            />
                        </div>
                        <div>
                            <label
                                htmlFor="seo_article_length_max"
                                className="block text-sm font-medium mb-2"
                                style={{ color: "var(--text-secondary)" }}
                            >
                                Maximum Words
                            </label>
                            <input
                                type="number"
                                id="seo_article_length_max"
                                name="seo_article_length_max"
                                min={500}
                                max={15000}
                                step={100}
                                defaultValue={persona.seo_article_length_max ?? 3000}
                                className="w-full rounded-lg px-3 py-2 text-sm"
                                style={{
                                    border: "1px solid var(--border)",
                                    color: "var(--foreground)",
                                }}
                            />
                        </div>
                    </div>
                    <p className="text-xs mt-3" style={{ color: "var(--text-muted)" }}>
                        These are guidelines for the AI, not hard limits. Actual length may vary depending on the topic.
                    </p>
                </div>
            </div>

            {/* Save */}
            <div
                className="rounded-xl p-4 flex items-center justify-between sticky bottom-4"
                style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
            >
                <p
                    className="text-sm"
                    style={{
                        color: message.includes("Failed") ? "var(--danger)" : "var(--success)",
                    }}
                >
                    {message}
                </p>
                <button
                    type="submit"
                    disabled={isSaving}
                    className="px-6 py-2 rounded-lg font-medium text-sm transition hover:opacity-90 disabled:opacity-50"
                    style={{ background: "var(--accent)", color: "var(--accent-text)" }}
                >
                    {isSaving ? "Saving..." : "Save SEO Settings"}
                </button>
            </div>
        </form>
    )
}
