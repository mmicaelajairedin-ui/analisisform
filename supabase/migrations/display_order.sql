-- Agregar columna display_order para ordenamiento manual de coaches
ALTER TABLE usuarios ADD COLUMN display_order INTEGER DEFAULT 0;

-- Inicializar con valores basados en created_at (coaches más viejos = números menores)
UPDATE usuarios
SET display_order = (
  SELECT COUNT(*)
  FROM usuarios u2
  WHERE u2.created_at <= usuarios.created_at AND u2.rol IN ('coach', 'admin')
);

-- Índice para consultas rápidas
CREATE INDEX idx_usuarios_display_order ON usuarios(display_order) WHERE rol IN ('coach', 'admin');
