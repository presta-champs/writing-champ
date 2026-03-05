import { createWebsite } from "@/app/actions/sites";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function NewSitePage() {
    return (
        <div className="max-w-2xl w-full">
            <Link href="/dashboard/sites" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 mb-6">
                <ArrowLeft size={16} /> Back to Sites
            </Link>

            <div className="mb-8">
                <h1 className="text-2xl font-bold text-gray-900">Add New Site</h1>
                <p className="text-gray-500">Register a new website to set up its content pipeline and brand voice.</p>
            </div>

            <div className="bg-white border rounded-lg shadow-sm p-6 text-foreground">
                <form action={createWebsite} className="space-y-6">
                    <div>
                        <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                            Site Name
                        </label>
                        <input
                            type="text"
                            name="name"
                            id="name"
                            placeholder="e.g. PrestaChamps"
                            required
                            className="w-full border rounded-md px-3 py-2 text-sm focus:ring-blue-500 outline-none"
                        />
                    </div>

                    <div>
                        <label htmlFor="url" className="block text-sm font-medium text-gray-700 mb-1">
                            Site URL
                        </label>
                        <input
                            type="url"
                            name="url"
                            id="url"
                            placeholder="https://prestachamps.com"
                            required
                            className="w-full border rounded-md px-3 py-2 text-sm focus:ring-blue-500 outline-none"
                        />
                    </div>

                    <div>
                        <label htmlFor="platform_type" className="block text-sm font-medium text-gray-700 mb-1">
                            Platform Type
                        </label>
                        <select
                            name="platform_type"
                            id="platform_type"
                            className="w-full border rounded-md px-3 py-2 text-sm bg-white outline-none"
                            defaultValue="wordpress"
                        >
                            <option value="wordpress">WordPress</option>
                            <option value="prestashop">PrestaShop</option>
                            <option value="custom">Custom / Webhook</option>
                        </select>
                        <p className="text-xs text-gray-500 mt-2">
                            This determines how the tool connects to your website for fetching context and publishing articles.
                        </p>
                    </div>

                    <div className="pt-4 border-t flex justify-end gap-3">
                        <Link href="/dashboard/sites" className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 border rounded-md">
                            Cancel
                        </Link>
                        <button type="submit" className="bg-blue-600 text-white hover:bg-blue-700 px-4 py-2 rounded-md font-medium text-sm">
                            Create Site
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
