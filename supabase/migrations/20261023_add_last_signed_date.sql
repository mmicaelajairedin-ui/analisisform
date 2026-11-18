-- Add last_signed_date column for FIX 2: timestamp-based state ordering
-- This column tracks the signedDate from the most recent Apple notification
-- Used to prevent old/stale events from reverting subscription state

ALTER TABLE usuarios_suscripciones_iap
  ADD COLUMN IF NOT EXISTS last_signed_date TIMESTAMPTZ;

-- Create index for fast timestamp comparisons in webhook
CREATE INDEX IF NOT EXISTS idx_usuarios_suscripciones_iap_last_signed_date
  ON usuarios_suscripciones_iap(last_signed_date);

COMMENT ON COLUMN usuarios_suscripciones_iap.last_signed_date IS
  'Tracks the signedDate from the most recent Apple notification. Used to prevent stale events (older timestamps) from reverting active subscriptions. FIX 2: timestamp-based ordering.';
