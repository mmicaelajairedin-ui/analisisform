-- ===================================================================
-- Pathway Coaches — esquema MVP (multi-nicho: fitness, financiero…)
-- Supabase project NUEVO (separado de career). RLS estricto desde el día 1.
-- Cada coach ve solo sus clientes; cada cliente ve solo lo suyo.
-- Aplicar en: Supabase → SQL Editor → pegar y ejecutar.
-- ===================================================================

-- ───────── Perfiles (coach y cliente comparten auth de Supabase) ─────────
create table if not exists coaches (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  nombre text,
  coach_type text not null default 'fitness',     -- fitness | financiero | …
  plan text not null default 'sencillo',           -- sencillo | pro
  config jsonb not null default '{}'::jsonb,        -- marca (color/logo), módulos on/off
  created_at timestamptz default now()
);

create table if not exists clientes (
  id uuid primary key references auth.users(id) on delete cascade,
  coach_id uuid not null references coaches(id) on delete cascade,
  nombre text,
  email text,
  objetivo text,
  estado text not null default 'activo',            -- activo | inactivo
  periodo_activo int default 1,                     -- semana (fitness) o mes (financiero)
  foto_url text,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz default now()
);

-- ───────── Entrada: evaluación + informe IA ─────────
create table if not exists evaluaciones (
  id bigserial primary key,
  cliente_id uuid not null references clientes(id) on delete cascade,
  coach_type text not null,
  respuestas jsonb not null,                        -- lo que llenó en el form
  consentimiento boolean not null default false,
  created_at timestamptz default now()
);

create table if not exists informes (
  id bigserial primary key,
  cliente_id uuid not null references clientes(id) on delete cascade,
  data jsonb not null,                              -- salida JSON de generar-informe
  created_at timestamptz default now()
);

-- ───────── Genéricos (todos los nichos) ─────────
create table if not exists objetivos (
  id bigserial primary key,
  cliente_id uuid not null references clientes(id) on delete cascade,
  texto text not null,
  periodo int,
  done boolean not null default false,
  creado_por text not null default 'coach',         -- coach | cliente
  created_at timestamptz default now()
);

create table if not exists habitos_log (
  id bigserial primary key,
  cliente_id uuid not null references clientes(id) on delete cascade,
  fecha date not null,
  habito text not null,                             -- agua | sueno | pasos | …
  done boolean not null default true,
  unique (cliente_id, fecha, habito)                -- permite marcar días pasados sin duplicar
);

create table if not exists mensajes (
  id bigserial primary key,
  cliente_id uuid not null references clientes(id) on delete cascade,
  coach_id uuid not null references coaches(id) on delete cascade,
  autor text not null,                              -- coach | cliente
  texto text not null,
  leido boolean not null default false,
  created_at timestamptz default now()
);

-- ───────── Fitness ─────────
create table if not exists fit_rutinas (
  id bigserial primary key,
  cliente_id uuid not null references clientes(id) on delete cascade,
  semana int not null,
  dias jsonb not null default '[]'::jsonb,          -- [{dia, ejercicios:[{nombre,series,reps,ex_id}]}]
  updated_at timestamptz default now()
);

create table if not exists fit_antropometria (
  id bigserial primary key,
  cliente_id uuid not null references clientes(id) on delete cascade,
  fecha date not null,
  peso numeric, grasa numeric, masa_muscular numeric, masa_osea numeric,
  pliegues numeric, imo numeric,
  medidas jsonb default '{}'::jsonb,                -- {cintura, cadera, …}
  fotos jsonb default '[]'::jsonb                   -- URLs (Uploadcare)
);

-- ───────── Financiero ─────────
create table if not exists fin_cierres (
  id bigserial primary key,
  cliente_id uuid not null references clientes(id) on delete cascade,
  mes date not null,
  ingresos numeric, ahorro numeric,
  categorias jsonb not null default '{}'::jsonb,    -- {vivienda, alimentacion, …}
  unique (cliente_id, mes)
);

create table if not exists fin_deudas (
  id bigserial primary key,
  cliente_id uuid not null references clientes(id) on delete cascade,
  nombre text, saldo numeric, cuota numeric, tasa numeric, orden int
);

create table if not exists fin_metas (
  id bigserial primary key,
  cliente_id uuid not null references clientes(id) on delete cascade,
  nombre text, objetivo numeric, actual numeric default 0
);

-- ===================================================================
-- RLS — cada coach solo lo suyo; cada cliente solo lo suyo
-- ===================================================================
alter table coaches enable row level security;
alter table clientes enable row level security;
alter table evaluaciones enable row level security;
alter table informes enable row level security;
alter table objetivos enable row level security;
alter table habitos_log enable row level security;
alter table mensajes enable row level security;
alter table fit_rutinas enable row level security;
alter table fit_antropometria enable row level security;
alter table fin_cierres enable row level security;
alter table fin_deudas enable row level security;
alter table fin_metas enable row level security;

-- coaches: cada quien su fila
create policy coach_self on coaches for all
  using (id = auth.uid()) with check (id = auth.uid());

-- clientes: el coach dueño hace todo; el cliente lee su propia fila
create policy clientes_coach on clientes for all
  using (coach_id = auth.uid()) with check (coach_id = auth.uid());
create policy clientes_self on clientes for select
  using (id = auth.uid());

-- helper: ¿soy el coach de este cliente?  ¿soy este cliente?
-- (se inlinea en cada policy con subconsultas)

-- Tablas del cliente: coach dueño = todo; cliente = lee lo suyo
-- (habitos_log y objetivos creados_por cliente también puede escribir)
do $$
declare t text;
begin
  foreach t in array array['evaluaciones','informes','objetivos','mensajes',
                           'fit_rutinas','fit_antropometria',
                           'fin_cierres','fin_deudas','fin_metas']
  loop
    execute format($f$
      create policy %1$s_coach on %1$s for all
        using (exists (select 1 from clientes c where c.id = %1$s.cliente_id and c.coach_id = auth.uid()))
        with check (exists (select 1 from clientes c where c.id = %1$s.cliente_id and c.coach_id = auth.uid()));
      create policy %1$s_cliente_read on %1$s for select
        using (cliente_id = auth.uid());
    $f$, t);
  end loop;
end $$;

-- El cliente puede ESCRIBIR lo que es suyo (hábitos, marcar objetivos, cierres, su peso)
create policy habitos_cliente_write on habitos_log for all
  using (cliente_id = auth.uid()) with check (cliente_id = auth.uid());
create policy objetivos_cliente_upd on objetivos for update
  using (cliente_id = auth.uid()) with check (cliente_id = auth.uid());
create policy cierres_cliente_write on fin_cierres for all
  using (cliente_id = auth.uid()) with check (cliente_id = auth.uid());
create policy mensajes_cliente_write on mensajes for insert
  with check (cliente_id = auth.uid());
