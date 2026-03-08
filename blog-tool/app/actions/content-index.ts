"use server";

import { createClient } from "@/lib/supabase/server";

export type ContentIndexEntry = {
  id: string;
  website_id: string;
  post_title: string;
  post_url: string;
  post_excerpt: string | null;
  fetched_at: string;
};

export async function getContentIndex(websiteId: string): Promise<ContentIndexEntry[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: membership } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", user.id)
    .limit(1)
    .single();

  if (!membership) throw new Error("No organization");

  // Verify website belongs to org
  const { data: website } = await supabase
    .from("websites")
    .select("id")
    .eq("id", websiteId)
    .eq("organization_id", membership.organization_id)
    .single();

  if (!website) throw new Error("Website not found");

  const { data, error } = await supabase
    .from("website_content_index")
    .select("*")
    .eq("website_id", websiteId)
    .order("fetched_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as ContentIndexEntry[];
}

export async function addContentIndexEntry(
  websiteId: string,
  entry: { post_title: string; post_url: string; post_excerpt?: string }
): Promise<ContentIndexEntry> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: membership } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", user.id)
    .limit(1)
    .single();

  if (!membership) throw new Error("No organization");

  // Verify website belongs to org
  const { data: website } = await supabase
    .from("websites")
    .select("id")
    .eq("id", websiteId)
    .eq("organization_id", membership.organization_id)
    .single();

  if (!website) throw new Error("Website not found");

  const { data, error } = await supabase
    .from("website_content_index")
    .insert({
      website_id: websiteId,
      post_title: entry.post_title,
      post_url: entry.post_url,
      post_excerpt: entry.post_excerpt || null,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as ContentIndexEntry;
}

export async function updateContentIndexEntry(
  entryId: string,
  updates: { post_title?: string; post_url?: string; post_excerpt?: string }
): Promise<void> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: membership } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", user.id)
    .limit(1)
    .single();

  if (!membership) throw new Error("No organization");

  // Verify entry belongs to a website in the user's org
  const { data: entry } = await supabase
    .from("website_content_index")
    .select("id, website_id, websites!inner(organization_id)")
    .eq("id", entryId)
    .single();

  if (!entry) throw new Error("Entry not found");

  const entryOrg = (entry as unknown as { websites: { organization_id: string } }).websites.organization_id;
  if (entryOrg !== membership.organization_id) throw new Error("Not authorized");

  const { error } = await supabase
    .from("website_content_index")
    .update(updates)
    .eq("id", entryId);

  if (error) throw new Error(error.message);
}

export async function deleteContentIndexEntry(entryId: string): Promise<void> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: membership } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", user.id)
    .limit(1)
    .single();

  if (!membership) throw new Error("No organization");

  // Verify entry belongs to a website in the user's org
  const { data: entry } = await supabase
    .from("website_content_index")
    .select("id, website_id, websites!inner(organization_id)")
    .eq("id", entryId)
    .single();

  if (!entry) throw new Error("Entry not found");

  const entryOrg = (entry as unknown as { websites: { organization_id: string } }).websites.organization_id;
  if (entryOrg !== membership.organization_id) throw new Error("Not authorized");

  const { error } = await supabase
    .from("website_content_index")
    .delete()
    .eq("id", entryId);

  if (error) throw new Error(error.message);
}
