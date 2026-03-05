import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Import fix functions — these will be created by the SEO engine agent
// Using dynamic import to avoid build errors if the file doesn't exist yet
async function loadFixes() {
  try {
    return await import("@/lib/seo/fixes");
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { checkId, html, metaTitle, metaDescription, primaryKeyword } = body;

    if (!checkId || !html) {
      return NextResponse.json({ error: "checkId and html are required" }, { status: 400 });
    }

    const fixes = await loadFixes();
    if (!fixes) {
      return NextResponse.json({ error: "Fix module not available" }, { status: 500 });
    }

    let fixedHtml = html;
    let fixedMetaTitle = metaTitle;
    let fixedMetaDescription = metaDescription;

    switch (checkId) {
      case "keyword-in-h2":
        fixedHtml = fixes.addKeywordToFirstH2(html, primaryKeyword);
        break;
      case "meta-title-keyword":
        fixedMetaTitle = fixes.addKeywordToMetaTitle(metaTitle || "", primaryKeyword);
        break;
      case "meta-description-keyword":
        fixedMetaDescription = fixes.addKeywordToMetaDescription(
          metaDescription || "",
          primaryKeyword
        );
        break;
      case "image-alt-text":
        fixedHtml = fixes.addAltTextToImages(html, primaryKeyword);
        break;
      case "meta-description-missing":
        fixedMetaDescription = fixes.generateMetaDescription(html, primaryKeyword, 155);
        break;
      default:
        return NextResponse.json({ error: "Unknown fix type" }, { status: 400 });
    }

    return NextResponse.json({
      fixedHtml,
      fixedMetaTitle,
      fixedMetaDescription,
    });
  } catch (error) {
    console.error("SEO fix error:", error);
    return NextResponse.json({ error: "Fix failed" }, { status: 500 });
  }
}
