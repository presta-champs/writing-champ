-- ─────────────────────────────────────────────────────────────────────────────
-- Row Level Security (RLS) — Multi-tenant isolation
-- Applied: 2026-03-05 (Phase 1.8 Security Review)
-- ─────────────────────────────────────────────────────────────────────────────

-- Helper: returns the set of organization IDs the current auth user belongs to.
CREATE OR REPLACE FUNCTION public.user_org_ids()
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id
  FROM organization_members
  WHERE user_id = auth.uid();
$$;

-- ── organizations ──────────────────────────────────────────────────────────

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own organizations"
  ON organizations FOR SELECT
  USING (id IN (SELECT public.user_org_ids()));

CREATE POLICY "Users can update their own organizations"
  ON organizations FOR UPDATE
  USING (id IN (SELECT public.user_org_ids()));

CREATE POLICY "Authenticated users can create organizations"
  ON organizations FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- ── organization_members ───────────────────────────────────────────────────

ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view members of their organizations"
  ON organization_members FOR SELECT
  USING (organization_id IN (SELECT public.user_org_ids()));

CREATE POLICY "Users can insert into their organizations"
  ON organization_members FOR INSERT
  WITH CHECK (
    organization_id IN (SELECT public.user_org_ids())
    OR user_id = auth.uid()
  );

CREATE POLICY "Users can delete from their organizations"
  ON organization_members FOR DELETE
  USING (organization_id IN (SELECT public.user_org_ids()));

-- ── websites ───────────────────────────────────────────────────────────────

ALTER TABLE websites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view their websites"
  ON websites FOR SELECT
  USING (organization_id IN (SELECT public.user_org_ids()));

CREATE POLICY "Org members can insert websites"
  ON websites FOR INSERT
  WITH CHECK (organization_id IN (SELECT public.user_org_ids()));

CREATE POLICY "Org members can update their websites"
  ON websites FOR UPDATE
  USING (organization_id IN (SELECT public.user_org_ids()));

CREATE POLICY "Org members can delete their websites"
  ON websites FOR DELETE
  USING (organization_id IN (SELECT public.user_org_ids()));

-- ── personas ───────────────────────────────────────────────────────────────

ALTER TABLE personas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view their personas"
  ON personas FOR SELECT
  USING (organization_id IN (SELECT public.user_org_ids()));

CREATE POLICY "Org members can insert personas"
  ON personas FOR INSERT
  WITH CHECK (organization_id IN (SELECT public.user_org_ids()));

CREATE POLICY "Org members can update their personas"
  ON personas FOR UPDATE
  USING (organization_id IN (SELECT public.user_org_ids()));

CREATE POLICY "Org members can delete their personas"
  ON personas FOR DELETE
  USING (organization_id IN (SELECT public.user_org_ids()));

-- ── persona_writing_samples ────────────────────────────────────────────────

ALTER TABLE persona_writing_samples ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view samples of their personas"
  ON persona_writing_samples FOR SELECT
  USING (persona_id IN (
    SELECT id FROM personas WHERE organization_id IN (SELECT public.user_org_ids())
  ));

CREATE POLICY "Org members can insert samples for their personas"
  ON persona_writing_samples FOR INSERT
  WITH CHECK (persona_id IN (
    SELECT id FROM personas WHERE organization_id IN (SELECT public.user_org_ids())
  ));

CREATE POLICY "Org members can delete samples of their personas"
  ON persona_writing_samples FOR DELETE
  USING (persona_id IN (
    SELECT id FROM personas WHERE organization_id IN (SELECT public.user_org_ids())
  ));

-- ── persona_website_assignments ────────────────────────────────────────────

ALTER TABLE persona_website_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view their persona-website assignments"
  ON persona_website_assignments FOR SELECT
  USING (persona_id IN (
    SELECT id FROM personas WHERE organization_id IN (SELECT public.user_org_ids())
  ));

CREATE POLICY "Org members can insert persona-website assignments"
  ON persona_website_assignments FOR INSERT
  WITH CHECK (persona_id IN (
    SELECT id FROM personas WHERE organization_id IN (SELECT public.user_org_ids())
  ));

CREATE POLICY "Org members can delete persona-website assignments"
  ON persona_website_assignments FOR DELETE
  USING (persona_id IN (
    SELECT id FROM personas WHERE organization_id IN (SELECT public.user_org_ids())
  ));

-- ── campaigns ──────────────────────────────────────────────────────────────

ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view their campaigns"
  ON campaigns FOR SELECT
  USING (organization_id IN (SELECT public.user_org_ids()));

CREATE POLICY "Org members can insert campaigns"
  ON campaigns FOR INSERT
  WITH CHECK (organization_id IN (SELECT public.user_org_ids()));

CREATE POLICY "Org members can update their campaigns"
  ON campaigns FOR UPDATE
  USING (organization_id IN (SELECT public.user_org_ids()));

CREATE POLICY "Org members can delete their campaigns"
  ON campaigns FOR DELETE
  USING (organization_id IN (SELECT public.user_org_ids()));

-- ── articles ───────────────────────────────────────────────────────────────

ALTER TABLE articles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view their articles"
  ON articles FOR SELECT
  USING (organization_id IN (SELECT public.user_org_ids()));

CREATE POLICY "Org members can insert articles"
  ON articles FOR INSERT
  WITH CHECK (organization_id IN (SELECT public.user_org_ids()));

CREATE POLICY "Org members can update their articles"
  ON articles FOR UPDATE
  USING (organization_id IN (SELECT public.user_org_ids()));

CREATE POLICY "Org members can delete their articles"
  ON articles FOR DELETE
  USING (organization_id IN (SELECT public.user_org_ids()));

-- ── article_keywords ───────────────────────────────────────────────────────

ALTER TABLE article_keywords ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can manage keywords for their articles"
  ON article_keywords FOR ALL
  USING (article_id IN (
    SELECT id FROM articles WHERE organization_id IN (SELECT public.user_org_ids())
  ));

-- ── article_images ─────────────────────────────────────────────────────────

ALTER TABLE article_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can manage images for their articles"
  ON article_images FOR ALL
  USING (article_id IN (
    SELECT id FROM articles WHERE organization_id IN (SELECT public.user_org_ids())
  ));

-- ── article_tags ───────────────────────────────────────────────────────────

ALTER TABLE article_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can manage tags for their articles"
  ON article_tags FOR ALL
  USING (article_id IN (
    SELECT id FROM articles WHERE organization_id IN (SELECT public.user_org_ids())
  ));

-- ── article_cross_site_links ───────────────────────────────────────────────

ALTER TABLE article_cross_site_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can manage cross-site links for their articles"
  ON article_cross_site_links FOR ALL
  USING (article_id IN (
    SELECT id FROM articles WHERE organization_id IN (SELECT public.user_org_ids())
  ));

-- ── news_feed_items ────────────────────────────────────────────────────────

ALTER TABLE news_feed_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view their news feed items"
  ON news_feed_items FOR SELECT
  USING (organization_id IN (SELECT public.user_org_ids()));

CREATE POLICY "Org members can insert news feed items"
  ON news_feed_items FOR INSERT
  WITH CHECK (organization_id IN (SELECT public.user_org_ids()));

CREATE POLICY "Org members can update their news feed items"
  ON news_feed_items FOR UPDATE
  USING (organization_id IN (SELECT public.user_org_ids()));

-- ── website_feed_sources ───────────────────────────────────────────────────

ALTER TABLE website_feed_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can manage feed sources for their websites"
  ON website_feed_sources FOR ALL
  USING (website_id IN (
    SELECT id FROM websites WHERE organization_id IN (SELECT public.user_org_ids())
  ));

-- ── website_content_index ──────────────────────────────────────────────────

ALTER TABLE website_content_index ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can manage content index for their websites"
  ON website_content_index FOR ALL
  USING (website_id IN (
    SELECT id FROM websites WHERE organization_id IN (SELECT public.user_org_ids())
  ));

-- ── mcp_events ─────────────────────────────────────────────────────────────

ALTER TABLE mcp_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view their MCP events"
  ON mcp_events FOR SELECT
  USING (organization_id IN (SELECT public.user_org_ids()));

CREATE POLICY "Org members can insert MCP events"
  ON mcp_events FOR INSERT
  WITH CHECK (organization_id IN (SELECT public.user_org_ids()));

-- ── usage_events ───────────────────────────────────────────────────────────

ALTER TABLE usage_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view their usage events"
  ON usage_events FOR SELECT
  USING (organization_id IN (SELECT public.user_org_ids()));

CREATE POLICY "Org members can insert usage events"
  ON usage_events FOR INSERT
  WITH CHECK (organization_id IN (SELECT public.user_org_ids()));

-- ── generation_jobs ────────────────────────────────────────────────────────

ALTER TABLE generation_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view their generation jobs"
  ON generation_jobs FOR SELECT
  USING (organization_id IN (SELECT public.user_org_ids()));

CREATE POLICY "Org members can insert generation jobs"
  ON generation_jobs FOR INSERT
  WITH CHECK (organization_id IN (SELECT public.user_org_ids()));

CREATE POLICY "Org members can update their generation jobs"
  ON generation_jobs FOR UPDATE
  USING (organization_id IN (SELECT public.user_org_ids()));

-- ── generation_job_items ───────────────────────────────────────────────────

ALTER TABLE generation_job_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can manage items for their generation jobs"
  ON generation_job_items FOR ALL
  USING (job_id IN (
    SELECT id FROM generation_jobs WHERE organization_id IN (SELECT public.user_org_ids())
  ));

-- ── users ──────────────────────────────────────────────────────────────────

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own record"
  ON users FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "Users can update their own record"
  ON users FOR UPDATE
  USING (id = auth.uid());

CREATE POLICY "Users can insert their own record"
  ON users FOR INSERT
  WITH CHECK (id = auth.uid());
