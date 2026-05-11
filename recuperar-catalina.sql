-- ============================================================
-- Recuperar a Catalina: activar trial sin tarjeta
-- ============================================================
-- Catalina (catalina.dc@gmail.com) se registró antes del cambio a
-- trial-sin-tarjeta. Su cuenta quedó con activo=false porque abandonó
-- el paso de Stripe. Este script la activa con 14 días de trial sin
-- pedirle tarjeta — alineado con el nuevo modelo.
--
-- Cómo usar:
--   1. Supabase Dashboard → SQL Editor → New query
--   2. Pegá este archivo → Run
--   3. Verificá la fila al final
--
-- Después: mandale el mensaje WhatsApp/mail desde Mica.
-- ============================================================

UPDATE usuarios
SET
  activo = true,
  configuracion = COALESCE(configuracion, '{}'::jsonb) || jsonb_build_object(
    'plan',                'basic',
    'estado_sub',          'prueba',
    'visible_directorio',  true,
    'max_candidatos',      5,
    'fecha_fin_prueba',    (NOW() + INTERVAL '14 days')::text,
    'recuperada_manual',   true,
    'sin_tarjeta',         true,
    'recuperada_at',       NOW()::text
  )
WHERE email = 'catalina.dc@gmail.com';

-- Verificación: debería devolver 1 fila con activo=t y trial activo
SELECT
  email,
  nombre,
  activo,
  configuracion->>'plan'              AS plan,
  configuracion->>'estado_sub'        AS estado_sub,
  configuracion->>'fecha_fin_prueba'  AS fin_trial,
  configuracion->>'sin_tarjeta'       AS sin_tarjeta
FROM usuarios
WHERE email = 'catalina.dc@gmail.com';

-- (Opcional) Borrar el mail recovery_5min de Catalina del queue, por si
-- todavía no se envió y no queremos que le llegue:
-- DELETE FROM email_queue
-- WHERE to_email = 'catalina.dc@gmail.com'
--   AND plantilla_id = 'recovery_5min';
