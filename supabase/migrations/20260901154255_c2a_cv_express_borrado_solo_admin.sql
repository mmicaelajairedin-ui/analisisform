-- C-2a · `cv_express` deja de ser borrable por `anon`.
--
-- ULTIMO PASO. Requiere que 1/3 (admin-express-op) y 2/3 (admin-express.html)
-- esten YA desplegados: este retira el privilegio del que el consumidor viejo
-- dependia. Al reves, el admin se queda sin poder borrar durante el despliegue.
--
-- QUE SE MIDIO, contra produccion y en solo lectura (2026-09-01)
--
--   politicas permisivas de borrado ... 1  → «anon delete cv_express»
--                                        USING(true), roles = {anon}
--   politicas restrictivas ........... 0
--   filas alcanzables ................ 14 de 14  (USING(true) no filtra)
--   privilegios de `anon` ............ los OCHO (arwdDxtm)
--   filas con paid_at ................ 14 de 14  → son Packs comprados
--
-- La autorizacion real era `localStorage.mj_user.rol==='admin'` en el
-- navegador (admin-express.html:101) y el DELETE iba con la anon key, que
-- esta en el propio fichero, linea 80, y es publica por diseno.
--
-- POR QUE NO BASTA EL `drop policy`
-- `anon` tiene ademas TRUNCATE, y PostgreSQL NO evalua RLS en un TRUNCATE:
-- la RLS filtra filas y TRUNCATE no mira filas. Sin revocarlo, la tabla se
-- vacia entera aunque la politica caiga. Es la tercera vez en este proyecto
-- (INC-041 en las tablas de Programas, INC-047 en mc_novedades) y la causa
-- es `pg_default_acl`: toda tabla nueva nace con los ocho concedidos.
--
-- QUE NO SE TOCA, A PROPOSITO
-- SELECT, INSERT y UPDATE de `anon` se CONSERVAN: dependen de ellos cv.html,
-- carta.html, cv-express.html, linkedin-viewer.html y panel-v2.html. Su
-- riesgo es otro frente (grantAccess concede Packs con la anon key) y queda
-- declarado, no resuelto aqui.
--
-- `service_role` conserva todo: es quien borrara, despues de que la Edge
-- Function verifique que quien llama es admin. `postgres` no se toca.
-- No se revoca EXECUTE de ninguna funcion: eso es INC-006.
--
-- SIN `begin`/`commit` explicitos: `supabase db push` ya ejecuta cada
-- migracion dentro de su propia transaccion.
--
-- IDEMPOTENTE. Vuelta atras al final, en comentario.

drop policy if exists "anon delete cv_express" on public.cv_express;

revoke delete, truncate on table public.cv_express from anon;
revoke delete, truncate on table public.cv_express from authenticated;

-- VUELTA ATRAS (no ejecutar salvo para revertir deliberadamente):
--   grant delete on table public.cv_express to anon;
--   create policy "anon delete cv_express" on public.cv_express
--     as permissive for delete to anon using (true);
--   (No repone TRUNCATE: nunca hizo falta para nada.)
