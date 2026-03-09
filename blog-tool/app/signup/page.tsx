import { signup } from "../actions/auth";

export default async function SignupPage({
    searchParams,
}: {
    searchParams: Promise<{ message?: string }>;
}) {
    const { message } = await searchParams;
    return (
        <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--background)' }}>
            <div className="w-full max-w-sm px-8">
                <div className="text-center mb-10">
                    <h1 className="text-3xl font-semibold" style={{ color: 'var(--foreground)' }}>Create Account</h1>
                    <p className="mt-2 text-sm" style={{ color: 'var(--text-muted)' }}>Start building your writing voices</p>
                </div>
                <form className="space-y-5" action={signup}>
                    <div>
                        <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }} htmlFor="name">
                            Full Name
                        </label>
                        <input
                            className="w-full rounded-lg px-4 py-2.5 text-sm transition"
                            style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--foreground)' }}
                            name="name"
                            placeholder="Jane Doe"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }} htmlFor="email">
                            Email
                        </label>
                        <input
                            className="w-full rounded-lg px-4 py-2.5 text-sm transition"
                            style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--foreground)' }}
                            name="email"
                            placeholder="you@example.com"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }} htmlFor="password">
                            Password
                        </label>
                        <input
                            className="w-full rounded-lg px-4 py-2.5 text-sm transition"
                            style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--foreground)' }}
                            type="password"
                            name="password"
                            placeholder="••••••••"
                            required
                        />
                    </div>
                    <button
                        className="w-full rounded-lg px-4 py-2.5 text-sm font-medium transition"
                        style={{ background: 'var(--accent)', color: 'var(--accent-text)' }}
                    >
                        Sign Up
                    </button>
                    <p className="text-center text-sm" style={{ color: 'var(--text-muted)' }}>
                        Already have an account?{" "}
                        <a href="/login" className="font-medium hover:underline" style={{ color: 'var(--accent)' }}>Sign in</a>
                    </p>
                    {message && (
                        <p className="p-3 rounded-lg text-sm text-center" style={{ background: 'var(--danger-light)', color: 'var(--danger)', border: '1px solid var(--danger)' }}>
                            {message}
                        </p>
                    )}
                </form>
            </div>
        </div>
    );
}
