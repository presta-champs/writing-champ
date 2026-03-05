import { createPersona } from "@/app/actions/personas";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function NewPersonaPage() {
    return (
        <div className="max-w-2xl w-full">
            <Link href="/dashboard/personas" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 mb-6">
                <ArrowLeft size={16} /> Back to Personas
            </Link>

            <div className="mb-8">
                <h1 className="text-2xl font-bold text-gray-900">Create New Persona</h1>
                <p className="text-gray-500">Define a new writing voice to use for articles and content.</p>
            </div>

            <div className="bg-white border rounded-lg shadow-sm p-6 text-foreground">
                <form action={createPersona} className="space-y-6">
                    <div>
                        <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                            Persona Name
                        </label>
                        <input
                            type="text"
                            name="name"
                            id="name"
                            placeholder="e.g. Technical SEO Expert"
                            required
                            className="w-full border rounded-md px-3 py-2 text-sm focus:ring-blue-500 outline-none"
                        />
                    </div>

                    <div>
                        <label htmlFor="bio" className="block text-sm font-medium text-gray-700 mb-1">
                            Biography / Context
                        </label>
                        <textarea
                            name="bio"
                            id="bio"
                            rows={3}
                            placeholder="e.g. A senior technical SEO specialized in JavaScript rendering and crawl budgets."
                            className="w-full border rounded-md px-3 py-2 text-sm focus:ring-blue-500 outline-none"
                        />
                    </div>

                    <div className="border-t pt-4 mt-6">
                        <h3 className="text-sm font-medium text-gray-900 mb-4">Base Tone Settings</h3>

                        <div className="space-y-4">
                            {/* Formal Slider */}
                            <div>
                                <div className="flex justify-between text-xs text-gray-500 mb-1">
                                    <span>Casual</span>
                                    <span>Formal</span>
                                </div>
                                <input type="range" name="tone_formal" min="0" max="100" defaultValue="50" className="w-full" />
                            </div>

                            {/* Warmth Slider */}
                            <div>
                                <div className="flex justify-between text-xs text-gray-500 mb-1">
                                    <span>Clinical</span>
                                    <span>Warm/Empathetic</span>
                                </div>
                                <input type="range" name="tone_warmth" min="0" max="100" defaultValue="50" className="w-full" />
                            </div>

                            {/* Conciseness Slider */}
                            <div>
                                <div className="flex justify-between text-xs text-gray-500 mb-1">
                                    <span>Verbose/Descriptive</span>
                                    <span>Concise/Direct</span>
                                </div>
                                <input type="range" name="tone_conciseness" min="0" max="100" defaultValue="50" className="w-full" />
                            </div>
                        </div>
                    </div>

                    <div className="pt-4 border-t flex justify-end gap-3 mt-6">
                        <Link href="/dashboard/personas" className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 border rounded-md">
                            Cancel
                        </Link>
                        <button type="submit" className="bg-blue-600 text-white hover:bg-blue-700 px-4 py-2 rounded-md font-medium text-sm">
                            Create Persona
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
