-- Add external SEO grading toggle to organizations
-- When true, the SEO checker will also call Surfer SEO (if an API key is set).

ALTER TABLE organizations
  ADD COLUMN external_seo_enabled BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN organizations.external_seo_enabled
  IS 'When true, the SEO audit includes an external Surfer SEO content score.';
