-- Suscripción del CLIENTE al coach (carril "cada 4 semanas", nicho fitness/
-- acompañamientos largos). NO retiene plata: cargo directo a la cuenta del
-- coach + comisión de Pathway como application_fee_percent en cada ciclo.
-- El acceso al portal se corta si la suscripción no está al día.
--
-- Guardamos la "fecha pagada hasta" (sub_vigente_hasta): el portal da acceso
-- mientras now < sub_vigente_hasta. Así el gate es robusto aunque se pierda
-- algún webhook: cuando vence el período pago y no llegó una renovación, se
-- corta solo.
ALTER TABLE candidatos ADD COLUMN IF NOT EXISTS sub_id TEXT;             -- id de la Stripe Subscription
ALTER TABLE candidatos ADD COLUMN IF NOT EXISTS sub_customer TEXT;       -- id del customer (cuenta conectada del coach)
ALTER TABLE candidatos ADD COLUMN IF NOT EXISTS sub_estado TEXT;         -- active | past_due | canceled | unpaid
ALTER TABLE candidatos ADD COLUMN IF NOT EXISTS sub_vigente_hasta TIMESTAMPTZ; -- pagado hasta (current_period_end)
ALTER TABLE candidatos ADD COLUMN IF NOT EXISTS sub_intervalo TEXT;      -- "4w"

CREATE INDEX IF NOT EXISTS candidatos_sub_id_idx ON candidatos (sub_id);
