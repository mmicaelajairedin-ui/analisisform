-- ════════════════════════════════════════════════════════════════════════════
-- C-2a · Verificación. SOLO `SELECT`, repetible, no escribe nada.
--
-- Se ejecuta ANTES y DESPUÉS de `0001`. Antes debe dar FALLA en los cuatro
-- primeros; después, PASA en los siete.
--
-- POR QUÉ COMPARA CONJUNTOS EXACTOS Y NO «¿tiene permisos?» (R-27, R-55):
-- la verificación de INC-041 preguntaba si `authenticated` tenía privilegios,
-- y con TRUNCATE puesto respondía que sí y daba verde. Una comprobación de
-- presencia no ve lo que SOBRA. Aquí se compara el conjunto entero.
--
-- Y comprueba las dos direcciones, que es lo que la hace útil: que el agujero
-- esté cerrado, Y que los consumidores legítimos sigan pudiendo trabajar. Una
-- verificación que solo mira lo primero da verde con el producto roto.
-- ════════════════════════════════════════════════════════════════════════════

with privs as (
  select a.grantee::regrole::text as rol, a.privilege_type
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace,
       lateral aclexplode(c.relacl) a
  where n.nspname = 'public' and c.relname = 'cv_express'
),
pol as (
  select p.polname, p.polcmd, p.polpermissive
  from pg_policy p join pg_class c on c.oid = p.polrelid
  where c.relname = 'cv_express'
),
checks as (
  -- 1 · Ninguna política deja borrar a nadie por la vía normal.
  select 1 as n,
         'sin politica de borrado' as comprobacion,
         '0' as esperado,
         (select count(*)::text from pol where polcmd = 'd' and polpermissive) as obtenido

  -- 2 · `anon` no puede borrar fila a fila.
  union all select 2,
         'anon sin el privilegio de borrado',
         'false',
         (select exists(select 1 from privs where rol='anon' and privilege_type='DELETE')::text)

  -- 3 · `anon` no puede vaciar la tabla entera. ESTE ES EL QUE LA RLS NO CUBRE.
  union all select 3,
         'anon sin TRUNCATE (la RLS no lo evalua)',
         'false',
         (select exists(select 1 from privs where rol='anon' and privilege_type='TRUNCATE')::text)

  -- 4 · Lo mismo para `authenticated`: un coach con sesion tampoco.
  union all select 4,
         'authenticated sin borrado ni TRUNCATE',
         'false',
         (select exists(select 1 from privs
                        where rol='authenticated'
                          and privilege_type in ('DELETE','TRUNCATE'))::text)

  -- 5, 6 · Y AHORA AL REVES: que no se haya roto lo que sí debe funcionar.
  --        cv.html, carta.html, cv-express.html y linkedin-viewer.html leen y
  --        escriben esta tabla con la anon key. Si esto falla, el producto
  --        está roto aunque el agujero esté cerrado.
  union all select 5,
         'anon conserva lectura',
         'true',
         (select exists(select 1 from privs where rol='anon' and privilege_type='SELECT')::text)

  union all select 6,
         'anon conserva alta y edicion',
         'true',
         (select (count(*) = 2)::text from privs
          where rol='anon' and privilege_type in ('INSERT','UPDATE'))

  -- 7 · Ninguna fila se perdió por el camino.
  union all select 7,
         'las 14 filas siguen ahi',
         '14',
         (select count(*)::text from public.cv_express)
)
select n,
       comprobacion,
       esperado,
       obtenido,
       case when esperado = obtenido then 'PASA' else 'FALLA' end as estado
from checks
order by n;
