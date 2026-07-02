-- ============================================================
-- Crear un PERFIL EMPLEADO (equipo comercial) — plantilla genérica
-- ============================================================
-- Un "empleado" NO es coach: no tiene clientes ni panel de coach.
-- Con rol='empleado', al iniciar sesión login/auth-callback lo mandan a
-- /empleado.html — panel con: Email templates · Mi firma · Chat con Micaela.
--
-- El acceso es 100% por ROL: creás la fila con rol='empleado' y ya entra.
-- No hay lista de emails en el código, así que sirve para CUALQUIER empleado.
--
-- Ejecutar en el SQL Editor de Supabase. Cambiá email y nombre.
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
  'EMAIL_DEL_EMPLEADO',          -- ej: gonzaloalcalde@pathwaycareercoach.com
  'empleado',
  'NOMBRE DEL EMPLEADO',         -- ej: Gonzalo Alcalde
  true,
  '{"puesto":"comercial"}'::jsonb
)
ON CONFLICT (email) DO UPDATE
  SET rol = 'empleado',
      nombre = COALESCE(usuarios.nombre, EXCLUDED.nombre),
      activo = true;

-- PASO 2 — Verificación
SELECT id, email, nombre, rol, activo
FROM usuarios
WHERE email = 'EMAIL_DEL_EMPLEADO';

-- ============================================================
-- CÓMO ENTRA EL EMPLEADO
-- ============================================================
-- A) Si el email usa Google (Workspace o Gmail):
--    login.html → "Continuar con Google" → cae directo en /empleado.html.
--
-- B) Con email + contraseña:
--    Supabase → Authentication → Users → "Add user" con ese email + contraseña.
--    Después entra por login.html con ese email y contraseña.
--    (La fila de usuarios de arriba ya define su rol = empleado.)
-- ============================================================
