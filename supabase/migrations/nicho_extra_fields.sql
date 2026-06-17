-- ===================================================================
-- Campos extra de nicho en `candidatos` (base de career, ddxnrsnjdvtqhxunxnwj).
-- Aplicar UNA vez en el SQL editor de Supabase. IF NOT EXISTS = seguro.
-- ===================================================================

-- Intake financiero (los lee la edge function generar-informe).
ALTER TABLE candidatos ADD COLUMN IF NOT EXISTS ingresos TEXT;          -- ingreso mensual
ALTER TABLE candidatos ADD COLUMN IF NOT EXISTS gastos TEXT;            -- gasto mensual aprox
ALTER TABLE candidatos ADD COLUMN IF NOT EXISTS deudas TEXT;            -- deuda total / descripción
ALTER TABLE candidatos ADD COLUMN IF NOT EXISTS objetivo_ahorro TEXT;  -- meta de ahorro
ALTER TABLE candidatos ADD COLUMN IF NOT EXISTS plazo TEXT;            -- plazo de la meta
ALTER TABLE candidatos ADD COLUMN IF NOT EXISTS ahorro_actual TEXT;    -- ahorro acumulado hoy

-- Gestión financiera estructurada (las carga el coach, las ve el cliente en el portal).
ALTER TABLE candidatos ADD COLUMN IF NOT EXISTS fin_objetivos TEXT;    -- JSON [{tipo,nombre,meta,actual,fecha,porque,aporte,nota,hilo:[{from,text,ts}]}] (metas colaborativas coach<->cliente)
ALTER TABLE candidatos ADD COLUMN IF NOT EXISTS fin_patrimonio TEXT;   -- JSON [{tipo,nombre,valor}] (activos del cliente: inversiones, propiedades, efectivo...)
ALTER TABLE candidatos ADD COLUMN IF NOT EXISTS fin_deudas TEXT;       -- JSON [{nombre, monto, cuota, estado}]
ALTER TABLE candidatos ADD COLUMN IF NOT EXISTS fin_cierres TEXT;      -- JSON [{mes, vivienda, alimentacion, ocio, deudas, ahorro}]
ALTER TABLE candidatos ADD COLUMN IF NOT EXISTS fin_diagnostico TEXT;  -- JSON {salud, control, deuda, ahorro} (0-100)

-- Fitness: plan de nutrición (texto que escribe el coach, lo ve el cliente).
ALTER TABLE candidatos ADD COLUMN IF NOT EXISTS fit_nutricion TEXT;
