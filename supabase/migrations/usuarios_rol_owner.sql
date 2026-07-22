-- ===================================================================
-- usuarios_rol_owner — habilita rol='owner' (dueño de red / multicoach)
--
-- La feature multi-coach (organizaciones.sql, login.html → multicoach.html,
-- crear-multicoach) crea al dueño de la red como `usuarios.rol='owner'`. Pero
-- el CHECK constraint original de `usuarios` (usuarios_rol_check) solo permitía
-- 'admin','coach','cliente','empleado' → CUALQUIER alta de owner fallaba con:
--   ERROR: new row for relation "usuarios" violates check constraint "usuarios_rol_check"
-- Es decir: ningún dueño de gimnasio/red se podía crear (ni de prueba ni real).
-- El tester-bot lo detectó al intentar loguear la cuenta del dueño de gym.
--
-- Esto recrea el constraint sumando 'owner'. Es seguro: todas las filas
-- existentes tienen un rol de la lista.
--
-- Aplicar una vez: Supabase Studio → SQL Editor.
-- ===================================================================

ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS usuarios_rol_check;
ALTER TABLE usuarios ADD CONSTRAINT usuarios_rol_check
  CHECK (rol IN ('admin', 'coach', 'cliente', 'empleado', 'owner'));
