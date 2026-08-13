-- ═══════════════════════════════════════════════════════════════════════
-- Migration: RLS INSERT policy for usuarios (allow auth user to create own row)
-- ═══════════════════════════════════════════════════════════════════════
-- PROBLEMA: Cuando un usuario nuevo se registra por Google/Apple OAuth,
-- el frontend intenta hacer INSERT a usuarios con auth_id = auth.uid().
-- Sin esta política, el INSERT falla con "permission denied for table usuarios"
-- incluso aunque el usuario esté autenticado.
--
-- SOLUCIÓN: Agregar política de INSERT que permita a un usuario autenticado
-- insertar solo su propia fila (where auth_id = auth.uid()).
--
-- APLICAR EN: Supabase SQL Editor de la cuenta de producción
-- ═══════════════════════════════════════════════════════════════════════

-- Policy: Un usuario autenticado puede insertar su propia fila
CREATE POLICY "usuarios_insert_own_row"
  ON usuarios
  FOR INSERT
  TO authenticated
  WITH CHECK (auth_id = auth.uid());

COMMENT ON POLICY "usuarios_insert_own_row" ON usuarios IS
  'Un usuario autenticado (vía OAuth o email) puede crear su propia fila en usuarios, donde auth_id debe coincidir con su UID en auth.users.';

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
-- Si falla, verificar:
--   1. Que RLS esté habilitado en usuarios: ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;
--   2. Que el JWT contiene el auth.uid() correcto (comparar con SELECT auth.uid();)
--   3. Que no hay otras políticas de INSERT más restrictivas
