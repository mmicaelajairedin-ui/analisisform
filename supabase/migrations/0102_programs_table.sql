-- Tabla de programas de coaching para MultiCoach
-- Permite trackear programas activos, coaches asignados y progreso

CREATE TABLE IF NOT EXISTS programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizaciones(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  coach TEXT,
  coach_id UUID,
  clients INT DEFAULT 0,
  completion INT DEFAULT 0,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'paused')),
  duration TEXT,
  description TEXT,
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_programs_org_id ON programs(org_id);
CREATE INDEX IF NOT EXISTS idx_programs_status ON programs(status);
CREATE INDEX IF NOT EXISTS idx_programs_coach_id ON programs(coach_id);

-- RLS: solo el owner y sus coaches ven sus programas
ALTER TABLE programs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "programs_owner_access" ON programs
  FOR ALL USING (
    org_id IN (
      SELECT id FROM organizaciones WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "programs_coach_access" ON programs
  FOR SELECT USING (
    coach_id = auth.uid()
    OR org_id IN (
      SELECT id FROM organizaciones WHERE owner_id = auth.uid()
    )
  );
