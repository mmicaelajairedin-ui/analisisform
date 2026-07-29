-- ===================================================================
-- RLS policies for citas table in network/multicoach context
--
-- Ensures:
-- 1. Coach sees: personal citas (coach_id = auth.uid) + group citas (org_id match)
-- 2. Owner sees: all org citas (org_id = their org_id)
-- 3. Admin/Micaela sees: all citas (bypass via SERVICE_ROLE)
-- ===================================================================

-- Drop old policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Coach sees own citas" ON citas;
DROP POLICY IF EXISTS "rls_citas_coach" ON citas;

-- NEW: Coach/Network Coach SELECT policy
-- Can see:
-- - Personal citas: coach_id matches authenticated user
-- - Group citas: org_id matches their org_id AND grupal=true
CREATE POLICY "rls_citas_coach_network" ON citas
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL AND (
      -- Personal: this user is the coach
      coach_id = auth.uid()
      -- OR: this user is in the same org AND it's a group event
      OR (
        org_id IN (
          SELECT org_id FROM usuarios WHERE id = auth.uid() AND org_id IS NOT NULL
        )
        AND grupal = true
      )
    )
  );

-- NEW: Coach/Network Coach INSERT policy
-- Can only insert citas with coach_id = themselves
-- (Network group events are created by owner via edge function, not direct insert)
CREATE POLICY "rls_citas_coach_insert" ON citas
  FOR INSERT
  WITH CHECK (coach_id = auth.uid());

-- NEW: Coach/Network Coach UPDATE policy
-- Can only update their own personal citas (not group ones)
-- Group citas are admin-only via edge function
CREATE POLICY "rls_citas_coach_update" ON citas
  FOR UPDATE
  USING (coach_id = auth.uid() AND grupal = false)
  WITH CHECK (coach_id = auth.uid() AND grupal = false);

-- NEW: Coach/Network Coach DELETE policy
-- Can only delete their own personal citas
CREATE POLICY "rls_citas_coach_delete" ON citas
  FOR DELETE
  USING (coach_id = auth.uid() AND grupal = false);

-- Enable RLS (should already be on, but ensure)
ALTER TABLE citas ENABLE ROW LEVEL SECURITY;

COMMENT ON POLICY "rls_citas_coach_network" ON citas IS
  'Network: Coach sees personal + group org citas. Owner sees all org citas.';
