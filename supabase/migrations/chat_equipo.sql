-- ============================================================
-- Chat interno del equipo (empleado ↔ admin) — Fase 2
-- ============================================================
-- Un hilo por empleado. Escriben el empleado y el admin (Micaela).
-- Tabla NUEVA, no toca nada existente. Ejecutar en Supabase SQL Editor.
-- ============================================================

create table if not exists mensajes_equipo (
  id          uuid primary key default gen_random_uuid(),
  empleado_id uuid not null references usuarios(id) on delete cascade,  -- de quién es el hilo
  de_id       uuid not null references usuarios(id),                    -- quién escribió
  texto       text not null,
  created_at  timestamptz default now()
);
create index if not exists idx_mensajes_equipo_hilo on mensajes_equipo(empleado_id, created_at);

alter table mensajes_equipo enable row level security;

-- El empleado ve/escribe SU hilo
drop policy if exists mensajes_equipo_empleado on mensajes_equipo;
create policy mensajes_equipo_empleado on mensajes_equipo for all
  using      ( empleado_id in (select id from usuarios where auth_id = auth.uid()) )
  with check ( empleado_id in (select id from usuarios where auth_id = auth.uid())
               and de_id  in (select id from usuarios where auth_id = auth.uid()) );

-- El admin ve/escribe cualquier hilo (de_id debe ser el admin al escribir)
drop policy if exists mensajes_equipo_admin on mensajes_equipo;
create policy mensajes_equipo_admin on mensajes_equipo for all
  using      ( exists (select 1 from usuarios where auth_id = auth.uid() and rol = 'admin') )
  with check ( exists (select 1 from usuarios where auth_id = auth.uid() and rol = 'admin')
               and de_id in (select id from usuarios where auth_id = auth.uid()) );

-- Verificación: select * from mensajes_equipo;
