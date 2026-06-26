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
-- Aplicar UNA vez en Supabase (SQL editor).

-- 1) Columna + índice
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS coach_slug TEXT;
CREATE INDEX IF NOT EXISTS idx_reviews_coach_slug ON reviews (coach_slug);

-- Las reseñas existentes quedan con coach_slug = NULL => siguen siendo las
-- reseñas de Pathway que aparecen en la landing. No hay que tocarlas.

-- 2) Cargar las 2 reseñas de clientes de Micaela en SU perfil de coach.
--    >>> Reemplazá  __TU_SLUG__  por tu slug real de coach (el de /coach/<slug>).
--    (las comillas simples internas van duplicadas '' por sintaxis SQL)

INSERT INTO reviews (nombre, rating, texto, fuente, publica, coach_slug) VALUES
(
  'Juan José Borregales Rivero',
  5,
  'Everything was great. We are still working together, but Micaela''s advice was very helpful, and she went above and beyond to make sure I got the best advice. I would definitively recommend her and hire her again.',
  'upwork',
  true,
  '__TU_SLUG__'
),
(
  'Juan Díaz',
  5,
  'Micaela went above and beyond helping me review my CV and LinkedIn profile. Great, fast and clear communication. Her insights really helped me improve my CV.',
  'upwork',
  true,
  '__TU_SLUG__'
);

-- Listo. Tu perfil /coach/__TU_SLUG__ mostrará estas 2 reseñas; la landing sigue
-- mostrando solo las de Pathway (coach_slug NULL).
