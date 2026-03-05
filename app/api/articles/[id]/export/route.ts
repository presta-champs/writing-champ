import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

function htmlToMarkdown(html: string): string {
  return html
    .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '\n## $1\n')
    .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '\n### $1\n')
    .replace(/<strong>(.*?)<\/strong>/gi, '**$1**')
    .replace(/<em>(.*?)<\/em>/gi, '*$1*')
    .replace(/<a[^>]+href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '[$2]($1)')
    .replace(/<li>(.*?)<\/li>/gi, '- $1')
    .replace(/<ul[^>]*>|<\/ul>/gi, '\n')
    .replace(/<ol[^>]*>|<\/ol>/gi, '\n')
    .replace(/<blockquote[^>]*>(.*?)<\/blockquote>/gi, '\n> $1\n')
    .replace(/<p[^>]*>(.*?)<\/p>/gi, '\n$1\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function htmlToPlainText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]*>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const format = request.nextUrl.searchParams.get('format') || 'html';

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: membership } = await supabase
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', user.id)
    .limit(1)
    .single();

  if (!membership) {
    return Response.json({ error: 'No organization found' }, { status: 403 });
  }

  const { data: article } = await supabase
    .from('articles')
    .select('title, body')
    .eq('id', id)
    .eq('organization_id', membership.organization_id)
    .single();

  if (!article) {
    return Response.json({ error: 'Article not found' }, { status: 404 });
  }

  const title = article.title || 'Untitled';
  const body = article.body || '';

  let content: string;
  let contentType: string;
  let extension: string;

  switch (format) {
    case 'markdown':
      content = `# ${title}\n\n${htmlToMarkdown(body)}`;
      contentType = 'text/markdown';
      extension = 'md';
      break;
    case 'plain':
      content = `${title}\n${'='.repeat(title.length)}\n\n${htmlToPlainText(body)}`;
      contentType = 'text/plain';
      extension = 'txt';
      break;
    default:
      content = `<h1>${title}</h1>\n${body}`;
      contentType = 'text/html';
      extension = 'html';
      break;
  }

  const filename = title.replace(/[^a-zA-Z0-9-_ ]/g, '').replace(/\s+/g, '-').toLowerCase();

  return new Response(content, {
    headers: {
      'Content-Type': `${contentType}; charset=utf-8`,
      'Content-Disposition': `attachment; filename="${filename}.${extension}"`,
    },
  });
}
