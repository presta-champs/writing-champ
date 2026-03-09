"use server";

import { createClient } from "@/lib/supabase/server";
import { useOrganization } from "@/lib/hooks/use-organization";
import { revalidatePath } from "next/cache";

/**
 * Returns all tags for a given article.
 * Verifies the article belongs to the caller's organization.
 */
export async function getArticleTags(
  articleId: string
): Promise<{ tags: string[]; error?: string }> {
  const org = await useOrganization();
  if (!org) return { tags: [], error: "Unauthorized" };

  const supabase = await createClient();

  // Verify article belongs to this org
  const { data: article } = await supabase
    .from("articles")
    .select("id")
    .eq("id", articleId)
    .eq("organization_id", org.id)
    .single();

  if (!article) return { tags: [], error: "Article not found" };

  const { data, error } = await supabase
    .from("article_tags")
    .select("tag")
    .eq("article_id", articleId)
    .order("tag");

  if (error) {
    console.error("getArticleTags error:", error);
    return { tags: [], error: "Failed to load tags" };
  }

  return { tags: (data ?? []).map((row) => row.tag) };
}

/**
 * Adds a tag to an article.
 * Validates that the tag is non-empty and <= 100 characters.
 * Silently succeeds if the tag already exists (upsert via composite PK).
 */
export async function addArticleTag(
  articleId: string,
  tag: string
): Promise<{ success: boolean; error?: string }> {
  const org = await useOrganization();
  if (!org) return { success: false, error: "Unauthorized" };

  const trimmed = tag.trim().toLowerCase();
  if (!trimmed) return { success: false, error: "Tag cannot be empty" };
  if (trimmed.length > 100)
    return { success: false, error: "Tag must be 100 characters or fewer" };

  const supabase = await createClient();

  // Verify article belongs to this org
  const { data: article } = await supabase
    .from("articles")
    .select("id")
    .eq("id", articleId)
    .eq("organization_id", org.id)
    .single();

  if (!article) return { success: false, error: "Article not found" };

  const { error } = await supabase
    .from("article_tags")
    .upsert({ article_id: articleId, tag: trimmed }, { onConflict: "article_id,tag" });

  if (error) {
    console.error("addArticleTag error:", error);
    return { success: false, error: "Failed to add tag" };
  }

  revalidatePath(`/dashboard/articles/${articleId}`);
  return { success: true };
}

/**
 * Removes a tag from an article.
 */
export async function removeArticleTag(
  articleId: string,
  tag: string
): Promise<{ success: boolean; error?: string }> {
  const org = await useOrganization();
  if (!org) return { success: false, error: "Unauthorized" };

  const trimmed = tag.trim().toLowerCase();
  if (!trimmed) return { success: false, error: "Tag cannot be empty" };

  const supabase = await createClient();

  // Verify article belongs to this org
  const { data: article } = await supabase
    .from("articles")
    .select("id")
    .eq("id", articleId)
    .eq("organization_id", org.id)
    .single();

  if (!article) return { success: false, error: "Article not found" };

  const { error } = await supabase
    .from("article_tags")
    .delete()
    .eq("article_id", articleId)
    .eq("tag", trimmed);

  if (error) {
    console.error("removeArticleTag error:", error);
    return { success: false, error: "Failed to remove tag" };
  }

  revalidatePath(`/dashboard/articles/${articleId}`);
  return { success: true };
}

/**
 * Returns all unique tags used across the caller's organization.
 * Useful for autocomplete suggestions.
 */
export async function getOrgTags(): Promise<{
  tags: string[];
  error?: string;
}> {
  const org = await useOrganization();
  if (!org) return { tags: [], error: "Unauthorized" };

  const supabase = await createClient();

  // Join article_tags with articles to scope by organization_id
  const { data, error } = await supabase
    .from("article_tags")
    .select("tag, articles!inner(organization_id)")
    .eq("articles.organization_id", org.id);

  if (error) {
    console.error("getOrgTags error:", error);
    return { tags: [], error: "Failed to load organization tags" };
  }

  // Deduplicate and sort
  const unique = [...new Set((data ?? []).map((row) => row.tag))].sort();
  return { tags: unique };
}
