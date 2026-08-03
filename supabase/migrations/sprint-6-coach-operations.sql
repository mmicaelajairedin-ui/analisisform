-- Sprint 6: Coach Operations (reassign clients, block availability)
-- UUID: 20260803_001_coach_operations

-- FUNCTION: reassign_clients(from_coach_id, to_coach_id)
-- Moves all clients from one coach to another
-- Used in: multicoach.html _equipoReasignarConfirm()
CREATE OR REPLACE FUNCTION reassign_clients(from_coach uuid, to_coach uuid)
RETURNS TABLE(success boolean, reassigned_count int) AS $$
DECLARE
  v_reassigned int := 0;
BEGIN
  -- Update all candidatos where coach_id = from_coach to to_coach
  UPDATE candidatos
  SET coach_id = to_coach,
      updated_at = now()
  WHERE coach_id = from_coach AND deleted_at IS NULL;

  GET DIAGNOSTICS v_reassigned = ROW_COUNT;

  RETURN QUERY SELECT TRUE, v_reassigned;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- GRANT: Allow authenticated users to call reassign_clients
-- Owner can reassign any coach's clients
-- Coaches cannot call this (permission via motor checks)
GRANT EXECUTE ON FUNCTION reassign_clients(uuid, uuid) TO authenticated, anon;

-- RLS POLICY: Coach operations audit trail
-- Optional: Log all reassignments for compliance
-- CREATE TABLE coach_operations_audit (
--   id BIGSERIAL PRIMARY KEY,
--   operation TEXT NOT NULL, -- 'reassign', 'block', 'unblock'
--   performed_by UUID REFERENCES usuarios(id),
--   coach_from UUID REFERENCES usuarios(id),
--   coach_to UUID REFERENCES usuarios(id),
--   details JSONB,
--   created_at TIMESTAMPTZ DEFAULT now()
-- );

-- This migration is idempotent — function recreate is safe
