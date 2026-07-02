-- ============================================================
-- Crear usuario EMPLEADO — Gonzalo Alcalde (equipo comercial)
-- ============================================================
-- Un "empleado" NO es coach: no tiene clientes ni panel de coach.
-- Al iniciar sesión, login/auth-callback lo mandan a /empleado.html,
-- un panel con: Email templates · Mi firma · Chat con Micaela.
--
-- Email ÚNICO del empleado: gonzaloalcalde@pathwaycareercoach.com
-- (Si además quisiera una cuenta de coach en el futuro, es aparte y no
--  interfiere con esta.)
--
-- Ejecutar en el SQL Editor de Supabase.
-- ============================================================

-- (Opcional) Si la columna `rol` tiene un CHECK que no incluye 'empleado',
-- el INSERT fallará. Mirá la definición del constraint:
--   SELECT conname, pg_get_constraintdef(oid)
--   FROM pg_constraint
--   WHERE conrelid = 'usuarios'::regclass AND contype = 'c';
-- y recreálo agregando 'empleado' a la lista de roles permitidos.

-- PASO 1 — Crear (o actualizar) la fila del empleado.
INSERT INTO usuarios (email, rol, nombre, activo, configuracion)
VALUES (
  'gonzaloalcalde@pathwaycareercoach.com',
  'empleado',
  'Gonzalo Alcalde',
  true,
  '{"puesto":"comercial"}'::jsonb
)
ON CONFLICT (email) DO UPDATE
  SET rol = 'empleado',
      nombre = COALESCE(usuarios.nombre, EXCLUDED.nombre),
      activo = true;

-- ============================================================
-- VERIFICACIÓN
-- ============================================================
SELECT id, email, nombre, rol, activo
FROM usuarios
WHERE email = 'gonzaloalcalde@pathwaycareercoach.com';

-- ============================================================
-- CÓMO ENTRA GONZALO
-- ============================================================
-- Con el email de Pathway hay 2 formas según cómo esté ese buzón:
--
-- A) Si pathwaycareercoach.com usa Google Workspace:
--    → login.html → "Continuar con Google" con gonzaloalcalde@pathwaycareercoach.com
--    → cae directo en /empleado.html.
--
-- B) Con email + contraseña (sin Google):
--    → Supabase → Authentication → Users → "Add user"
--    → email: gonzaloalcalde@pathwaycareercoach.com  +  contraseña.
--    → Después entra por login.html con ese email y contraseña.
--    (La fila de usuarios de arriba ya define su rol = empleado.)
-- ============================================================
