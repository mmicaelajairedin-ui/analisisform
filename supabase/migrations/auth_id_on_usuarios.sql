-- Fase 1 del cierre de RLS: agrega la columna auth_id a usuarios para
-- linkear cada coach/cliente con su fila en auth.users (Supabase Auth).
--
-- Cómo se llena: el edge function `migrate-user-to-auth` la setea
-- automáticamente cuando un usuario entra al login viejo con su
-- email+contraseña. Después de unos días, casi todos los usuarios
-- activos van a tener auth_id seteado.
--
-- Cuando esté listo (Fase 3) las políticas RLS van a poder ser tipo:
--   USING (auth.uid() = (SELECT auth_id FROM usuarios WHERE id = candidatos.coach_id))
-- o más directo, mapeando candidatos.coach_id contra auth.uid()
-- después de migrar el id raíz.
--
-- Correr una vez en Supabase → SQL Editor.

ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS auth_id UUID UNIQUE;

CREATE INDEX IF NOT EXISTS usuarios_auth_id_idx ON usuarios(auth_id);

-- Diagnóstico: cuántos usuarios todavía no se migraron
-- SELECT count(*) FILTER (WHERE auth_id IS NULL) AS pendientes,
--        count(*) FILTER (WHERE auth_id IS NOT NULL) AS migrados
-- FROM usuarios;
