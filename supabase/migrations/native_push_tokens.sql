-- native_push_tokens — tokens de notificaciones push NATIVAS (iOS APNs / Android FCM).
-- El push WEB usa push_subscriptions (VAPID). Esta tabla es para la app de tienda
-- (Capacitor), que registra un token de dispositivo distinto.
--
-- Lo guarda pw-native.js con la anon key (RLS abierto solo para INSERT/UPSERT).
-- Nadie puede LEER con la anon key: los tokens solo se leen desde la edge function
-- send-push-apns con el service role.

create table if not exists native_push_tokens (
  id           bigint generated always as identity primary key,
  user_email   text,
  token        text not null unique,
  platform     text not null default 'ios',   -- 'ios' | 'android'
  ua           text,
  created_at   timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index if not exists native_push_tokens_email_idx on native_push_tokens (user_email);

alter table native_push_tokens enable row level security;

-- anon puede registrar/actualizar SU token (upsert por token). No puede leer.
drop policy if exists "anon insert native token" on native_push_tokens;
create policy "anon insert native token"
  on native_push_tokens for insert to anon
  with check (true);

drop policy if exists "anon upsert native token" on native_push_tokens;
create policy "anon upsert native token"
  on native_push_tokens for update to anon
  using (true) with check (true);
