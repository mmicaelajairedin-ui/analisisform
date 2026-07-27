-- kind canónico de la cita = el MODO de la Sala.
--   sesion          → coach + cliente que ya está adentro (0%)
--   primera_llamada → coach + persona nueva (posible cliente)
--   demo_pathway    → admin/empleado + prospecto de coach
--   personal        → agenda suelta (sin Sala)
-- Aditivo y seguro: las citas viejas quedan con kind NULL → el código las trata
-- como 'sesion' por defecto. NO toca cobros (eso es la Fase 2 con candidatos.origen).
ALTER TABLE citas ADD COLUMN IF NOT EXISTS kind TEXT;
