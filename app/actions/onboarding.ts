"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function createOrganization(formData: FormData) {
    const supabase = await createClient();

    const orgName = formData.get("orgName") as string;

    if (!orgName) {
        return redirect("/onboarding?message=Organization name is required");
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
        return redirect("/login");
    }

    // Ensure user exists in our public.users table
    const { error: userInsertError } = await supabase
        .from('users')
        .upsert({ id: user.id, email: user.email, name: user.user_metadata?.full_name })
        .select();

    if (userInsertError) {
        console.error(userInsertError);
        return redirect("/onboarding?message=Failed to register user record");
    }

    // Create the organization
    const { data: orgData, error: orgError } = await supabase
        .from('organizations')
        .insert([{ name: orgName }])
        .select()
        .single();

    if (orgError) {
        console.error(orgError);
        return redirect("/onboarding?message=Failed to create organization");
    }

    // Link the user to the organization as an admin
    const { error: memberError } = await supabase
        .from('organization_members')
        .insert([{ organization_id: orgData.id, user_id: user.id, role: 'admin' }]);

    if (memberError) {
        console.error(memberError);
        return redirect("/onboarding?message=Failed to assign role");
    }

    return redirect("/dashboard");
}
