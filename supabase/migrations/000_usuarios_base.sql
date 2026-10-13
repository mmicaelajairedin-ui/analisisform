-- Base usuarios table (for local development)
-- In production, usuarios links to Supabase Auth via auth.uid()
-- For local testing, this creates a minimal usuarios table

CREATE TABLE IF NOT EXISTS usuarios (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  nombre TEXT,
  apellido TEXT,
  rol TEXT CHECK (rol IN ('admin', 'coach', 'candidato', 'colaborador')) DEFAULT 'coach',
  activo BOOLEAN DEFAULT true,
  foto_perfil TEXT,
  configuracion JSONB DEFAULT '{}',
  -- Gamification
  game_pts INTEGER DEFAULT 0,
  game_medal TEXT,
  last_seen TIMESTAMPTZ,
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS: users can read own row
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own user" ON usuarios
  FOR SELECT USING (auth.uid() = id);

-- Service role can insert/update/delete
CREATE POLICY "Service role can manage users" ON usuarios
  FOR ALL USING (auth.role() = 'service_role');

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON usuarios TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON usuarios TO service_role;

-- Index for common queries
CREATE INDEX IF NOT EXISTS usuarios_email_idx ON usuarios(email);
CREATE INDEX IF NOT EXISTS usuarios_rol_idx ON usuarios(rol);
CREATE INDEX IF NOT EXISTS usuarios_activo_idx ON usuarios(activo);
