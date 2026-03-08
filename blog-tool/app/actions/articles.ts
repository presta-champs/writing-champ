"use server";

import { createClient } from "@/lib/supabase/server";
import { useOrganization } from "@/lib/hooks/use-organization";

export type DuplicateBriefData = {
    format: string | null;
    primaryKeyword: string | null;
    secondaryKeywords: string[] | null;
    websiteId: string | null;
    personaId: string | null;
    readabilityTarget: number | null;
    title: string | null;
};

/**
 * Fetches the brief fields from an existing article so the frontend can
 * pre-fill a new article generation form with them.
 *
 * Returns null if the article is not found or does not belong to the
 * user's organization.
 */
export async function duplicateArticle(
    articleId: string
): Promise<{ data: DuplicateBriefData | null; error?: string }> {
    const org = await useOrganization();
    if (!org) {
        return { data: null, error: "Unauthorized" };
    }

    const supabase = await createClient();

    const { data, error } = await supabase
        .from("articles")
        .select(
            "title, format, primary_keyword, secondary_keywords, website_id, persona_id"
        )
        .eq("id", articleId)
        .eq("organization_id", org.id)
        .single();

    if (error || !data) {
        return { data: null, error: "Article not found" };
    }

    // Try to fetch readability_target separately (column may not exist if migration not run)
    let readabilityTarget: number | null = null;
    try {
        const { data: extra } = await supabase
            .from("articles")
            .select("readability_target")
            .eq("id", articleId)
            .single();
        if (extra && typeof (extra as Record<string, unknown>).readability_target === "number") {
            readabilityTarget = (extra as Record<string, unknown>).readability_target as number;
        }
    } catch {
        // Column might not exist — ignore
    }

    return {
        data: {
            title: data.title,
            format: data.format,
            primaryKeyword: data.primary_keyword,
            secondaryKeywords: data.secondary_keywords,
            websiteId: data.website_id,
            personaId: data.persona_id,
            readabilityTarget,
        },
    };
}
