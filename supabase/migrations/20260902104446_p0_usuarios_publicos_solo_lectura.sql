-- P0 · `usuarios_publicos` deja de ser escribible por `anon` y `authenticated`.
--
-- QUE SE MIDIO, contra produccion y en SOLO LECTURA (2026-09-02)
--
--   is_updatable ......................... YES
--   is_insertable_into ................... YES
--   columnas escribibles ................. 12 de 13, incluida `rol`
--   check_option ......................... NONE
--   reloptions (security_invoker) ........ NULL  → la vista corre como su dueno
--   dueno de la vista .................... postgres
--   dueno de `usuarios` .................. postgres
--   usuarios.relforcerowsecurity ......... false
--   postgres.rolbypassrls ................ true
--   privilegios de `anon` sobre la vista . los SIETE (arwdDxt)
--   privilegios de `authenticated` ....... los SIETE
--   triggers INSTEAD OF .................. 0
--   reglas ............................... solo _RETURN
--   consumidores de ESCRITURA en el repo . 0
--
-- POR QUE ES P0
-- La vista no es `security_invoker`, asi que accede a `usuarios` con la
-- identidad de su DUENO (`postgres`). `usuarios` tiene RLS activa pero SIN
-- FORCE, y ademas `postgres` tiene BYPASSRLS: por esta via las 11 politicas de
-- `usuarios` NO se evaluan, y tampoco los grants por columna de `anon`. Con
-- `check_option = NONE`, un UPDATE puede ademas sacar la fila del WHERE de la
-- vista. Resultado: `rol` era escribible con la anon key —publica por diseno—
-- sin pasar por ninguna politica. No se ejecuto ningun exploit para medirlo:
-- todo lo de arriba sale de catalogos (pg_class, pg_policies, pg_default_acl,
-- information_schema.views).
--
-- QUE NO SE TOCA, A PROPOSITO
-- SELECT se CONSERVA para anon y authenticated: de el dependen los 5
-- consumidores —soy-candidato.html, soy-candidato-en.html, coaches.html,
-- coaches-en.html, reservar.html—, todos GET. Ninguno escribe.
-- NO se aplica `security_invoker`: rompería el directorio publico, porque las
-- unicas politicas SELECT de `usuarios` en produccion exigen `auth.uid()`, y
-- para `anon` eso es NULL → 0 filas. Necesita antes una politica de directorio
-- que hoy NO esta aplicada. Queda declarado, no resuelto aqui.
-- NO se aplica WITH CHECK OPTION: sin escritura no hay nada que comprobar, y
-- por si sola dejaria abierto el paso a rol='admin' (esta dentro del WHERE).
-- NO se toca FORCE ROW LEVEL SECURITY: con BYPASSRLS en `postgres` no cerraria
-- esta via. Ninguna politica de `usuarios` se modifica. Ninguna funcion.
-- Ninguna otra vista. Ningun otro objeto.
--
-- E1 · LA CAUSA SISTEMICA
-- Los seis privilegios de escritura no los concedio `usuarios_publicos_view.sql`
-- (ese fichero solo da SELECT): los heredo de `pg_default_acl`, que concede los
-- ocho a `anon`/`authenticated` en toda relacion nueva de `public`. Es la cuarta
-- vez que este patron muerde (INC-041, INC-047, C-2a y esto), y las tres
-- anteriores se parchearon una a una. Aqui se corta para lo que venga.
--
-- ALCANCE REAL DE E1: cubre solo las relaciones creadas por `postgres`, que es
-- como conecta `supabase db push`. Hay una SEGUNDA entrada de default ACL a
-- nombre de `supabase_admin` que NO se puede tocar desde aqui (`postgres` no es
-- miembro de ese rol). Queda declarada, no resuelta.
--
-- EFECTO EN MIGRACIONES FUTURAS: desde aqui, una tabla nueva NO nace escribible
-- por anon/authenticated. La migracion que la cree debe conceder explicitamente
-- lo que necesite. Es el comportamiento buscado, pero es un cambio de convencion.
--
-- SIN `begin`/`commit` explicitos: `supabase db push` ya ejecuta cada migracion
-- dentro de su propia transaccion.
--
-- IDEMPOTENTE: revocar lo ya revocado es un no-op. Vuelta atras al final.

-- ── A · barrera primaria ──────────────────────────────────────────────────
revoke insert, update, delete, truncate, references, trigger
  on table public.usuarios_publicos from anon;

revoke insert, update, delete, truncate, references, trigger
  on table public.usuarios_publicos from authenticated;

-- ── E1 · causa sistemica (solo relaciones NUEVAS creadas por `postgres`) ──
alter default privileges for role postgres in schema public
  revoke insert, update, delete, truncate, references, trigger on tables from anon;

alter default privileges for role postgres in schema public
  revoke insert, update, delete, truncate, references, trigger on tables from authenticated;

-- VUELTA ATRAS (no ejecutar salvo para revertir deliberadamente):
--   grant insert, update, delete, truncate, references, trigger
--     on table public.usuarios_publicos to anon;
--   grant insert, update, delete, truncate, references, trigger
--     on table public.usuarios_publicos to authenticated;
--   alter default privileges for role postgres in schema public
--     grant insert, update, delete, truncate, references, trigger on tables to anon;
--   alter default privileges for role postgres in schema public
--     grant insert, update, delete, truncate, references, trigger on tables to authenticated;
