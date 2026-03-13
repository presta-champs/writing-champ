-- Add planner-specific columns to campaigns table
ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS format VARCHAR(100),
  ADD COLUMN IF NOT EXISTS primary_keyword VARCHAR(255),
  ADD COLUMN IF NOT EXISTS secondary_keywords JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS source VARCHAR(50) DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS scheduled_at DATE,
  ADD COLUMN IF NOT EXISTS target_length INTEGER DEFAULT 1500,
  ADD COLUMN IF NOT EXISTS article_id UUID REFERENCES articles(id) ON DELETE SET NULL;

-- Index for calendar queries (scheduled items by month)
CREATE INDEX IF NOT EXISTS idx_campaigns_scheduled ON campaigns(organization_id, scheduled_at)
  WHERE scheduled_at IS NOT NULL;

-- Index for unscheduled ideas
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(organization_id, status)
  WHERE status IN ('idea', 'planned', 'writing', 'approved', 'scheduled', 'done');
