-- ===================================================================
-- coach_capacity_config — Configuración de capacidad por coach
--
-- Limites: cuántos clientes activos es "saludable" para cada coach.
-- Valores por defecto + overrides por coach.
--
-- Aplicar una vez en Supabase Studio → SQL Editor.
-- ===================================================================

CREATE TABLE IF NOT EXISTS coach_capacity_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id UUID REFERENCES usuarios(id) ON DELETE CASCADE,
  version INT NOT NULL,

  -- Valores
  capacity_max INT DEFAULT 15, -- Max clientes simultáneos
  capacity_recommended INT DEFAULT 12, -- "Sano" = 80% de max
  sesiones_semana_expected INT DEFAULT 30, -- Sesiones esperadas por semana a capacidad

  -- Estado
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),

  UNIQUE(coach_id, version)
);

-- Índice para queries rápidas
CREATE INDEX IF NOT EXISTS idx_coach_capacity_coach_id ON coach_capacity_config(coach_id, active DESC);

-- RLS: coach puede leer su propia config, admin puede leer/escribir todas
ALTER TABLE coach_capacity_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "capacity_coach_read" ON coach_capacity_config
  FOR SELECT USING (
    coach_id = auth.uid()
    OR auth.jwt() ->> 'rol' IN ('admin', 'owner')
  );

CREATE POLICY "capacity_admin_write" ON coach_capacity_config
  FOR ALL USING (auth.jwt() ->> 'rol' IN ('admin', 'owner'))
  WITH CHECK (auth.jwt() ->> 'rol' IN ('admin', 'owner'));
