-- Reviews table for coach public profiles
-- Reviews can come from two sources:
-- 1. The nudge popup (cliente.html _reviewNudge → _submitReviewNudge → _pushReviewPublic)
-- 2. The main review card (cliente.html _saveResena) - but that uses candidatos.resena

CREATE TABLE IF NOT EXISTS reviews (
  id BIGSERIAL PRIMARY KEY,
  coach_slug TEXT NOT NULL,  -- FK to usuarios.slug (denormalized for edge function queries)
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  texto TEXT,
  nombre TEXT,  -- author name (from _reviewAuthorName)
  fuente TEXT NOT NULL DEFAULT 'portal',  -- 'portal', 'marketplace', etc
  publica BOOLEAN NOT NULL DEFAULT true,  -- false = private, not shown in listings
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Indexes for the edge function queries
  UNIQUE(coach_slug, id) -- ensures uniqueness and helps with sort
);

-- RLS: reviews are readable by anon (for public profiles) but only writable by authenticated clients
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reviews_anon_read" ON reviews
  FOR SELECT TO anon USING (true);

CREATE POLICY "reviews_authenticated_insert" ON reviews
  FOR INSERT TO authenticated WITH CHECK (true);

-- Grant anonymous and authenticated users read access
GRANT SELECT ON reviews TO anon, authenticated;
GRANT INSERT ON reviews TO authenticated;

-- Index for the edge function query: SELECT coach_slug, rating WHERE coach_slug IN (...) AND publica=true
CREATE INDEX idx_reviews_coach_slug_publica ON reviews(coach_slug, publica DESC);
