-- ===================================================================
-- Agregar soporte para canales de sistema en red_canales
-- Los canales de sistema (General, Owners, Coaches, RRHH) están disponibles
-- para toda la red automáticamente. No pueden ser eliminados.
-- ===================================================================

-- Agregar columna is_system para identificar canales del sistema
ALTER TABLE red_canales ADD COLUMN IF NOT EXISTS is_system BOOLEAN DEFAULT false;

-- Para cada organización existente, crear canales de sistema si no existen
DO $$
DECLARE
  org_rec RECORD;
  owner_id UUID;
BEGIN
  FOR org_rec IN SELECT id, organizaciones.owner_id FROM organizaciones LOOP
    owner_id := org_rec.owner_id;

    -- Crear canal Owners si no existe
    INSERT INTO red_canales (org_id, nombre, creado_por, miembros, is_system)
    SELECT org_rec.id, 'Owners', owner_id, '[]'::jsonb, true
    WHERE NOT EXISTS (
      SELECT 1 FROM red_canales
      WHERE org_id = org_rec.id AND nombre = 'Owners' AND is_system = true
    );

    -- Crear canal Coaches si no existe
    INSERT INTO red_canales (org_id, nombre, creado_por, miembros, is_system)
    SELECT org_rec.id, 'Coaches', owner_id, '[]'::jsonb, true
    WHERE NOT EXISTS (
      SELECT 1 FROM red_canales
      WHERE org_id = org_rec.id AND nombre = 'Coaches' AND is_system = true
    );

    -- Crear canal RRHH si no existe
    INSERT INTO red_canales (org_id, nombre, creado_por, miembros, is_system)
    SELECT org_rec.id, 'RRHH', owner_id, '[]'::jsonb, true
    WHERE NOT EXISTS (
      SELECT 1 FROM red_canales
      WHERE org_id = org_rec.id AND nombre = 'RRHH' AND is_system = true
    );
  END LOOP;
END $$;
