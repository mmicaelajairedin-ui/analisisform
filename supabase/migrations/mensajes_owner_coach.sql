-- ===================================================================
-- mensajes_owner_coach — chat entre el DUEÑO de una red y cada uno de SUS
-- coaches. Es el equivalente a mensajes_admin_coach (Pathway↔coach), pero para
-- la empresa: así el chat del dueño con su equipo NO se mezcla con el soporte
-- de Pathway.
--   from_owner=true  → mensaje del dueño al coach
--   from_owner=false → respuesta del coach al dueño
-- Escrituras: por la edge function mensaje-red (service role, gateada). Lectura:
-- filtrada por org_id (+ coach_id). RLS estricto queda para el hardening general.
-- Aplicar una vez: Supabase → SQL Editor.
-- ===================================================================

CREATE TABLE IF NOT EXISTS mensajes_owner_coach (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     UUID NOT NULL REFERENCES organizaciones(id) ON DELETE CASCADE,
  coach_id   UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  from_owner BOOLEAN NOT NULL,
  body       TEXT NOT NULL,
  leido_en   TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mensajes_owner_coach_idx
  ON mensajes_owner_coach(org_id, coach_id, created_at DESC);
