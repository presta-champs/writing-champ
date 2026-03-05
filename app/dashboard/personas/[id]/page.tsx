import { createClient } from "@/lib/supabase/server";
import { useOrganization } from "@/lib/hooks/use-organization";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PersonaVoiceForm } from "@/components/personas/voice-form";
import { WritingSamples } from "@/components/personas/writing-samples";
import { WebsiteAssignments } from "@/components/personas/website-assignments";

export default async function PersonaDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const org = await useOrganization();
    const supabase = await createClient();

    const { data: persona } = await supabase
        .from("personas")
        .select("*")
        .eq("id", id)
        .eq("organization_id", org?.id)
        .single();

    if (!persona) {
        return <div style={{ color: 'var(--text-muted)' }}>Persona not found or unauthorized.</div>;
    }

    // Fetch writing samples
    const { data: samples } = await supabase
        .from("persona_writing_samples")
        .select("*")
        .eq("persona_id", persona.id)
        .order("uploaded_at", { ascending: false });

    // Fetch website assignments with website names
    const { data: assignments } = await supabase
        .from("persona_website_assignments")
        .select("website_id, usage_count, websites(id, name, url)")
        .eq("persona_id", persona.id);

    // Fetch all org websites for the assignment dropdown
    const { data: allWebsites } = await supabase
        .from("websites")
        .select("id, name, url")
        .eq("organization_id", org?.id);

    return (
        <div className="max-w-6xl w-full pb-12">
            <Link href="/dashboard/personas" className="inline-flex items-center gap-2 text-sm mb-6 hover:underline" style={{ color: 'var(--text-muted)' }}>
                <ArrowLeft size={16} /> Back to Personas
            </Link>

            <div className="mb-8 pb-6" style={{ borderBottom: '1px solid var(--border)' }}>
                <h1 className="text-2xl font-bold flex items-center gap-3" style={{ color: 'var(--foreground)' }}>
                    {persona.name}
                </h1>
                <p className="mt-2 max-w-2xl" style={{ color: 'var(--text-muted)' }}>{persona.bio}</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-8">
                    <PersonaVoiceForm persona={persona} />
                </div>

                <div className="space-y-6">
                    <WritingSamples
                        personaId={persona.id}
                        samples={samples || []}
                        voiceSummary={persona.voice_summary}
                    />

                    <WebsiteAssignments
                        personaId={persona.id}
                        assignments={(assignments || []).map(a => ({
                            websiteId: a.website_id,
                            websiteName: (a.websites as any)?.name || "Unknown",
                            websiteUrl: (a.websites as any)?.url || "",
                            usageCount: a.usage_count,
                        }))}
                        allWebsites={(allWebsites || []).map(w => ({
                            id: w.id,
                            name: w.name,
                            url: w.url,
                        }))}
                    />
                </div>
            </div>
        </div>
    );
}
