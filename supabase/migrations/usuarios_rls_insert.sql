-- ═══════════════════════════════════════════════════════════════════════
-- Migration: RLS INSERT policy for usuarios (allow auth user to create own row)
-- ═══════════════════════════════════════════════════════════════════════
-- PROBLEMA: Cuando un usuario nuevo se registra por Google/Apple OAuth,
-- el frontend intenta hacer INSERT a usuarios con auth_id = auth.uid().
-- Sin esta política, el INSERT falla con "permission denied for table usuarios"
-- incluso aunque el usuario esté autenticado.
--
-- GAP: auth_id es UNIQUE pero NO es NOT NULL. Esto permite:
--   - Filas viejas con auth_id = NULL (migración gradual)
--   - Potencialmente insertar auth_id = NULL si la política no es explícita
--
-- SOLUCIÓN:
-- 1. Agregar política de INSERT que REQUIERA auth_id = auth.uid() (no NULL)
-- 2. Garantizar que nuevos INSERT tengan auth_id NOT NULL (estructura de tabla)
--
-- APLICAR EN: Supabase SQL Editor de la cuenta de producción
-- ═══════════════════════════════════════════════════════════════════════

-- Policy: Un usuario autenticado puede insertar su propia fila
-- ⚠️ IMPORTANTE: WITH CHECK valida AMBAS condiciones:
--   - auth_id NO es NULL
--   - auth_id coincide exactamente con auth.uid()
-- Si falta alguna, el INSERT es rechazado.
CREATE POLICY "usuarios_insert_own_row"
  ON usuarios
  FOR INSERT
  TO authenticated
  WITH CHECK (auth_id IS NOT NULL AND auth_id = auth.uid());

COMMENT ON POLICY "usuarios_insert_own_row" ON usuarios IS
  'Un usuario autenticado (vía OAuth o email) puede crear su propia fila en usuarios, donde auth_id DEBE ser NOT NULL y coincidir con su UID en auth.users. Previene filas incompletas o asignación a otros usuarios.';

-- ─ Verificación ──────────────────────────────────────────────────────────
-- Después de aplicar esta migración, un usuario nuevo debería poder hacer:
--   POST /rest/v1/usuarios
--   {
--     "email": "nuevo@example.com",
--     "auth_id": "<su UUID de auth.uid()>",
--     "rol": "coach",
--     ...
--   }
-- Con Authorization: Bearer <JWT auténtico> (no la anon key).
--
-- CASOS QUE DEBEN FALLAR (401/403):
--   1. Insertar con auth_id = NULL → WITH CHECK (auth_id IS NOT NULL) = FALSE
--   2. Insertar con auth_id de otro usuario → WITH CHECK (auth_id = auth.uid()) = FALSE
--   3. Insertar sin Authorization header → 401 Unauthorized
--
-- Si el insert falla de otra forma, verificar:
--   1. Que RLS esté habilitado: SELECT * FROM pg_tables WHERE tablename='usuarios' AND rowsecurity;
--   2. Que el JWT contiene auth.uid(): SELECT auth.uid(); (en SQL Editor como authenticated)
--   3. Que auth_id en el JSON del POST coincide exactamente con auth.uid() del JWT
