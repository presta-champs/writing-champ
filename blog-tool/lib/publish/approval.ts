"use server";

import { createClient } from "@/lib/supabase/server";
import { useUser } from "@/lib/hooks/use-user";
import { useOrganization } from "@/lib/hooks/use-organization";
import { revalidatePath } from "next/cache";
import { createNotification } from "@/app/actions/notifications";

export type ApprovalEvent = {
  id: string;
  article_id: string;
  organization_id: string;
  user_id: string | null;
  action: "submitted" | "approved" | "rejected";
  comment: string | null;
  created_at: string;
  user_name?: string;
  user_email?: string;
};

/**
 * Submit an article for approval.
 * Changes status from 'draft' to 'pending_approval'.
 * Both editors and admins can submit.
 */
export async function submitForApproval(
  articleId: string
): Promise<{ success: boolean; error?: string }> {
  const user = await useUser();
  const org = await useOrganization();
  if (!user || !org) return { success: false, error: "Not authorized" };

  const supabase = await createClient();

  // Verify article belongs to org and is in draft status
  const { data: article } = await supabase
    .from("articles")
    .select("id, status, organization_id, title, created_by")
    .eq("id", articleId)
    .eq("organization_id", org.id)
    .single();

  if (!article) return { success: false, error: "Article not found" };
  if (article.status !== "draft") {
    return { success: false, error: "Only draft articles can be submitted for approval" };
  }

  // Check that approval workflow is enabled
  const { data: orgData } = await supabase
    .from("organizations")
    .select("approval_workflow_enabled")
    .eq("id", org.id)
    .single();

  if (!orgData?.approval_workflow_enabled) {
    return { success: false, error: "Approval workflow is not enabled for this organization" };
  }

  // Update article status
  const { error: updateError } = await supabase
    .from("articles")
    .update({
      status: "pending_approval",
      approval_comment: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", articleId)
    .eq("organization_id", org.id);

  if (updateError) return { success: false, error: updateError.message };

  // Log the approval event
  await supabase.from("approval_events").insert({
    article_id: articleId,
    organization_id: org.id,
    user_id: user.id,
    action: "submitted",
    comment: null,
  });

  // Notify all admins in the organization
  const { data: admins } = await supabase
    .from("organization_members")
    .select("user_id")
    .eq("organization_id", org.id)
    .eq("role", "admin");

  if (admins && admins.length > 0) {
    const articleTitle = article.title || "Untitled";
    await Promise.all(
      admins.map((admin) =>
        createNotification({
          orgId: org.id,
          userId: admin.user_id,
          type: "approval_submitted",
          title: "Article submitted for review",
          message: `"${articleTitle}" has been submitted for approval.`,
          articleId,
        })
      )
    );
  }

  revalidatePath(`/dashboard/articles/${articleId}`);
  return { success: true };
}

/**
 * Approve an article.
 * Changes status from 'pending_approval' to 'approved'.
 * Only admins can approve.
 */
export async function approveArticle(
  articleId: string,
  comment?: string
): Promise<{ success: boolean; error?: string }> {
  const user = await useUser();
  const org = await useOrganization();
  if (!user || !org) return { success: false, error: "Not authorized" };

  if (org.role !== "admin") {
    return { success: false, error: "Only admins can approve articles" };
  }

  const supabase = await createClient();

  // Verify article belongs to org and is pending approval
  const { data: article } = await supabase
    .from("articles")
    .select("id, status, organization_id, title, created_by")
    .eq("id", articleId)
    .eq("organization_id", org.id)
    .single();

  if (!article) return { success: false, error: "Article not found" };
  if (article.status !== "pending_approval") {
    return { success: false, error: "Only articles pending approval can be approved" };
  }

  // Update article status
  const { error: updateError } = await supabase
    .from("articles")
    .update({
      status: "approved",
      approved_by: user.id,
      approval_comment: comment || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", articleId)
    .eq("organization_id", org.id);

  if (updateError) return { success: false, error: updateError.message };

  // Log the approval event
  await supabase.from("approval_events").insert({
    article_id: articleId,
    organization_id: org.id,
    user_id: user.id,
    action: "approved",
    comment: comment || null,
  });

  // Notify the article creator
  if (article.created_by) {
    const articleTitle = article.title || "Untitled";
    await createNotification({
      orgId: org.id,
      userId: article.created_by,
      type: "approval_approved",
      title: "Article approved",
      message: `"${articleTitle}" has been approved.${comment ? ` Comment: ${comment}` : ""}`,
      articleId,
    });
  }

  revalidatePath(`/dashboard/articles/${articleId}`);
  return { success: true };
}

/**
 * Reject an article.
 * Changes status from 'pending_approval' to 'draft', stores rejection comment.
 * Only admins can reject.
 */
export async function rejectArticle(
  articleId: string,
  comment: string
): Promise<{ success: boolean; error?: string }> {
  const user = await useUser();
  const org = await useOrganization();
  if (!user || !org) return { success: false, error: "Not authorized" };

  if (org.role !== "admin") {
    return { success: false, error: "Only admins can reject articles" };
  }

  if (!comment || !comment.trim()) {
    return { success: false, error: "A rejection comment is required" };
  }

  const supabase = await createClient();

  // Verify article belongs to org and is pending approval
  const { data: article } = await supabase
    .from("articles")
    .select("id, status, organization_id, title, created_by")
    .eq("id", articleId)
    .eq("organization_id", org.id)
    .single();

  if (!article) return { success: false, error: "Article not found" };
  if (article.status !== "pending_approval") {
    return { success: false, error: "Only articles pending approval can be rejected" };
  }

  // Update article status and store rejection comment
  const { error: updateError } = await supabase
    .from("articles")
    .update({
      status: "draft",
      approval_comment: comment.trim(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", articleId)
    .eq("organization_id", org.id);

  if (updateError) return { success: false, error: updateError.message };

  // Log the rejection event
  await supabase.from("approval_events").insert({
    article_id: articleId,
    organization_id: org.id,
    user_id: user.id,
    action: "rejected",
    comment: comment.trim(),
  });

  // Notify the article creator about rejection
  if (article.created_by) {
    const articleTitle = article.title || "Untitled";
    await createNotification({
      orgId: org.id,
      userId: article.created_by,
      type: "approval_rejected",
      title: "Article needs revision",
      message: `"${articleTitle}" was returned for revision. Reason: ${comment.trim()}`,
      articleId,
    });
  }

  revalidatePath(`/dashboard/articles/${articleId}`);
  return { success: true };
}

/**
 * Get the approval history for an article.
 * Returns all approval events ordered by most recent first.
 */
export async function getApprovalHistory(
  articleId: string
): Promise<{ data: ApprovalEvent[]; error?: string }> {
  const org = await useOrganization();
  if (!org) return { data: [], error: "Not authorized" };

  const supabase = await createClient();

  // Verify article belongs to org
  const { data: article } = await supabase
    .from("articles")
    .select("id")
    .eq("id", articleId)
    .eq("organization_id", org.id)
    .single();

  if (!article) return { data: [], error: "Article not found" };

  const { data: events, error } = await supabase
    .from("approval_events")
    .select("id, article_id, organization_id, user_id, action, comment, created_at")
    .eq("article_id", articleId)
    .eq("organization_id", org.id)
    .order("created_at", { ascending: false });

  if (error) return { data: [], error: error.message };

  // Fetch user names for the events
  const userIds = [...new Set((events || []).map((e) => e.user_id).filter(Boolean))] as string[];
  let userMap: Record<string, { name: string | null; email: string }> = {};

  if (userIds.length > 0) {
    const { data: users } = await supabase
      .from("users")
      .select("id, name, email")
      .in("id", userIds);

    if (users) {
      userMap = Object.fromEntries(
        users.map((u) => [u.id, { name: u.name, email: u.email }])
      );
    }
  }

  const enrichedEvents: ApprovalEvent[] = (events || []).map((e) => ({
    ...e,
    action: e.action as ApprovalEvent["action"],
    user_name: e.user_id ? userMap[e.user_id]?.name || undefined : undefined,
    user_email: e.user_id ? userMap[e.user_id]?.email || undefined : undefined,
  }));

  return { data: enrichedEvents };
}
