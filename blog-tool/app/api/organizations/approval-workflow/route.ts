import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/organizations/approval-workflow
 * Body: { enabled: boolean }
 * Toggles the approval workflow for the current user's organization.
 * Only admins can change this setting.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient();

  // Auth check
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Org membership + role check
  const { data: membership } = await supabase
    .from("organization_members")
    .select("organization_id, role")
    .eq("user_id", user.id)
    .limit(1)
    .single();

  if (!membership) {
    return NextResponse.json({ error: "No organization found" }, { status: 403 });
  }

  if (membership.role !== "admin") {
    return NextResponse.json(
      { error: "Only admins can change workflow settings" },
      { status: 403 }
    );
  }

  // Parse body
  let body: { enabled?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (typeof body.enabled !== "boolean") {
    return NextResponse.json(
      { error: "The 'enabled' field must be a boolean" },
      { status: 400 }
    );
  }

  // Update org
  const { error: updateError } = await supabase
    .from("organizations")
    .update({ approval_workflow_enabled: body.enabled })
    .eq("id", membership.organization_id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, enabled: body.enabled });
}
