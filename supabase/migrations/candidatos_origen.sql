-- origen del cliente: 'propio' (lo trajo el coach → 0% comisión) | 'pathway'
-- (lo trajo el marketplace de Pathway → comisión escalonada).
-- Decisión (docs/proyecto-sala-sesion.md): default 'propio' = lo seguro (nunca
-- cobra comisión de más; los 'pathway' se marcan solos al pagar por el marketplace).
ALTER TABLE candidatos ADD COLUMN IF NOT EXISTS origen TEXT DEFAULT 'propio';
-- Backfill: los que ya existían quedan 'propio' (nadie es 'pathway' hasta que el
-- marketplace lo trajo). Los pathway viejos, si los hay, se ajustan a mano.
UPDATE candidatos SET origen = 'propio' WHERE origen IS NULL;
