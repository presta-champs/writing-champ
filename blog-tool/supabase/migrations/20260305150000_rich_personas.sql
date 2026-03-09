-- Rich persona fields for deep personality/voice configuration
ALTER TABLE personas
  ADD COLUMN IF NOT EXISTS voice_principles JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS sentence_rules_do JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS sentence_rules_dont JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS structural_patterns JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS recurring_themes JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS example_passages JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS system_prompt_override TEXT,
  ADD COLUMN IF NOT EXISTS methodology TEXT,
  ADD COLUMN IF NOT EXISTS tone_authority VARCHAR(255),
  ADD COLUMN IF NOT EXISTS tone_brand_loyalty INT DEFAULT 50,
  ADD COLUMN IF NOT EXISTS seo_heading_style VARCHAR(255),
  ADD COLUMN IF NOT EXISTS seo_meta_tone VARCHAR(255),
  ADD COLUMN IF NOT EXISTS seo_article_length_min INT DEFAULT 800,
  ADD COLUMN IF NOT EXISTS seo_article_length_max INT DEFAULT 2000,
  ADD COLUMN IF NOT EXISTS is_builtin BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS builtin_slug VARCHAR(100);

-- Index for finding built-in personas quickly
CREATE INDEX IF NOT EXISTS idx_personas_builtin ON personas(is_builtin) WHERE is_builtin = TRUE;
