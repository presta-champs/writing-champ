import { NextRequest, NextResponse } from "next/server";
import { getContentIndex, addContentIndexEntry } from "@/app/actions/content-index";

export async function GET(req: NextRequest) {
  const websiteId = req.nextUrl.searchParams.get("websiteId");
  if (!websiteId) {
    return NextResponse.json({ error: "websiteId required" }, { status: 400 });
  }

  try {
    const entries = await getContentIndex(websiteId);
    return NextResponse.json({ entries });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { websiteId, post_title, post_url, post_excerpt } = body;

    if (!websiteId || !post_title || !post_url) {
      return NextResponse.json(
        { error: "websiteId, post_title, and post_url are required" },
        { status: 400 }
      );
    }

    const entry = await addContentIndexEntry(websiteId, {
      post_title,
      post_url,
      post_excerpt,
    });

    return NextResponse.json({ entry });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
