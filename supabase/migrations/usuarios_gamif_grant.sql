-- ============================================================================
-- usuarios_gamif_grant — permite persistir SOLO puntos (xp) y medallas (badges)
-- del coach desde el navegador, sin abrir el resto de la tabla `usuarios`.
--
-- Problema que resuelve: el panel guarda xp/badges con PATCH /rest/v1/usuarios
-- (best-effort). `usuarios` tiene RLS activo y NO tenía política de UPDATE para
-- anon → cada guardado devolvía 403 y ensuciaba client_errors (falsos "errores
-- de guardado"). Los puntos igual vivían en localStorage, pero no cruzaban de
-- dispositivo y asustaban en el panel de errores.
--
-- Seguridad (importante): `usuarios` guarda `password_hash` y `configuracion`
-- (que incluye estado de prueba/pago). Por eso NO abrimos la tabla entera:
--   1) REVOKE de cualquier UPDATE amplio previo que pudiera tener anon.
--   2) GRANT de UPDATE SOLO sobre las columnas xp y badges.
-- Así, aunque la política de fila sea permisiva (el modelo actual es login
-- propio + anon key, sin Supabase Auth, igual que candidatos), lo ÚNICO que se
-- puede escribir desde el navegador son esas dos columnas de gamificación.
-- Contraseñas, configuracion, activo, rol, etc. siguen cerrados.
--
-- Deploy: pegar en el SQL Editor de Supabase y Run.
-- ============================================================================

-- Columnas de gamificación (idempotente: si ya existen, no hace nada).
alter table public.usuarios add column if not exists xp     integer not null default 0;
alter table public.usuarios add column if not exists badges jsonb   not null default '[]'::jsonb;

-- Blindaje de columnas: anon puede ACTUALIZAR únicamente xp y badges.
revoke update on public.usuarios from anon;
grant  update (xp, badges) on public.usuarios to anon;

-- Política de UPDATE para anon (la tabla ya tiene RLS activo por el login).
-- El GRANT de columnas de arriba es el que limita QUÉ se puede escribir; esta
-- política solo habilita la operación de UPDATE para la fila.
drop policy if exists usuarios_anon_gamif on public.usuarios;
create policy usuarios_anon_gamif on public.usuarios
  for update to anon
  using (true)
  with check (true);
