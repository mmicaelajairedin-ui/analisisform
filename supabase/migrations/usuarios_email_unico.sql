-- ============================================================================
-- usuarios_email_unico — un email = un solo usuario (un solo rol).
--
-- Problema que resuelve: coaches y clientes viven en la MISMA tabla `usuarios`
-- (distintos `rol`). Si un email quedaba cargado dos veces (p. ej. como coach y
-- como cliente), el login hace `email=eq.X limit=1` y agarra un rol arbitrario
-- → entrás como coach y no podés entrar como cliente (o al revés). Confuso.
--
-- Este índice único (case-insensitive) garantiza en la BASE que un email tenga
-- UNA sola fila, sin importar por qué camino del código se intente crear (el
-- panel tiene ~5 lugares que insertan clientes + el registro de coaches). Es el
-- blindaje de fondo del guardrail "un email = un solo rol"; el aviso lindo en el
-- panel es solo UX.
--
-- OJO: si la tabla YA tiene emails duplicados, la creación del índice FALLA.
-- Para verlos primero:
--   select lower(email) e, count(*) from public.usuarios group by 1 having count(*)>1;
-- Resolvé esos duplicados (borrá/mergeá la fila sobrante) y volvé a correr esto.
--
-- Deploy: pegar en el SQL Editor de Supabase y Run.
-- ============================================================================

create unique index if not exists usuarios_email_lower_uk
  on public.usuarios (lower(email));
