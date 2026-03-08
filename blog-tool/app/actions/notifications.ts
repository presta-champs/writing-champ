"use server";

import { createClient } from "@/lib/supabase/server";
import { useUser } from "@/lib/hooks/use-user";
import { useOrganization } from "@/lib/hooks/use-organization";

// ─── Types ───────────────────────────────────────────────────────────────────

export type Notification = {
  id: string;
  organization_id: string;
  user_id: string;
  type: string;
  title: string;
  message: string | null;
  article_id: string | null;
  read: boolean;
  created_at: string;
};

// ─── getUnreadCount ──────────────────────────────────────────────────────────

/** Returns the count of unread notifications for the current user. */
export async function getUnreadCount(): Promise<number> {
  const user = await useUser();
  if (!user) return 0;

  const supabase = await createClient();

  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("read", false);

  if (error) {
    console.error("Failed to fetch unread count:", error.message);
    return 0;
  }

  return count ?? 0;
}

// ─── getNotifications ────────────────────────────────────────────────────────

/** Returns recent notifications for the current user. */
export async function getNotifications(
  limit: number = 20
): Promise<Notification[]> {
  const user = await useUser();
  if (!user) return [];

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Failed to fetch notifications:", error.message);
    return [];
  }

  return data ?? [];
}

// ─── markAsRead ──────────────────────────────────────────────────────────────

/** Marks a single notification as read. */
export async function markAsRead(
  notificationId: string
): Promise<{ success: boolean; error?: string }> {
  const user = await useUser();
  if (!user) return { success: false, error: "Not authorized" };

  const supabase = await createClient();

  const { error } = await supabase
    .from("notifications")
    .update({ read: true })
    .eq("id", notificationId)
    .eq("user_id", user.id);

  if (error) return { success: false, error: error.message };

  return { success: true };
}

// ─── markAllAsRead ───────────────────────────────────────────────────────────

/** Marks all notifications as read for the current user. */
export async function markAllAsRead(): Promise<{
  success: boolean;
  error?: string;
}> {
  const user = await useUser();
  if (!user) return { success: false, error: "Not authorized" };

  const supabase = await createClient();

  const { error } = await supabase
    .from("notifications")
    .update({ read: true })
    .eq("user_id", user.id)
    .eq("read", false);

  if (error) return { success: false, error: error.message };

  return { success: true };
}

// ─── createNotification ─────────────────────────────────────────────────────

/**
 * Internal helper — creates a notification row.
 * Called from approval.ts after approval events succeed.
 */
export async function createNotification(params: {
  orgId: string;
  userId: string;
  type: string;
  title: string;
  message?: string;
  articleId?: string;
}): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase.from("notifications").insert({
    organization_id: params.orgId,
    user_id: params.userId,
    type: params.type,
    title: params.title,
    message: params.message ?? null,
    article_id: params.articleId ?? null,
  });

  if (error) {
    console.error("Failed to create notification:", error.message);
  }
}
