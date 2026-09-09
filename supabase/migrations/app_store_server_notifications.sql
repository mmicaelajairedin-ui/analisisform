-- ============================================================================
-- Apple Server Notifications V2 — Audit Log
-- ============================================================================
-- Tabla que guarda CADA notificación que llega de Apple (webhook).
--
-- Propósito:
--   1. Audit trail: quién cambió qué cuándo
--   2. Debugging: buscar notificaciones específicas por tipo/coach/fecha
--   3. Idempotencia: verificar si una notification_id ya fue procesada
--   4. Reconciliación: detectar notificaciones perdidas o fuera de orden
--
-- Flujo:
--   1. Apple envía webhook → apple-iap-webhook Edge Function recibe payload
--   2. Edge Function valida JWT, extrae notificationType y datos
--   3. Inserta en app_store_server_notifications (notification_id UNIQUE)
--   4. Procesa la notificación (actualiza usuarios_suscripciones_iap)
--   5. Si notification_id duplicado → rechaza (UNIQUE constraint)
--
-- Nota importante:
--   Apple recomienda al menos 6 reintentos de webhook si no recibimos 200 OK.
--   El UNIQUE en notification_id evita que procesar la notificación 2 veces.

CREATE TABLE IF NOT EXISTS app_store_server_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Apple notification identifier (ÚNICA por suscripción + evento)
  notification_id TEXT NOT NULL UNIQUE,

  -- Coach afectado (NULL si no se pudo determinar identidad)
  coach_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,

  -- Identificadores Apple
  original_transaction_id TEXT,
  bundle_id TEXT NOT NULL DEFAULT 'com.pathwaycareercoach.ios',

  -- Tipo de evento (12 tipos en Server Notifications V2)
  notification_type TEXT NOT NULL
    CHECK (notification_type IN (
      'SUBSCRIBED',
      'DID_RENEW',
      'DID_FAIL_TO_RENEW',
      'DID_RECOVER',
      'DID_CHANGE_RENEWAL_PREF',
      'DID_CHANGE_RENEWAL_STATUS',
      'GRACE_PERIOD_EXPIRED',
      'EXPIRED',
      'REVOKE',
      'REFUND',
      'PRICE_INCREASE',
      'OFFER_REDEEMED'
    )),

  -- Subtype (depende del tipo principal)
  sub_type TEXT,

  -- El JWT completo que envió Apple (guardado por auditoría/debugging)
  -- ⚠️ Contiene datos sensibles: guarda en RLS restrictiva
  raw_payload JSONB,

  -- Datos extraídos (easier querying)
  data JSONB, -- contiene: expiresDate, originalTransactionId, productId, etc.

  -- Procesamiento
  processed BOOLEAN DEFAULT false,
  processed_at TIMESTAMPTZ,
  processing_error TEXT, -- si hubo error al procesar

  -- Audit
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Entorno (sandbox vs production)
  environment TEXT NOT NULL DEFAULT 'sandbox'
    CHECK (environment IN ('sandbox', 'production'))
);

-- Índices para queries rápidas
CREATE INDEX idx_app_store_notifications_coach_id ON app_store_server_notifications(coach_id);
CREATE INDEX idx_app_store_notifications_notification_type ON app_store_server_notifications(notification_type);
CREATE INDEX idx_app_store_notifications_received_at ON app_store_server_notifications(received_at);
CREATE INDEX idx_app_store_notifications_original_transaction_id ON app_store_server_notifications(original_transaction_id);
CREATE INDEX idx_app_store_notifications_processed ON app_store_server_notifications(processed);

-- RLS: Solo admin y coaches ven sus propias notificaciones
ALTER TABLE app_store_server_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS app_store_notifications_select ON app_store_server_notifications;
CREATE POLICY app_store_notifications_select ON app_store_server_notifications FOR SELECT
  USING (
    coach_id = public.pw_coach_id()
    OR public.pw_is_admin()
  );

-- Insert: SOLO edge functions (service role), NUNCA desde frontend
DROP POLICY IF EXISTS app_store_notifications_insert ON app_store_server_notifications;
CREATE POLICY app_store_notifications_insert ON app_store_server_notifications FOR INSERT
  WITH CHECK (false); -- Service role bypasses RLS, pero políticas hacen que frontend dé error

-- Update: SOLO edge functions (service role)
DROP POLICY IF EXISTS app_store_notifications_update ON app_store_server_notifications;
CREATE POLICY app_store_notifications_update ON app_store_server_notifications FOR UPDATE
  USING (false);

-- Delete: SOLO admin (archiving, no borrado recomendado)
DROP POLICY IF EXISTS app_store_notifications_delete ON app_store_server_notifications;
CREATE POLICY app_store_notifications_delete ON app_store_server_notifications FOR DELETE
  USING (public.pw_is_admin());

-- ============================================================================
-- Notas para Fase 1 Backend
-- ============================================================================
--
-- 1. Edge Function apple-iap-webhook:
--    a) Recibe POST body (Apple Server Notifications V2 JWT)
--    b) Valida firma JWT contra Apple's public key
--    c) Extrae notification_id, notificationType, datos
--    d) Inserta en app_store_server_notifications
--      - Si notification_id duplicado → constraint violation → retorna 409 (ignore)
--      - Si nuevo → inserta y procesa
--    e) Procesa notificación:
--      - Valida que coach existe (appAccountToken → usuarios.app_account_token)
--      - Actualiza usuarios_suscripciones_iap con nuevo estado
--      - Marca processed=true, processed_at=now()
--    f) Retorna 200 OK a Apple
--
-- 2. Queries útiles:
--    a) Notificaciones no procesadas:
--       SELECT * FROM app_store_server_notifications
--       WHERE processed = false ORDER BY received_at DESC;
--
--    b) Últimas notificaciones por coach:
--       SELECT coach_id, notification_type, received_at
--       FROM app_store_server_notifications
--       WHERE coach_id = ? ORDER BY received_at DESC LIMIT 10;
--
--    c) Notificaciones con error:
--       SELECT * FROM app_store_server_notifications
--       WHERE processing_error IS NOT NULL ORDER BY received_at DESC;
--
-- 3. Limpieza / Archiving:
--    - Las notificaciones se guardan indefinidamente
--    - Opcionalmente: archivar notificaciones > 90 días a tabla separada
--    - NO borrar, preservar para auditoría

-- ============================================================================
-- Verificación post-creación
-- ============================================================================
-- SELECT * FROM app_store_server_notifications LIMIT 1;
-- SELECT count(*) FROM app_store_server_notifications;
-- SELECT notification_type, count(*) FROM app_store_server_notifications GROUP BY notification_type;
