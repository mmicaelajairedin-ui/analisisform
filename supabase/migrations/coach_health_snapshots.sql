-- Snapshot semanal del Health Score por coach — para la TENDENCIA del ranking.
--
-- La edge function `metricas` (service role) escribe 1 fila por coach por semana
-- de forma idempotente (on_conflict coach_id,semana) y la compara contra la más
-- reciente anterior para calcular `tendencia` (delta del health vs. la semana
-- pasada). El panel NUNCA lee esta tabla directo: recibe la tendencia ya
-- calculada en la respuesta de metricas.
--
-- `semana` = bucket semanal desde epoch: floor(ms / (7 * 86400000)). Es un entero
-- monótono, simple y sin dependencias de zona horaria.
--
-- Aplicar UNA vez en el SQL Editor de Supabase (idempotente).

CREATE TABLE IF NOT EXISTS coach_health_snapshots (
  coach_id     text NOT NULL,
  semana       integer NOT NULL,
  health_score integer NOT NULL DEFAULT 0,
  ts           timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (coach_id, semana)
);

-- Consulta típica de metricas: "última semana anterior por coach".
CREATE INDEX IF NOT EXISTS coach_health_snapshots_semana_idx
  ON coach_health_snapshots (semana DESC);

-- RLS ON, sin policies: solo el service role (que ignora RLS) escribe/lee.
-- anon y authenticated quedan sin acceso, igual que `eventos` / `client_errors`.
ALTER TABLE coach_health_snapshots ENABLE ROW LEVEL SECURITY;
