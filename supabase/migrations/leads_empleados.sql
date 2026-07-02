-- ============================================================
-- LEADS de empleados (equipo comercial) — Fase 1
-- ============================================================
-- Tablas NUEVAS, no tocan nada existente (coaches, clientes, etc.).
-- Cada empleado gestiona SUS leads; el admin ve los de todos.
-- La comisión se calcula por "altas" (leads convertidos en coach).
--
-- Ejecutar en el SQL Editor de Supabase. Idempotente.
-- ============================================================

-- 1) LEADS ----------------------------------------------------
create table if not exists leads (
  id            uuid primary key default gen_random_uuid(),
  empleado_id   uuid not null references usuarios(id) on delete cascade,
  nombre        text,
  email         text,
  telefono      text,
  instagram     text,
  nicho         text default 'sin',      -- sin | carrera | fitness | finanzas
  estado        text default 'nuevo',    -- nuevo | contactado | demo | alta | descartado
  nota          text,
  demo_agendada boolean default false,
  demo_fecha    timestamptz,
  -- Atribución de comisión: qué coach se dio de alta a partir de este lead
  alta_coach_id uuid references usuarios(id),
  alta_at       timestamptz,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);
create index if not exists idx_leads_empleado on leads(empleado_id);
create index if not exists idx_leads_estado   on leads(estado);

-- 2) REGISTRO DE EMAILS ENVIADOS -----------------------------
-- De acá sale el "enviado hace 4 días · plantilla".
create table if not exists lead_emails (
  id          uuid primary key default gen_random_uuid(),
  lead_id     uuid not null references leads(id) on delete cascade,
  empleado_id uuid not null references usuarios(id),
  asunto      text,
  cuerpo      text,
  plantilla   text,
  enviado_at  timestamptz default now()
);
create index if not exists idx_lead_emails_lead on lead_emails(lead_id);

-- 3) SEGURIDAD (RLS) -----------------------------------------
-- Aislamiento por empleado; admin ve todo. Usa auth.uid() ↔ usuarios.auth_id
-- (mismo login que ya usás; el auth_id se enlaza al iniciar sesión).
alter table leads       enable row level security;
alter table lead_emails enable row level security;

-- Helper inline: ids de usuario del auth actual
-- (un usuario = una fila en usuarios con auth_id = auth.uid())

drop policy if exists leads_empleado on leads;
create policy leads_empleado on leads for all
  using      ( empleado_id in (select id from usuarios where auth_id = auth.uid()) )
  with check ( empleado_id in (select id from usuarios where auth_id = auth.uid()) );

drop policy if exists leads_admin on leads;
create policy leads_admin on leads for all
  using      ( exists (select 1 from usuarios where auth_id = auth.uid() and rol = 'admin') )
  with check ( exists (select 1 from usuarios where auth_id = auth.uid() and rol = 'admin') );

drop policy if exists lead_emails_empleado on lead_emails;
create policy lead_emails_empleado on lead_emails for all
  using      ( empleado_id in (select id from usuarios where auth_id = auth.uid()) )
  with check ( empleado_id in (select id from usuarios where auth_id = auth.uid()) );

drop policy if exists lead_emails_admin on lead_emails;
create policy lead_emails_admin on lead_emails for all
  using ( exists (select 1 from usuarios where auth_id = auth.uid() and rol = 'admin') );

-- 4) MÉTRICAS / COMISIÓN por empleado (para el admin) ---------
-- Vista de solo lectura: totales por empleado + comisión estimada.
-- El monto por alta se decide en la app (ej. 30). Acá dejamos el conteo.
create or replace view v_empleado_metricas as
select
  e.id                                             as empleado_id,
  e.nombre,
  e.email,
  count(l.id)                                      as leads_total,
  count(l.id) filter (where l.estado <> 'nuevo'
                        and l.estado <> 'descartado') as contactados,
  count(l.id) filter (where l.demo_agendada)       as demos,
  count(l.id) filter (where l.estado = 'alta')     as altas
from usuarios e
left join leads l on l.empleado_id = e.id
where e.rol = 'empleado'
group by e.id, e.nombre, e.email;

-- ============================================================
-- VERIFICACIÓN
-- ============================================================
-- select * from v_empleado_metricas;
-- (0 filas hasta que haya empleados con leads)
-- ============================================================
