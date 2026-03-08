-- Initialize Database Schema for WritingChamps Blog Tool

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─────────────────────────────────────────────────────────────────────────────
-- Core Tables
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    plan VARCHAR(50) DEFAULT 'starter',
    article_limit INT DEFAULT 10,
    approval_workflow_enabled BOOLEAN DEFAULT FALSE,
    external_seo_grader_enabled BOOLEAN DEFAULT FALSE,
    api_integration_keys JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE organization_members (
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(50) DEFAULT 'editor', -- admin/editor
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (organization_id, user_id)
);

CREATE TABLE websites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    url VARCHAR(500) NOT NULL,
    platform_type VARCHAR(50) DEFAULT 'wordpress',
    mcp_server_url VARCHAR(500),
    mcp_auth_token TEXT,
    mcp_status VARCHAR(50) DEFAULT 'unconfigured',
    mcp_last_synced TIMESTAMP WITH TIME ZONE,
    -- brand voice
    site_description TEXT,
    tone_guardrails TEXT,
    banned_topics TEXT,
    banned_words TEXT,
    required_elements TEXT,
    content_pillars JSONB DEFAULT '[]',
    -- specialty profile for cross-site interlinking
    specialty_summary TEXT,
    specialty_topics JSONB DEFAULT '[]',
    primary_url VARCHAR(500),
    -- news feed config
    feed_topics JSONB DEFAULT '[]',
    feed_keywords_include JSONB DEFAULT '[]',
    feed_keywords_exclude JSONB DEFAULT '[]',
    feed_refresh_interval_hours INT DEFAULT 6,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE website_feed_sources (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    website_id UUID REFERENCES websites(id) ON DELETE CASCADE,
    source_type VARCHAR(50) DEFAULT 'rss', -- rss/publication_name
    source_value TEXT NOT NULL,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE news_feed_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    website_id UUID REFERENCES websites(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    headline TEXT NOT NULL,
    url VARCHAR(1000) NOT NULL,
    publication_name VARCHAR(255),
    published_at TIMESTAMP WITH TIME ZONE,
    excerpt TEXT,
    fetched_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    dismissed_by JSONB DEFAULT '[]' -- array of user_ids
);

CREATE TABLE website_content_index (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    website_id UUID REFERENCES websites(id) ON DELETE CASCADE,
    post_title TEXT NOT NULL,
    post_url TEXT NOT NULL,
    post_excerpt TEXT,
    fetched_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE personas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    bio TEXT,
    avatar_url VARCHAR(1000),
    -- shared across tools
    tone_formal INT DEFAULT 50,
    tone_warmth INT DEFAULT 50,
    tone_conciseness INT DEFAULT 50,
    tone_humor INT DEFAULT 50,
    quirks TEXT,
    forbidden_words TEXT,
    signature_phrases TEXT,
    voice_summary TEXT,
    -- rich voice definition
    voice_principles JSONB DEFAULT '[]',
    sentence_rules_do JSONB DEFAULT '[]',
    sentence_rules_dont JSONB DEFAULT '[]',
    structural_patterns JSONB DEFAULT '[]',
    recurring_themes JSONB DEFAULT '[]',
    example_passages JSONB DEFAULT '[]',
    system_prompt_override TEXT,
    methodology TEXT,
    tone_authority VARCHAR(255),
    tone_brand_loyalty INT DEFAULT 50,
    seo_heading_style VARCHAR(255),
    seo_meta_tone VARCHAR(255),
    seo_article_length_min INT DEFAULT 800,
    seo_article_length_max INT DEFAULT 2000,
    is_builtin BOOLEAN DEFAULT FALSE,
    builtin_slug VARCHAR(100),
    -- blog specific
    model_override VARCHAR(50),
    image_style VARCHAR(100),
    seo_outbound_links INT DEFAULT 3,
    seo_internal_links INT DEFAULT 3,
    seo_link_placement VARCHAR(100),
    seo_keyword_density FLOAT DEFAULT 1.5,
    seo_keyword_placement_rules TEXT,
    seo_heading_depth INT DEFAULT 3,
    seo_include_faq BOOLEAN DEFAULT FALSE,
    seo_include_toc BOOLEAN DEFAULT FALSE,
    seo_meta_description_length INT DEFAULT 160,
    seo_title_tag_format VARCHAR(255),
    seo_ahrefs_min_volume INT DEFAULT 100,
    seo_ahrefs_max_difficulty INT DEFAULT 30,
    seo_ahrefs_country VARCHAR(10) DEFAULT 'us',
    -- email & social specific
    email_subject_style VARCHAR(255),
    email_preheader_style VARCHAR(255),
    social_brevity VARCHAR(100),
    social_handle_style VARCHAR(100),
    archived BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE persona_writing_samples (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    persona_id UUID REFERENCES personas(id) ON DELETE CASCADE,
    filename VARCHAR(255) NOT NULL,
    storage_url VARCHAR(1000) NOT NULL,
    extracted_text TEXT,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE persona_website_assignments (
    persona_id UUID REFERENCES personas(id) ON DELETE CASCADE,
    website_id UUID REFERENCES websites(id) ON DELETE CASCADE,
    usage_count INT DEFAULT 0,
    PRIMARY KEY (persona_id, website_id)
);

CREATE TABLE campaigns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    website_id UUID REFERENCES websites(id) ON DELETE SET NULL,
    persona_id UUID REFERENCES personas(id) ON DELETE SET NULL,
    title VARCHAR(500) NOT NULL,
    core_idea TEXT NOT NULL,
    audience_context TEXT,
    -- news seed
    source_article_url TEXT,
    source_article_title TEXT,
    source_article_publication VARCHAR(255),
    source_article_published_at TIMESTAMP WITH TIME ZONE,
    news_feed_item_id UUID REFERENCES news_feed_items(id) ON DELETE SET NULL,
    -- status tracking
    status VARCHAR(50) DEFAULT 'draft',
    blog_published BOOLEAN DEFAULT FALSE,
    blog_post_url TEXT,
    blog_post_id VARCHAR(255),
    email_sent BOOLEAN DEFAULT FALSE,
    email_campaign_id VARCHAR(255),
    email_planner_project_id VARCHAR(255),
    social_posted BOOLEAN DEFAULT FALSE,
    social_post_ids JSONB DEFAULT '[]',
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE articles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
    title TEXT,
    body TEXT,
    meta_title VARCHAR(255),
    meta_description TEXT,
    persona_id UUID REFERENCES personas(id) ON DELETE SET NULL,
    website_id UUID REFERENCES websites(id) ON DELETE SET NULL,
    format VARCHAR(100),
    word_count INT DEFAULT 0,
    primary_keyword VARCHAR(255),
    secondary_keywords JSONB DEFAULT '[]',
    model_used VARCHAR(50),
    prompt_snapshot TEXT,
    seo_score INT DEFAULT 0,
    seo_audit_snapshot JSONB,
    cross_site_links_snapshot JSONB,
    external_seo_score INT,
    featured_image_url TEXT,
    -- news
    source_article_url TEXT,
    source_article_title TEXT,
    source_article_publication VARCHAR(255),
    status VARCHAR(50) DEFAULT 'draft',
    scheduled_at TIMESTAMP WITH TIME ZONE,
    published_at TIMESTAMP WITH TIME ZONE,
    external_post_id VARCHAR(255),
    mcp_publish_log JSONB,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE article_keywords (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    article_id UUID REFERENCES articles(id) ON DELETE CASCADE,
    keyword VARCHAR(255) NOT NULL,
    search_volume INT DEFAULT 0,
    difficulty INT DEFAULT 0,
    role VARCHAR(50) DEFAULT 'primary', -- primary/secondary
    source VARCHAR(50) DEFAULT 'manual'
);

CREATE TABLE article_images (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    article_id UUID REFERENCES articles(id) ON DELETE CASCADE,
    storage_url TEXT NOT NULL,
    source VARCHAR(50) DEFAULT 'stock', -- stock/generated
    position INT DEFAULT 0,
    alt_text TEXT
);

CREATE TABLE article_tags (
    article_id UUID REFERENCES articles(id) ON DELETE CASCADE,
    tag VARCHAR(100) NOT NULL,
    PRIMARY KEY (article_id, tag)
);

CREATE TABLE article_cross_site_links (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    article_id UUID REFERENCES articles(id) ON DELETE CASCADE,
    target_website_id UUID REFERENCES websites(id) ON DELETE SET NULL,
    target_url TEXT NOT NULL,
    anchor_text VARCHAR(255),
    paragraph_index INT,
    status VARCHAR(50) DEFAULT 'inserted', -- inserted/removed_by_user
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE mcp_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    website_id UUID REFERENCES websites(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    operation VARCHAR(100),
    status VARCHAR(50),
    request_snapshot JSONB,
    response_snapshot JSONB,
    duration_ms INT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE usage_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    article_id UUID REFERENCES articles(id) ON DELETE SET NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    event_type VARCHAR(100) NOT NULL,
    model_used VARCHAR(50),
    estimated_cost_usd FLOAT DEFAULT 0.0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE generation_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    status VARCHAR(50) DEFAULT 'pending',
    total INT DEFAULT 0,
    completed INT DEFAULT 0,
    failed INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE generation_job_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id UUID REFERENCES generation_jobs(id) ON DELETE CASCADE,
    article_id UUID REFERENCES articles(id) ON DELETE SET NULL,
    status VARCHAR(50) DEFAULT 'pending',
    error_message TEXT
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Indexes
-- ─────────────────────────────────────────────────────────────────────────────

CREATE INDEX idx_websites_org ON websites(organization_id);
CREATE INDEX idx_personas_org ON personas(organization_id);
CREATE INDEX idx_articles_org ON articles(organization_id);
CREATE INDEX idx_campaigns_org ON campaigns(organization_id);
CREATE INDEX idx_articles_status ON articles(status);
CREATE INDEX idx_usage_events_org ON usage_events(organization_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- Row Level Security (RLS)
-- ─────────────────────────────────────────────────────────────────────────────
-- Helper: returns the set of organization IDs the current auth user belongs to.
-- Used in all RLS policies to enforce multi-tenant isolation.

CREATE OR REPLACE FUNCTION auth.user_org_ids()
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
  USING (id IN (SELECT auth.user_org_ids()));

CREATE POLICY "Users can update their own organizations"
  ON organizations FOR UPDATE
  USING (id IN (SELECT auth.user_org_ids()));

-- INSERT allowed for onboarding (user creates org before membership exists)
CREATE POLICY "Authenticated users can create organizations"
  ON organizations FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- ── organization_members ───────────────────────────────────────────────────

ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view members of their organizations"
  ON organization_members FOR SELECT
  USING (organization_id IN (SELECT auth.user_org_ids()));

CREATE POLICY "Users can insert into their organizations"
  ON organization_members FOR INSERT
  WITH CHECK (
    organization_id IN (SELECT auth.user_org_ids())
    OR user_id = auth.uid() -- allow self-insertion during onboarding
  );

CREATE POLICY "Users can delete from their organizations"
  ON organization_members FOR DELETE
  USING (organization_id IN (SELECT auth.user_org_ids()));

-- ── websites ───────────────────────────────────────────────────────────────

ALTER TABLE websites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view their websites"
  ON websites FOR SELECT
  USING (organization_id IN (SELECT auth.user_org_ids()));

CREATE POLICY "Org members can insert websites"
  ON websites FOR INSERT
  WITH CHECK (organization_id IN (SELECT auth.user_org_ids()));

CREATE POLICY "Org members can update their websites"
  ON websites FOR UPDATE
  USING (organization_id IN (SELECT auth.user_org_ids()));

CREATE POLICY "Org members can delete their websites"
  ON websites FOR DELETE
  USING (organization_id IN (SELECT auth.user_org_ids()));

-- ── personas ───────────────────────────────────────────────────────────────

ALTER TABLE personas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view their personas"
  ON personas FOR SELECT
  USING (organization_id IN (SELECT auth.user_org_ids()));

CREATE POLICY "Org members can insert personas"
  ON personas FOR INSERT
  WITH CHECK (organization_id IN (SELECT auth.user_org_ids()));

CREATE POLICY "Org members can update their personas"
  ON personas FOR UPDATE
  USING (organization_id IN (SELECT auth.user_org_ids()));

CREATE POLICY "Org members can delete their personas"
  ON personas FOR DELETE
  USING (organization_id IN (SELECT auth.user_org_ids()));

-- ── persona_writing_samples ────────────────────────────────────────────────
-- Scoped through personas table (persona must belong to user's org)

ALTER TABLE persona_writing_samples ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view samples of their personas"
  ON persona_writing_samples FOR SELECT
  USING (persona_id IN (
    SELECT id FROM personas WHERE organization_id IN (SELECT auth.user_org_ids())
  ));

CREATE POLICY "Org members can insert samples for their personas"
  ON persona_writing_samples FOR INSERT
  WITH CHECK (persona_id IN (
    SELECT id FROM personas WHERE organization_id IN (SELECT auth.user_org_ids())
  ));

CREATE POLICY "Org members can delete samples of their personas"
  ON persona_writing_samples FOR DELETE
  USING (persona_id IN (
    SELECT id FROM personas WHERE organization_id IN (SELECT auth.user_org_ids())
  ));

-- ── persona_website_assignments ────────────────────────────────────────────

ALTER TABLE persona_website_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view their persona-website assignments"
  ON persona_website_assignments FOR SELECT
  USING (persona_id IN (
    SELECT id FROM personas WHERE organization_id IN (SELECT auth.user_org_ids())
  ));

CREATE POLICY "Org members can insert persona-website assignments"
  ON persona_website_assignments FOR INSERT
  WITH CHECK (persona_id IN (
    SELECT id FROM personas WHERE organization_id IN (SELECT auth.user_org_ids())
  ));

CREATE POLICY "Org members can delete persona-website assignments"
  ON persona_website_assignments FOR DELETE
  USING (persona_id IN (
    SELECT id FROM personas WHERE organization_id IN (SELECT auth.user_org_ids())
  ));

-- ── campaigns ──────────────────────────────────────────────────────────────

ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view their campaigns"
  ON campaigns FOR SELECT
  USING (organization_id IN (SELECT auth.user_org_ids()));

CREATE POLICY "Org members can insert campaigns"
  ON campaigns FOR INSERT
  WITH CHECK (organization_id IN (SELECT auth.user_org_ids()));

CREATE POLICY "Org members can update their campaigns"
  ON campaigns FOR UPDATE
  USING (organization_id IN (SELECT auth.user_org_ids()));

CREATE POLICY "Org members can delete their campaigns"
  ON campaigns FOR DELETE
  USING (organization_id IN (SELECT auth.user_org_ids()));

-- ── articles ───────────────────────────────────────────────────────────────

ALTER TABLE articles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view their articles"
  ON articles FOR SELECT
  USING (organization_id IN (SELECT auth.user_org_ids()));

CREATE POLICY "Org members can insert articles"
  ON articles FOR INSERT
  WITH CHECK (organization_id IN (SELECT auth.user_org_ids()));

CREATE POLICY "Org members can update their articles"
  ON articles FOR UPDATE
  USING (organization_id IN (SELECT auth.user_org_ids()));

CREATE POLICY "Org members can delete their articles"
  ON articles FOR DELETE
  USING (organization_id IN (SELECT auth.user_org_ids()));

-- ── article_keywords ───────────────────────────────────────────────────────

ALTER TABLE article_keywords ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can manage keywords for their articles"
  ON article_keywords FOR ALL
  USING (article_id IN (
    SELECT id FROM articles WHERE organization_id IN (SELECT auth.user_org_ids())
  ));

-- ── article_images ─────────────────────────────────────────────────────────

ALTER TABLE article_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can manage images for their articles"
  ON article_images FOR ALL
  USING (article_id IN (
    SELECT id FROM articles WHERE organization_id IN (SELECT auth.user_org_ids())
  ));

-- ── article_tags ───────────────────────────────────────────────────────────

ALTER TABLE article_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can manage tags for their articles"
  ON article_tags FOR ALL
  USING (article_id IN (
    SELECT id FROM articles WHERE organization_id IN (SELECT auth.user_org_ids())
  ));

-- ── article_cross_site_links ───────────────────────────────────────────────

ALTER TABLE article_cross_site_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can manage cross-site links for their articles"
  ON article_cross_site_links FOR ALL
  USING (article_id IN (
    SELECT id FROM articles WHERE organization_id IN (SELECT auth.user_org_ids())
  ));

-- ── news_feed_items ────────────────────────────────────────────────────────

ALTER TABLE news_feed_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view their news feed items"
  ON news_feed_items FOR SELECT
  USING (organization_id IN (SELECT auth.user_org_ids()));

CREATE POLICY "Org members can insert news feed items"
  ON news_feed_items FOR INSERT
  WITH CHECK (organization_id IN (SELECT auth.user_org_ids()));

CREATE POLICY "Org members can update their news feed items"
  ON news_feed_items FOR UPDATE
  USING (organization_id IN (SELECT auth.user_org_ids()));

-- ── website_feed_sources ───────────────────────────────────────────────────

ALTER TABLE website_feed_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can manage feed sources for their websites"
  ON website_feed_sources FOR ALL
  USING (website_id IN (
    SELECT id FROM websites WHERE organization_id IN (SELECT auth.user_org_ids())
  ));

-- ── website_content_index ──────────────────────────────────────────────────

ALTER TABLE website_content_index ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can manage content index for their websites"
  ON website_content_index FOR ALL
  USING (website_id IN (
    SELECT id FROM websites WHERE organization_id IN (SELECT auth.user_org_ids())
  ));

-- ── mcp_events ─────────────────────────────────────────────────────────────

ALTER TABLE mcp_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view their MCP events"
  ON mcp_events FOR SELECT
  USING (organization_id IN (SELECT auth.user_org_ids()));

CREATE POLICY "Org members can insert MCP events"
  ON mcp_events FOR INSERT
  WITH CHECK (organization_id IN (SELECT auth.user_org_ids()));

-- ── usage_events ───────────────────────────────────────────────────────────

ALTER TABLE usage_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view their usage events"
  ON usage_events FOR SELECT
  USING (organization_id IN (SELECT auth.user_org_ids()));

CREATE POLICY "Org members can insert usage events"
  ON usage_events FOR INSERT
  WITH CHECK (organization_id IN (SELECT auth.user_org_ids()));

-- ── generation_jobs ────────────────────────────────────────────────────────

ALTER TABLE generation_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view their generation jobs"
  ON generation_jobs FOR SELECT
  USING (organization_id IN (SELECT auth.user_org_ids()));

CREATE POLICY "Org members can insert generation jobs"
  ON generation_jobs FOR INSERT
  WITH CHECK (organization_id IN (SELECT auth.user_org_ids()));

CREATE POLICY "Org members can update their generation jobs"
  ON generation_jobs FOR UPDATE
  USING (organization_id IN (SELECT auth.user_org_ids()));

-- ── generation_job_items ───────────────────────────────────────────────────

ALTER TABLE generation_job_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can manage items for their generation jobs"
  ON generation_job_items FOR ALL
  USING (job_id IN (
    SELECT id FROM generation_jobs WHERE organization_id IN (SELECT auth.user_org_ids())
  ));

-- ── users ──────────────────────────────────────────────────────────────────
-- Users can only see/edit their own record

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
