-- ============================================================================
-- IAP Coach Plans — Main subscription table
-- ============================================================================
-- Tabla central para gestionar suscripciones Apple IAP (auto-renewable).
--
-- Modelo: Cada coach (usuarios.id) puede tener UNA suscripción IAP activa.
-- La suscripción tiene un status que refleja su ciclo de vida (active,
-- expired, grace_period, billing_retry, revoked, refunded).
--
-- Datos importantes:
--   - expires_date: cuándo expira (Apple, timestamp)
--   - status: estado actual (6+ valores)
--   - payment_source: 'apple_iap' (diferencia de Stripe)
--   - originalTransactionId: Apple identifier único (para reconciliación)
--   - appAccountToken: UUID que linkea a usuarios.app_account_token
--
-- Operaciones:
--   - Webhook de Apple: UPDATE con nuevo status/expires_date
--   - Check de entitlement: SELECT status, expires_date WHERE coach_id=$1
--   - Reconciliación: SELECT ... WHERE status='active' AND expires_date > NOW()

CREATE TABLE IF NOT EXISTS usuarios_suscripciones_iap (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Relación con coach
  coach_id UUID NOT NULL UNIQUE REFERENCES usuarios(id) ON DELETE CASCADE,

  -- Apple identifiers
  original_transaction_id TEXT NOT NULL UNIQUE,
  app_account_token UUID NOT NULL,

  -- Producto (plan)
  product_id TEXT NOT NULL, -- 'coach.plan.basic.monthly' | 'coach.plan.pro.monthly'
  bundle_id TEXT NOT NULL DEFAULT 'com.pathwaycareercoach.ios',

  -- Lifecycle states
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'expired', 'grace_period', 'billing_retry', 'revoked', 'refunded')),

  -- Dates
  purchase_date TIMESTAMPTZ NOT NULL,
  expires_date TIMESTAMPTZ NOT NULL,
  grace_period_expires_at TIMESTAMPTZ, -- solo si status='grace_period'
  renewal_cancelled_at TIMESTAMPTZ, -- fecha en que coach canceló renovación
  refunded_at TIMESTAMPTZ, -- solo si status='refunded'

  -- Environment (sandbox vs production)
  environment TEXT NOT NULL DEFAULT 'sandbox'
    CHECK (environment IN ('sandbox', 'production')),

  -- Payment source identifier (Pathway-specific)
  payment_source TEXT NOT NULL DEFAULT 'apple_iap',

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_webhook_at TIMESTAMPTZ, -- cuándo se actualizó por última vez vía webhook

  -- Metadata para debugging
  last_notification_type TEXT, -- 'SUBSCRIBED', 'DID_RENEW', 'GRACE_PERIOD_EXPIRED', etc.
  error_message TEXT -- si hubo error en último procesamiento
);

-- Índices para queries rápidas
CREATE INDEX idx_usuarios_suscripciones_iap_coach_id ON usuarios_suscripciones_iap(coach_id);
CREATE INDEX idx_usuarios_suscripciones_iap_status ON usuarios_suscripciones_iap(status);
CREATE INDEX idx_usuarios_suscripciones_iap_expires_date ON usuarios_suscripciones_iap(expires_date);
CREATE INDEX idx_usuarios_suscripciones_iap_original_transaction_id ON usuarios_suscripciones_iap(original_transaction_id);
CREATE INDEX idx_usuarios_suscripciones_iap_app_account_token ON usuarios_suscripciones_iap(app_account_token);
CREATE INDEX idx_usuarios_suscripciones_iap_product_id ON usuarios_suscripciones_iap(product_id);

-- RLS: Los coaches ven solo su propia suscripción
ALTER TABLE usuarios_suscripciones_iap ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS usuarios_suscripciones_iap_select ON usuarios_suscripciones_iap;
CREATE POLICY usuarios_suscripciones_iap_select ON usuarios_suscripciones_iap FOR SELECT
  USING (
    coach_id = public.pw_coach_id()
    OR public.pw_is_admin()
  );

-- Update: solo edge functions (service role) y admin
DROP POLICY IF EXISTS usuarios_suscripciones_iap_update ON usuarios_suscripciones_iap;
CREATE POLICY usuarios_suscripciones_iap_update ON usuarios_suscripciones_iap FOR UPDATE
  USING (public.pw_is_admin())
  WITH CHECK (public.pw_is_admin());

-- Insert: solo edge functions (service role) y admin (via frontend raro)
DROP POLICY IF EXISTS usuarios_suscripciones_iap_insert ON usuarios_suscripciones_iap;
CREATE POLICY usuarios_suscripciones_iap_insert ON usuarios_suscripciones_iap FOR INSERT
  WITH CHECK (public.pw_is_admin());

-- Delete: solo admin
DROP POLICY IF EXISTS usuarios_suscripciones_iap_delete ON usuarios_suscripciones_iap;
CREATE POLICY usuarios_suscripciones_iap_delete ON usuarios_suscripciones_iap FOR DELETE
  USING (public.pw_is_admin());

-- Trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION public.update_usuarios_suscripciones_iap_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS usuarios_suscripciones_iap_update_timestamp ON usuarios_suscripciones_iap;
CREATE TRIGGER usuarios_suscripciones_iap_update_timestamp
  BEFORE UPDATE ON usuarios_suscripciones_iap
  FOR EACH ROW
  EXECUTE FUNCTION public.update_usuarios_suscripciones_iap_timestamp();

-- Helper: verificar si coach tiene entitlement activo
CREATE OR REPLACE FUNCTION public.pw_has_apple_iap_entitlement(p_coach_id UUID)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM usuarios_suscripciones_iap
    WHERE coach_id = p_coach_id
      AND status IN ('active', 'grace_period')
      AND expires_date > now()
  )
$$;

GRANT EXECUTE ON FUNCTION public.pw_has_apple_iap_entitlement(UUID) TO anon, authenticated;

-- ============================================================================
-- Agregar columna a usuarios para guardar app_account_token
-- ============================================================================
-- El app_account_token es el UUID que Apple incluye en cada transacción
-- e identifica al coach en el lado Apple/cliente iOS.

ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS app_account_token UUID UNIQUE;
CREATE INDEX IF NOT EXISTS idx_usuarios_app_account_token ON usuarios(app_account_token);

-- ============================================================================
-- Agregar columna payment_source a usuarios (ya existe probablemente)
-- ============================================================================
-- Distingue entre Stripe, Apple IAP, y manual override.
-- Si no existe, crearla.

ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS payment_source TEXT
  DEFAULT 'stripe'
  CHECK (payment_source IN ('stripe', 'apple_iap', 'manual_override'));

-- ============================================================================
-- Actualización automática de payment_source en usuarios
-- ============================================================================
-- Cuando se crea/actualiza una suscripción IAP, sincronizar payment_source.

CREATE OR REPLACE FUNCTION public.sync_payment_source_on_iap()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE usuarios
  SET payment_source = 'apple_iap'
  WHERE id = NEW.coach_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS sync_payment_source_on_iap_insert ON usuarios_suscripciones_iap;
CREATE TRIGGER sync_payment_source_on_iap_insert
  AFTER INSERT ON usuarios_suscripciones_iap
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_payment_source_on_iap();

-- ============================================================================
-- Notas para implementación Fase 1
-- ============================================================================
--
-- Condiciones para eligibilidad:
--   1. Coach puede comprar Apple IAP si NO tiene Stripe activo:
--      SELECT NOT EXISTS (
--        SELECT 1 FROM usuarios_suscripciones_stripe
--        WHERE coach_id = ? AND status = 'active' AND current_period_end > now()
--      )
--
--   2. Coach puede comprar Stripe si NO tiene Apple IAP activo:
--      SELECT NOT pw_has_apple_iap_entitlement(?)
--
-- Estados de acceso:
--   - active: acceso completo ✅
--   - grace_period: acceso completo (3 días para pagar) ✅
--   - billing_retry: SIN acceso (Apple retrying) ❌
--   - expired: SIN acceso ❌
--   - revoked: SIN acceso ❌
--   - refunded: SIN acceso ❌

-- ============================================================================
-- Verificación post-creación
-- ============================================================================
-- SELECT * FROM usuarios_suscripciones_iap LIMIT 1;
-- SELECT count(*) FROM usuarios_suscripciones_iap;
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name='usuarios_suscripciones_iap' ORDER BY ordinal_position;
