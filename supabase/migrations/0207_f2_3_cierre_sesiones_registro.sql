-- F2.3 (parcial, alcance autorizado) — Cierre de seguridad de sesiones_registro.
--
-- Estado previo: RLS DESHABILITADA y grants completos para anon/authenticated
-- sobre una tabla que guarda datos de sesiones de clientes (14 filas). Medido:
-- el rol anon leia las 14.
--
-- Es seguro AHORA y no depende de D-1 (A vs B): el unico escritor del repo es
-- pw-scheduler.js, que vive detras de `USE_NEW_SCHEDULER=false`
-- (panel-v2.html:1451, verificado). Ninguna edge function ni pantalla la lee.
--
-- Se cierra sin politicas a proposito: hasta que D-1 defina el modelo de
-- sesiones, el unico acceso legitimo es service_role. Anadir politicas ahora
-- seria prejuzgar esa decision.
--
-- NO se toca el esquema ni los datos de la tabla (fuera de alcance).
-- NO se toca ranking_mensual: tiene lector vivo (panel-v2.html:10828) y no
-- estaba en el alcance autorizado.

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.sesiones_registro FROM anon, authenticated;
ALTER TABLE public.sesiones_registro ENABLE ROW LEVEL SECURITY;
