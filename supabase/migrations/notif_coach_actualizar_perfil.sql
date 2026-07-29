-- ============================================================================
-- notif_coach_actualizar_perfil — nudge a TODOS los coaches con perfil público
-- activo para que actualicen/regeneren su perfil con la nueva IA.
--
-- Por qué: el perfil público (coach.html) ahora se autocompleta con IA (título
-- SEO, bio, especialidades, "¿Por qué elegir a X?", ideal_para, keywords) y el
-- directorio (coaches.html) muestra métricas reales, verificado y "ver más".
-- Los coaches que ya tenían el perfil activo lo cargaron a mano → conviene que
-- lo regeneren para aprovechar los campos nuevos y rankear mejor.
--
-- Cómo llega: inserta UNA fila por coach en `notificaciones` con para='coach'.
-- El panel las lee (panel-v2.html → _PWCOACHNOTIF: notificaciones?para=eq.coach)
-- y las muestra en la campanita. Al TOCARLA navega al editor: `sec` guarda el
-- destino ('go:config|profile' → Configuración → Perfil, lo entiende el panel).
-- `clave` fija = idempotente (re-correr no duplica ni re-notifica a quien ya la
-- marcó). Para RE-lanzar una campaña, cambiar el sufijo de `clave`.
--
-- NOTA: la 1ª versión (clave 'perfil_actualizar_2026_07') salió con texto largo
-- y sin link (no navegaba). Esta usa una clave NUEVA ('..._v2') para que la
-- notificación corregida (corta + con link al editor) vuelva a aparecer, incluso
-- a quien ya tocó la anterior.
--
-- Deploy: pegar en el SQL Editor de Supabase y ejecutar. Es idempotente.
-- ============================================================================

insert into public.notificaciones (email, para, tipo, clave, titulo, detalle, sec, color)
select
  lower(u.email)                                   as email,
  'coach'                                          as para,
  'perfil'                                         as tipo,
  'perfil_actualizar_2026_07_v2'                   as clave,
  'Tu perfil quedó sin actualizar'                 as titulo,
  'Complétalo con IA para aparecer mejor'          as detalle,
  'go:config|profile'                              as sec,
  '#2D6A4F'                                         as color
from public.usuarios u
where u.email is not null
  and (
    u.perfil_publico_activo = true
    or u.configuracion->>'perfil_publico_activo' = 'true'
  )
on conflict (email, clave) do nothing;

-- Limpieza: borra la 1ª versión (larga y sin link) para que no quede duplicada
-- en la campanita de quien todavía no la tocó.
delete from public.notificaciones
where para = 'coach' and clave = 'perfil_actualizar_2026_07';
