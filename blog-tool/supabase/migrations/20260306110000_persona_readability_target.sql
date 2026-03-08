-- Add configurable Flesch-Kincaid readability target per article
ALTER TABLE articles
  ADD COLUMN IF NOT EXISTS readability_target smallint DEFAULT 50;

COMMENT ON COLUMN articles.readability_target IS 'Flesch-Kincaid reading ease target (20-80). Higher = easier to read. Default 50.';
