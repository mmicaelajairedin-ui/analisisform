-- Remove linkedin column from coaches table
-- Coaches don't need to store LinkedIn in their profile

ALTER TABLE coaches DROP COLUMN IF EXISTS linkedin;

DROP INDEX IF EXISTS idx_coaches_linkedin;
