import { createClient } from "@/lib/supabase/server";
import { useOrganization } from "@/lib/hooks/use-organization";
import Link from "next/link";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { BrandVoiceForm } from "@/components/sites/brand-voice-form";
import { ContentIndex } from "@/components/sites/content-index";

export default async function SiteDetailPage({ params }: { params: { id: string } }) {
    const org = await useOrganization();
    const supabase = await createClient();

    const { data: site } = await supabase
        .from("websites")
        .select("*")
        .eq("id", params.id)
        .eq("organization_id", org?.id)
        .single();

    if (!site) {
        return <div>Site not found or unauthorized.</div>;
    }

    return (
        <div className="max-w-6xl w-full pb-12">
            <Link href="/dashboard/sites" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 mb-6">
                <ArrowLeft size={16} /> Back to Sites
            </Link>

            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                        {site.name}
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800 capitalize">
                            {site.platform_type}
                        </span>
                    </h1>
                    <a href={site.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline flex items-center gap-1 mt-1 text-sm">
                        {site.url} <ExternalLink size={14} />
                    </a>
                </div>
            </div>

            <div className="mb-8">
                {/* We will add MCP connection config UI here in Phase 2 */}
                <div className="bg-gray-50 border rounded-lg p-5 mb-8">
                    <p className="text-sm text-gray-600 font-medium">CMS Connection (Phase 2 Component)</p>
                    <p className="text-xs text-gray-500 mt-1">This panel will house the MCP server connection credentials and sync status.</p>
                </div>
            </div>

            {/* Brand Voice Editor */}
            <BrandVoiceForm site={site} />

            {/* Content Index for Internal Linking */}
            <div className="mt-8">
                <ContentIndex websiteId={site.id} />
            </div>
        </div>
    )
}
