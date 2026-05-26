-- Trigger Postgres: cada vez que se crea un candidato (sea via formulario,
-- "Sumar un cliente" del panel, o cualquier otra fuente), dispara la edge
-- function `notif-new-client`, que decide si mandar el email según el
-- toggle del coach asignado.
--
-- Requiere la extensión pg_net (viene activada por default en Supabase
-- Pro/Team; en Free puede haber que habilitarla manualmente desde el
-- Database → Extensions).
--
-- Correr una vez en Supabase → SQL Editor.

-- Asegurar que pg_net esté disponible
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Función que el trigger ejecuta. Hace un POST asíncrono (no bloquea el
-- INSERT) a la edge function. Si la function falla por cualquier razón,
-- el INSERT del candidato se completa igual — la notificación es
-- best-effort.
CREATE OR REPLACE FUNCTION pw_notify_new_client()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  fn_url TEXT := 'https://ddxnrsnjdvtqhxunxnwj.supabase.co/functions/v1/notif-new-client';
BEGIN
  PERFORM net.http_post(
    url := fn_url,
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := jsonb_build_object('candidato_id', NEW.id::text)
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Si pg_net falla (extensión deshabilitada, red, etc.) no rompemos el
  -- INSERT del candidato. Solo se pierde la notificación.
  RETURN NEW;
END;
$$;

-- Evitar duplicar el trigger si la migración se corre dos veces
DROP TRIGGER IF EXISTS pw_after_candidato_insert ON candidatos;

CREATE TRIGGER pw_after_candidato_insert
AFTER INSERT ON candidatos
FOR EACH ROW
EXECUTE FUNCTION pw_notify_new_client();

-- Diagnóstico: ver últimas llamadas a la edge function
-- SELECT id, created, url, status_code, response_status, error_msg
-- FROM net._http_response ORDER BY created DESC LIMIT 10;
