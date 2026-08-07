-- Tabla de diagnóstico para errores de upload a Storage
-- Registra automáticamente: status HTTP, mensaje del servidor, plataforma del usuario
-- Permite debugging sin depender de que el cliente abra la consola

create table if not exists upload_diagnostics (
  id bigint primary key generated always as identity,
  ts timestamptz default now(),

  -- Identificación del usuario
  user_email text,
  user_id uuid,

  -- Contexto de la petición
  bucket text not null,  -- 'docs', 'avatars', etc
  file_name text,
  file_size bigint,
  detected_mime_type text,

  -- Resultado HTTP
  http_status integer,  -- 400, 403, 415, etc
  http_status_text text,
  response_body text,  -- primeros 500 caracteres

  -- Plataforma
  user_agent text,
  platform text,  -- 'ios', 'android', 'web', 'capacitor'

  -- Trazabilidad
  step text,  -- 'storage_request', 'storage_response', 'file_select', etc
  error_message text,

  -- Metadata para debugging
  endpoint_url text,
  headers_sent jsonb  -- sin exponer secrets
);

-- Índices para queries de debugging
create index if not exists idx_upload_diag_ts on upload_diagnostics(ts desc);
create index if not exists idx_upload_diag_email on upload_diagnostics(user_email);
create index if not exists idx_upload_diag_status on upload_diagnostics(http_status);
create index if not exists idx_upload_diag_bucket on upload_diagnostics(bucket);
create index if not exists idx_upload_diag_platform on upload_diagnostics(platform);

-- RLS: Anon solo INSERT (no puede leer)
-- Admin puede leer para debugging
alter table upload_diagnostics enable row level security;

drop policy if exists "upload_diagnostics_anon_insert" on upload_diagnostics;
create policy "upload_diagnostics_anon_insert"
  on upload_diagnostics for insert
  to anon, authenticated
  with check (true);  -- Todos pueden registrar errores

drop policy if exists "upload_diagnostics_admin_read" on upload_diagnostics;
create policy "upload_diagnostics_admin_read"
  on upload_diagnostics for select
  to authenticated
  using (
    -- Admin (rol admin o email específico) puede leer todos
    (select auth.jwt() -> 'user_metadata' ->> 'admin')::boolean = true
    or auth.jwt() ->> 'email' in ('micaela@pathwaycareercoach.com', 'mmicaela.jairedin@gmail.com')
  );

-- Grant permisos a anon key para INSERT
grant insert on upload_diagnostics to anon, authenticated;
grant select on upload_diagnostics to authenticated;
