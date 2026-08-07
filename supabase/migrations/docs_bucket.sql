-- Bucket 'docs': documentos que el coach adjunta a una sesión para el cliente
-- (PDF, Word, imágenes, txt). Antes se subían al bucket 'avatars', que está
-- restringido a imágenes → los PDF/Word rebotaban ("No se pudo subir el documento").

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'docs','docs', true, 10485760,   -- público, 10 MB
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'image/png','image/jpeg','image/webp','image/gif'
  ]
)
on conflict (id) do update
  set public = true,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Lectura pública (el cliente abre/descarga el doc desde su portal).
drop policy if exists "docs read" on storage.objects;
create policy "docs read" on storage.objects for select using (bucket_id = 'docs');
-- Subida desde el panel del coach (anon key, mismo nivel que avatars).
drop policy if exists "docs write" on storage.objects;
create policy "docs write" on storage.objects for insert with check (bucket_id = 'docs');
