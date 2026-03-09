-- Add default AI model column to organizations
-- Nullable: when NULL, users pick a model per-generation (no org-wide default)

ALTER TABLE organizations
  ADD COLUMN default_model TEXT;

COMMENT ON COLUMN organizations.default_model
  IS 'Organization-wide default AI model ID (e.g. claude-sonnet-4-20250514). NULL means no default.';
