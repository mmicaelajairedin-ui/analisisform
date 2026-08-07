-- Add resultado and notas_llamada to citas table
-- resultado: the outcome/result of the meeting
-- notas_llamada: notes taken during the call

ALTER TABLE citas ADD COLUMN IF NOT EXISTS resultado TEXT;
ALTER TABLE citas ADD COLUMN IF NOT EXISTS notas_llamada TEXT;

CREATE INDEX IF NOT EXISTS idx_citas_resultado ON citas(resultado);
