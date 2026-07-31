-- Agregar tracking de conexión real del cliente en videosesiones
-- Indica si el cliente realmente se conectó (true), se intentó pero no (false), o desconocido (null)
ALTER TABLE citas ADD COLUMN IF NOT EXISTS cliente_conectado BOOLEAN;

-- Para el historial de llamadas en el panel, queremos saber si el cliente se conectó
-- Índice para queries que filtren por este campo
CREATE INDEX IF NOT EXISTS citas_cliente_conectado_idx ON citas (cliente_conectado);
