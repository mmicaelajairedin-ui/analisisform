-- Informes guardados como ARCHIVOS por cliente (historial que se apila).
-- La tabla `informes` existente guarda UNO por cliente (unique por email) y se
-- pisa al regenerar. Esta tabla nueva permite guardar VARIOS informes por
-- cliente, cada uno como un archivo con su fecha, sin pisar nada.
--
-- Aislamiento: se filtra por coach_id + email (cada coach ve solo los de sus
-- clientes). No mezcla clientes ni coaches. No toca la tabla `informes` actual.
create table if not exists informes_guardados (
  id          bigserial primary key,
  coach_id    uuid,                       -- de quién es el cliente (aislamiento)
  email       text not null,              -- cliente (vínculo por email)
  titulo      text,                       -- ej. "Informe · Sesión 2"
  contenido   jsonb not null,             -- el informe (mismo formato que informes.data)
  created_at  timestamptz default now()
);

-- Búsqueda rápida: los informes de un cliente de un coach, más nuevos primero.
create index if not exists informes_guardados_lookup
  on informes_guardados (coach_id, email, created_at desc);

-- Permisos + RLS (mismo patrón permisivo que `informes`; RLS estricto = Sprint B).
GRANT SELECT, INSERT, UPDATE, DELETE ON public.informes_guardados TO anon, authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
DO $$
BEGIN
  IF to_regclass('public.informes_guardados') IS NOT NULL THEN
    ALTER TABLE public.informes_guardados ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS informes_guardados_anon_all ON public.informes_guardados;
    CREATE POLICY informes_guardados_anon_all ON public.informes_guardados
      FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;
