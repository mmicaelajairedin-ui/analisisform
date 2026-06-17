-- ============================================================================
-- Fase 3b — Limpieza de políticas RLS "abiertas" heredadas del MVP
-- ============================================================================
-- CONTEXTO: al activar rls_strict.sql, el candado NO cerró porque convivían
-- políticas viejas permisivas (qual = true) creadas a mano en el dashboard de
-- Supabase en la época del MVP (cuando todo estaba abierto). Como las políticas
-- PERMISSIVE se combinan con OR, una sola con `USING (true)` deja pasar a todos
-- y anula las políticas estrictas.
--
-- Diagnóstico que lo destapó:
--   SELECT tablename, policyname, cmd, qual FROM pg_policies
--   WHERE tablename IN ('candidatos','informes','cv_publicados');
-- → aparecían "public select" / "public select cv" con qual=true (lectura
--   abierta) y "allow_anon_update" / "public update cv" / "public delete cv"
--   (escritura/borrado abiertos para anon).
--
-- Esta migración las elimina. Quedan SOLO las políticas estrictas de
-- rls_strict.sql (candidatos_select, informes_select, cv_publicados_*, etc.).
-- Ya corrida en producción el 2026-06-16; se versiona para dejar registro y
-- para que una reconstrucción desde migraciones no reintroduzca la fuga.
-- ============================================================================

-- candidatos: lectura abierta + update anónimo
DROP POLICY IF EXISTS "public select"     ON candidatos;
DROP POLICY IF EXISTS "allow_anon_update" ON candidatos;

-- informes: lectura abierta
DROP POLICY IF EXISTS "public select"     ON informes;

-- cv_publicados: lectura / update / delete abiertos
DROP POLICY IF EXISTS "public select cv"  ON cv_publicados;
DROP POLICY IF EXISTS "public update cv"  ON cv_publicados;
DROP POLICY IF EXISTS "public delete cv"  ON cv_publicados;

-- NOTA: las políticas de INSERT viejas ("public insert", "public insert cv",
-- "candidato_puede_actualizar_su_cv") se dejan a propósito: el alta por el
-- formulario de intake (anónima) necesita poder insertar. Son write-only, no
-- exponen datos. Si más adelante se quiere endurecer también el INSERT, hacerlo
-- en una migración aparte y verificar que el intake y la publicación de CV sigan
-- funcionando.

-- ============================================================================
-- VERIFICACIÓN (post-drop)
-- ============================================================================
-- Debe quedar UNA sola política SELECT por tabla (la estricta):
--   SELECT tablename, policyname, cmd, qual FROM pg_policies
--   WHERE tablename IN ('candidatos','informes','cv_publicados') AND cmd='SELECT';
-- Y desde el navegador SIN login, /rest/v1/candidatos?select=* debe dar [].
