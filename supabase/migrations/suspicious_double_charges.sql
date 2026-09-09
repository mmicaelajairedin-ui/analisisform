-- ============================================================================
-- Doble Cobro Monitoreo y Recuperación
-- ============================================================================
-- Tabla para detectar y registrar casos donde un coach fue cargado en AMBAS
-- plataformas (Stripe y Apple IAP) casi simultáneamente.
--
-- Realidad arquitectónica:
--   - Stripe y Apple son sistemas independientes
--   - Entre el primer cobro y la validación/rechazo del segundo hay un lag
--   - Es IMPOSIBLE prevenir 100% (solo ~95% con eligibility checks)
--   - PERO es POSIBLE detectar (diaria) y recuperar (manual)
--
-- Estrategia 3-fases:
--   1. PREVENCIÓN (~95%): eligibility checks antes de permitir compra
--   2. DETECCIÓN (100%): query diaria que busca coaches en "ambas" al mismo tiempo
--   3. RECUPERACIÓN (manual): admin revisa logs y decide refund en cuál plataforma

CREATE TABLE IF NOT EXISTS suspicious_double_charges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Coach afectado
  coach_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,

  -- Identificadores de ambas plataformas
  stripe_charge_id TEXT, -- Stripe charge o subscription_id
  stripe_amount NUMERIC(10, 2), -- Monto cobrado en Stripe
  stripe_charge_at TIMESTAMPTZ,

  apple_transaction_id TEXT, -- Apple original_transaction_id
  apple_amount NUMERIC(10, 2), -- Monto en Apple (convertir a USD si aplica)
  apple_charge_at TIMESTAMPTZ,

  -- Diferencia temporal entre cobros (ms)
  time_delta_ms INTEGER, -- si > 5 min (300000 ms): probablemente independiente, no doble cobro

  -- Moneda
  currency TEXT DEFAULT 'USD',

  -- Severidad: auto-detected vs requiere revisión
  severity TEXT NOT NULL DEFAULT 'review'
    CHECK (severity IN ('auto_refund', 'review', 'false_positive')),

  -- Resolución
  resolved BOOLEAN DEFAULT false,
  resolution_type TEXT, -- 'refund_stripe' | 'refund_apple' | 'keep_both' | 'false_positive'
  refund_amount NUMERIC(10, 2), -- Monto reembolsado
  refund_processed_at TIMESTAMPTZ,
  refund_notes TEXT, -- Notas del admin sobre la decisión

  -- Audit
  detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES usuarios(id), -- Qué admin lo revisó

  -- Email al coach
  notification_sent BOOLEAN DEFAULT false,
  notification_sent_at TIMESTAMPTZ,
  notification_method TEXT, -- 'email' | 'whatsapp' | 'both'

  -- Metadata
  notes JSONB -- Contexto adicional (logs, debugging info, etc.)
);

-- Índices
CREATE INDEX idx_suspicious_double_charges_coach_id ON suspicious_double_charges(coach_id);
CREATE INDEX idx_suspicious_double_charges_resolved ON suspicious_double_charges(resolved);
CREATE INDEX idx_suspicious_double_charges_detected_at ON suspicious_double_charges(detected_at);
CREATE INDEX idx_suspicious_double_charges_severity ON suspicious_double_charges(severity);
CREATE INDEX idx_suspicious_double_charges_stripe_charge_id ON suspicious_double_charges(stripe_charge_id);
CREATE INDEX idx_suspicious_double_charges_apple_transaction_id ON suspicious_double_charges(apple_transaction_id);

-- RLS: Solo admin y affected coach ven
ALTER TABLE suspicious_double_charges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS suspicious_double_charges_select ON suspicious_double_charges;
CREATE POLICY suspicious_double_charges_select ON suspicious_double_charges FOR SELECT
  USING (
    coach_id = public.pw_coach_id()
    OR public.pw_is_admin()
  );

-- Insert: SOLO edge functions (detection job)
DROP POLICY IF EXISTS suspicious_double_charges_insert ON suspicious_double_charges;
CREATE POLICY suspicious_double_charges_insert ON suspicious_double_charges FOR INSERT
  WITH CHECK (false); -- Service role bypasses

-- Update: SOLO admin (para marcar resuelto, agregar notas, etc.)
DROP POLICY IF EXISTS suspicious_double_charges_update ON suspicious_double_charges;
CREATE POLICY suspicious_double_charges_update ON suspicious_double_charges FOR UPDATE
  USING (public.pw_is_admin())
  WITH CHECK (public.pw_is_admin());

-- ============================================================================
-- Edge Function: Daily Detection Job
-- ============================================================================
-- Corre diariamente (vía Supabase Cron o GitHub Actions).
-- Query: coaches que simultáneamente tienen:
--   - status='active' en usuarios_suscripciones_iap Y expires_date > NOW()
--   - Stripe activo en usuarios.configuracion JSONB (estado_sub='activa'|'prueba', fecha_fin_periodo > NOW)
--
-- Si encuentra: inserta en suspicious_double_charges con severity='review'.
--
-- Fuente de verdad Stripe:
--   - usuarios.configuracion->>'stripe_customer_id' (indica presencia de Stripe)
--   - usuarios.configuracion->>'estado_sub' (valores: 'activa', 'prueba', 'cancelada', etc.)
--   - usuarios.configuracion->>'fecha_fin_periodo' (current_period_end del webhook Stripe)

-- ============================================================================
-- Helper: Función para detectar doble cobro (para queries manuales)
-- ============================================================================
-- Detecta coaches con suscripción Apple IAP activa Y Stripe activo simultáneamente.
-- Datos Stripe vienen de usuarios.configuracion JSONB (actualizado por stripe-webhook).
-- Datos IAP vienen de usuarios_suscripciones_iap table.
CREATE OR REPLACE FUNCTION public.detect_double_charges()
RETURNS TABLE (
  coach_id UUID,
  stripe_charge_id TEXT,
  apple_transaction_id TEXT,
  stripe_amount NUMERIC,
  apple_amount NUMERIC,
  time_delta_ms INTEGER,
  currency TEXT
) AS $$
  SELECT
    u.id,
    (u.configuracion->>'stripe_subscription_id')::TEXT,
    iap.original_transaction_id,
    NULL::NUMERIC, -- stripe_amount not tracked in usuarios.configuracion (edge function can extract)
    NULL::NUMERIC, -- apple_amount not tracked in usuarios_suscripciones_iap (TODO: add to schema)
    EXTRACT(EPOCH FROM (iap.expires_date - (u.configuracion->>'fecha_fin_periodo')::TIMESTAMPTZ))::INTEGER * 1000,
    'USD'::TEXT
  FROM usuarios u
  INNER JOIN usuarios_suscripciones_iap iap ON iap.coach_id = u.id
  WHERE
    -- Apple IAP is active
    iap.status = 'active' AND iap.expires_date > now()
    -- Stripe is active (from configuracion JSONB)
    AND (u.configuracion->>'stripe_customer_id') IS NOT NULL
    AND (u.configuracion->>'estado_sub') IN ('activa', 'prueba')
    AND (u.configuracion->>'fecha_fin_periodo')::TIMESTAMPTZ > now()
$$ LANGUAGE sql STABLE SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.detect_double_charges() TO authenticated, anon;

-- ============================================================================
-- Notas de Implementación
-- ============================================================================
--
-- 1. Prevención (Fase 1 Backend):
--    - Before inserting into usuarios_suscripciones_iap (validate-iap endpoint):
--      Check usuarios.configuracion JSONB:
--        IF stripe_customer_id IS NOT NULL
--        AND estado_sub IN ('activa', 'prueba')
--        AND fecha_fin_periodo > NOW()
--      THEN reject purchase with 409 "Ya tienes un plan activo"
--
-- 2. Detección (Daily Job, Fase 1.5):
--    - Cron job que cada 24h corre detect_double_charges()
--    - Por cada fila, inserta en suspicious_double_charges
--    - Severity = 'review' (requiere revisión manual)
--    - Notifica a admin via email
--
-- 3. Recuperación (Manual, Admin Dashboard):
--    - Admin revisa suspicious_double_charges lista
--    - Abre el coach en panel
--    - Revisa logs de Stripe y Apple
--    - Decide: refund_stripe? refund_apple? keep_both?
--    - UPDATE suspicious_double_charges:
--      - resolved = true
--      - resolution_type = 'refund_stripe' | etc.
--      - refund_amount
--      - refund_processed_at
--    - Si refund: ejecutar manualmente en Stripe/Apple API
--    - Enviar email/WhatsApp al coach explicando
--
-- 4. Recuperación de Datos:
--    - Stripe refund: vía Stripe Dashboard o API (reversible)
--    - Apple refund: vía App Store Connect (reversible)
--    - NUNCA borrar el cargo, solo reembolsar
--
-- 5. Queries útiles:
--    a) Doble cobro no resuelto:
--       SELECT coach_id, stripe_charge_id, apple_transaction_id, detected_at
--       FROM suspicious_double_charges
--       WHERE resolved = false ORDER BY detected_at DESC;
--
--    b) Doble cobro por coach:
--       SELECT * FROM suspicious_double_charges
--       WHERE coach_id = ? ORDER BY detected_at DESC;
--
--    c) Monto total en "revisión":
--       SELECT SUM(stripe_amount + apple_amount) as total_under_review
--       FROM suspicious_double_charges WHERE resolved = false;

-- ============================================================================
-- Verificación post-creación
-- ============================================================================
-- SELECT * FROM suspicious_double_charges LIMIT 1;
-- SELECT count(*) FROM suspicious_double_charges;
-- SELECT severity, count(*) FROM suspicious_double_charges GROUP BY severity;
