"use client"

import { useState } from "react"
import { updateBrandVoice } from "@/app/actions/sites"
import { Website } from "@/types"

export function BrandVoiceForm({ site }: { site: Website }) {
    const [isSaving, setIsSaving] = useState(false)
    const [message, setMessage] = useState("")

    async function handleSubmit(formData: FormData) {
        setIsSaving(true)
        setMessage("")
        try {
            await updateBrandVoice(site.id, formData)
            setMessage("Brand voice updated successfully.")
        } catch (err) {
            setMessage("Failed to update brand voice.")
            console.error(err)
        } finally {
            setIsSaving(false)
        }
    }

    return (
        <form action={handleSubmit} className="space-y-6 max-w-3xl">
            <div className="bg-white border rounded-lg shadow-sm p-6 space-y-6 text-foreground">
                <div>
                    <h3 className="text-lg font-medium leading-6 text-gray-900 mb-1">Brand Voice Profile</h3>
                    <p className="mt-1 text-sm text-gray-500">
                        These guardrails apply to all personas and content generated for this specific website.
                    </p>
                </div>

                <div>
                    <label htmlFor="site_description" className="block text-sm font-medium text-gray-700 mb-1">
                        Site Description / Global Context
                    </label>
                    <textarea
                        id="site_description"
                        name="site_description"
                        rows={3}
                        defaultValue={site.site_description || ""}
                        placeholder="e.g. PrestaChamps is an ecommerce agency specializing in PrestaShop performance optimization."
                        className="w-full border rounded-md px-3 py-2 text-sm focus:ring-blue-500 outline-none"
                    />
                </div>

                <div>
                    <label htmlFor="tone_guardrails" className="block text-sm font-medium text-gray-700 mb-1">
                        Tone Guardrails
                    </label>
                    <textarea
                        id="tone_guardrails"
                        name="tone_guardrails"
                        rows={2}
                        defaultValue={site.tone_guardrails || ""}
                        placeholder="e.g. Never sound salesy. Be authoritative but accessible. Avoid academic jargon."
                        className="w-full border rounded-md px-3 py-2 text-sm focus:ring-blue-500 outline-none"
                    />
                </div>

                <div>
                    <label htmlFor="required_elements" className="block text-sm font-medium text-gray-700 mb-1">
                        Required Elements
                    </label>
                    <textarea
                        id="required_elements"
                        name="required_elements"
                        rows={2}
                        defaultValue={site.required_elements || ""}
                        placeholder="e.g. Always conclude with a call-to-action asking readers to book an audit."
                        className="w-full border rounded-md px-3 py-2 text-sm focus:ring-blue-500 outline-none"
                    />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label htmlFor="banned_topics" className="block text-sm font-medium text-gray-700 mb-1">
                            Banned Topics
                        </label>
                        <textarea
                            id="banned_topics"
                            name="banned_topics"
                            rows={3}
                            defaultValue={site.banned_topics || ""}
                            placeholder="e.g. Magento, Shopify, political commentary"
                            className="w-full border rounded-md px-3 py-2 text-sm focus:ring-blue-500 outline-none"
                        />
                    </div>

                    <div>
                        <label htmlFor="banned_words" className="block text-sm font-medium text-gray-700 mb-1">
                            Banned Words
                        </label>
                        <textarea
                            id="banned_words"
                            name="banned_words"
                            rows={3}
                            defaultValue={site.banned_words || ""}
                            placeholder="e.g. paradigm shift, synergies, game-changer"
                            className="w-full border rounded-md px-3 py-2 text-sm focus:ring-blue-500 outline-none"
                        />
                    </div>
                </div>

                <div>
                    <label htmlFor="content_pillars" className="block text-sm font-medium text-gray-700 mb-1">
                        Content Pillars (comma separated)
                    </label>
                    <input
                        type="text"
                        id="content_pillars"
                        name="content_pillars"
                        defaultValue={site.content_pillars?.join(', ') || ""}
                        placeholder="e.g. Page Speed, Conversions, Checkout UX"
                        className="w-full border rounded-md px-3 py-2 text-sm focus:ring-blue-500 outline-none"
                    />
                </div>

                <div className="pt-4 border-t flex items-center justify-between">
                    <p className={`text-sm ${message.includes("Failed") ? "text-red-600" : "text-green-600"}`}>
                        {message}
                    </p>
                    <button
                        type="submit"
                        disabled={isSaving}
                        className="bg-blue-600 text-white hover:bg-blue-700 disabled:bg-blue-300 px-4 py-2 rounded-md font-medium text-sm transition"
                    >
                        {isSaving ? "Saving..." : "Save Brand Voice"}
                    </button>
                </div>
            </div>
        </form>
    )
}
