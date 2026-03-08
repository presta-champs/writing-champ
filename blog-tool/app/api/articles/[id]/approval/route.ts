import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  submitForApproval,
  approveArticle,
  rejectArticle,
  getApprovalHistory,
} from "@/lib/publish/approval";

/**
 * POST /api/articles/[id]/approval
 * Body: { action: "submit" | "approve" | "reject", comment?: string }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Auth check
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Org membership check
  const { data: membership } = await supabase
    .from("organization_members")
    .select("organization_id, role")
    .eq("user_id", user.id)
    .limit(1)
    .single();

  if (!membership) {
    return NextResponse.json({ error: "No organization found" }, { status: 403 });
  }

  // Parse body
  let body: { action?: string; comment?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { action, comment } = body;

  if (!action || !["submit", "approve", "reject"].includes(action)) {
    return NextResponse.json(
      { error: "Invalid action. Must be one of: submit, approve, reject" },
      { status: 400 }
    );
  }

  // Role enforcement
  if (action === "approve" || action === "reject") {
    if (membership.role !== "admin") {
      return NextResponse.json(
        { error: "Only admins can approve or reject articles" },
        { status: 403 }
      );
    }
  }

  // Execute the action
  let result: { success: boolean; error?: string };

  switch (action) {
    case "submit":
      result = await submitForApproval(id);
      break;
    case "approve":
      result = await approveArticle(id, comment);
      break;
    case "reject":
      if (!comment || !comment.trim()) {
        return NextResponse.json(
          { error: "A comment is required when rejecting an article" },
          { status: 400 }
        );
      }
      result = await rejectArticle(id, comment);
      break;
    default:
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}

/**
 * GET /api/articles/[id]/approval
 * Returns the approval history for an article.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Auth check
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Org membership check
  const { data: membership } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", user.id)
    .limit(1)
    .single();

  if (!membership) {
    return NextResponse.json({ error: "No organization found" }, { status: 403 });
  }

  const { data, error } = await getApprovalHistory(id);

  if (error) {
    return NextResponse.json({ error }, { status: 400 });
  }

  return NextResponse.json({ events: data });
}
