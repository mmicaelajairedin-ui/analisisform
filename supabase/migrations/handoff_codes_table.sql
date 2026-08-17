-- Tabla temporal para códigos de handoff de sesión (Pathway → MultiCoach)
create table if not exists public.handoff_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  user_id uuid not null references auth.users(id) on delete cascade,
  org_id text,
  created_at timestamp with time zone default now(),
  expires_at timestamp with time zone not null,
  used_at timestamp with time zone,
  is_valid boolean default true,

  -- Índices para búsqueda y limpieza
  constraint handoff_code_not_expired check (expires_at > now()),
  constraint handoff_code_not_used check (used_at is null or is_valid = false)
);

create index if not exists idx_handoff_codes_code on public.handoff_codes(code);
create index if not exists idx_handoff_codes_user_id on public.handoff_codes(user_id);
create index if not exists idx_handoff_codes_expires_at on public.handoff_codes(expires_at);

-- RLS: nadie puede leer/escribir directamente, solo la Edge Function
alter table public.handoff_codes enable row level security;

create policy "handoff_codes_no_access" on public.handoff_codes
  for all using (false) with check (false);

-- Permitir solo a funciones autenticadas (SECURITY DEFINER)
grant all on public.handoff_codes to postgres;
