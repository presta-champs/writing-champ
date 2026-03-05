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
    } = body as Partial<SeoAuditInput>;

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
      personaSeoSettings: personaSeoSettings ?? undefined,
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
