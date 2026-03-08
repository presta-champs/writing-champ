"use client"

import { useState } from "react"
import { Mic, Search } from "lucide-react"

type Tab = "voice" | "seo"

export function PersonaTabs({
    voiceContent,
    seoContent,
}: {
    voiceContent: React.ReactNode
    seoContent: React.ReactNode
}) {
    const [active, setActive] = useState<Tab>("voice")

    const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
        { id: "voice", label: "Voice", icon: <Mic size={16} /> },
        { id: "seo", label: "SEO", icon: <Search size={16} /> },
    ]

    return (
        <div>
            <div
                className="flex gap-1 p-1 rounded-xl mb-6"
                style={{ background: "var(--surface-warm)" }}
            >
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActive(tab.id)}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
                        style={{
                            background: active === tab.id ? "var(--surface)" : "transparent",
                            color: active === tab.id ? "var(--foreground)" : "var(--text-muted)",
                            boxShadow: active === tab.id ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                        }}
                    >
                        {tab.icon}
                        {tab.label}
                    </button>
                ))}
            </div>

            <div style={{ display: active === "voice" ? "block" : "none" }}>
                {voiceContent}
            </div>
            <div style={{ display: active === "seo" ? "block" : "none" }}>
                {seoContent}
            </div>
        </div>
    )
}
