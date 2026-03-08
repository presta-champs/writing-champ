// -----------------------------------------------------------------------
// POST /api/seo-check
// Receives an article + settings, runs the full SEO audit, and returns
// the SeoAuditResult. Requires authentication and org membership.
// -----------------------------------------------------------------------

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { runSeoAudit } from '@/lib/seo/checker';
import type { SeoAuditInput } from '@/lib/seo/types';

export async function POST(request: NextRequest) {
  try {
    // ---------------------------------------------------------------
    // Auth check
    // ---------------------------------------------------------------
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized. Please log in.' },
        { status: 401 },
      );
    }

    // ---------------------------------------------------------------
    // Org membership check
    // ---------------------------------------------------------------
    const { data: membership } = await supabase
      .from('organization_members')
      .select('organization_id, role')
      .eq('user_id', user.id)
      .limit(1)
      .single();

    if (!membership) {
      return NextResponse.json(
        { error: 'No organization membership found.' },
        { status: 403 },
      );
    }

    // ---------------------------------------------------------------
    // Parse and validate request body
    // ---------------------------------------------------------------
    const body = await request.json();

    const {
      html,
      metaTitle,
      metaDescription,
      primaryKeyword,
      secondaryKeywords,
      targetWordCount,
      contentIndex,
      personaSeoSettings,
      articleId,
    } = body as Partial<SeoAuditInput> & { articleId?: string };

    if (!html || typeof html !== 'string') {
      return NextResponse.json(
        { error: 'Missing required field: html (string).' },
        { status: 400 },
      );
    }

    if (!primaryKeyword || typeof primaryKeyword !== 'string') {
      return NextResponse.json(
        { error: 'Missing required field: primaryKeyword (string).' },
        { status: 400 },
      );
    }

    // ---------------------------------------------------------------
    // Auto-resolve persona SEO settings from the article if not provided
    // ---------------------------------------------------------------
    let resolvedSeoSettings = personaSeoSettings ?? undefined;
    if (!resolvedSeoSettings && articleId) {
      const { data: article } = await supabase
        .from('articles')
        .select('persona_id, readability_target')
        .eq('id', articleId)
        .eq('organization_id', membership.organization_id)
        .single();
      if (article?.persona_id) {
        const { data: persona } = await supabase
          .from('personas')
          .select('seo_internal_links, seo_outbound_links, seo_keyword_density, seo_heading_depth')
          .eq('id', article.persona_id)
          .eq('organization_id', membership.organization_id)
          .single();
        if (persona) {
          resolvedSeoSettings = {
            seo_internal_linking: persona.seo_internal_links,
            seo_external_linking: persona.seo_outbound_links,
            seo_keyword_density: persona.seo_keyword_density,
            seo_heading_depth: persona.seo_heading_depth,
            seo_readability_target: article.readability_target ?? undefined,
          };
        }
      } else if (article?.readability_target) {
        resolvedSeoSettings = {
          seo_readability_target: article.readability_target,
        };
      }
    }

    // ---------------------------------------------------------------
    // Run the audit
    // ---------------------------------------------------------------
    const auditInput: SeoAuditInput = {
      html,
      metaTitle: metaTitle ?? undefined,
      metaDescription: metaDescription ?? undefined,
      primaryKeyword,
      secondaryKeywords: Array.isArray(secondaryKeywords) ? secondaryKeywords : [],
      targetWordCount: typeof targetWordCount === 'number' ? targetWordCount : undefined,
      contentIndex: Array.isArray(contentIndex) ? contentIndex : [],
      personaSeoSettings: resolvedSeoSettings,
    };

    const result = runSeoAudit(auditInput);

    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    console.error('[SEO Check API] Error:', err);
    return NextResponse.json(
      { error: 'Internal server error.' },
      { status: 500 },
    );
  }
}
