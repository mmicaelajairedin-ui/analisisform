# Sistema Permanente de Diagnóstico de Uploads

## Descripción

Cada error de subida a Supabase Storage se registra automáticamente en la tabla `upload_diagnostics`. No dependerás más de que los clientes abran la consola del navegador.

## Tabla: `upload_diagnostics`

Creada por: `supabase/migrations/upload_diagnostics.sql`

### Columnas

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | bigint | Primary key auto-incremento |
| `ts` | timestamptz | Timestamp del error (UTC) |
| `user_email` | text | Email del usuario que subió |
| `user_id` | uuid | ID del usuario en Supabase Auth |
| `bucket` | text | Bucket ('docs' o 'avatars') |
| `file_name` | text | Nombre del archivo |
| `file_size` | bigint | Tamaño en bytes |
| `detected_mime_type` | text | MIME type detectado por el navegador |
| `http_status` | integer | Status code HTTP (400, 403, 415, etc) |
| `http_status_text` | text | Status text ("Bad Request", etc) |
| `response_body` | text | Primeros 500 caracteres de la respuesta del servidor |
| `user_agent` | text | User-Agent del navegador (primeros 200 chars) |
| `platform` | text | Plataforma: 'ios', 'android', 'web', 'capacitor_ios', 'capacitor_android' |
| `step` | text | Paso donde falló: 'storage_http', 'upload_error', 'file_select' |
| `error_message` | text | Mensaje de error (primeros 200 chars) |
| `endpoint_url` | text | URL del endpoint (con dominio enmascarado) |
| `headers_sent` | jsonb | Headers enviados (sin exponer secrets) |

## Consultas Útiles

### Ver últimos 20 errores

```sql
SELECT ts, user_email, platform, bucket, http_status, error_message
FROM upload_diagnostics
ORDER BY ts DESC
LIMIT 20;
```

### Errores de hoy

```sql
SELECT ts, user_email, platform, bucket, http_status, response_body
FROM upload_diagnostics
WHERE ts > now() - interval '24 hours'
ORDER BY ts DESC;
```

### Errores por status HTTP

```sql
SELECT http_status, COUNT(*) as count, platform, bucket
FROM upload_diagnostics
WHERE ts > now() - interval '7 days'
GROUP BY http_status, platform, bucket
ORDER BY count DESC;
```

### Errores en iOS específicamente

```sql
SELECT ts, user_email, bucket, http_status, file_name, detected_mime_type, response_body
FROM upload_diagnostics
WHERE platform LIKE 'ios%'
ORDER BY ts DESC
LIMIT 10;
```

### Investigar un cliente específico

```sql
SELECT ts, bucket, file_name, http_status, step, error_message
FROM upload_diagnostics
WHERE user_email = 'cliente@example.com'
ORDER BY ts DESC;
```

### Ver patrones: ¿Qué MIME types fallan más?

```sql
SELECT detected_mime_type, http_status, COUNT(*) as occurrences
FROM upload_diagnostics
WHERE http_status IS NOT NULL
GROUP BY detected_mime_type, http_status
ORDER BY occurrences DESC;
```

## Acceso

### Admin (Micaela)

Puedes ver todos los logs ejecutando SQL en Supabase Editor:
1. Supabase Dashboard → SQL Editor
2. Copiar una query de arriba
3. Ejecutar

O via API (autenticado como admin):
```javascript
fetch('https://api.pathwaycareercoach.com/rest/v1/upload_diagnostics?order=ts.desc&limit=20', {
  headers: {
    apikey: SUPABASE_API_KEY,
    Authorization: 'Bearer ' + JWT_ADMIN_TOKEN
  }
}).then(r => r.json()).then(console.log)
```

### Clientes (Anon key)

Los clientes NO pueden leer estos logs (RLS policy lo previene). Solo pueden escribir automáticamente cuando hay error.

## Cómo funciona

### En el navegador (panel-v2.html)

1. **Detecta plataforma**: `_detectPlatform()` identifica iOS, Android, Web o Capacitor
2. **En cada error de upload**: `_logUploadErrorToSupabase()` envía a Supabase
3. **Silencioso**: el logging no afecta el flujo de upload
4. **Incluye**: platform, status HTTP, mensaje del servidor, user-agent, MIME type

### Ejemplo de flujo

```
Usuario intenta subir foto en iOS
  ↓
Navegador envía request a /storage/v1/object/docs/...
  ↓
Supabase devuelve HTTP 400 "headers must have required property authorization"
  ↓
_uploadDoc() catch captura el error
  ↓
_logUploadErrorToSupabase("docs", ..., 400, "...", ...) 
  ↓
Fetch POST a /rest/v1/upload_diagnostics
  ↓
Registro guardado en Supabase
  ↓
Puedes investigar sin pedirle nada al cliente
```

## Campos sanitizados

Para privacidad, algunos campos se sanitizan:

- `headers_sent`: muestra solo las claves ({apikey: "***", Authorization: "***", Content-Type: "image/jpeg"})
- `endpoint_url`: el dominio se enmascarado ({SB}/storage/v1/object/docs/... → .../storage/v1/object/[DOMAIN]/...)
- `user_agent`: solo primeros 200 caracteres
- `response_body`: solo primeros 500 caracteres

## Debugging Automatizado

Ahora puedes:

✅ Ver EXACTAMENTE qué devolvió Supabase (response_body)
✅ Identificar si es problema de plataforma (iOS, Android, etc)
✅ Detectar patrones (ej: iOS siempre falla con image/heic)
✅ No esperar a que el cliente abra la consola
✅ Investigar proactivamente

## Integración Futura

Podrías agregar:
- Dashboard en panel-v2 para ver logs en tiempo real
- Alertas automáticas (email si 5+ errores en 1 hora)
- Análisis de tendencias (qué buckets fallan más)
- Reporte semanal de errores por plataforma
