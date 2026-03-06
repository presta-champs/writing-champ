import { NextRequest, NextResponse } from "next/server";
import { publishArticleToCms } from "@/app/actions/mcp";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const body = await req.json();
    const schedule = body.schedule as string | undefined;

    if (!schedule) {
      return NextResponse.json(
        { error: "schedule (ISO 8601 datetime) is required" },
        { status: 400 }
      );
    }

    // Validate it's a future date
    const scheduleDate = new Date(schedule);
    if (isNaN(scheduleDate.getTime())) {
      return NextResponse.json(
        { error: "Invalid date format. Use ISO 8601." },
        { status: 400 }
      );
    }
    if (scheduleDate <= new Date()) {
      return NextResponse.json(
        { error: "Schedule date must be in the future" },
        { status: 400 }
      );
    }

    const result = await publishArticleToCms(id, { schedule });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Schedule failed" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      externalPostId: result.externalPostId,
      postUrl: result.postUrl,
      scheduledAt: schedule,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
