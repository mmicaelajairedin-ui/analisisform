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
-- y las muestra en la campanita. `clave` fija = idempotente (re-correr no duplica
-- ni re-notifica a quien ya la marcó). Para RE-lanzar una campaña nueva, cambiar
-- el sufijo de `clave` (p. ej. _2026_08).
--
-- Deploy: pegar en el SQL Editor de Supabase y ejecutar. Es idempotente.
-- ============================================================================

insert into public.notificaciones (email, para, tipo, clave, titulo, detalle, color)
select
  lower(u.email)                                   as email,
  'coach'                                          as para,
  'perfil'                                         as tipo,
  'perfil_actualizar_2026_07'                      as clave,
  'Actualiza tu perfil público con IA'             as titulo,
  'Ahora puedes autocompletar tu perfil (título SEO, bio, especialidades y "¿Por qué elegirte?") con un clic desde Configuración → Perfil público. Regéneralo para aparecer mejor en el directorio.' as detalle,
  '#2D6A4F'                                         as color
from public.usuarios u
where u.email is not null
  and (
    u.perfil_publico_activo = true
    or u.configuracion->>'perfil_publico_activo' = 'true'
  )
on conflict (email, clave) do nothing;
