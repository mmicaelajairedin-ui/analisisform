-- Auto-generate unique tokens for citas when inserted
-- Tokens are cryptographically random hex strings (32 chars = 128 bits)
-- Used in sala.html?token=<token> to validate access without guessing

CREATE OR REPLACE FUNCTION generate_cita_token()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.token IS NULL THEN
    NEW.token := encode(gen_random_bytes(16), 'hex');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS citas_auto_token ON citas;
CREATE TRIGGER citas_auto_token
  BEFORE INSERT ON citas
  FOR EACH ROW
  EXECUTE FUNCTION generate_cita_token();

-- VERIFY: Next INSERT into citas should auto-generate a 32-char hex token
-- SELECT id, token FROM citas WHERE token IS NOT NULL LIMIT 1;
