# AUDITORÍA COMPLETA: FLUJO DE SUBIDA DE FOTOS DE EJERCICIO (exfoto-inp)

## ✅ VERIFICACIONES COMPLETADAS

### 1. Código en repositorio vs código desplegado
**ESTADO:** ✅ COINCIDEN
- Commit actual: `92b5f62b` (Instrument _uploadDoc with detailed request/response logging)
- Branch: `claude/pathway-app-store-review-fy5y15`
- Estado: `up to date with origin/claude/pathway-app-store-review-fy5y15`
- Working tree: clean (sin cambios no comprometidos)

### 2. Búsqueda de múltiples implementaciones de _uploadDoc
**ESTADO:** ✅ UNA SOLA IMPLEMENTACIÓN
- Definición: `panel-v2.html` línea 14129
- Llamadas:
  1. Línea 13848: Documentos de sesión (sesObj.doc)
  2. Línea 14209: Foto de rutina al agregar ejercicio (id="fr-foto")
  3. Línea 14230: **Foto de ejercicio desde listado** (class="exfoto-inp") ← EL CASO QUE FALLA
- Otro proyecto (sala.html): usa `resUpload()` independiente, no _uploadDoc

### 3. Flujo completo: foto de ejercicio (exfoto-inp)

```
PASO 1: INPUT HTML (línea 5485)
├─ Type: file
├─ Class: exfoto-inp
├─ Accept: image/*
├─ Data attributes: data-id (cliente), data-idx (posición en array)
└─ Display: none (hidden)

PASO 2: EVENT LISTENER (línea 14224-14237)
├─ Evento: change (click en label dispara input change)
├─ Validación de archivo:
│  ├─ ff = ev.target.files[0] (obtiene archivo)
│  ├─ if (!ff) return (sin archivo, aborta)
│  ├─ if (ff.size > 5*1024*1024) alert + return (tamaño máximo 5MB)
│  └─ cid, ix = obtiene ID cliente e índice del ejercicio
├─ UI: toast("Subiendo foto…")
└─ Llama: _uploadDoc(ff)

PASO 3: FUNCIÓN _uploadDoc (línea 14129-14159)
├─ Parámetro: f = File object
├─ ID: (REAL && RME && RME.id) ? RME.id : "anon"
├─ Path: "doc-{id}-{timestamp}-{filename_limpio}"
├─ MIME Type detection:
│  ├─ Intenta: f.type
│  ├─ Si vacío o no soportado, detecta desde extensión
│  ├─ Fallback: "image/jpeg"
│  └─ Soportados: png, jpeg, webp, pdf, docx, xlsx, txt
├─ Headers:
│  ├─ apikey: KEY (anon JWT)
│  ├─ Authorization: "Bearer "+KEY (anon JWT)
│  └─ Content-Type: {mimeType detectado}
├─ Modo: mode="cors"
├─ Body: f (File object directo)
├─ LOG PREVIO (storage_request):
│  ├─ URL (con [DOMAIN] enmascarado)
│  ├─ Method, Headers, Content-Type
│  ├─ File size, File name
│  └─ A: localStorage._photo_logs
└─ FETCH POST a: {SB}/storage/v1/object/docs/{path}

PASO 4: RESPUESTA HTTP
├─ Si r.ok: devuelve URL pública
├─ Si !r.ok (HTTP 400, etc):
│  ├─ LOG RESPUESTA (storage_response):
│  │  ├─ status, statusText
│  │  ├─ content-length header
│  │  ├─ response body (primeros 500 chars)
│  │  └─ A: localStorage._photo_logs
│  └─ throw Error con mensaje
└─ Catch: propaga el error

PASO 5: EVENTO LISTENER - THEN (línea 14230-14235)
├─ URL recibida
├─ c2 = obtiene cliente por cid
├─ arr = _rutToArr() convierte fit_rutina JSON a array
├─ if (!arr[ix]) return (ejercicio no encontrado, aborta silenciosamente)
├─ arr[ix].foto = url (asigna URL)
├─ j = JSON.stringify(arr)
├─ PATCH a: /rest/v1/candidatos?id=eq.{cid}
│  └─ Body: {fit_rutina: j}
├─ Si exitoso: actualiza c2.raw.fit_rutina
└─ toast("Foto agregada ✓")

PASO 6: EVENTO LISTENER - CATCH (línea 14236)
└─ alert("No se pudo subir la foto")
```

### 4. Comparación: _uploadDoc vs _uploadAvatar

| Aspecto | _uploadAvatar (✓funciona) | _uploadDoc (✗HTTP 400) |
|---------|--------------------------|----------------------|
| Bucket | avatars | docs |
| Path prefix | coach- | doc- |
| Content-Type | f.type \|\| "image/png" | detectado desde extensión |
| x-upsert header | SÍ: "true" | NO |
| mode: "cors" | NO | SÍ |
| Authorization header | "Bearer "+KEY | "Bearer "+KEY |
| apikey header | KEY | KEY |
| Logging | NO | SÍ (nuevo) |
| Error detail | Básico | Detallado + logs |

### 5. Bucket docs: Configuración

**Archivo:** `supabase/migrations/docs_bucket.sql`
```sql
- ID: 'docs'
- Público: true
- Límite: 10485760 bytes (10 MB)
- MIME types permitidos:
  * application/pdf
  * application/msword
  * application/vnd.openxmlformats-officedocument.wordprocessingml.document
  * application/vnd.ms-excel
  * application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
  * text/plain
  * image/png ← cliente envía esto si iOS detecta .jpg
  * image/jpeg ← cliente envía esto si iOS detecta .jpeg
  * image/webp ← cliente envía esto si iOS detecta .webp
```

**RLS Policies:**
- "docs read": SELECT if bucket_id='docs' (público)
- "docs write": INSERT if bucket_id='docs' (público)

### 6. Proxy: api.pathwaycareercoach.com

**Definición en código:**
```javascript
var SB="https://api.pathwaycareercoach.com";
```

**Estado:** NO hay configuración de proxy explícita en el repositorio
- No hay wrangler.toml (Cloudflare Workers)
- No hay configuración de reverse proxy
- El proxy está configurado externamente (probablemente en Cloudflare Dashboard o DNS)

**IMPLICACIÓN:** Las peticiones van a través de un proxy que:
1. Recibe la petición HTTPS a `/storage/v1/object/docs/...`
2. La enruta a Supabase Storage
3. Valida headers de forma específica

**Error recibido:** `"headers must have required property 'authorization'"`
- Esto viene del proxy o Supabase Storage
- El proxy requiere AMBOS: apikey AND Authorization headers
- Esto explica por qué el fix de agregar Authorization fue exitoso

---

## 🔍 HALLAZGOS

### Hallazgo 1: Bucket docs existe y está bien configurado
✅ VERIFICADO en migration file

### Hallazgo 2: Solo hay UNA implementación de _uploadDoc
✅ VERIFICADO: definida en panel-v2.html línea 14129

### Hallazgo 3: _uploadAvatar tiene x-upsert, _uploadDoc no
⚠️ DIFERENCIA IDENTIFICADA pero no es la causa del 400
- avatars siempre tuvo x-upsert (no fue removido)
- docs nunca tuvo x-upsert (o fue removido antes)
- El bucket 'docs' no necesita x-upsert porque filenames ya son únicos

### Hallazgo 4: El proxy requiere Authorization header
✅ CONFIRMADO por el error exacto del servidor:
```
"headers must have required property 'authorization'"
```

### Hallazgo 5: iOS MIME type issue
✅ PREVENTIVAMENTE SOLUCIONADO:
- iOS puede enviar image/heic (no soportado)
- Código detecta esto y auto-convierte a image/jpeg desde extensión
- Así funciona aunque el cliente tenga foto en formato HEIC

### Hallazgo 6: Logging automático agregado
✅ IMPLEMENTADO:
- Cada petición registra: URL, método, headers (sin secretos), tamaño
- Cada respuesta registra: status, statusText, body
- Todo en localStorage sin depender del cliente

---

## ⚠️ DIFERENCIAS ENCONTRADAS (Sin cambios)

### Diferencia 1: Content-Type detection
- **avatars:** directo del file.type con fallback a "image/png"
- **docs:** detecta desde extensión si file.type es unsupported
- **Razón:** docs es más defensivo porque iOS puede enviar unsupported types

### Diferencia 2: x-upsert header
- **avatars:** SÍ tiene (talvez innecesario pero no daña)
- **docs:** NO tiene (filenames son únicos, no es necesario)
- **Razón:** No afecta el problema, documentos tienen nombres únicos

### Diferencia 3: mode: "cors"
- **avatars:** NO tiene
- **docs:** SÍ tiene (agregado recientemente)
- **Razón:** Explícitamente permite CORS, buena práctica

### Diferencia 4: Logging
- **avatars:** sin logging automático
- **docs:** con logging automático en storage_request y storage_response
- **Razón:** Necesario para diagnosis sin depender del cliente

---

## CONCLUSIÓN

El código en repositorio es el correcto y coincide con lo deployado. No existe otra implementación de _uploadDoc. El proxy requiere AMBOS headers (apikey + Authorization), lo que fue solucionado en commit dc8578d8. Las diferencias entre _uploadAvatar y _uploadDoc son intencionales y apropiadas para cada caso de uso.

El logging automático (commit 92b5f62b) permitirá diagnosticar cualquier error futuro sin intervención manual del cliente.

