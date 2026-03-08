import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { createOrganization } from "../actions/onboarding";

export default async function OnboardingPage({
    searchParams,
}: {
    searchParams: { message: string };
}) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return redirect('/login');
    }

    // Check if they already belong to an organization
    const { data: memberships } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', user.id)
        .limit(1);

    if (memberships && memberships.length > 0) {
        return redirect('/dashboard');
    }

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
            <div className="w-full max-w-md p-8 bg-white rounded-lg shadow-md">
                <h1 className="text-2xl font-bold text-center mb-2">Welcome to WritingChamps!</h1>
                <p className="text-gray-600 text-center mb-6">Let's set up your workspace to manage your sites and AI personas.</p>

                <form action={createOrganization} className="flex flex-col gap-4">
                    <div>
                        <label htmlFor="orgName" className="block text-sm font-medium text-gray-700 mb-1">
                            Organization Name
                        </label>
                        <input
                            type="text"
                            name="orgName"
                            id="orgName"
                            required
                            placeholder="Acme Corp"
                            className="w-full px-4 py-2 border rounded-md focus:ring-blue-500 focus:border-blue-500"
                        />
                    </div>

                    <button
                        type="submit"
                        className="w-full bg-blue-600 text-white font-semibold py-2 px-4 rounded-md hover:bg-blue-700 transition"
                    >
                        Create Workspace
                    </button>

                    {searchParams?.message && (
                        <p className="p-3 mt-2 bg-red-100 text-red-700 rounded-md text-sm text-center">
                            {searchParams.message}
                        </p>
                    )}
                </form>
            </div>
        </div>
    );
}
