-- ===================================================================
-- RAÍZ del problema "clientes que nacen inactivos y no pueden entrar".
--
-- Síntoma: un cliente entra, pone su contraseña y le dice "pendiente de pago"
-- / "acceso pausado", o no aparece en el panel de su coach. Causa: su fila
-- nació con activo = false.
--
-- Por qué nacía inactivo: si el DEFAULT de la columna `activo` es false (o no
-- tiene default), cualquier INSERT que no setee `activo` explícitamente crea la
-- fila inactiva. El código ya fuerza activo:true en las altas (panel +
-- formulario), pero esto SELLA cualquier otra vía presente o futura.
--
-- Esta migración pone el DEFAULT en true para candidatos y usuarios. Solo
-- afecta a inserciones FUTURAS que omitan la columna; no toca filas existentes.
-- Idempotente y segura.
--
-- Aplicar una vez en Supabase Studio → SQL Editor.
-- ===================================================================

ALTER TABLE candidatos ALTER COLUMN activo SET DEFAULT true;
ALTER TABLE usuarios   ALTER COLUMN activo SET DEFAULT true;

-- Verificación (debería mostrar 'true' en column_default para ambas):
SELECT table_name, column_name, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('candidatos','usuarios')
  AND column_name = 'activo';
