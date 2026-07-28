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

-- Privilegios de tabla: el rol de la request necesita el GRANT además de la
-- policy (RLS decide la FILA; el GRANT decide si el rol puede tocar la tabla).
-- Damos a AMBOS roles porque el portal se conecta con la anon key para clientes
-- de login propio, pero los clientes/coaches ya migrados a Supabase Auth mandan
-- su JWT → rol `authenticated`. Sin esto, esos usuarios recibían 403 al insertar
-- (era el 2º error del panel: POST /rest/v1/notificaciones 403). Mismo patrón que
-- informes_guardados.sql.
grant select, insert, update, delete on public.notificaciones to anon, authenticated;

-- Modelo de acceso ACTUAL de la plataforma: login propio (anon key) Y usuarios
-- migrados a Supabase Auth (JWT → authenticated) conviven. La policy cubre a los
-- DOS roles; sin `authenticated` en la lista, el usuario con JWT no matcheaba
-- ninguna policy y el INSERT se rechazaba (403). El cierre estricto de RLS
-- (USING email = auth.email()) es parte del Sprint B general de seguridad, no de
-- esta migración.
drop policy if exists notif_anon_all on public.notificaciones;
create policy notif_anon_all on public.notificaciones
  for all to anon, authenticated
  using (true)
  with check (true);
