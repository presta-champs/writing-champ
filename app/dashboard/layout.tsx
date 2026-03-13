import Link from "next/link";
import { LayoutDashboard, Globe, Users, FileText, Settings, LogOut, PenTool, DollarSign, CalendarDays } from "lucide-react";
import { signout } from "@/app/actions/auth";

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <div className="flex h-screen" style={{ background: 'var(--background)' }}>

            {/* Sidebar */}
            <aside className="w-64 flex-col hidden md:flex" style={{ background: 'var(--surface)', borderRight: '1px solid var(--border)' }}>
                <div className="px-5 py-5" style={{ borderBottom: '1px solid var(--border)' }}>
                    <h1 className="text-xl font-bold tracking-tight" style={{ color: 'var(--foreground)' }}>WritingChamps</h1>
                </div>

                <nav className="flex-1 px-3 py-4 space-y-0.5">
                    <Link href="/dashboard" className="flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg hover:opacity-80 transition" style={{ color: 'var(--text-secondary)' }}>
                        <LayoutDashboard size={18} /> Dashboard
                    </Link>
                    <Link href="/dashboard/sites" className="flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg hover:opacity-80 transition" style={{ color: 'var(--text-secondary)' }}>
                        <Globe size={18} /> Sites
                    </Link>
                    <Link href="/dashboard/personas" className="flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg hover:opacity-80 transition" style={{ color: 'var(--text-secondary)' }}>
                        <Users size={18} /> Personas
                    </Link>
                    <Link href="/dashboard/articles/new" className="flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg hover:opacity-80 transition" style={{ color: 'var(--accent)' }}>
                        <PenTool size={18} /> New Article
                    </Link>
                    <Link href="/dashboard/planner" className="flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg hover:opacity-80 transition" style={{ color: 'var(--text-secondary)' }}>
                        <CalendarDays size={18} /> Planner
                    </Link>
                    <Link href="/dashboard/library" className="flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg hover:opacity-80 transition" style={{ color: 'var(--text-secondary)' }}>
                        <FileText size={18} /> Content Library
                    </Link>
                    <Link href="/dashboard/usage" className="flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg hover:opacity-80 transition" style={{ color: 'var(--text-secondary)' }}>
                        <DollarSign size={18} /> Usage
                    </Link>
                    <Link href="/dashboard/settings" className="flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg hover:opacity-80 transition" style={{ color: 'var(--text-secondary)' }}>
                        <Settings size={18} /> Settings
                    </Link>
                </nav>

                <div className="px-3 py-4" style={{ borderTop: '1px solid var(--border)' }}>
                    <form action={signout}>
                        <button type="submit" className="flex items-center gap-3 px-3 py-2 w-full text-left text-sm font-medium rounded-lg hover:opacity-80 transition" style={{ color: 'var(--danger)' }}>
                            <LogOut size={18} /> Sign Out
                        </button>
                    </form>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col overflow-hidden">
                {/* Mobile Header */}
                <header className="p-4 md:hidden flex justify-between items-center" style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
                    <h1 className="text-xl font-bold" style={{ color: 'var(--foreground)' }}>WritingChamps</h1>
                    <form action={signout}>
                        <button type="submit" className="text-sm font-medium" style={{ color: 'var(--danger)' }}>Sign Out</button>
                    </form>
                </header>

                <div className="flex-1 overflow-auto p-8">
                    {children}
                </div>
            </main>

        </div>
    )
}
