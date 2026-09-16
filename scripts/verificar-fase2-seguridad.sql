-- ============================================================================
-- Verificador de estado EFECTIVO · cierre de seguridad Fase 2 (2026-09-16)
-- ============================================================================
--
--   psql "$DATABASE_URL" -f scripts/verificar-fase2-seguridad.sql
--
-- Comprueba, contra el catalogo de la base VIVA, que las dos migraciones de
-- este cierre estan aplicadas Y que no se llevaron por delante nada legitimo.
--
-- FALLA CERRADO: cualquier desvio lanza excepcion y el script sale en rojo.
-- No imprime OK salvo que las nueve comprobaciones pasen.
--
-- Mide COMPORTAMIENTO EFECTIVO con has_*_privilege, no la presencia de una
-- cadena en un fichero: una migracion no esta aplicada porque alguien la haya
-- ejecutado, lo esta cuando el catalogo lo dice (R-69); y verificar presencia
-- no es verificar comportamiento (R-27).
--
-- ROJO ANTES / VERDE DESPUES (R-49). Sobre la base SIN las migraciones, medido
-- el 2026-09-16 con esta misma consulta: la comprobacion 1 falla sola —anon
-- conserva EXECUTE— y la 4 devuelve 424 pares (tabla, rol, privilegio) vivos
-- sobre 55 de las 59 tablas de public. Con las dos migraciones aplicadas, 9/9.
-- ============================================================================

DO $$
DECLARE
  v_malos text := '';
  v_n int;
  rec record;
BEGIN
  ----------------------------------------------------------------------------
  -- 1 · LA ENUMERACION YA NO FUNCIONA: anon no puede invocar el oraculo.
  --     Es la comprobacion que el encargo pedia. Si anon conserva EXECUTE,
  --     POST /rest/v1/rpc/pw_tiene_pass sigue contestando "si esa cuenta
  --     existe" a cualquiera que tenga la clave publica, que va en el bundle.
  ----------------------------------------------------------------------------
  IF has_function_privilege('anon', 'public.pw_tiene_pass(text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'FALLO 1 · anon TODAVIA puede ejecutar pw_tiene_pass(text): la enumeracion de cuentas sigue abierta';
  END IF;

  ----------------------------------------------------------------------------
  -- 2 · Y no se rompio el flujo legitimo: panel-v2.html:14429 la llama con
  --     _hdr(), o sea con el JWT del usuario (rol authenticated). Si esto
  --     falla, un coach deja de poder saber si su cliente ya tiene acceso.
  ----------------------------------------------------------------------------
  IF NOT has_function_privilege('authenticated', 'public.pw_tiene_pass(text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'FALLO 2 · authenticated PERDIO EXECUTE sobre pw_tiene_pass(text): se revoco de mas y panel-v2 queda roto';
  END IF;

  ----------------------------------------------------------------------------
  -- 3 · Tampoco se le devolvio a PUBLIC, de donde lo quito en su dia
  --     usuarios_protect_password.sql.
  ----------------------------------------------------------------------------
  IF has_function_privilege('public', 'public.pw_tiene_pass(text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'FALLO 3 · PUBLIC recupero EXECUTE sobre pw_tiene_pass(text)';
  END IF;

  ----------------------------------------------------------------------------
  -- 4 · Los cuatro privilegios sobrantes, fuera de TODAS las tablas de public
  --     y para los dos roles de la API. TRUNCATE es el que importa: PostgreSQL
  --     no evalua RLS en un TRUNCATE (R-55, por cuarta vez).
  --     Se recorre el catalogo, no una lista escrita a mano: una tabla nueva
  --     que herede la baraja tiene que poner esto en rojo.
  ----------------------------------------------------------------------------
  FOR rec IN
    SELECT c.relname::text AS tabla, r.rolname::text AS rol, p AS priv
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
     CROSS JOIN unnest(ARRAY['TRUNCATE','REFERENCES','TRIGGER','MAINTAIN']) AS p
     CROSS JOIN unnest(ARRAY['anon','authenticated']) AS r(rolname)
     WHERE n.nspname = 'public' AND c.relkind = 'r'
       AND has_table_privilege(r.rolname, c.oid, p)
  LOOP
    v_malos := v_malos || format('%s/%s/%s ', rec.tabla, rec.rol, rec.priv);
  END LOOP;
  IF v_malos <> '' THEN
    RAISE EXCEPTION 'FALLO 4 · privilegios sobrantes vivos: %', v_malos;
  END IF;

  ----------------------------------------------------------------------------
  -- 5 · CONTRAPRUEBA. No basta con que los cuatro se hayan ido: hay que
  --     demostrar que no se revoco de mas. Estas seis son rutas de producto
  --     que HOY funcionan y que un REVOKE torpe habria matado. Si alguna
  --     falla, la migracion se llevo por delante el producto y no la defensa.
  ----------------------------------------------------------------------------
  v_malos := '';
  IF NOT has_table_privilege('anon','public.candidatos','INSERT')      THEN v_malos := v_malos||'anon/candidatos/INSERT '; END IF;
  IF NOT has_table_privilege('anon','public.client_errors','INSERT')   THEN v_malos := v_malos||'anon/client_errors/INSERT '; END IF;
  IF NOT has_table_privilege('anon','public.leads','INSERT')           THEN v_malos := v_malos||'anon/leads/INSERT '; END IF;
  IF NOT has_table_privilege('anon','public.usuarios','INSERT')        THEN v_malos := v_malos||'anon/usuarios/INSERT '; END IF;
  IF NOT has_table_privilege('authenticated','public.usuarios','SELECT') THEN v_malos := v_malos||'authenticated/usuarios/SELECT '; END IF;
  IF NOT has_table_privilege('anon','public.usuarios_publicos','SELECT') THEN v_malos := v_malos||'anon/usuarios_publicos/SELECT '; END IF;
  IF v_malos <> '' THEN
    RAISE EXCEPTION 'FALLO 5 · se revoco de mas, rutas de producto sin privilegio: %', v_malos;
  END IF;

  ----------------------------------------------------------------------------
  -- 6 · Ninguna politica de RLS invoca pw_tiene_pass. Es la condicion que hace
  --     seguro revocarle EXECUTE a un rol: PostgreSQL evalua una politica con
  --     los privilegios de QUIEN consulta, y revocar ahi tumba el producto
  --     entero (INC-006).
  ----------------------------------------------------------------------------
  SELECT count(*) INTO v_n FROM pg_policies
   WHERE schemaname = 'public'
     AND (coalesce(qual,'') LIKE '%pw_tiene_pass%' OR coalesce(with_check,'') LIKE '%pw_tiene_pass%');
  IF v_n > 0 THEN
    RAISE EXCEPTION 'FALLO 6 · % politica(s) de RLS invocan pw_tiene_pass: revocar EXECUTE las deja sin poder evaluarse (INC-006)', v_n;
  END IF;

  ----------------------------------------------------------------------------
  -- 7 · La RLS de usuarios sigue activa. Es lo que sostiene que el GET directo
  --     a /rest/v1/usuarios?email=eq.X no sea un segundo oraculo, mas rico que
  --     el RPC porque devolveria id, rol, nombre y configuracion.
  ----------------------------------------------------------------------------
  SELECT count(*) INTO v_n FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public' AND c.relname = 'usuarios' AND c.relrowsecurity;
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'FALLO 7 · usuarios se quedo SIN RLS activa: el GET por email vuelve a ser un oraculo';
  END IF;

  ----------------------------------------------------------------------------
  -- 8 · Y anon sigue sin poder leer usuarios, ni por privilegio ni por
  --     politica. Las dos unicas politicas de SELECT que le alcanzan comparan
  --     una columna con una expresion que sin JWT es NULL. Si aparece una
  --     tercera con otra forma, o si le conceden SELECT, hay que volver a
  --     mirar esto a mano antes de darlo por cerrado.
  ----------------------------------------------------------------------------
  IF has_table_privilege('anon', 'public.usuarios', 'SELECT') THEN
    RAISE EXCEPTION 'FALLO 8a · anon recupero SELECT sobre usuarios: hay un oraculo de enumeracion mas rico que el RPC';
  END IF;
  SELECT count(*) INTO v_n FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'usuarios' AND cmd = 'SELECT'
     AND (roles::text LIKE '%anon%' OR roles::text LIKE '%public%')
     AND coalesce(qual,'') NOT IN ('(auth_id = auth.uid())',
                                   '(email = (auth.jwt() ->> ''email''::text))');
  IF v_n > 0 THEN
    RAISE EXCEPTION 'FALLO 8b · hay % politica(s) de SELECT sobre usuarios alcanzables por anon con una forma nueva: revisar si reabren la enumeracion', v_n;
  END IF;

  ----------------------------------------------------------------------------
  -- 9 · CANARIO. Si el verificador no puede medir, no puede aprobar (R-77).
  --     pg_read_file esta revocada a anon en cualquier proyecto sano; medido
  --     en produccion el 2026-09-16 y devuelve false. Si aqui saliera true,
  --     has_function_privilege no estaria midiendo lo que creemos.
  ----------------------------------------------------------------------------
  IF has_function_privilege('anon', 'pg_catalog.pg_read_file(text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'FALLO 9 · el canario paso: has_function_privilege no mide lo que se cree, o anon tiene mucho mas de lo que deberia';
  END IF;

  RAISE NOTICE 'OK 9/9 · enumeracion cerrada para anon, flujo authenticated intacto, privilegios sobrantes retirados sin tocar DML';
END $$;
