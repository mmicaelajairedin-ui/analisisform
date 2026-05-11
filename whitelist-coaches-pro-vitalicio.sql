-- ============================================================
-- WHITELIST: Coaches con acceso Pro vitalicio (no expiran)
-- ============================================================
-- Aplica a:
--   - mmicaela.jairedin@gmail.com (admin / dueña de la plataforma)
--   - demo.coach@pathway.com      (cuenta para demos en vivo)
--
-- Marca a estos coaches como Pro permanente para que el webhook
-- de Stripe no les altere el plan ni el estado, y para que nunca
-- caiga `activo` a false aunque cambie algo en Stripe.
--
-- INSTRUCCIONES:
-- 1. Abrí Supabase Dashboard → SQL Editor → New query
-- 2. Pegá todo este archivo → click "Run"
-- 3. Verificá la salida del SELECT al final (deben aparecer las 2 filas)
-- ============================================================

-- PASO 1: Asegurar que ambos usuarios existen y son rol coach/admin
-- (mmicaela debería ser admin; demo.coach debería ser coach)
UPDATE usuarios
SET rol = 'admin'
WHERE email = 'mmicaela.jairedin@gmail.com'
  AND rol NOT IN ('admin');

UPDATE usuarios
SET rol = 'coach'
WHERE email = 'demo.coach@pathway.com'
  AND rol NOT IN ('coach', 'admin');

-- PASO 2: Setear plan Pro vitalicio + activo + flag es_pro_vitalicio
-- El flag `es_pro_vitalicio` lo lee el webhook Stripe para no pisarles
-- el plan cuando llegan eventos de subscription.deleted o similar.
UPDATE usuarios
SET
  activo = true,
  configuracion = COALESCE(configuracion, '{}'::jsonb) || jsonb_build_object(
    'plan',              'pro',
    'estado_sub',        'activa',
    'es_pro_vitalicio',  true,
    'fecha_fin_periodo', NULL,
    'fecha_fin_prueba',  NULL
  )
WHERE email IN (
  'mmicaela.jairedin@gmail.com',
  'demo.coach@pathway.com'
);

-- PASO 3: Verificación
SELECT
  email,
  rol,
  activo,
  configuracion->>'plan'              AS plan,
  configuracion->>'estado_sub'        AS estado_sub,
  configuracion->>'es_pro_vitalicio'  AS es_pro_vitalicio
FROM usuarios
WHERE email IN (
  'mmicaela.jairedin@gmail.com',
  'demo.coach@pathway.com'
)
ORDER BY email;

-- Esperado:
-- mmicaela.jairedin@gmail.com  | admin | t | pro | activa | true
-- demo.coach@pathway.com       | coach | t | pro | activa | true
