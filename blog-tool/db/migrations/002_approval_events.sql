-- Migration: Add approval events table and approval_comment column to articles

-- Store approval/rejection history per article
CREATE TABLE approval_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    article_id UUID REFERENCES articles(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(50) NOT NULL, -- 'submitted' | 'approved' | 'rejected'
    comment TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_approval_events_article ON approval_events(article_id);
CREATE INDEX idx_approval_events_org ON approval_events(organization_id);

-- Add approval_comment to articles for the most recent rejection reason
ALTER TABLE articles ADD COLUMN IF NOT EXISTS approval_comment TEXT;

-- RLS for approval_events
ALTER TABLE approval_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view their approval events"
  ON approval_events FOR SELECT
  USING (organization_id IN (SELECT auth.user_org_ids()));

CREATE POLICY "Org members can insert approval events"
  ON approval_events FOR INSERT
  WITH CHECK (organization_id IN (SELECT auth.user_org_ids()));
