import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod/v4";

// ─── Request schema ──────────────────────────────────────────────────────────

const BulkScheduleItemSchema = z.object({
  id: z.uuid(),
  scheduledAt: z.iso.datetime(),
});

const BulkScheduleSchema = z.object({
  articles: z.array(BulkScheduleItemSchema).min(1).max(100),
});

// ─── POST /api/articles/bulk-schedule ────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();

    // ── Auth ──────────────────────────────────────────────────────────────
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    // ── Org membership ───────────────────────────────────────────────────
    const { data: membership } = await supabase
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", user.id)
      .limit(1)
      .single();

    if (!membership) {
      return Response.json(
        { error: "No organization found" },
        { status: 403 }
      );
    }

    const orgId = membership.organization_id;

    // ── Validate body ────────────────────────────────────────────────────
    const body = await req.json();
    const parsed = BulkScheduleSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        {
          error: "Invalid request body",
          details: parsed.error.issues.map((i) => i.message),
        },
        { status: 400 }
      );
    }

    const { articles } = parsed.data;

    // ── Validate all dates are in the future ─────────────────────────────
    const now = new Date();
    for (const item of articles) {
      const d = new Date(item.scheduledAt);
      if (d <= now) {
        return Response.json(
          {
            error: `Schedule date must be in the future (article ${item.id})`,
            code: "PAST_DATE",
          },
          { status: 400 }
        );
      }
    }

    // ── Verify all article IDs belong to this org ────────────────────────
    const articleIds = articles.map((a) => a.id);

    const { data: existingArticles } = await supabase
      .from("articles")
      .select("id")
      .eq("organization_id", orgId)
      .in("id", articleIds);

    const existingIds = new Set((existingArticles || []).map((a) => a.id));
    const missingIds = articleIds.filter((id) => !existingIds.has(id));

    if (missingIds.length > 0) {
      return Response.json(
        {
          error: `Articles not found or not in your organization: ${missingIds.join(", ")}`,
          code: "ARTICLES_NOT_FOUND",
        },
        { status: 404 }
      );
    }

    // ── Update each article ──────────────────────────────────────────────
    const results: {
      id: string;
      success: boolean;
      scheduledAt?: string;
      error?: string;
    }[] = [];

    for (const item of articles) {
      const { error: updateError } = await supabase
        .from("articles")
        .update({
          scheduled_at: item.scheduledAt,
          status: "scheduled",
          updated_at: new Date().toISOString(),
        })
        .eq("id", item.id)
        .eq("organization_id", orgId);

      if (updateError) {
        results.push({
          id: item.id,
          success: false,
          error: updateError.message,
        });
      } else {
        results.push({
          id: item.id,
          success: true,
          scheduledAt: item.scheduledAt,
        });
      }
    }

    // ── Log usage event ──────────────────────────────────────────────────
    const successCount = results.filter((r) => r.success).length;

    if (successCount > 0) {
      await supabase.from("usage_events").insert({
        organization_id: orgId,
        user_id: user.id,
        event_type: "bulk_schedule",
        estimated_cost_usd: 0,
      });
    }

    // ── Response ─────────────────────────────────────────────────────────
    const allSucceeded = results.every((r) => r.success);

    return Response.json(
      {
        success: allSucceeded,
        scheduled: successCount,
        failed: results.length - successCount,
        results,
      },
      { status: allSucceeded ? 200 : 207 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  }
}
