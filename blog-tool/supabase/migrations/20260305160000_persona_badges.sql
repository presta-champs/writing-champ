-- Persona badges for quick identification and filtering
ALTER TABLE personas
  ADD COLUMN IF NOT EXISTS badges TEXT[] DEFAULT '{}';

-- GIN index for efficient array queries (filtering by badge)
CREATE INDEX IF NOT EXISTS idx_personas_badges ON personas USING GIN (badges);
