-- fit_nutri_real: lo que el cliente REALMENTE comió cuando difiere del plan del
-- coach, por COMIDA (misma idea que fit_ejercicios_real del gym). El cliente lo
-- registra con el botón ✎ de cada comida en su portal fitness (sección
-- Nutrición → Plan de la semana); el coach lo ve en su panel (pestaña Nutrición)
-- con el valor del plan TACHADO + lo real al lado. Formato JSON, indexado por
-- día + etiqueta de la comida:
--   { "lun|Almuerzo": { "r":"atún a la plancha", "ts":"2026-07-28" } }
--   r = lo que comió de verdad (si cambió)
alter table candidatos add column if not exists fit_nutri_real text;
