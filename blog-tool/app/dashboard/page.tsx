import { useOrganization } from "@/lib/hooks/use-organization";
import { useUser } from "@/lib/hooks/use-user";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Plus, PenTool, Globe, FileText } from "lucide-react";

export default async function DashboardHome() {
    const user = await useUser();
    const org = await useOrganization();

    if (!user || !org) {
        redirect("/login");
    }

    const supabase = await createClient();

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const [sitesResult, personasResult, articlesThisMonthResult, recentArticlesResult] = await Promise.all([
        supabase
            .from('websites')
            .select('*', { count: 'exact', head: true })
            .eq('organization_id', org.id),
        supabase
            .from('personas')
            .select('*', { count: 'exact', head: true })
            .eq('organization_id', org.id),
        supabase
            .from('articles')
            .select('*', { count: 'exact', head: true })
            .eq('organization_id', org.id)
            .gte('created_at', monthStart),
        supabase
            .from('articles')
            .select('id, title, status, format, created_at, websites(name)')
            .eq('organization_id', org.id)
            .order('created_at', { ascending: false })
            .limit(5),
    ]);

    const siteCount = sitesResult.count ?? 0;
    const personaCount = personasResult.count ?? 0;
    const articlesThisMonth = articlesThisMonthResult.count ?? 0;
    const recentArticles = recentArticlesResult.data ?? [];

    const isEmpty = siteCount === 0 && personaCount === 0;

    return (
        <div className="max-w-4xl space-y-8">
            <div>
                <h1 className="text-3xl font-bold" style={{ color: 'var(--foreground)' }}>
                    Welcome, {user.name?.split(' ')[0] || 'Writer'}
                </h1>
                <p className="mt-1" style={{ color: 'var(--text-muted)' }}>
                    Here&apos;s the latest from your {org.name} workspace.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Link href="/dashboard/sites" className="p-6 rounded-xl transition hover:shadow-sm" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                    <h3 className="text-sm font-medium mb-2" style={{ color: 'var(--text-muted)' }}>Total Sites</h3>
                    <p className="text-3xl font-bold" style={{ color: 'var(--foreground)' }}>{siteCount}</p>
                </Link>
                <Link href="/dashboard/personas" className="p-6 rounded-xl transition hover:shadow-sm" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                    <h3 className="text-sm font-medium mb-2" style={{ color: 'var(--text-muted)' }}>Active Personas</h3>
                    <p className="text-3xl font-bold" style={{ color: 'var(--foreground)' }}>{personaCount}</p>
                </Link>
                <div className="p-6 rounded-xl" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                    <h3 className="text-sm font-medium mb-2" style={{ color: 'var(--text-muted)' }}>Articles This Month</h3>
                    <p className="text-3xl font-bold" style={{ color: 'var(--foreground)' }}>{articlesThisMonth}</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Link href="/dashboard/articles/new" className="p-4 rounded-xl transition hover:opacity-90 flex items-center gap-3" style={{ background: 'var(--accent)', color: 'var(--accent-text)' }}>
                    <PenTool size={20} />
                    <span className="font-medium">New Article</span>
                </Link>
                <Link href="/dashboard/sites/new" className="p-4 rounded-xl transition hover:shadow-sm flex items-center gap-3" style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
                    <Globe size={20} />
                    <span className="font-medium">Add Website</span>
                </Link>
                <Link href="/dashboard/library" className="p-4 rounded-xl transition hover:shadow-sm flex items-center gap-3" style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
                    <FileText size={20} />
                    <span className="font-medium">Content Library</span>
                </Link>
            </div>

            {recentArticles.length > 0 ? (
                <div className="rounded-xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                    <div className="px-6 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
                        <h2 className="text-lg font-semibold" style={{ color: 'var(--foreground)' }}>Recent Articles</h2>
                    </div>
                    <div>
                        {recentArticles.map((article: any, i: number) => (
                            <Link
                                key={article.id}
                                href={`/dashboard/articles/${article.id}`}
                                className="flex items-center justify-between px-6 py-3.5 transition hover:opacity-80"
                                style={i < recentArticles.length - 1 ? { borderBottom: '1px solid var(--border)' } : {}}
                            >
                                <div>
                                    <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>{article.title}</p>
                                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                                        {(article.websites as any)?.name} &middot; {article.format} &middot; {new Date(article.created_at).toLocaleDateString()}
                                    </p>
                                </div>
                                <span className="text-xs px-2.5 py-0.5 rounded-full font-medium" style={
                                    article.status === 'published'
                                        ? { background: 'var(--success-light)', color: 'var(--success)' }
                                        : article.status === 'approved'
                                        ? { background: 'var(--accent-light)', color: 'var(--accent)' }
                                        : { background: 'var(--surface-warm)', color: 'var(--text-secondary)' }
                                }>
                                    {article.status}
                                </span>
                            </Link>
                        ))}
                    </div>
                </div>
            ) : isEmpty ? (
                <div className="rounded-xl p-6 flex flex-col items-center justify-center text-center py-12" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                    <div className="p-3 rounded-full mb-4" style={{ background: 'var(--surface-warm)' }}>
                        <Plus style={{ color: 'var(--text-muted)' }} size={24} />
                    </div>
                    <h2 className="text-lg font-semibold mb-1" style={{ color: 'var(--foreground)' }}>Get started</h2>
                    <p className="mb-4 max-w-sm" style={{ color: 'var(--text-muted)' }}>Create your first Website and Persona, then generate your first article.</p>
                    <Link href="/dashboard/sites/new" className="px-5 py-2.5 rounded-lg font-medium text-sm transition" style={{ background: 'var(--accent)', color: 'var(--accent-text)' }}>
                        Add Website
                    </Link>
                </div>
            ) : null}
        </div>
    );
}
