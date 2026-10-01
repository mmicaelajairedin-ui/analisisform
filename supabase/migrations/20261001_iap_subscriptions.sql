-- IAP Subscriptions Table — Pathway iOS In-App Purchases
-- Stores Apple StoreKit 2 subscription data for coaches

CREATE TABLE IF NOT EXISTS usuarios_suscripciones_iap (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,

  -- Apple transaction identifiers
  original_transaction_id VARCHAR(255) NOT NULL UNIQUE, -- Apple's unique ID (stays same across renewals)
  app_account_token UUID NOT NULL, -- Links purchase to coach's auth session

  -- Product & pricing
  product_id VARCHAR(255) NOT NULL, -- coach.plan.basic.monthly | coach.plan.pro.monthly

  -- Subscription state (Apple App Store Server Notifications states)
  state VARCHAR(50) NOT NULL CHECK (state IN (
    'active',          -- subscription is active
    'grace_period',    -- payment failed but within grace period
    'billing_retry',   -- retrying billing after failed payment
    'expired',         -- expired or not renewed
    'revoked',         -- user revoked
    'refunded'         -- refund issued
  )),

  -- Dates (ISO 8601)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  renewal_date TIMESTAMPTZ,

  -- Apple notification tracking (idempotency)
  last_notification_type VARCHAR(100),
  last_notification_at TIMESTAMPTZ,
  notification_count INT DEFAULT 0,

  -- Metadata
  environment VARCHAR(20) DEFAULT 'production' CHECK (environment IN ('sandbox', 'production')),
  auto_renew_status BOOLEAN DEFAULT true,
  price_usd DECIMAL(10, 2),
  billing_cycle VARCHAR(20),

  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_usuarios_suscripciones_iap_usuario_id
  ON usuarios_suscripciones_iap(usuario_id);

CREATE INDEX IF NOT EXISTS idx_usuarios_suscripciones_iap_app_account_token
  ON usuarios_suscripciones_iap(app_account_token);

CREATE INDEX IF NOT EXISTS idx_usuarios_suscripciones_iap_product_id
  ON usuarios_suscripciones_iap(product_id);

CREATE INDEX IF NOT EXISTS idx_usuarios_suscripciones_iap_state
  ON usuarios_suscripciones_iap(state);

CREATE INDEX IF NOT EXISTS idx_usuarios_suscripciones_iap_expires_at
  ON usuarios_suscripciones_iap(expires_at);

-- RLS: Coaches can read only their own subscriptions
ALTER TABLE usuarios_suscripciones_iap ENABLE ROW LEVEL SECURITY;

CREATE POLICY "usuarios_suscripciones_iap_select_own"
  ON usuarios_suscripciones_iap
  FOR SELECT
  USING (usuario_id = auth.uid());

-- Service role (functions) can do everything
CREATE POLICY "usuarios_suscripciones_iap_service_role"
  ON usuarios_suscripciones_iap
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Anonymous role can only check entitlement (read active subscriptions)
CREATE POLICY "usuarios_suscripciones_iap_anon_read_active"
  ON usuarios_suscripciones_iap
  FOR SELECT
  USING (auth.role() = 'anon' AND state IN ('active', 'grace_period'));

COMMENT ON TABLE usuarios_suscripciones_iap IS
  'Tracks Apple StoreKit 2 subscriptions. Linked to usuarios by user ID and app_account_token. State synchronized via webhook from Apple App Store Server Notifications V2.';
