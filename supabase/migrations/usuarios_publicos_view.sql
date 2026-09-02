-- ===================================================================
-- usuarios_publicos_view.sql — Vista PÚBLICA del coach (sin secretos).
--
-- El directorio de coaches, el perfil público y la página de reservas necesitan
-- mostrar datos del coach (nombre, foto, bio, servicios, precios, slug…). Hasta
-- ahora los leían de la tabla `usuarios` con la anon key, lo que exponía la
-- `configuracion` COMPLETA — incluido el token de Google Calendar. Esta vista
-- expone SOLO lo público y le SACA a `configuracion` las claves sensibles.
--
-- Claves que se quitan (secretos, no van al público):
--   · gcal / google          → token de Google Calendar (credencial real)
--   · verification_token      → token de confirmación de email
--   · access_code             → código de acceso al formulario de intake
--
-- Se deja el resto (servicios, precios, especialidades, slug, tipos de cita,
-- etc.), que es lo que las páginas públicas usan para mostrar al coach.
--
-- La vista corre con los privilegios de su dueño → devuelve las filas públicas
-- sin depender del RLS de `usuarios`. Le damos SELECT a anon y authenticated.
-- Cuando el frontend lea de acá (etapa 2), podremos cerrar la lectura directa de
-- `configuracion` en `usuarios` para anónimos (etapa 3) sin romper nada.
--
-- Deploy: se aplica sola al mergear a main (workflow supabase-migrations).
-- ===================================================================

CREATE OR REPLACE VIEW public.usuarios_publicos AS
SELECT
  id, nombre, email, foto_url, nombre_practica, bio, slug,
  titulo_profesional, perfil_publico_activo, rol, activo, created_at,
  (COALESCE(configuracion, '{}'::jsonb)
     - 'gcal' - 'google' - 'verification_token' - 'access_code') AS configuracion
FROM public.usuarios
WHERE rol IN ('coach','admin') OR (rol = 'empleado' AND activo IS TRUE);

-- READ-ONLY EXPLÍCITO. La vista es SECURITY DEFINER (owner con BYPASSRLS): sin
-- esto, un anon/authenticated con los privilegios de escritura que heredan de
-- `pg_default_acl` (R-55) podría escribir en `usuarios` saltándose su RLS,
-- incluida `rol` → escalada a admin. Se REVOCA antes de conceder para que una
-- recreación desde cero NUNCA vuelva a conceder escritura por los defaults.
-- La barrera activa en producción es `usuarios_publicos_view_readonly.sql`;
-- esto es su equivalente para un reset. (P0 usuarios_publicos writable-view.)
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN
  ON public.usuarios_publicos
  FROM anon, authenticated;

GRANT SELECT ON public.usuarios_publicos TO anon, authenticated;
