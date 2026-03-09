import { createClient } from "@/lib/supabase/server";
import { useUser } from "@/lib/hooks/use-user";
import { useOrganization } from "@/lib/hooks/use-organization";

export async function submitForApproval(
  articleId: string
): Promise<{ success: boolean; error?: string }> {
  const user = await useUser();
  const org = await useOrganization();
  if (!user || !org) return { success: false, error: "Not authorized" };

  const supabase = await createClient();

  const { error } = await supabase
    .from("articles")
    .update({ status: "pending_approval" })
    .eq("id", articleId)
    .eq("organization_id", org.id);

  if (error) return { success: false, error: error.message };

  // Log the event
  await supabase.from("mcp_events").insert({
    organization_id: org.id,
    operation: "approval_submitted",
    status: "success",
    request_snapshot: { articleId, userId: user.id },
  });

  return { success: true };
}

export async function approveArticle(
  articleId: string,
  comment?: string
): Promise<{ success: boolean; error?: string }> {
  const user = await useUser();
  const org = await useOrganization();
  if (!user || !org) return { success: false, error: "Not authorized" };

  const supabase = await createClient();

  const { error } = await supabase
    .from("articles")
    .update({
      status: "approved",
      approved_by: user.id,
    })
    .eq("id", articleId)
    .eq("organization_id", org.id);

  if (error) return { success: false, error: error.message };

  await supabase.from("mcp_events").insert({
    organization_id: org.id,
    operation: "approval_approved",
    status: "success",
    request_snapshot: { articleId, userId: user.id, comment },
  });

  return { success: true };
}

export async function rejectArticle(
  articleId: string,
  comment: string
): Promise<{ success: boolean; error?: string }> {
  const user = await useUser();
  const org = await useOrganization();
  if (!user || !org) return { success: false, error: "Not authorized" };

  const supabase = await createClient();

  const { error } = await supabase
    .from("articles")
    .update({ status: "draft" })
    .eq("id", articleId)
    .eq("organization_id", org.id);

  if (error) return { success: false, error: error.message };

  await supabase.from("mcp_events").insert({
    organization_id: org.id,
    operation: "approval_rejected",
    status: "success",
    request_snapshot: { articleId, userId: user.id, comment },
  });

  return { success: true };
}

export async function getApprovalHistory(
  articleId: string
): Promise<{ data: Record<string, unknown>[]; error?: string }> {
  const org = await useOrganization();
  if (!org) return { data: [], error: "Not authorized" };

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("mcp_events")
    .select("*")
    .eq("organization_id", org.id)
    .in("operation", ["approval_submitted", "approval_approved", "approval_rejected"])
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) return { data: [], error: error.message };

  const filtered = (data || []).filter(
    (e) => (e.request_snapshot as Record<string, unknown>)?.articleId === articleId
  );

  return { data: filtered };
}
