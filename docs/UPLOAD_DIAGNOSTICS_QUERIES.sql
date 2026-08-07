-- UPLOAD DIAGNOSTICS: Queries para investigar errores de subida
--
-- Copia cualquiera de estas queries al SQL Editor de Supabase:
-- https://app.supabase.com/project/[tu-proyecto]/sql/new
--
-- ============================================================================

-- QUERY 1: Últimos 20 errores de upload (más reciente primero)
SELECT
  ts,
  user_email,
  platform,
  bucket,
  file_name,
  http_status,
  error_message
FROM upload_diagnostics
ORDER BY ts DESC
LIMIT 20;

-- ============================================================================

-- QUERY 2: Errores de hoy
SELECT
  ts,
  user_email,
  platform,
  bucket,
  http_status,
  response_body
FROM upload_diagnostics
WHERE ts > now() - interval '24 hours'
ORDER BY ts DESC;

-- ============================================================================

-- QUERY 3: Resumen por status HTTP (¿cuántos errores de cada tipo?)
SELECT
  http_status,
  http_status_text,
  COUNT(*) as "Total Errores",
  COUNT(DISTINCT user_email) as "Usuarios Afectados",
  COUNT(DISTINCT platform) as "Plataformas",
  STRING_AGG(DISTINCT platform, ', ') as "Plataformas Afectadas"
FROM upload_diagnostics
WHERE ts > now() - interval '7 days'
GROUP BY http_status, http_status_text
ORDER BY "Total Errores" DESC;

-- ============================================================================

-- QUERY 4: Errores específicos en iOS
SELECT
  ts,
  user_email,
  bucket,
  file_name,
  detected_mime_type,
  http_status,
  response_body
FROM upload_diagnostics
WHERE platform LIKE 'ios%'
  AND ts > now() - interval '7 days'
ORDER BY ts DESC;

-- ============================================================================

-- QUERY 5: Errores en Android
SELECT
  ts,
  user_email,
  bucket,
  file_name,
  detected_mime_type,
  http_status,
  response_body
FROM upload_diagnostics
WHERE platform LIKE 'android%'
  AND ts > now() - interval '7 days'
ORDER BY ts DESC;

-- ============================================================================

-- QUERY 6: Investigar un usuario específico
-- IMPORTANTE: cambiar 'cliente@example.com' al email real
SELECT
  ts,
  bucket,
  file_name,
  detected_mime_type,
  http_status,
  step,
  error_message,
  response_body
FROM upload_diagnostics
WHERE user_email = 'cliente@example.com'
ORDER BY ts DESC;

-- ============================================================================

-- QUERY 7: Patrones de MIME types que fallan
SELECT
  detected_mime_type,
  http_status,
  COUNT(*) as "Ocurrencias",
  COUNT(DISTINCT user_email) as "Usuarios",
  STRING_AGG(DISTINCT platform, ', ') as "Plataformas"
FROM upload_diagnostics
WHERE http_status IS NOT NULL
  AND ts > now() - interval '7 days'
GROUP BY detected_mime_type, http_status
ORDER BY "Ocurrencias" DESC;

-- ============================================================================

-- QUERY 8: Errores por bucket
SELECT
  bucket,
  COUNT(*) as "Total Errores",
  COUNT(DISTINCT user_email) as "Usuarios",
  AVG(file_size)::integer as "Tamaño Promedio",
  STRING_AGG(DISTINCT http_status::text, ', ') as "Status Codes"
FROM upload_diagnostics
WHERE ts > now() - interval '7 days'
GROUP BY bucket
ORDER BY "Total Errores" DESC;

-- ============================================================================

-- QUERY 9: Timeline de errores (últimas 24 horas, agrupado por hora)
SELECT
  DATE_TRUNC('hour', ts) as "Hora",
  COUNT(*) as "Errores en esa Hora",
  STRING_AGG(DISTINCT platform, ', ') as "Plataformas",
  STRING_AGG(DISTINCT http_status::text, ', ') as "Status Codes"
FROM upload_diagnostics
WHERE ts > now() - interval '24 hours'
GROUP BY DATE_TRUNC('hour', ts)
ORDER BY "Hora" DESC;

-- ============================================================================

-- QUERY 10: Máximo error reciente (DEBUGGING RÁPIDO)
-- Ejecuta esto para ver el error más reciente y todas sus detalles
SELECT
  *
FROM upload_diagnostics
ORDER BY ts DESC
LIMIT 1;

-- ============================================================================
-- NOTES:
--
-- Estas queries son PUBLIC, puedes compartirlas con tu equipo.
-- Los datos NO contienen secretos (headers sanitizados, etc).
--
-- Cambios útiles:
-- - Reemplaza '7 days' por '30 days' o '1 hour' según necesites
-- - Cambia LIMIT 20 por LIMIT 100 para ver más resultados
-- - Agrega "AND platform = 'ios'" para solo iOS
--
-- ============================================================================
