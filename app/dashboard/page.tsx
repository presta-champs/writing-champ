import { useOrganization } from "@/lib/hooks/use-organization";
import { useUser } from "@/lib/hooks/use-user";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Plus, PenTool, Globe, FileText } from "lucide-react";
import { formatCostDisplay } from '@/lib/usage-display';

export default async function DashboardHome() {
    const user = await useUser();
    const org = await useOrganization();

    if (!user || !org) {
        redirect("/login");
    }

    const supabase = await createClient();

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const [sitesResult, personasResult, articlesThisMonthResult, recentArticlesResult, spendingResult] = await Promise.all([
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
        supabase
            .from('usage_events')
            .select('estimated_cost_usd')
            .eq('organization_id', org.id)
            .gte('created_at', monthStart),
    ]);

    // Budget columns may not exist if migration hasn't run yet
    let budgetData: { monthly_budget: number | null; budget_warning_threshold: number } | null = null;
    try {
        const { data, error } = await supabase
            .from('organizations')
            .select('monthly_budget, budget_warning_threshold')
            .eq('id', org.id)
            .single();
        if (!error) budgetData = data;
    } catch {
        // Budget columns don't exist yet
    }

    const siteCount = sitesResult.count ?? 0;
    const personaCount = personasResult.count ?? 0;
    const articlesThisMonth = articlesThisMonthResult.count ?? 0;
    const recentArticles = recentArticlesResult.data ?? [];
    const spendingEvents = spendingResult.data ?? [];
    const totalSpend = spendingEvents.reduce((sum: number, e: any) => sum + (e.estimated_cost_usd || 0), 0);
    const budget = budgetData?.monthly_budget ?? null;
    const budgetThreshold = budgetData?.budget_warning_threshold ?? 0.8;
    const budgetPercent = budget ? (totalSpend / budget) * 100 : null;
    const isOverThreshold = budgetPercent !== null && budgetPercent >= budgetThreshold * 100;

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

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
                    <p className="text-3xl font-bold" style={{ color: 'var(--foreground)' }}>{articlesThisMonth} <span className="text-lg font-normal" style={{ color: 'var(--text-muted)' }}>/ {org.article_limit || 10}</span></p>
                </div>
                <Link href="/dashboard/usage" className="p-6 rounded-xl transition hover:shadow-sm" style={{
                    background: isOverThreshold ? 'var(--warning-bg, #fef3c7)' : 'var(--surface)',
                    border: `1px solid ${isOverThreshold ? 'var(--warning-border, #f59e0b)' : 'var(--border)'}`,
                }}>
                    <h3 className="text-sm font-medium mb-2" style={{ color: 'var(--text-muted)' }}>
                        Spending This Month
                        {isOverThreshold && <span className="ml-1">&#9888;</span>}
                    </h3>
                    <p className="text-3xl font-bold" style={{ color: 'var(--foreground)' }}>
                        {formatCostDisplay(totalSpend)}
                    </p>
                    {budget !== null && (
                        <>
                            <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                                / ${budget.toFixed(2)}
                            </p>
                            <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                                <div
                                    className="h-full rounded-full transition-all"
                                    style={{
                                        width: `${Math.min(budgetPercent!, 100)}%`,
                                        background: budgetPercent! >= 100 ? '#ef4444' : isOverThreshold ? '#f59e0b' : '#10b981',
                                    }}
                                />
                            </div>
                        </>
                    )}
                    {budget === null && (
                        <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>No budget set</p>
                    )}
                </Link>
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
