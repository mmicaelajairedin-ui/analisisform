-- ===================================================================
-- Add org_id and indices to citas table for network/multicoach support
--
-- Network coaches need to see:
-- 1. Personal citas (coach_id = their ID, 1:1 sessions)
-- 2. Group citas (org_id = their org_id, grupal=true, classes/webinars)
--
-- This migration adds the org_id foreign key (if missing) and indices
-- for fast filtering by (org_id, grupal, inicio).
-- ===================================================================

-- Add org_id column if it doesn't exist
ALTER TABLE citas
ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizaciones(id) ON DELETE CASCADE;

-- Populate org_id from candidatos for existing citas
-- (matches citas.email to candidatos.email to get org_id)
UPDATE citas
SET org_id = (
  SELECT c.org_id
  FROM candidatos c
  WHERE LOWER(c.email) = LOWER(citas.email)
  LIMIT 1
)
WHERE org_id IS NULL AND email IS NOT NULL;

-- Create indices for fast filtering by org_id and grupal
CREATE INDEX IF NOT EXISTS idx_citas_org_id
  ON citas(org_id);

CREATE INDEX IF NOT EXISTS idx_citas_org_grupal
  ON citas(org_id, grupal, inicio DESC);

CREATE INDEX IF NOT EXISTS idx_citas_coach_grupal
  ON citas(coach_id, grupal, inicio DESC);

-- Composite index: fast filtering for "coach's personal + group citas"
-- Used by panel-v2 to load: WHERE coach_id=X OR (org_id=Y AND grupal=true)
CREATE INDEX IF NOT EXISTS idx_citas_coach_org_grupal
  ON citas(coach_id, org_id, grupal, inicio DESC);
