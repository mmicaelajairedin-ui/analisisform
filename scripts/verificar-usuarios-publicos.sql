-- ════════════════════════════════════════════════════════════════════════════
-- GUARDRAIL · P0 usuarios_publicos writable-view / RLS bypass / admin escalation
--
-- Comprueba el ESTADO EFECTIVO de los privilegios sobre `public.usuarios_publicos`,
-- NO una cadena en una migración (R-27, R-102): lee `pg_class.relacl` con
-- `aclexplode`, que es lo que la base aplica de verdad.
--
-- SOLO SELECT, repetible, no escribe nada.
--
-- Se ejecuta ANTES y DESPUÉS de la barrera:
--   · ANTES  → los criterios 1-2 FALLAN (anon/authenticated tienen escritura).
--   · DESPUÉS → los cuatro PASAN.
--
-- Autofallido: si queda cualquier privilegio de escritura, hace RAISE EXCEPTION,
-- así `psql -v ON_ERROR_STOP=1` sale con código ≠ 0 y un CI se pone en rojo.
--
-- Comprueba las DOS direcciones, que es lo que lo hace útil (R-55, y la lección
-- de INC-041): que el agujero esté cerrado, Y que la lectura del directorio
-- —lo único que usan los 5 consumidores GET— siga funcionando. Un guardrail
-- que solo mira lo primero da verde con el producto roto.
-- ════════════════════════════════════════════════════════════════════════════

\pset border 2

with privs as (
  select a.grantee::regrole::text as rol, a.privilege_type
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace,
       lateral aclexplode(c.relacl) a
  where n.nspname = 'public' and c.relname = 'usuarios_publicos'
),
checks as (
  -- 1 · anon sin NINGÚN privilegio de escritura (los 7 que sobran).
  select 1 as n,
         'anon sin escritura (INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER/MAINTAIN)' as comprobacion,
         'true' as esperado,
         (select not exists(
            select 1 from privs
            where rol='anon'
              and privilege_type in ('INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER','MAINTAIN')
          )::text) as obtenido

  -- 2 · authenticated, lo mismo.
  union all select 2,
         'authenticated sin escritura',
         'true',
         (select not exists(
            select 1 from privs
            where rol='authenticated'
              and privilege_type in ('INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER','MAINTAIN')
          )::text)

  -- 3, 4 · AL REVÉS: la lectura del directorio NO se rompió.
  union all select 3,
         'anon conserva la lectura (directorio publico)',
         'true',
         (select exists(select 1 from privs where rol='anon' and privilege_type='SELECT')::text)

  union all select 4,
         'authenticated conserva la lectura',
         'true',
         (select exists(select 1 from privs where rol='authenticated' and privilege_type='SELECT')::text)
)
select n, comprobacion, esperado, obtenido,
       case when esperado = obtenido then 'PASA' else 'FALLA' end as estado
from checks
order by n;

-- Corte duro: si algún criterio falla, la ejecución termina con error.
do $$
declare
  escritura_abierta boolean;
  lectura_rota boolean;
begin
  select exists(
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace,
         lateral aclexplode(c.relacl) a
    where n.nspname='public' and c.relname='usuarios_publicos'
      and a.grantee::regrole::text in ('anon','authenticated')
      and a.privilege_type in ('INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER','MAINTAIN')
  ) into escritura_abierta;

  select not (
    exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace,
                   lateral aclexplode(c.relacl) a
            where n.nspname='public' and c.relname='usuarios_publicos'
              and a.grantee::regrole::text='anon' and a.privilege_type='SELECT')
    and
    exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace,
                   lateral aclexplode(c.relacl) a
            where n.nspname='public' and c.relname='usuarios_publicos'
              and a.grantee::regrole::text='authenticated' and a.privilege_type='SELECT')
  ) into lectura_rota;

  if escritura_abierta then
    raise exception 'GUARDRAIL usuarios_publicos: anon/authenticated tienen privilegios de ESCRITURA sobre la vista. P0 writable-view reabierto.';
  end if;
  if lectura_rota then
    raise exception 'GUARDRAIL usuarios_publicos: se rompio la LECTURA del directorio (falta SELECT a anon/authenticated).';
  end if;
  raise notice 'GUARDRAIL usuarios_publicos: OK — solo lectura, directorio intacto.';
end $$;
