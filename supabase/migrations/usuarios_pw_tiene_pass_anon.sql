-- ============================================================================
-- Fase 4b — pw_tiene_pass() también para anon (lo usa registro.html)
-- ============================================================================
-- registro.html (activación de cuentas de coach) corre SIN sesión (anon) y
-- necesita saber si un email ya tiene contraseña, sin leer password_hash (que
-- quedó protegido por usuarios_protect_password.sql). Usa la función booleana
-- pw_tiene_pass, que en Fase 4 quedó habilitada solo para 'authenticated'.
-- Esta migración la habilita también para 'anon'.
--
-- Tradeoff: anon puede preguntar "¿este email tiene cuenta con contraseña?".
-- Riesgo de enumeración BAJO (plataforma invitation-only, base chica) y no
-- expone el hash en ningún caso. Correr una vez en Supabase → SQL Editor.
-- ============================================================================

GRANT EXECUTE ON FUNCTION public.pw_tiene_pass(text) TO anon;

-- ROLLBACK: REVOKE EXECUTE ON FUNCTION public.pw_tiene_pass(text) FROM anon;
