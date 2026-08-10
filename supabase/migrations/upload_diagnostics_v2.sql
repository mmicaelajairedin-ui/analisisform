-- Upload Diagnostics v2: Enhanced error tracking with environment, commit, and classification
--
-- Extends upload_diagnostics with: correlation_id, environment, frontend_commit, backend_commit,
-- upload_type, error_code for comprehensive error lifecycle tracking (DETECTED → TRIAGED → FIXED → VERIFIED)

-- Add new columns to upload_diagnostics
ALTER TABLE IF EXISTS upload_diagnostics
ADD COLUMN IF NOT EXISTS correlation_id UUID DEFAULT gen_random_uuid(),
ADD COLUMN IF NOT EXISTS environment TEXT DEFAULT 'unknown', -- production | staging | preview | local
ADD COLUMN IF NOT EXISTS frontend_commit TEXT DEFAULT 'UNKNOWN', -- git commit hash from HTML
ADD COLUMN IF NOT EXISTS backend_commit TEXT DEFAULT 'UNKNOWN', -- edge function deployment SHA
ADD COLUMN IF NOT EXISTS upload_type TEXT DEFAULT 'unknown', -- avatar | exercise | document
ADD COLUMN IF NOT EXISTS error_code TEXT DEFAULT 'UNKNOWN'; -- ERR_* code for classification

-- Index for error triage and diagnosis
CREATE INDEX IF NOT EXISTS upload_diagnostics_correlation_idx
ON upload_diagnostics(correlation_id);

CREATE INDEX IF NOT EXISTS upload_diagnostics_environment_idx
ON upload_diagnostics(environment);

CREATE INDEX IF NOT EXISTS upload_diagnostics_error_code_idx
ON upload_diagnostics(error_code);

CREATE INDEX IF NOT EXISTS upload_diagnostics_commit_idx
ON upload_diagnostics(frontend_commit, backend_commit);

-- Update RLS policies if they exist
-- Anon can insert diagnostics (for error reporting from browser)
DROP POLICY IF EXISTS "upload_diagnostics_anon_insert" ON upload_diagnostics;
CREATE POLICY "upload_diagnostics_anon_insert" ON upload_diagnostics
FOR INSERT TO anon, authenticated
WITH CHECK (true);

-- Admin only can select and view all diagnostics
DROP POLICY IF EXISTS "upload_diagnostics_admin_read" ON upload_diagnostics;
CREATE POLICY "upload_diagnostics_admin_read" ON upload_diagnostics
FOR SELECT TO authenticated
USING (auth.jwt() ->> 'role' = 'admin');

-- Enable RLS
ALTER TABLE upload_diagnostics ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE upload_diagnostics
IS 'Error telemetry for file uploads: tracks causes, environment, commits for regression prevention';

COMMENT ON COLUMN upload_diagnostics.correlation_id
IS 'UUID to link related errors from same session (tester-bot error -> triage -> registry)';

COMMENT ON COLUMN upload_diagnostics.environment
IS 'Deployment environment: production (pathwaycareercoach.com) | staging | preview | local';

COMMENT ON COLUMN upload_diagnostics.frontend_commit
IS 'Git commit hash of deployed frontend code (from meta name=frontend-commit)';

COMMENT ON COLUMN upload_diagnostics.backend_commit
IS 'Git commit hash of deployed edge functions (from X-Backend-Commit header)';

COMMENT ON COLUMN upload_diagnostics.upload_type
IS 'Classification: avatar (coach photo) | exercise (coach gym photo) | document (PDF/Word)';

COMMENT ON COLUMN upload_diagnostics.error_code
IS 'Standardized error code: ERR-UPLOAD-001, ERR-UPLOAD-002, ERR-ENV-001, etc.';
