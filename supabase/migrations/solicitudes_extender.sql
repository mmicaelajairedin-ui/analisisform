-- Migration — extender `solicitudes` para soportar servicios custom
-- del array configuracion.servicios + mensaje opcional del candidato.
--
-- Antes la tabla asumía solo 2 servicios fijos ("sesion" / "mentoria")
-- con precios desde cfg.precio_sesion / cfg.precio_mentoria. Ahora el
-- candidato compra desde el perfil público del coach donde se listan
-- todos los servicios de configuracion.servicios; necesitamos guardar
-- cuál servicio + (opcional) un mensaje del candidato como contexto
-- para que el coach decida aceptar o rechazar la solicitud.
--
-- Aplicar una vez en Supabase SQL editor.

ALTER TABLE solicitudes
  ADD COLUMN IF NOT EXISTS servicio_idx     integer,    -- índice en cfg.servicios (0,1,2,...) — null si vino del flujo viejo
  ADD COLUMN IF NOT EXISTS servicio_titulo  text,       -- nombre del servicio cacheado al momento de compra (sobrevive a renombres del coach)
  ADD COLUMN IF NOT EXISTS mensaje          text;       -- mensaje opcional del candidato al pedir el servicio
