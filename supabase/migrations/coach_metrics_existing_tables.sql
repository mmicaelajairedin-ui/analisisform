-- ===================================================================
-- coach_metrics_existing_tables — Actualizaciones a tablas existentes
--
-- Agrega columnas y FKs necesarias para calcular coach_metrics_daily.
-- Idempotente: safe para aplicar múltiples veces.
--
-- Aplicar una vez en Supabase Studio → SQL Editor.
-- ===================================================================

-- Tabla: candidatos
-- Agrega estado, motivo_churn, pago_confirmado (para filtrar clientes activos/completados)

ALTER TABLE candidatos
  ADD COLUMN IF NOT EXISTS estado TEXT DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS motivo_churn TEXT,
  ADD COLUMN IF NOT EXISTS pago_confirmado BOOLEAN DEFAULT false;

-- Constraint: estado debe ser un valor válido
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'candidatos' AND constraint_name = 'candidatos_estado_check'
  ) THEN
    ALTER TABLE candidatos ADD CONSTRAINT candidatos_estado_check
      CHECK (estado IN ('active', 'completed', 'churned', 'paused', 'pending'));
  END IF;
END $$;

-- Tabla: usuarios
-- Agrega activity tracking (last_login ya existe en algunos sistemas, verificar)

ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS last_login TIMESTAMP,
  ADD COLUMN IF NOT EXISTS last_seen TIMESTAMP;

-- Tabla: sesiones_registro
-- Agrega coach_id + candidato_id para poder agrupar por coach

ALTER TABLE sesiones_registro
  ADD COLUMN IF NOT EXISTS coach_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS candidato_id UUID REFERENCES candidatos(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_sesiones_registro_coach_id_fecha
  ON sesiones_registro(coach_id, fecha);

CREATE INDEX IF NOT EXISTS idx_sesiones_registro_candidato_id
  ON sesiones_registro(candidato_id);

-- Tabla: informes
-- Agrega coach_id para power metrics

ALTER TABLE informes
  ADD COLUMN IF NOT EXISTS coach_id UUID REFERENCES usuarios(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_informes_coach_id_fecha
  ON informes(coach_id, fecha_creacion);

-- Tabla: candidatos — más índices para queries de métricas
CREATE INDEX IF NOT EXISTS idx_candidatos_coach_id_estado
  ON candidatos(coach_id, estado);

CREATE INDEX IF NOT EXISTS idx_candidatos_fecha_inicio
  ON candidatos(fecha_inicio);

CREATE INDEX IF NOT EXISTS idx_candidatos_estado
  ON candidatos(estado);

-- NOTA: Si las columnas coach_id existen en sesiones_registro/informes,
-- verifica que en tu lógica de aplicación se populen correctamente.
-- Edge Functions asumirán que estos FKs están disponibles.
