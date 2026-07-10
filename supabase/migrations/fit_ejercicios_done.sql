-- Registro de ejercicios que el cliente MARCA como hechos en su rutina.
-- Antes toggleEx() solo tachaba en pantalla (ni localStorage ni base) → al
-- recargar se perdía TODO lo marcado y el coach nunca veía qué entrenó.
-- Ahora se guarda por FECHA: { "2026-07-10": { "1|Lunes|Press de banca": 1, ... } }
-- Así sobrevive la recarga, se resetea cada día (la rutina se repite) y el coach
-- puede ver por día qué hizo el cliente. El día de gym también se marca en
-- fit_habitos.gym (que el coach ya ve en el calendario).
-- Idempotente.
ALTER TABLE candidatos ADD COLUMN IF NOT EXISTS fit_ejercicios_done TEXT DEFAULT '{}';
