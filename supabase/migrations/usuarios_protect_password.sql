-- ============================================================================
-- Fase 4 del cierre de RLS — Proteger usuarios.password_hash (la única columna
-- sensible de la tabla usuarios)
-- ============================================================================
-- GAP que cierra: hoy, con la anon key (pública en el JS), cualquiera puede
--   fetch('/rest/v1/usuarios?select=email,password_hash')  y bajarse TODOS los
-- hashes de contraseña (SHA-256, crackeables offline).
--
-- POR QUÉ NO prendemos RLS completo en usuarios:
--   usuarios alimenta el DIRECTORIO PÚBLICO de coaches, el intake (crea el login
--   del cliente), el registro de coaches y el login. Prender RLS ahí romperia
--   varios flujos públicos. El ÚNICO dato sensible es password_hash, así que en
--   vez de RLS de fila, usamos permisos a NIVEL COLUMNA: nadie (anon ni
--   authenticated) puede LEER password_hash; el resto de columnas sigue legible.
--
-- ⚠️ ORDEN DE ROLLOUT (igual de estricto que rls_strict.sql):
--   1) Deploy del frontend nuevo (login.html que NO lee password_hash + panel
--      que usa la función pw_tiene_pass). El login nuevo funciona IGUAL antes y
--      después de esta migración (verifica vía Supabase Auth), así que se puede
--      deployar y verificar primero, sin tocar la base.
--   2) Verificar en producción: login de coach, login de cliente, alta por el
--      formulario, "crear acceso" de un cliente desde el panel.
--   3) Recién entonces correr ESTE archivo en Supabase → SQL Editor.
--   4) Re-verificar lo mismo + el candado (abajo). Si algo falla → ROLLBACK.
--
-- NOTA: service_role (edge functions: migrate-user-to-auth, etc.) NO se ve
--   afectado — bypassa estos permisos y sigue leyendo password_hash server-side.
-- ============================================================================

-- ── 1) Cortar la lectura de password_hash para anon y authenticated ──────────
-- En Postgres un GRANT SELECT a nivel TABLA cubre todas las columnas y un REVOKE
-- por columna no puede "restarle". Por eso: revocamos el SELECT de tabla y
-- re-otorgamos SELECT columna por columna EXCEPTO password_hash. El bloque es
-- dinámico → no hay que enumerar columnas y aguanta cambios de esquema futuros.
REVOKE SELECT ON public.usuarios FROM anon, authenticated;

-- ⚠️ IMPORTANTE: este DO block (el re-grant por columna) DEBE correr junto con el
-- REVNoKE de arriba. Si se corre solo el REVOKE, anon/authenticated quedan SIN
-- lectura de NINGUNA columna → "permission denied for table usuarios" → se rompe
-- el LOGIN (lee el perfil tras autenticar) y el DIRECTORIO público. Correr SIEMPRE
-- el archivo completo. (Pasó en el rollout del 2026-06-16: se aplicó el REVOKE sin
-- el GRANT y hubo que re-correr este bloque para restaurar la lectura.)
DO $$
DECLARE col text;
BEGIN
  FOR col IN
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'usuarios'
      AND column_name <> 'password_hash'
  LOOP
    EXECUTE format('GRANT SELECT (%I) ON public.usuarios TO anon, authenticated', col);
  END LOOP;
END $$;

-- INSERT / UPDATE / DELETE quedan intactos (no se tocan): el intake, el registro
-- y el panel siguen pudiendo crear/actualizar el password_hash (lo escriben, no
-- lo leen). Solo bloqueamos la LECTURA.

-- ── 2) Función para que el panel sepa si un cliente ya tiene contraseña ──────
-- El panel mostraba "tiene acceso" leyendo password_hash (ahora prohibido).
-- Esta función SECURITY DEFINER devuelve solo un booleano, nunca el hash.
CREATE OR REPLACE FUNCTION public.pw_tiene_pass(p_email text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM usuarios
    WHERE lower(email) = lower(p_email)
      AND password_hash IS NOT NULL
      AND password_hash <> ''
  )
$$;

-- Solo coaches/clientes logueados (authenticated). NO anon, para no permitir
-- enumerar qué emails tienen cuenta.
REVOKE ALL ON FUNCTION public.pw_tiene_pass(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pw_tiene_pass(text) TO authenticated;

-- ============================================================================
-- VERIFICACIÓN (correr como anon)
-- ============================================================================
-- Esto AHORA debe FALLAR (permiso denegado sobre la columna) o devolver vacío:
--   SELECT password_hash FROM usuarios LIMIT 1;
-- Esto debe seguir ANDANDO (directorio público de coaches):
--   SELECT id, nombre, foto_url FROM usuarios WHERE rol='coach' AND activo;

-- ============================================================================
-- ROLLBACK (si algo se rompe, re-habilita la lectura y listo)
-- ============================================================================
-- GRANT SELECT ON public.usuarios TO anon, authenticated;
-- DROP FUNCTION IF EXISTS public.pw_tiene_pass(text);
