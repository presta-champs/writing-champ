"use server";

import { createClient } from "@/lib/supabase/server";
import { useUser } from "@/lib/hooks/use-user";
import { useOrganization } from "@/lib/hooks/use-organization";
import { revalidatePath } from "next/cache";

// ─── Types ───────────────────────────────────────────────────────────────────

export type TeamMember = {
  user_id: string;
  email: string;
  name: string | null;
  role: string;
  joined_at: string;
};

export type ActivityEvent = {
  id: string;
  event_type: string;
  model_used: string | null;
  estimated_cost_usd: number;
  created_at: string;
  user_name: string | null;
  user_email: string | null;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Returns the current user + org, or throws a structured error. */
async function requireAdmin() {
  const user = await useUser();
  const org = await useOrganization();
  if (!user || !org) {
    return { user: null, org: null, error: "Not authorized" } as const;
  }
  if (org.role !== "admin") {
    return { user, org, error: "Only admins can perform this action" } as const;
  }
  return { user, org, error: null } as const;
}

// ─── getTeamMembers ──────────────────────────────────────────────────────────

export async function getTeamMembers(): Promise<TeamMember[]> {
  const org = await useOrganization();
  if (!org) return [];

  const supabase = await createClient();

  // Query organization_members joined with users
  const { data, error } = await supabase
    .from("organization_members")
    .select(`
      user_id,
      role,
      joined_at,
      users (
        email,
        name
      )
    `)
    .eq("organization_id", org.id)
    .order("joined_at", { ascending: true });

  if (error || !data) {
    console.error("Failed to fetch team members:", error);
    return [];
  }

  return data.map((row: any) => {
    const userData = Array.isArray(row.users) ? row.users[0] : row.users;
    return {
      user_id: row.user_id,
      email: userData?.email || "Unknown",
      name: userData?.name || null,
      role: row.role,
      joined_at: row.joined_at,
    };
  });
}

// ─── inviteTeamMember ────────────────────────────────────────────────────────

export async function inviteTeamMember(
  email: string,
  role: string
): Promise<{ success: boolean; error?: string }> {
  const { org, error: authError } = await requireAdmin();
  if (authError || !org) return { success: false, error: authError || "Not authorized" };

  const trimmedEmail = email.trim().toLowerCase();
  if (!trimmedEmail) return { success: false, error: "Email is required" };

  const validRoles = ["admin", "editor", "viewer"];
  if (!validRoles.includes(role)) {
    return { success: false, error: "Invalid role. Must be admin, editor, or viewer." };
  }

  const supabase = await createClient();

  // Check if user already exists in the users table
  const { data: existingUser } = await supabase
    .from("users")
    .select("id")
    .eq("email", trimmedEmail)
    .single();

  if (existingUser) {
    // Check if already a member of this org
    const { data: existingMembership } = await supabase
      .from("organization_members")
      .select("user_id")
      .eq("organization_id", org.id)
      .eq("user_id", existingUser.id)
      .single();

    if (existingMembership) {
      return { success: false, error: "This user is already a member of this workspace." };
    }

    // Add them directly
    const { error: insertError } = await supabase
      .from("organization_members")
      .insert({
        organization_id: org.id,
        user_id: existingUser.id,
        role,
      });

    if (insertError) {
      console.error("Failed to add member:", insertError);
      return { success: false, error: "Failed to add member." };
    }
  } else {
    // User doesn't exist yet. We can't create a Supabase auth user with the
    // anon key. Instead, we'll store a pending invite. When that person signs
    // up with this email they will be matched during onboarding.
    //
    // For now, return a helpful message. A full invite system would use
    // Supabase admin API with the service_role key and send an invite email.
    return {
      success: false,
      error: "No account found with this email. The user must sign up first, then you can add them.",
    };
  }

  revalidatePath("/dashboard/settings/team");
  return { success: true };
}

// ─── updateMemberRole ────────────────────────────────────────────────────────

export async function updateMemberRole(
  userId: string,
  newRole: string
): Promise<{ success: boolean; error?: string }> {
  const { user, org, error: authError } = await requireAdmin();
  if (authError || !user || !org) return { success: false, error: authError || "Not authorized" };

  const validRoles = ["admin", "editor", "viewer"];
  if (!validRoles.includes(newRole)) {
    return { success: false, error: "Invalid role." };
  }

  // Prevent admin from changing their own role (could lock themselves out)
  if (userId === user.id) {
    return { success: false, error: "You cannot change your own role." };
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from("organization_members")
    .update({ role: newRole })
    .eq("organization_id", org.id)
    .eq("user_id", userId);

  if (error) {
    console.error("Failed to update role:", error);
    return { success: false, error: "Failed to update role." };
  }

  revalidatePath("/dashboard/settings/team");
  return { success: true };
}

// ─── removeMember ────────────────────────────────────────────────────────────

export async function removeMember(
  userId: string
): Promise<{ success: boolean; error?: string }> {
  const { user, org, error: authError } = await requireAdmin();
  if (authError || !user || !org) return { success: false, error: authError || "Not authorized" };

  if (userId === user.id) {
    return { success: false, error: "You cannot remove yourself from the workspace." };
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from("organization_members")
    .delete()
    .eq("organization_id", org.id)
    .eq("user_id", userId);

  if (error) {
    console.error("Failed to remove member:", error);
    return { success: false, error: "Failed to remove member." };
  }

  revalidatePath("/dashboard/settings/team");
  return { success: true };
}

// ─── getActivityLog ──────────────────────────────────────────────────────────

export async function getActivityLog(
  limit: number = 50,
  offset: number = 0
): Promise<{ events: ActivityEvent[]; total: number }> {
  const { org, error: authError } = await requireAdmin();
  if (authError || !org) return { events: [], total: 0 };

  const supabase = await createClient();

  // Get total count
  const { count } = await supabase
    .from("usage_events")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", org.id);

  // Get events with user info via join
  const { data, error } = await supabase
    .from("usage_events")
    .select(`
      id,
      event_type,
      model_used,
      estimated_cost_usd,
      created_at,
      users (
        name,
        email
      )
    `)
    .eq("organization_id", org.id)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error || !data) {
    console.error("Failed to fetch activity log:", error);
    return { events: [], total: 0 };
  }

  const events: ActivityEvent[] = data.map((row: any) => {
    const userData = Array.isArray(row.users) ? row.users[0] : row.users;
    return {
      id: row.id,
      event_type: row.event_type,
      model_used: row.model_used,
      estimated_cost_usd: row.estimated_cost_usd,
      created_at: row.created_at,
      user_name: userData?.name || null,
      user_email: userData?.email || null,
    };
  });

  return { events, total: count || 0 };
}
