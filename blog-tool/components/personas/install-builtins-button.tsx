"use client"

import { useState } from "react"
import { installBuiltinPersonas } from "@/app/actions/personas"
import { Download } from "lucide-react"

export function InstallBuiltinsButton({ variant = "primary" }: { variant?: "primary" | "secondary" }) {
    const [loading, setLoading] = useState(false)
    const [result, setResult] = useState<string | null>(null)

    async function handleInstall() {
        setLoading(true)
        setResult(null)
        try {
            const { installed } = await installBuiltinPersonas()
            if (installed === 0) {
                setResult("All built-in personas are already installed.")
            } else {
                setResult(`Installed ${installed} persona${installed > 1 ? "s" : ""}.`)
            }
        } catch {
            setResult("Failed to install personas.")
        } finally {
            setLoading(false)
        }
    }

    if (variant === "secondary") {
        return (
            <div className="flex items-center gap-2">
                {result && <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{result}</span>}
                <button
                    onClick={handleInstall}
                    disabled={loading}
                    className="text-sm px-3 py-1.5 rounded-lg flex items-center gap-1.5 disabled:opacity-50 transition hover:opacity-80"
                    style={{ color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
                >
                    <Download size={14} />
                    {loading ? "Installing..." : "Install Built-in Personas"}
                </button>
            </div>
        )
    }

    return (
        <div className="text-center">
            {result && <p className="text-sm mb-2" style={{ color: 'var(--success)' }}>{result}</p>}
            <button
                onClick={handleInstall}
                disabled={loading}
                className="font-medium px-4 py-2 rounded-lg inline-flex items-center gap-2 disabled:opacity-50 transition hover:opacity-90"
                style={{ background: 'var(--success)', color: '#ffffff' }}
            >
                <Download size={18} />
                {loading ? "Installing..." : "Install Built-in Personas"}
            </button>
        </div>
    )
}
