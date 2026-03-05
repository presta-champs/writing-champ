import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  addKeywordToMetaTitle,
  addKeywordToMetaDescription,
  addKeywordToFirstH2,
  addAltTextToImages,
  generateMetaDescription,
} from "@/lib/seo/fixes";

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

    let fixedHtml = html;
    let fixedMetaTitle = metaTitle || "";
    let fixedMetaDescription = metaDescription || "";

    switch (checkId) {
      // Heading fixes
      case "keyword-in-h2":
        fixedHtml = addKeywordToFirstH2(html, primaryKeyword);
        break;

      // Meta title fixes
      case "meta-title-keyword":
        fixedMetaTitle = addKeywordToMetaTitle(metaTitle || "", primaryKeyword);
        break;
      case "meta-title-length":
        // If title is missing entirely, generate from article
        if (!metaTitle) {
          const titleMatch = html.match(/<h2[^>]*>(.*?)<\/h2>/i);
          const titleText = titleMatch
            ? titleMatch[1].replace(/<[^>]*>/g, "")
            : primaryKeyword;
          fixedMetaTitle = addKeywordToMetaTitle(titleText, primaryKeyword);
        }
        break;

      // Meta description fixes
      case "meta-desc-keyword":
        fixedMetaDescription = addKeywordToMetaDescription(
          metaDescription || "",
          primaryKeyword
        );
        break;
      case "meta-desc-length":
        // If description is missing entirely, generate from content
        if (!metaDescription) {
          fixedMetaDescription = generateMetaDescription(html, primaryKeyword, 155);
        }
        break;

      // Image fixes
      case "image-alt-text":
      case "image-alt-keyword":
        fixedHtml = addAltTextToImages(html, primaryKeyword);
        break;

      default:
        return NextResponse.json({ error: `Unknown fix type: ${checkId}` }, { status: 400 });
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
