-- ============================================================================
-- notificaciones — centro de notificaciones del cliente (campanita estilo IG).
--
-- Problema que resuelve: hoy el estado leído/no-leído del bell vive en
-- localStorage (mj_notif_seen_*) → NO persiste de verdad, no es por-ítem y no
-- cruza dispositivos. Esta tabla es la FUENTE DE VERDAD: cada acción del coach
-- que el cliente puede ver genera UNA fila (idempotente por (email,clave)), con
-- su propio flag `leida`. El cliente la marca leída al tocarla (→ ojito abierto).
--
-- Fase 1 (esta): el PORTAL DEL CLIENTE detecta las acciones del coach y crea las
-- filas (no hace falta tocar el panel del coach todavía). Fase 3: el coach las
-- inserta directo para que sean inmediatas. Misma tabla las dos veces (`para`
-- distingue destinatario cliente/coach).
--
-- Deploy: aplicar en el SQL editor de Supabase.
-- ============================================================================

create table if not exists public.notificaciones (
  id       bigint generated always as identity primary key,
  email    text        not null,                    -- destinatario (lowercase)
  para     text        not null default 'cliente',  -- 'cliente' | 'coach'
  tipo     text        not null,                    -- informe|sesion|tareas|cv|carta|recursos|semana|mensaje
  clave    text        not null,                    -- clave estable → un evento = una notificación
  titulo   text        not null,
  detalle  text,
  sec      text,                                    -- sección a la que navega (goSec)
  icon     text,
  color    text,
  leida    boolean     not null default false,
  ts       timestamptz not null default now(),
  constraint notificaciones_email_clave_uk unique (email, clave)
);

create index if not exists notificaciones_email_ts_idx
  on public.notificaciones (email, ts desc);

alter table public.notificaciones enable row level security;

-- Modelo de acceso ACTUAL de la plataforma: login propio (no Supabase Auth) →
-- el anon key filtra por email desde el cliente, igual que `candidatos`. El
-- cierre estricto de RLS (USING email = auth.email()) es parte del Sprint B
-- general de seguridad, no de esta migración.
drop policy if exists notif_anon_all on public.notificaciones;
create policy notif_anon_all on public.notificaciones
  for all to anon
  using (true)
  with check (true);
