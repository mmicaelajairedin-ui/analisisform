-- Contenido de empresa que ve el cliente en su portal (read-only): la revista,
-- los avisos y las clases los edita SOLO el responsable en su panel Multi-Coach.
-- El portal del cliente (pathway-fit-cliente.html → sección Comunidad) los muestra
-- y solo aparece la pestaña si hay contenido de empresa (clientes de coach individual
-- no la ven). JSON en texto.
ALTER TABLE candidatos ADD COLUMN IF NOT EXISTS empresa_nombre  TEXT;
ALTER TABLE candidatos ADD COLUMN IF NOT EXISTS empresa_revista TEXT;
ALTER TABLE candidatos ADD COLUMN IF NOT EXISTS empresa_avisos  TEXT;
ALTER TABLE candidatos ADD COLUMN IF NOT EXISTS empresa_clases  TEXT;
