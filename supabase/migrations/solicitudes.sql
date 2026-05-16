-- Migration — tabla `solicitudes`
-- Solicitudes del directorio Pathway (carril marketplace). NO se mezcla
-- con `candidatos` (clientes propios del coach, 0% comisión).
--
-- Aplicar una vez en Supabase (SQL editor o migración).
--
-- Estados:
--   pendiente   — candidato eligió coach, aún sin autorizar pago
--   autorizada  — tarjeta autorizada (hold), esperando que el coach acepte
--   aceptada    — coach aceptó → se capturó el pago (coach cobra, Pathway 20%)
--   rechazada   — coach rechazó → hold liberado, sin cargo
--   expirada    — pasaron 24 h sin respuesta → hold liberado

create table if not exists solicitudes (
  id                    uuid primary key default gen_random_uuid(),
  coach_id              uuid,
  candidato_nombre      text,
  candidato_email       text,
  servicio              text,            -- 'mentoria' | 'sesion'
  monto                 numeric,         -- precio que puso el coach
  comision              numeric,         -- 20% de monto (lo de Pathway)
  estado                text default 'pendiente',
  stripe_account_id     text,            -- cuenta Connect del coach
  stripe_session_id     text,
  stripe_payment_intent text,
  created_at            timestamptz default now(),
  expires_at            timestamptz      -- created_at + 24h
);

create index if not exists idx_solicitudes_coach  on solicitudes(coach_id);
create index if not exists idx_solicitudes_estado on solicitudes(estado);
create index if not exists idx_solicitudes_expira on solicitudes(expires_at);
