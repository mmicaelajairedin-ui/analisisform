-- ============================================================
-- Limpieza: eliminar columnas duplicadas que agregue por error
-- ============================================================
-- La tabla usuarios YA tenia bio, foto_url y configuracion JSONB con
-- calendly_url adentro. La migracion anterior agrego bio_publica,
-- foto_perfil_url y calendly_url como columnas separadas, lo cual
-- duplica datos.
--
-- Este script:
--   1. Migra los valores que ya hayas guardado (con tu UPDATE manual)
--      a las columnas correctas.
--   2. Borra las columnas duplicadas.
--
-- Idempotente. Hacer backup antes.
-- ============================================================

-- 1) Migrar bio_publica → bio (solo si bio esta vacio)
UPDATE usuarios
   SET bio = bio_publica
 WHERE (bio IS NULL OR bio = '')
   AND bio_publica IS NOT NULL
   AND bio_publica <> '';

-- 2) Migrar foto_perfil_url → foto_url (solo si foto_url esta vacio)
UPDATE usuarios
   SET foto_url = foto_perfil_url
 WHERE (foto_url IS NULL OR foto_url = '')
   AND foto_perfil_url IS NOT NULL
   AND foto_perfil_url <> '';

-- 3) Migrar columna calendly_url → configuracion->>'calendly_url'
--    Solo si la JSONB no tiene calendly_url ya seteado
UPDATE usuarios
   SET configuracion = jsonb_set(
         COALESCE(configuracion, '{}'::jsonb),
         '{calendly_url}',
         to_jsonb(calendly_url)
       )
 WHERE calendly_url IS NOT NULL
   AND calendly_url <> ''
   AND (
        configuracion IS NULL
        OR NOT (configuracion ? 'calendly_url')
        OR configuracion->>'calendly_url' = ''
        OR configuracion->>'calendly_url' IS NULL
       );

-- 4) Drop columnas duplicadas
ALTER TABLE usuarios DROP COLUMN IF EXISTS bio_publica;
ALTER TABLE usuarios DROP COLUMN IF EXISTS foto_perfil_url;
ALTER TABLE usuarios DROP COLUMN IF EXISTS calendly_url;

-- ============================================================
-- VERIFICACION
-- ============================================================
-- SELECT email, slug, titulo_profesional, bio, foto_url,
--        configuracion->>'calendly_url' AS calendly_url,
--        perfil_publico_activo
-- FROM usuarios
-- WHERE email = 'mmicaela.jairedin@gmail.com';
