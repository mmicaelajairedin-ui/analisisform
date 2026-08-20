-- account_deletion_requests.sql
-- COMPLIANCE FIX: Apple requirement "apps that create accounts must offer deletion"
--
-- Implements self-service account deletion with 24-hour cooldown to prevent accidents.
-- User initiates deletion (password confirmation), gets 24h to cancel, then auto-deletes.
--
-- Apply once in Supabase.

CREATE TABLE IF NOT EXISTS account_deletion_requests (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  usuario_id UUID NOT NULL UNIQUE,  -- Unique: only 1 pending deletion per user
  auth_id UUID NOT NULL,             -- Link to Supabase Auth user
  email TEXT NOT NULL,
  requested_at TIMESTAMPTZ DEFAULT now(),
  scheduled_delete_at TIMESTAMPTZ NOT NULL,  -- 24 hours later
  cancelled_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,

  CONSTRAINT fk_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS account_deletion_by_user ON account_deletion_requests(usuario_id);
CREATE INDEX IF NOT EXISTS account_deletion_pending ON account_deletion_requests(scheduled_delete_at) WHERE deleted_at IS NULL AND cancelled_at IS NULL;

-- RLS: Users can only request/cancel their own deletion
ALTER TABLE account_deletion_requests ENABLE ROW LEVEL SECURITY;

-- Users can INSERT their own deletion request
DROP POLICY IF EXISTS deletion_insert ON account_deletion_requests;
CREATE POLICY deletion_insert ON account_deletion_requests
  FOR INSERT WITH CHECK (
    auth.uid()::text = usuario_id::text OR
    EXISTS (SELECT 1 FROM usuarios WHERE id = usuario_id AND auth_id = auth.uid())
  );

-- Users can UPDATE (cancel) their own deletion
DROP POLICY IF EXISTS deletion_cancel ON account_deletion_requests;
CREATE POLICY deletion_cancel ON account_deletion_requests
  FOR UPDATE WITH CHECK (
    auth.uid()::text = usuario_id::text OR
    EXISTS (SELECT 1 FROM usuarios WHERE id = usuario_id AND auth_id = auth.uid())
  );

-- Service role (cron job) can UPDATE completed deletions
DROP POLICY IF EXISTS deletion_execute ON account_deletion_requests;
CREATE POLICY deletion_execute ON account_deletion_requests
  FOR UPDATE USING (true);  -- Service role bypasses RLS

-- Users can SELECT their own deletion request
DROP POLICY IF EXISTS deletion_select ON account_deletion_requests;
CREATE POLICY deletion_select ON account_deletion_requests
  FOR SELECT WITH CHECK (
    auth.uid()::text = usuario_id::text OR
    EXISTS (SELECT 1 FROM usuarios WHERE id = usuario_id AND auth_id = auth.uid())
  );

-- ========================================================================
-- Helper function: schedule account deletion (called from frontend)
-- ========================================================================
CREATE OR REPLACE FUNCTION schedule_account_deletion(p_usuario_id UUID)
RETURNS JSON AS $$
DECLARE
  v_usuario usuarios%ROWTYPE;
  v_scheduled_at TIMESTAMPTZ;
  v_request account_deletion_requests%ROWTYPE;
BEGIN
  -- Verify user exists and matches auth.uid()
  SELECT * INTO v_usuario FROM usuarios WHERE id = p_usuario_id AND auth_id = auth.uid();
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Usuario no encontrado o sin permisos');
  END IF;

  -- Check if deletion already scheduled
  SELECT * INTO v_request FROM account_deletion_requests
    WHERE usuario_id = p_usuario_id AND cancelled_at IS NULL AND deleted_at IS NULL;
  IF FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Eliminación ya programada. Cancela la anterior primero.');
  END IF;

  -- Schedule deletion in 24 hours
  v_scheduled_at := now() + INTERVAL '24 hours';

  INSERT INTO account_deletion_requests (usuario_id, auth_id, email, scheduled_delete_at)
  VALUES (p_usuario_id, auth.uid(), v_usuario.email, v_scheduled_at)
  RETURNING * INTO v_request;

  RETURN json_build_object(
    'success', true,
    'scheduled_at', v_request.requested_at,
    'delete_at', v_request.scheduled_delete_at,
    'message', 'Tu cuenta se eliminará en 24 horas. Puedes cancelar en cualquier momento.'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========================================================================
-- Helper function: cancel account deletion
-- ========================================================================
CREATE OR REPLACE FUNCTION cancel_account_deletion(p_usuario_id UUID)
RETURNS JSON AS $$
DECLARE
  v_rows_updated INT;
BEGIN
  -- Verify user owns this request
  UPDATE account_deletion_requests
  SET cancelled_at = now()
  WHERE usuario_id = p_usuario_id
    AND cancelled_at IS NULL
    AND deleted_at IS NULL
    AND EXISTS (SELECT 1 FROM usuarios WHERE id = p_usuario_id AND auth_id = auth.uid());

  GET DIAGNOSTICS v_rows_updated = ROW_COUNT;

  IF v_rows_updated = 0 THEN
    RETURN json_build_object('success', false, 'error', 'No hay eliminación programada para cancelar');
  END IF;

  RETURN json_build_object(
    'success', true,
    'message', 'Eliminación cancelada. Tu cuenta se mantiene activa.'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========================================================================
-- Helper function: execute account deletion (called by cron job)
-- Run hourly: SELECT execute_account_deletions();
-- ========================================================================
CREATE OR REPLACE FUNCTION execute_account_deletions()
RETURNS TABLE(deleted_count INT, error_msg TEXT) AS $$
DECLARE
  v_deleted INT := 0;
  v_error TEXT := NULL;
  v_deletion_request account_deletion_requests%ROWTYPE;
BEGIN
  -- Find all accounts scheduled for deletion (24h passed)
  FOR v_deletion_request IN
    SELECT * FROM account_deletion_requests
    WHERE scheduled_delete_at <= now()
      AND cancelled_at IS NULL
      AND deleted_at IS NULL
    LIMIT 100  -- Process in batches
  LOOP
    BEGIN
      -- BEGIN TRANSACTION: Delete user data atomically

      -- 1. Delete sessions (invalidate all tokens)
      DELETE FROM auth.sessions WHERE user_id = v_deletion_request.auth_id;

      -- 2. Delete API refresh tokens
      DELETE FROM auth.refresh_tokens WHERE user_id = v_deletion_request.auth_id;

      -- 3. Anonymize chats (keep audit trail)
      UPDATE contactos_chat
      SET contacto = '[DELETED]'
      WHERE id IN (SELECT id FROM contactos_chat WHERE email = v_deletion_request.email);

      -- 4. Unlink clients (if coach) - mark as sin_coach
      UPDATE candidatos
      SET coach_id = NULL
      WHERE coach_id = v_deletion_request.usuario_id;

      -- 5. Delete CVs
      DELETE FROM cv_publicados WHERE email = v_deletion_request.email;

      -- 6. Delete informes
      DELETE FROM informes WHERE email = v_deletion_request.email;

      -- 7. Delete notificaciones
      DELETE FROM notificaciones WHERE usuario_id = v_deletion_request.usuario_id;

      -- 8. Mark usuario como deleted (preserve audit)
      UPDATE usuarios
      SET
        email = '[DELETED]-' || v_deletion_request.usuario_id::text,
        nombre = '[DELETED]',
        activo = false,
        password_hash = NULL,
        configuracion = NULL
      WHERE id = v_deletion_request.usuario_id;

      -- 9. Delete Supabase Auth user
      -- Note: This requires service role. If not available, just mark as deleted above.
      -- DELETE FROM auth.users WHERE id = v_deletion_request.auth_id;

      -- 10. Mark request as completed
      UPDATE account_deletion_requests
      SET deleted_at = now()
      WHERE id = v_deletion_request.id;

      v_deleted := v_deleted + 1;

    EXCEPTION WHEN OTHERS THEN
      v_error := COALESCE(v_error, '') || 'Error deleting user ' || v_deletion_request.usuario_id::text || ': ' || SQLERRM || '; ';
      -- Continue processing other deletions instead of failing entire batch
    END;
  END LOOP;

  RETURN QUERY SELECT v_deleted, v_error;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========================================================================
-- Audit log: Insert into client_errors when accounts are deleted
-- ========================================================================
CREATE OR REPLACE TRIGGER audit_account_deletion
AFTER UPDATE ON account_deletion_requests
FOR EACH ROW
WHEN (NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL)
EXECUTE FUNCTION (
  BEGIN
    INSERT INTO client_errors (kind, detail, page, email, ts)
    VALUES (
      'account_deletion_completed',
      'Cuenta eliminada: ' || NEW.usuario_id::text,
      '/account/deleted',
      NEW.email,
      now()
    );
    RETURN NEW;
  END
)$;

-- Manual schedule (if needed before cron is set up):
-- SELECT execute_account_deletions();
