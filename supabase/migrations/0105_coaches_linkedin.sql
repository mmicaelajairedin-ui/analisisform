-- Add optional linkedin field to coaches table
-- Allows coaches to add their LinkedIn profile URL (optional)

ALTER TABLE coaches ADD COLUMN linkedin TEXT;

-- Index for uniqueness validation if needed
CREATE INDEX IF NOT EXISTS idx_coaches_linkedin ON coaches(linkedin)
WHERE linkedin IS NOT NULL;
