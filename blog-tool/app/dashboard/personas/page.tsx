import { createClient } from "@/lib/supabase/server";
import { useOrganization } from "@/lib/hooks/use-organization";
import Link from "next/link";
import { Plus, Users } from "lucide-react";
import { InstallBuiltinsButton } from "@/components/personas/install-builtins-button";
import { PersonaGrid } from "@/components/personas/persona-grid";

export default async function PersonasPage() {
    const org = await useOrganization();
    const supabase = await createClient();

    const { data: personas } = await supabase
        .from("personas")
        .select("id, name, bio, is_builtin, badges")
        .eq("organization_id", org?.id)
        .eq("archived", false);

    return (
        <div className="max-w-6xl w-full">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>Personas</h1>
                    <p style={{ color: 'var(--text-muted)' }}>Manage the digital voices and tones used across your platforms.</p>
                </div>
                <div className="flex items-center gap-3">
                    <InstallBuiltinsButton variant="secondary" />
                    <Link
                        href="/dashboard/personas/new"
                        className="font-medium px-4 py-2 rounded-lg flex items-center gap-2 text-sm transition hover:opacity-90"
                        style={{ background: 'var(--accent)', color: 'var(--accent-text)' }}
                    >
                        <Plus size={18} /> New Persona
                    </Link>
                </div>
            </div>

            {!personas || personas.length === 0 ? (
                <div className="rounded-xl p-12 text-center" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                    <Users className="mx-auto mb-4" style={{ color: 'var(--border-hover)' }} size={48} />
                    <h3 className="text-lg font-medium mb-1" style={{ color: 'var(--foreground)' }}>No personas found</h3>
                    <p className="mb-6" style={{ color: 'var(--text-muted)' }}>Install a pre-built persona or create your own from scratch.</p>
                    <div className="flex items-center justify-center gap-4">
                        <InstallBuiltinsButton variant="primary" />
                        <Link
                            href="/dashboard/personas/new"
                            className="font-medium px-4 py-2 rounded-lg inline-block text-sm transition hover:opacity-90"
                            style={{ background: 'var(--accent)', color: 'var(--accent-text)' }}
                        >
                            Create From Scratch
                        </Link>
                    </div>
                </div>
            ) : (
                <PersonaGrid personas={personas} />
            )}
        </div>
    )
}
