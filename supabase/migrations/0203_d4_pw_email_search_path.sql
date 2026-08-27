-- D-4 — Fijar search_path de pw_email(), unica de las tres funciones helper que
-- no lo tenia (linter: function_search_path_mutable). pw_coach_id() y
-- pw_is_admin() ya usan SET search_path TO 'public'. El cuerpo solo lee
-- auth.jwt(), que va schema-cualificado, asi que el cambio es seguro.
-- Alcance exacto de D-4: search_path. NO se cambia a SECURITY DEFINER.
ALTER FUNCTION public.pw_email() SET search_path TO 'public';
