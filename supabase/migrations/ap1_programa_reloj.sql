-- ===================================================================
-- AP1 · El reloj del programa
--
-- PROBLEMA: `semana_activa` solo cambia si el coach entra y la sube a mano.
-- Medido el 2026-08-27: 58 de 73 clientes llevan meses congelados en la
-- semana 1, y con ellos todo lo que cuelga de ese numero (recursos por semana,
-- roadmap, medallas, "nueva semana"). El programa no tiene calendario propio:
-- tiene un numero que alguien tiene que acordarse de subir.
--
-- SOLUCION: la semana se DERIVA de una fecha de inicio. `semana_activa` deja de
-- ser la fuente y pasa a ser una cache del valor derivado (para que las
-- consultas y los emails que ya lo leen sigan funcionando sin cambios).
--
--   programa_inicio    date     · cuando arranco el programa
--   programa_semanas   int      · cuanto dura (NULL = 4, el valor de siempre)
--   programa_pausado   boolean  · congela la semana donde este
--
-- El calculo vive en pw-programa.js (una sola fuente para panel y portal).
--
-- Aplicar: automatico al mergear a main (supabase-migrations.yml).
-- ===================================================================

ALTER TABLE candidatos ADD COLUMN IF NOT EXISTS programa_inicio  DATE;
ALTER TABLE candidatos ADD COLUMN IF NOT EXISTS programa_semanas INTEGER;
ALTER TABLE candidatos ADD COLUMN IF NOT EXISTS programa_pausado BOOLEAN DEFAULT false;

-- ── GRANT explicito de las columnas nuevas ──────────────────────────
-- Sin esto se repite el incidente documentado en CLAUDE.md: `game_pts`,
-- `game_medal` y `last_seen` se añadieron a `usuarios` despues de un re-grant
-- por columna, no quedaron cubiertas, y `select=game_pts` devolvia 403.
-- Es idempotente: si el grant original era a nivel de tabla, no cambia nada.
GRANT SELECT (programa_inicio, programa_semanas, programa_pausado)
  ON candidatos TO anon, authenticated;
GRANT UPDATE (programa_inicio, programa_semanas, programa_pausado)
  ON candidatos TO anon, authenticated;
GRANT INSERT (programa_inicio, programa_semanas, programa_pausado)
  ON candidatos TO anon, authenticated;

-- ── Backfill que NO mueve a nadie de semana (criterio AP1-B) ────────
-- El protocolo del proyecto prohibe que un sprint cambie lo que se ve fuera de
-- su alcance. Un backfill ingenuo (`programa_inicio = created_at`) mandaria de
-- golpe a decenas de clientes a "programa terminado" el dia del deploy.
--
-- En su lugar se ancla la fecha de inicio HACIA ATRAS desde la semana que el
-- cliente ya muestra: inicio = hoy - (semana_actual - 1) x 7 dias. Asi la
-- semana derivada del dia del deploy es EXACTAMENTE la que se veia el dia
-- anterior, y el reloj arranca desde ahi.
--
-- greatest(...,1) cubre los 3 clientes con semana_activa = 0, que el frontend
-- ya mostraba como 1 (`parseInt(x)||1` en cliente.html, `if(!(wk>=1)) wk=1` en
-- panel-v2.html): tampoco cambian.
UPDATE candidatos
   SET programa_inicio = (CURRENT_DATE - ((GREATEST(COALESCE(semana_activa, 1), 1) - 1) * 7))
 WHERE programa_inicio IS NULL;

-- ── Verificacion post-deploy (criterio AP1-B) ───────────────────────
-- Debe devolver 0 filas: ningun cliente cambia de semana visible.
--
--   SELECT id, semana_activa AS antes,
--          LEAST(GREATEST(((CURRENT_DATE - programa_inicio) / 7) + 1, 1),
--                COALESCE(programa_semanas, 4)) AS despues
--     FROM candidatos
--    WHERE programa_inicio IS NOT NULL
--      AND LEAST(GREATEST(((CURRENT_DATE - programa_inicio) / 7) + 1, 1),
--                COALESCE(programa_semanas, 4))
--          <> GREATEST(COALESCE(semana_activa, 1), 1);
