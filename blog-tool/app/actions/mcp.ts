"use server";

import { createClient } from "@/lib/supabase/server";
import { useUser } from "@/lib/hooks/use-user";
import { useOrganization } from "@/lib/hooks/use-organization";
import { encrypt, decrypt } from "@/lib/crypto";
import { McpClient } from "@/lib/mcp/client";
import type { McpPlatform, FieldMapping } from "@/lib/mcp/types";
import { revalidatePath } from "next/cache";

/**
 * Test a CMS connection without saving it.
 */
export async function testMcpConnection(
  websiteId: string,
  serverUrl: string,
  authToken: string
): Promise<{ success: boolean; message: string; siteName?: string; postsCount?: number }> {
  const org = await useOrganization();
  if (!org) return { success: false, message: "Not authorized" };

  const supabase = await createClient();
  const { data: site } = await supabase
    .from("websites")
    .select("platform_type")
    .eq("id", websiteId)
    .eq("organization_id", org.id)
    .single();

  if (!site) return { success: false, message: "Site not found" };

  const client = new McpClient({
    serverUrl,
    authToken,
    platform: site.platform_type as McpPlatform,
  });

  const result = await client.testConnection();
  return result;
}

/**
 * Save CMS connection credentials (encrypted) and update status.
 */
export async function saveMcpConnection(
  websiteId: string,
  serverUrl: string,
  authToken: string
): Promise<{ success: boolean; error?: string }> {
  const user = await useUser();
  const org = await useOrganization();
  if (!user || !org) return { success: false, error: "Not authorized" };
  if (org.role !== "admin")
    return { success: false, error: "Only admins can configure CMS connections" };

  const supabase = await createClient();

  // Verify site belongs to org
  const { data: site } = await supabase
    .from("websites")
    .select("id, platform_type")
    .eq("id", websiteId)
    .eq("organization_id", org.id)
    .single();

  if (!site) return { success: false, error: "Site not found" };

  // Test before saving
  const client = new McpClient({
    serverUrl,
    authToken,
    platform: site.platform_type as McpPlatform,
  });
  const test = await client.testConnection();

  const encryptedToken = encrypt(authToken);

  const { error } = await supabase
    .from("websites")
    .update({
      mcp_server_url: serverUrl,
      mcp_auth_token: encryptedToken,
      mcp_status: test.success ? "connected" : "error",
    })
    .eq("id", websiteId)
    .eq("organization_id", org.id);

  if (error) return { success: false, error: error.message };

  // Log the event
  await supabase.from("mcp_events").insert({
    website_id: websiteId,
    organization_id: org.id,
    operation: "connection_save",
    status: test.success ? "success" : "error",
    request_snapshot: { serverUrl, platform: site.platform_type },
    response_snapshot: { message: test.message },
  });

  revalidatePath(`/dashboard/sites/${websiteId}`);
  return { success: true };
}

/**
 * Save custom field mapping for a website's webhook integration.
 * Stored in the website's connection_config JSON column.
 */
export async function saveFieldMapping(
  websiteId: string,
  mapping: FieldMapping
): Promise<{ success: boolean; error?: string }> {
  const user = await useUser();
  const org = await useOrganization();
  if (!user || !org) return { success: false, error: "Not authorized" };
  if (org.role !== "admin")
    return { success: false, error: "Only admins can configure field mappings" };

  const supabase = await createClient();

  // Verify site belongs to org and is a custom platform
  const { data: site } = await supabase
    .from("websites")
    .select("id, platform_type, connection_config")
    .eq("id", websiteId)
    .eq("organization_id", org.id)
    .single();

  if (!site) return { success: false, error: "Site not found" };
  if (site.platform_type !== "custom")
    return { success: false, error: "Field mapping is only available for custom CMS integrations" };

  // Merge field mapping into existing connection_config
  const existingConfig = (site.connection_config as Record<string, unknown>) || {};
  const updatedConfig = {
    ...existingConfig,
    fieldMapping: mapping,
  };

  const { error } = await supabase
    .from("websites")
    .update({ connection_config: updatedConfig })
    .eq("id", websiteId)
    .eq("organization_id", org.id);

  if (error) return { success: false, error: error.message };

  revalidatePath(`/dashboard/sites/${websiteId}`);
  return { success: true };
}

/**
 * Retrieve the current field mapping for a website.
 */
export async function getFieldMapping(
  websiteId: string
): Promise<{ success: boolean; mapping?: FieldMapping; error?: string }> {
  const org = await useOrganization();
  if (!org) return { success: false, error: "Not authorized" };

  const supabase = await createClient();
  const { data: site } = await supabase
    .from("websites")
    .select("connection_config")
    .eq("id", websiteId)
    .eq("organization_id", org.id)
    .single();

  if (!site) return { success: false, error: "Site not found" };

  const config = (site.connection_config as Record<string, unknown>) || {};
  const mapping = (config.fieldMapping as FieldMapping) || {};

  return { success: true, mapping };
}

/**
 * Disconnect CMS — clear credentials.
 */
export async function disconnectMcp(
  websiteId: string
): Promise<{ success: boolean; error?: string }> {
  const user = await useUser();
  const org = await useOrganization();
  if (!user || !org) return { success: false, error: "Not authorized" };
  if (org.role !== "admin")
    return { success: false, error: "Only admins can manage CMS connections" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("websites")
    .update({
      mcp_server_url: null,
      mcp_auth_token: null,
      mcp_status: "unconfigured",
      mcp_last_synced: null,
    })
    .eq("id", websiteId)
    .eq("organization_id", org.id);

  if (error) return { success: false, error: error.message };

  revalidatePath(`/dashboard/sites/${websiteId}`);
  return { success: true };
}

/**
 * Sync content index from CMS.
 * Fetches all published posts and upserts them into website_content_index.
 */
export async function syncContentIndex(
  websiteId: string
): Promise<{ success: boolean; synced: number; error?: string }> {
  const org = await useOrganization();
  if (!org) return { success: false, synced: 0, error: "Not authorized" };

  const supabase = await createClient();
  const { data: site } = await supabase
    .from("websites")
    .select("id, platform_type, mcp_server_url, mcp_auth_token, organization_id")
    .eq("id", websiteId)
    .eq("organization_id", org.id)
    .single();

  if (!site || !site.mcp_server_url || !site.mcp_auth_token) {
    return { success: false, synced: 0, error: "CMS not connected" };
  }

  let authToken: string;
  try {
    authToken = decrypt(site.mcp_auth_token);
  } catch {
    return { success: false, synced: 0, error: "Failed to decrypt auth token" };
  }

  const client = new McpClient({
    serverUrl: site.mcp_server_url,
    authToken,
    platform: site.platform_type as McpPlatform,
  });

  const startTime = Date.now();
  let allPosts: { title: string; url: string; excerpt?: string }[] = [];
  let page = 1;

  try {
    // Paginate through all posts
    while (true) {
      const result = await client.fetchContentIndex(page, 100);
      allPosts.push(
        ...result.posts.map((p) => ({
          title: p.title,
          url: p.url,
          excerpt: p.excerpt,
        }))
      );
      if (!result.hasMore) break;
      page++;
      if (page > 50) break; // Safety limit
    }

    // Delete existing index entries for this site
    await supabase
      .from("website_content_index")
      .delete()
      .eq("website_id", websiteId);

    // Insert fresh entries
    if (allPosts.length > 0) {
      const rows = allPosts.map((p) => ({
        website_id: websiteId,
        post_title: p.title,
        post_url: p.url,
        post_excerpt: p.excerpt || null,
      }));

      // Insert in batches of 500
      for (let i = 0; i < rows.length; i += 500) {
        const batch = rows.slice(i, i + 500);
        await supabase.from("website_content_index").insert(batch);
      }
    }

    // Update sync timestamp
    await supabase
      .from("websites")
      .update({ mcp_last_synced: new Date().toISOString(), mcp_status: "connected" })
      .eq("id", websiteId)
      .eq("organization_id", org.id);

    // Log event
    await supabase.from("mcp_events").insert({
      website_id: websiteId,
      organization_id: org.id,
      operation: "content_index_sync",
      status: "success",
      response_snapshot: { postsCount: allPosts.length },
      duration_ms: Date.now() - startTime,
    });

    revalidatePath(`/dashboard/sites/${websiteId}`);
    return { success: true, synced: allPosts.length };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sync failed";

    await supabase.from("mcp_events").insert({
      website_id: websiteId,
      organization_id: org.id,
      operation: "content_index_sync",
      status: "error",
      response_snapshot: { error: message },
      duration_ms: Date.now() - startTime,
    });

    return { success: false, synced: 0, error: message };
  }
}

/**
 * Publish an article to the connected CMS.
 */
export async function publishArticleToCms(
  articleId: string,
  options?: { schedule?: string }
): Promise<{ success: boolean; externalPostId?: string; postUrl?: string; error?: string }> {
  const user = await useUser();
  const org = await useOrganization();
  if (!user || !org) return { success: false, error: "Not authorized" };

  const supabase = await createClient();

  // Fetch article with website info
  const { data: article } = await supabase
    .from("articles")
    .select("*, websites!articles_website_id_fkey(id, platform_type, mcp_server_url, mcp_auth_token, url, organization_id, connection_config)")
    .eq("id", articleId)
    .eq("organization_id", org.id)
    .single();

  if (!article) return { success: false, error: "Article not found" };

  const website = article.websites as unknown as {
    id: string;
    platform_type: string;
    mcp_server_url: string | null;
    mcp_auth_token: string | null;
    url: string;
    organization_id: string;
    connection_config: Record<string, unknown> | null;
  };

  if (!website?.mcp_server_url || !website?.mcp_auth_token) {
    return { success: false, error: "CMS not connected for this site" };
  }

  let authToken: string;
  try {
    authToken = decrypt(website.mcp_auth_token);
  } catch {
    return { success: false, error: "Failed to decrypt CMS credentials" };
  }

  // Extract field mapping from connection_config for custom platforms
  const fieldMapping =
    website.platform_type === "custom" && website.connection_config?.fieldMapping
      ? (website.connection_config.fieldMapping as FieldMapping)
      : undefined;

  const client = new McpClient({
    serverUrl: website.mcp_server_url,
    authToken,
    platform: website.platform_type as McpPlatform,
    fieldMapping,
  });

  const isScheduled = !!options?.schedule;
  const startTime = Date.now();

  try {
    const result = article.external_post_id
      ? await client.updatePost(article.external_post_id, {
          title: article.title || "Untitled",
          content: article.body || "",
          status: isScheduled ? "future" : "publish",
          meta_title: article.meta_title || undefined,
          meta_description: article.meta_description || undefined,
          featured_image_url: article.featured_image_url || undefined,
          date: options?.schedule || undefined,
        })
      : await client.publish({
          title: article.title || "Untitled",
          content: article.body || "",
          status: isScheduled ? "future" : "publish",
          meta_title: article.meta_title || undefined,
          meta_description: article.meta_description || undefined,
          featured_image_url: article.featured_image_url || undefined,
          date: options?.schedule || undefined,
        });

    if (!result.success) {
      // Update article status to failed
      await supabase
        .from("articles")
        .update({
          status: "failed",
          mcp_publish_log: {
            lastAttempt: new Date().toISOString(),
            error: result.error,
          },
        })
        .eq("id", articleId);

      await supabase.from("mcp_events").insert({
        website_id: website.id,
        organization_id: org.id,
        operation: "publish",
        status: "error",
        request_snapshot: { articleId, scheduled: isScheduled },
        response_snapshot: { error: result.error },
        duration_ms: Date.now() - startTime,
      });

      return { success: false, error: result.error };
    }

    // Update article with success info
    await supabase
      .from("articles")
      .update({
        status: isScheduled ? "scheduled" : "published",
        external_post_id: result.externalPostId || article.external_post_id,
        published_at: isScheduled ? null : new Date().toISOString(),
        scheduled_at: isScheduled ? options!.schedule : null,
        mcp_publish_log: {
          lastPublish: new Date().toISOString(),
          externalPostId: result.externalPostId,
          postUrl: result.postUrl,
        },
      })
      .eq("id", articleId);

    await supabase.from("mcp_events").insert({
      website_id: website.id,
      organization_id: org.id,
      operation: isScheduled ? "schedule" : "publish",
      status: "success",
      request_snapshot: { articleId, scheduled: isScheduled },
      response_snapshot: {
        externalPostId: result.externalPostId,
        postUrl: result.postUrl,
      },
      duration_ms: Date.now() - startTime,
    });

    return {
      success: true,
      externalPostId: result.externalPostId,
      postUrl: result.postUrl,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Publish failed";

    await supabase
      .from("articles")
      .update({
        status: "failed",
        mcp_publish_log: {
          lastAttempt: new Date().toISOString(),
          error: message,
        },
      })
      .eq("id", articleId);

    await supabase.from("mcp_events").insert({
      website_id: website.id,
      organization_id: org.id,
      operation: "publish",
      status: "error",
      request_snapshot: { articleId },
      response_snapshot: { error: message },
      duration_ms: Date.now() - startTime,
    });

    return { success: false, error: message };
  }
}

/**
 * Update article status (for approval workflow).
 */
export async function updateArticleStatus(
  articleId: string,
  newStatus: "draft" | "pending_approval" | "approved" | "scheduled" | "published" | "failed"
): Promise<{ success: boolean; error?: string }> {
  const user = await useUser();
  const org = await useOrganization();
  if (!user || !org) return { success: false, error: "Not authorized" };

  const supabase = await createClient();

  const updates: Record<string, unknown> = { status: newStatus };
  if (newStatus === "approved") {
    updates.approved_by = user.id;
  }

  const { error } = await supabase
    .from("articles")
    .update(updates)
    .eq("id", articleId)
    .eq("organization_id", org.id);

  if (error) return { success: false, error: error.message };
  return { success: true };
}
