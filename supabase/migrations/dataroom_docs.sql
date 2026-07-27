-- Data-room de inversores: documentos auto-gestionables desde inversores.html
-- La coach (admin) sube documentos con título desde la propia página; los
-- inversores habilitados (dataroom_permitidos) los ven y abren.
--
-- ⚠️ NOTA DE SEGURIDAD (leer): este esquema usa la anon key pública (igual que
-- el resto del portal). El "gate" por email es SUAVE: cualquiera con la anon key
-- podría leer la lista y, técnicamente, escribir. Para material MUY sensible,
-- el paso siguiente es: bucket PRIVADO + Edge Function que valide el email y
-- devuelva signed URLs, y escritura sólo vía Edge Function con un secreto de
-- admin. Este esquema iguala el nivel de seguridad del dossier actual (que ya
-- exponía todo a cualquiera con el archivo), no lo empeora.

create table if not exists dataroom_docs (
  id          bigserial primary key,
  titulo      text not null,
  descripcion text,
  meta        text,                       -- etiqueta corta, ej. "PDF · 3 min"
  url         text not null,              -- URL pública del archivo (o link externo)
  tipo        text default 'doc',         -- 'doc' | 'demo'
  orden       int  default 100,           -- para ordenar las tarjetas
  created_at  timestamptz default now()
);

alter table dataroom_docs enable row level security;

-- Lectura de la lista (los inversores ven las tarjetas). Gate suave por email
-- en el frontend, igual que dataroom_permitidos/dataroom_accesos.
drop policy if exists dataroom_docs_read on dataroom_docs;
create policy dataroom_docs_read on dataroom_docs for select using (true);

-- Alta/baja desde el panel admin (anon). Ver nota de seguridad arriba.
drop policy if exists dataroom_docs_insert on dataroom_docs;
create policy dataroom_docs_insert on dataroom_docs for insert with check (true);
drop policy if exists dataroom_docs_delete on dataroom_docs;
create policy dataroom_docs_delete on dataroom_docs for delete using (true);

-- ── Storage: bucket público "dataroom" para los archivos subidos ──
insert into storage.buckets (id, name, public)
values ('dataroom','dataroom', true)
on conflict (id) do nothing;

drop policy if exists "dataroom read"  on storage.objects;
create policy "dataroom read"  on storage.objects for select using (bucket_id = 'dataroom');
drop policy if exists "dataroom write" on storage.objects;
create policy "dataroom write" on storage.objects for insert with check (bucket_id = 'dataroom');

-- ── Lista de acceso (dataroom_permitidos): gestionable desde el panel admin ──
-- La tabla ya existía para el gate; abrimos lectura/alta/baja (mismo nivel de
-- gate suave). Ver nota de seguridad de arriba.
create table if not exists dataroom_permitidos (
  email text primary key,
  created_at timestamptz default now()
);
alter table dataroom_permitidos enable row level security;
drop policy if exists dataroom_permitidos_read   on dataroom_permitidos;
create policy dataroom_permitidos_read   on dataroom_permitidos for select using (true);
drop policy if exists dataroom_permitidos_insert on dataroom_permitidos;
create policy dataroom_permitidos_insert on dataroom_permitidos for insert with check (true);
drop policy if exists dataroom_permitidos_delete on dataroom_permitidos;
create policy dataroom_permitidos_delete on dataroom_permitidos for delete using (true);

-- Seed opcional: la demo interactiva (link externo), para que no arranque vacío.
insert into dataroom_docs (titulo, descripcion, meta, url, tipo, orden)
select 'Demo interactiva','Recorré la plataforma real —tareas, progreso, sesiones y gamificación— sin registro.','Demo · 4 min','https://demo.arcade.software/S497IIt6F5RXuKNAqAAg?embed','demo',10
where not exists (select 1 from dataroom_docs where tipo='demo');
