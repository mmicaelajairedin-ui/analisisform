-- Token por reserva: habilita el link "gestionar mi cita" (cancelar/reprogramar)
-- que va en el email de confirmación y en los recordatorios. El link es
-- /gestionar-cita.html?t=<token> y la página busca la cita por ese token
-- (no por id), así nadie puede tocar la cita de otro adivinando ids.
ALTER TABLE citas ADD COLUMN IF NOT EXISTS token text;
CREATE INDEX IF NOT EXISTS citas_token_idx ON citas (token);
