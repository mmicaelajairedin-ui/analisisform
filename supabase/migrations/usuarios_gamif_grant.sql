-- ============================================================================
-- usuarios_gamif_grant — permite persistir SOLO telemetría "best-effort" del
-- coach (gamificación + presencia) desde el navegador, sin abrir el resto de la
-- tabla `usuarios`.
--
-- Problema que resuelve: el panel guarda desde el navegador, best-effort, varias
-- columnas de telemetría con PATCH /rest/v1/usuarios:
--   · xp / badges              (gamificación de acciones)   → pwXpSave/pwAwardBadge
--   · game_pts / game_medal    (juego de la cabra)          → _gameSyncServer
--   · last_seen                (presencia "en línea")       → coachBeat (heartbeat)
-- `usuarios` tiene RLS activo. anon SOLO tenía GRANT de UPDATE sobre xp/badges,
-- así que game_pts/game_medal/last_seen devolvían 403 en cada guardado y
-- ensuciaban client_errors (falsos "errores de guardado"). Peor: coachBeat corre
-- en el heartbeat y en el boot ANTES de que el SDK adjunte el JWT → sale con la
-- anon key → 403 en CASI TODAS las sesiones del panel (era el error #1 del panel
-- de errores: ~127 PATCH /rest/v1/usuarios 403). Los datos igual vivían en
-- localStorage, pero no cruzaban de dispositivo y asustaban en el panel.
--
-- Seguridad (importante): `usuarios` guarda `password_hash` y `configuracion`
-- (que incluye estado de prueba/pago). Por eso NO abrimos la tabla entera:
--   1) REVOKE de cualquier UPDATE amplio previo que pudiera tener anon.
--   2) GRANT de UPDATE SOLO sobre las columnas de telemetría (nunca password,
--      configuracion, activo, rol, email…).
-- Así, aunque la política de fila sea permisiva (el modelo actual es login
-- propio + anon key, sin Supabase Auth, igual que candidatos), lo ÚNICO que se
-- puede escribir desde el navegador con la anon key son esas columnas inofensivas.
-- Contraseñas, configuracion, activo, rol, etc. siguen cerrados. Los coaches con
-- JWT (authenticated) ya podían escribir su fila vía la policy usuarios_self_update.
--
-- Deploy: pegar en el SQL Editor de Supabase y Run (idempotente, re-ejecutable).
-- ============================================================================

-- Columnas de telemetría (idempotente: si ya existen, no hace nada). Deben
-- existir antes del GRANT por columna de abajo; las declaramos acá para que este
-- archivo sea autosuficiente sin depender del orden con coach_game.sql /
-- presence_last_seen.sql.
alter table public.usuarios add column if not exists xp         integer     not null default 0;
alter table public.usuarios add column if not exists badges     jsonb       not null default '[]'::jsonb;
alter table public.usuarios add column if not exists game_pts   integer     default 0;
alter table public.usuarios add column if not exists game_medal integer     default 0;
alter table public.usuarios add column if not exists last_seen  timestamptz;

-- Blindaje de columnas: anon puede ACTUALIZAR únicamente estas columnas de
-- telemetría (gamificación + presencia). Nada más.
revoke update on public.usuarios from anon;
grant  update (xp, badges, game_pts, game_medal, last_seen) on public.usuarios to anon;

-- Política de UPDATE para anon (la tabla ya tiene RLS activo por el login).
-- El GRANT de columnas de arriba es el que limita QUÉ se puede escribir; esta
-- política solo habilita la operación de UPDATE para la fila.
drop policy if exists usuarios_anon_gamif on public.usuarios;
create policy usuarios_anon_gamif on public.usuarios
  for update to anon
  using (true)
  with check (true);
