"use server";

import { createClient } from "@/lib/supabase/server";
import { useOrganization } from "@/lib/hooks/use-organization";
import { revalidatePath } from "next/cache";

export async function createWebsite(formData: FormData) {
    const org = await useOrganization();
    if (!org) throw new Error("Unauthorized");

    const name = formData.get("name") as string;
    const url = formData.get("url") as string;
    const platform_type = formData.get("platform_type") as string || "wordpress";

    const supabase = await createClient();

    const { error } = await supabase
        .from("websites")
        .insert([{ organization_id: org.id, name, url, platform_type }]);

    if (error) {
        console.error(error);
        throw new Error("Failed to create website");
    }

    revalidatePath("/dashboard/sites");
}

export async function updateBrandVoice(id: string, formData: FormData) {
    const org = await useOrganization();
    if (!org) throw new Error("Unauthorized");

    const site_description = formData.get("site_description") as string;
    const tone_guardrails = formData.get("tone_guardrails") as string;
    const banned_topics = formData.get("banned_topics") as string;
    const banned_words = formData.get("banned_words") as string;
    const required_elements = formData.get("required_elements") as string;

    const contentPillarsRaw = formData.get("content_pillars") as string;
    const content_pillars = contentPillarsRaw ? contentPillarsRaw.split(',').map(s => s.trim()) : [];

    const supabase = await createClient();

    const { error } = await supabase
        .from("websites")
        .update({
            site_description,
            tone_guardrails,
            banned_topics,
            banned_words,
            required_elements,
            content_pillars
        })
        .eq("id", id)
        .eq("organization_id", org.id); // Security: ensure it belongs to their org

    if (error) {
        console.error(error);
        throw new Error("Failed to update brand voice");
    }

    revalidatePath(`/dashboard/sites/${id}`);
}
