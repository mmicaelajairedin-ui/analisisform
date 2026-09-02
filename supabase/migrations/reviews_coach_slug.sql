-- Reseñas por coach — Pathway Career Coach
--
-- Agrega una columna `coach_slug` a la tabla `reviews` para vincular cada
-- reseña a un coach concreto.
--   coach_slug NULL  -> reseña de PATHWAY (sale en la landing, index.html)
--   coach_slug = X   -> reseña del coach con slug X (sale en /coach/X)
--
-- testimonios.js filtra:
--   landing  (sin data-coach)        -> WHERE coach_slug IS NULL
--   coach.html (data-coach="<slug>") -> WHERE coach_slug = '<slug>'
--
-- Aplicar en Supabase (SQL editor).

-- 1) Columna + índice  (idempotente: si ya lo corriste, no pasa nada)
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS coach_slug TEXT;
CREATE INDEX IF NOT EXISTS idx_reviews_coach_slug ON reviews (coach_slug);
-- Las reseñas existentes quedan con coach_slug = NULL => siguen siendo las
-- reseñas de Pathway que aparecen en la landing. No hay que tocarlas.

-- 2a) Corregir el slug de las reseñas de Micaela a su slug REAL, el que tiene
--     su fila en `usuarios`: 'micaela-jairedin' (perfil: /coach/micaela-jairedin).
--
--     ⚠️ SEPTIEMBRE 2026 — ESTE BLOQUE ESTABA AL REVÉS. Ponía 'micaelajairedin'
--     (sin guion), que no coincide con NINGÚN usuario, así que las 2 reseñas de
--     Upwork dejaron de salir en su perfil y en el ★ del directorio. Corregido
--     aquí y en la base. NO volver a invertirlo: el slug con guion es el bueno.
UPDATE reviews SET coach_slug = 'micaela-jairedin'
WHERE coach_slug IN ('micaelajairedin', '__TU_SLUG__');

-- 2b) Si TODAVÍA no insertaste las 2 reseñas, corré este INSERT
--     (si ya las tenés, NO lo corras de nuevo para no duplicarlas):
INSERT INTO reviews (nombre, rating, texto, fuente, publica, coach_slug) VALUES
(
  'Juan José Borregales Rivero',
  5,
  'Everything was great. We are still working together, but Micaela''s advice was very helpful, and she went above and beyond to make sure I got the best advice. I would definitively recommend her and hire her again.',
  'upwork',
  true,
  'micaela-jairedin'
),
(
  'Juan Díaz',
  5,
  'Micaela went above and beyond helping me review my CV and LinkedIn profile. Great, fast and clear communication. Her insights really helped me improve my CV.',
  'upwork',
  true,
  'micaela-jairedin'
);

-- 3) Verificar que quedaron bien:
-- SELECT nombre, rating, coach_slug, publica FROM reviews WHERE coach_slug = 'micaela-jairedin';
