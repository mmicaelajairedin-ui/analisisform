-- ════════════════════════════════════════════════════════════════════════════
-- P0 · usuarios_publicos writable-view / RLS bypass / admin-role escalation
--
-- BARRERA MÍNIMA (A). Deja `usuarios_publicos` en SOLO LECTURA para anon y
-- authenticated. NO toca la definición de la vista, NO toca `security_invoker`,
-- NO toca ninguna política de `usuarios`, NO toca FORCE RLS, NO toca funciones.
-- Solo ACLs de la vista.
--
-- QUÉ CIERRA. La vista es SECURITY DEFINER (owner `postgres`, con BYPASSRLS) y
-- es actualizable/insertable/borrable. anon y authenticated tenían sobre ella
-- el juego completo de privilegios, así que con la anon key pública se podía
-- escribir en `usuarios` SALTÁNDOSE su RLS — incluida la columna `rol`, lo que
-- alcanza el gate de admin (`rol='admin'`). Sin los privilegios de escritura,
-- PostgREST no puede escribir por la vista. La lectura del directorio público
-- —lo único que usan los 5 consumidores— se conserva intacta.
--
-- POR QUÉ ES UNA MIGRACIÓN NUEVA Y NO SE EDITA LA QUE CREA LA VISTA:
-- `supabase db push` solo aplica migraciones que no están en el historial
-- remoto, así que editar `usuarios_publicos_view.sql` NO cambiaría producción
-- (ya está aplicada). Aquella se corrige aparte, para reproducibilidad en un
-- reset; ESTA es la barrera que se aplica ahora.
--
-- POR QUÉ REVOKE EXPLÍCITO Y NO CONFÍA EN LOS DEFAULTS. Estos privilegios NO
-- los concedió ninguna migración: los heredó la vista de `pg_default_acl` al
-- crearse. Es R-55 aplicado a una vista (misma causa que INC-041/047/073). Por
-- eso se revoca el conjunto entero, incluido MAINTAIN, que la lista original no
-- nombraba pero que también sobra para dejar «SELECT únicamente».
--
-- IDEMPOTENTE y sin DROP: se puede volver a aplicar sin efecto.
-- Deploy: se aplica sola al mergear a main (workflow supabase-migrations).
-- ════════════════════════════════════════════════════════════════════════════

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN
  ON public.usuarios_publicos
  FROM anon, authenticated;

-- Se reafirma la única capacidad legítima. No revoca nada; asegura que SELECT
-- queda aunque este script se aplique sobre un estado ya endurecido.
GRANT SELECT ON public.usuarios_publicos TO anon, authenticated;
