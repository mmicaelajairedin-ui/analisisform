-- Gastos previsibles del cliente financiero (portal pathway-fin-cliente.html).
-- Guarda un JSON { facts:{coche,familia,casa,mascota,autonomo}, items:[{n,f,m,on,src}] }
-- con los gastos que conviene tener previstos (seguro anual, ITV, IBI, etc.).
ALTER TABLE candidatos ADD COLUMN IF NOT EXISTS fin_previsibles TEXT;
