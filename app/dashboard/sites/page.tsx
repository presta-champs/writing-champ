import { createClient } from "@/lib/supabase/server";
import { useOrganization } from "@/lib/hooks/use-organization";
import Link from "next/link";
import { Plus, Globe } from "lucide-react";

export default async function SitesPage() {
    const org = await useOrganization();
    const supabase = await createClient();

    const { data: websites } = await supabase
        .from("websites")
        .select("id, name, url, platform_type")
        .eq("organization_id", org?.id);

    return (
        <div className="max-w-6xl w-full">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Sites</h1>
                    <p className="text-gray-500">Manage your organization's websites and brand voices.</p>
                </div>
                <Link
                    href="/dashboard/sites/new"
                    className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-md flex items-center gap-2"
                >
                    <Plus size={18} /> Add Site
                </Link>
            </div>

            {!websites || websites.length === 0 ? (
                <div className="bg-white border rounded-lg p-12 text-center shadow-sm">
                    <Globe className="mx-auto text-gray-300 mb-4" size={48} />
                    <h3 className="text-lg font-medium text-gray-900 mb-1">No sites found</h3>
                    <p className="text-gray-500 mb-6">You haven't added any websites to your workspace yet.</p>
                    <Link
                        href="/dashboard/sites/new"
                        className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-md inline-block"
                    >
                        Add Your First Site
                    </Link>
                </div>
            ) : (
                <div className="bg-white border rounded-lg shadow-sm overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">URL</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Platform</th>
                                <th scope="col" className="relative px-6 py-3"><span className="sr-only">Edit</span></th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {websites.map((site) => (
                                <tr key={site.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="font-medium text-gray-900">{site.name}</div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-sm text-gray-500">{site.url}</div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800 capitalize">
                                            {site.platform_type}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <Link href={`/dashboard/sites/${site.id}`} className="text-blue-600 hover:text-blue-900">
                                            Configure
                                        </Link>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    )
}
