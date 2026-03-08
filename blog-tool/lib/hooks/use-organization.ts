import { createClient } from "../supabase/server";
import { useUser } from "./use-user";

export async function useOrganization() {
    const supabase = await createClient();
    const user = await useUser();

    if (!user) {
        return null; // Not logged in
    }

    const { data: memberships } = await supabase
        .from('organization_members')
        .select(`
            role,
            organizations (
                id,
                name,
                plan,
                article_limit,
                approval_workflow_enabled,
                external_seo_grader_enabled
            )
        `)
        .eq('user_id', user.id)
        .limit(1);

    if (!memberships || memberships.length === 0) {
        return null; // Has not completed onboarding
    }

    const membership = memberships[0];

    const orgData = Array.isArray(membership.organizations)
        ? membership.organizations[0]
        : membership.organizations;

    return {
        role: membership.role,
        ...(orgData as any)
    };
}
