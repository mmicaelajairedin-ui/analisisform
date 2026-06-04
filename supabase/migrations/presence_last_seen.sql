-- ===================================================================
-- Presencia "en línea" para el chat (coach ↔ cliente).
-- Cada lado actualiza su last_seen cada ~45s (heartbeat). El otro muestra
-- un puntito verde si el last_seen es de hace menos de ~90s.
-- Base de career (ddxnrsnjdvtqhxunxnwj). Aplicar una vez.
-- ===================================================================

-- Última actividad del CLIENTE (la setea su portal).
ALTER TABLE candidatos ADD COLUMN IF NOT EXISTS cliente_last_seen TIMESTAMPTZ;

-- Última actividad del COACH (la setea el panel).
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS last_seen TIMESTAMPTZ;
