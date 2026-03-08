-- Organization-level editorial guidelines
-- These sit above persona voice in the prompt hierarchy and ensure consistency.
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS editorial_pov VARCHAR(20) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS editorial_person_rules TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS editorial_commercial_tone TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS editorial_dos JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS editorial_donts JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS editorial_custom_rules TEXT DEFAULT NULL;

COMMENT ON COLUMN organizations.editorial_pov IS 'Default POV: first_person, second_person, third_person';
COMMENT ON COLUMN organizations.editorial_person_rules IS 'Detailed POV instructions, e.g. "Never refer to the company as we"';
COMMENT ON COLUMN organizations.editorial_commercial_tone IS 'Commercial language policy, e.g. "Avoid salesy language" or "Position products positively"';
COMMENT ON COLUMN organizations.editorial_dos IS 'Array of editorial rules: things all writers must always do';
COMMENT ON COLUMN organizations.editorial_donts IS 'Array of editorial rules: things all writers must never do';
COMMENT ON COLUMN organizations.editorial_custom_rules IS 'Free-form additional editorial guidelines';
