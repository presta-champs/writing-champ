import { createClient } from "../supabase/server";

export async function useUser() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return null;
    }

    const { data: dbUser } = await supabase.from('users').select('*').eq('id', user.id).single();

    return {
        ...user,
        ...dbUser
    };
}
