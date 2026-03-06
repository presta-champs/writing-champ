import { NextRequest, NextResponse } from "next/server";
import { publishArticleToCms } from "@/app/actions/mcp";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
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
