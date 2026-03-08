import { NextRequest, NextResponse } from "next/server";
import { publishArticleToCms } from "@/app/actions/mcp";
import { createClient } from "@/lib/supabase/server";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    // Auth + approval workflow enforcement
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: membership } = await supabase
      .from("organization_members")
      .select("organization_id, role")
      .eq("user_id", user.id)
      .limit(1)
      .single();

    if (!membership) {
      return NextResponse.json({ error: "No organization found" }, { status: 403 });
    }

    // Check if approval workflow is enabled
    const { data: orgData } = await supabase
      .from("organizations")
      .select("approval_workflow_enabled")
      .eq("id", membership.organization_id)
      .single();

    if (orgData?.approval_workflow_enabled && membership.role !== "admin") {
      // Non-admin users must have an approved article to publish
      const { data: article } = await supabase
        .from("articles")
        .select("status")
        .eq("id", id)
        .eq("organization_id", membership.organization_id)
        .single();

      if (!article) {
        return NextResponse.json({ error: "Article not found" }, { status: 404 });
      }

      if (article.status !== "approved") {
        return NextResponse.json(
          { error: "This article must be approved before it can be published. Submit it for review first." },
          { status: 403 }
        );
      }
    }

    const body = await req.json().catch(() => ({}));
    const schedule = body.schedule as string | undefined;

    const result = await publishArticleToCms(id, schedule ? { schedule } : undefined);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Publish failed" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      externalPostId: result.externalPostId,
      postUrl: result.postUrl,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
