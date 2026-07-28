-- fit_ejercicios_real: lo que el cliente REALMENTE hizo en el gym cuando difiere
-- del plan que cargó el coach (hizo más series/peso, o cambió el ejercicio).
-- El cliente lo registra con el botón ✎ de cada ejercicio en su portal fitness;
-- el coach lo ve en su panel (pestaña Gym) con el valor del plan TACHADO + el
-- real al lado. Formato JSON, indexado por la misma clave que _exKey del portal:
--   { "1|Lunes · Tren superior|Press de banca": { "m":"4×12 · 35 kg", "n":"", "ts":"2026-07-28" } }
--   m = series×reps · peso real (si cambió);  n = otro ejercicio (si lo cambió)
alter table candidatos add column if not exists fit_ejercicios_real text;
