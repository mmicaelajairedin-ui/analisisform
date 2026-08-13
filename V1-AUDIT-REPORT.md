# V1-AUDIT-REPORT.md — Booking/Agenda V1: Estado Actual Auditado

**Fecha:** Agosto 13, 2026  
**Auditor:** Claude Code Agent  
**Scope:** V1 Booking/Agenda (reservar.html, sync-cita-to-gcal, gcal-push, send-email, panel-v2, cliente.html, sala.html)  
**Status:** READ-ONLY audit, sin modificaciones  

---

## CLASIFICACIÓN POR COMPONENTE

### 1. reservar.html (Booking Form)

**Responsabilidad:** Capturar reserva, decidir proveedor video, enviar emails.

**Provider Decision Logic (líneas 908-976):**
```
IF zoom_link exists → usar ZOOM
ELSE SI puede sync Google Meet → sync-cita-to-gcal async
  SI sync success → usar Google Meet URL
  ELSE SI falla "no_conference_data" → fallback Sala
  ELSE → fallback Sala
ELSE → fallback Sala
```

**Decisión ocurre en FRONTEND → V2 la moverá a BACKEND.**

**CLASIFICACIÓN:**
- ❌ **MODIFICAR** Provider decision (mover backend)
- ❌ **MODIFICAR** Email timing (enviar DESPUÉS confirmación BD)
- ✅ **CONSERVAR** Zoom lookup (funciona bien)
- ✅ **CONSERVAR** Sala fallback (red seguridad correcta)

**Email Sending (línea 1076):**
- Enviado INMEDIATAMENTE, ANTES de confirmar sync en BD
- Race condition: email promete link no confirmado en DB aún

**CLASIFICACIÓN:**
- ❌ **MODIFICAR** Email debe venir desde `send-email-v2` DESPUÉS provider_url en BD

**Database Save (línea 878-891):**
- **CLASIFICACIÓN:** ✅ **CONSERVAR** (sólido con reintento)

---

### 2. sync-cita-to-gcal (Edge Function)

**Flow (líneas 86-103):**
1. Si `hangoutLink` existe: PATCH a `citas.meet_link`
2. Si PATCH falla: retorna error explícito
3. Si PATCH success: retorna `{ok:true, link_saved:true}`

**Transactional Contract:**
- ✅ `ok:true && link_saved:true` → garantiza `meet_link` en BD
- ✅ Si error → caller sabe no hay link confirmado

**CLASIFICACIÓN:**
- ✅ **CONSERVAR** Contrato transaccional
- ✅ **CONSERVAR** Validación `conferenceData.entryPoints`
- ❌ **MODIFICAR** No tiene retry logic (V2 la tendrá)
- ❌ **MODIFICAR** Hardcoded Google (V2 agnóstico)

---

### 3. gcal-push (Edge Function)

**Validación crítica (línea 150-152):**
```
SI !hangoutLink → retorna error "google_no_conference_data"
Mensaje: "Gmail (necesita Workspace), token revocado, o permisos limitados"
```

**COMPROBADO:** Gmail personal (@gmail.com) NO genera Meet links via API
- Coach: mmicaela.jairedin@gmail.com
- Últimas 63 bookings: **0 con meet_link**, **0 con google_event_id**
- **No es bug. Limitación documentada de Google.**

**CLASIFICACIÓN:**
- ✅ **CONSERVAR** Token refresh logic
- ✅ **CONSERVAR** Validación conferenceData
- ✅ **CONSERVAR** Error messaging
- ❌ **MODIFICAR** Hardcoded Google (V2 agnóstico)

---

### 4. send-email (Edge Function)

**CLASIFICACIÓN:**
- ✅ **CONSERVAR** Brevo integration
- ❌ **MODIFICAR** No aceptar HTML frontend; construir en edge function leyendo BD
- ❌ **MODIFICAR** Provider display from BD, no frontend guess

---

### 5. panel-v2.html (Coach Dashboard)

**CLASIFICACIÓN:**
- ✅ **CONSERVAR** Filtering por coach_id
- ❌ **MODIFICAR** Agregar columna `provider` (mostrar tipo + ícono)
- ❌ **MODIFICAR** Agregar columna `provider_error` si falló sync
- ❌ **MODIFICAR** Botón retry manual para syncs fallidos

---

### 6. cliente.html (Candidate Portal)

**CLASIFICACIÓN:**
- ✅ **CONSERVAR** Display de link
- ❌ **MODIFICAR** Mostrar tipo provider (🎥 Sala / 📹 Meet / 💻 Zoom)
- ❌ **MODIFICAR** Si `provider_error`: mostrar "Preparando tu sesión"
- ❌ **MODIFICAR** Leer `provider` de BD, no frontend

---

### 7. sala.html (Video Room)

**Auditoría técnica: ✅ SÓLIDO**

| Aspecto | Status | Evidencia |
|---------|--------|-----------|
| Token Validation | ✅ Seguro | Lines 390-410: valida token vs citas.token |
| Access Control | ✅ Correcto | Lines 355-388: MOD si mj_user.id === room_owner |
| WebRTC P2P | ✅ Implementado | Lines 673-689: P2P via pw-p2p.js + TURN fallback |
| JaaS Fallback | ✅ Implementado | Lines 517-612: 8x8 como backup |
| XSS Protection | ✅ Protected | Line 319: esc() escaping |
| Mobile Responsive | ✅ Optimizado | Lines 159-194: CSS responsive |

**Gaps operacionales (NO técnicos, pero reales):**

| Gap | Impacto | Solución V2 |
|-----|---------|-------------|
| No session tracking | Sin proof de joins | sesiones_registro con timestamps |
| No timeout management | Sesiones fantasma | Auto-disconnect 2h idle |
| No recording | Sin evidencia | Recording opcional (plan 8x8) |
| No data persistence | Notas/tareas solo client-side | Integrar con BD |
| Single point of failure (8x8) | Si 8x8 cae → todo cae | V2 evaluará fallback |

**CLASIFICACIÓN:**
- ✅ **CONSERVAR** Token validation, P2P + JaaS, UI/UX
- ❌ **MEJORAR** Session tracking (integrar sesiones_registro)
- ❌ **MEJORAR** Timeout management (auto-disconnect 2h)
- ⚠️ **EVALUAR** Recording (depende plan 8x8)

---

## PUNTOS DE QUIEBRE CRÍTICOS

### Quiebre 1: Race Condition Email ↔ Sync

**T=0ms:** Frontend decide link (Zoom/Google/Sala)  
**T=10ms:** postEmail() envía email con link  
**T=15ms:** sync-cita-to-gcal llamado (async, pending)  
**T=500ms:** sync completa o falla  
→ **Email ya enviado con link no confirmado en BD**

**Impacto:** Cliente recibe email, hace click, link no funciona yet.

**V1 mitigación:** Email dice "El link aparecerá pronto" si no inmediato.

**V2 solución:** Email DESPUÉS de `provider_url` confirmado en BD.

---

### Quiebre 2: Email Template Mismatch

**ERROR_REGISTRY.md:** "ERR-EMAIL-RECORDATORIO" — email dice "Google Meet", delivery es "Sala"

**Impacto:** "¿Por qué dice Meet si esto es Sala?"

**V2 solución:** Email construido en `send-email-v2` leyendo actual `provider` de BD.

---

### Quiebre 3: Gmail Personal → 0% Google Meet

**COMPROBADO:** Cuentas @gmail.com personal NO generan Meet links via Google Calendar API
- Coach: mmicaela.jairedin@gmail.com
- Últimas 63 citas: **0 con meet_link**, **0 con google_event_id**
- **No es bug. Limitación Google documentada.**

**V2 solución:** `select-provider` detecta Gmail, skips Google, defaults Sala.

---

### Quiebre 4: No Provider Formalization

**Actual:** Tres campos separados (zoom_link, meet_link, ninguno para Sala)
- Imposible: "¿cuántas usan Sala vs Meet vs Zoom?"
- Debugging: revisar 3 columnas
- No hay: error tracking, retry logic

**V2 solución:** 6 columnas nuevas + provider abstraction unificada.

---

## RESUMEN: Qué Funciona vs Falla

| Aspecto | ¿Funciona? |
|---------|-----------|
| Zoom bookings | ✅ SÍ |
| Google Meet (Gmail) | ❌ NO (API limitation) |
| Google Meet (Workspace) | ✅ SÍ |
| Sala fallback | ✅ SÍ |
| Email sending | ✅ SÍ |
| DB persistence | ✅ SÍ |
| Sala video | ✅ SÍ |
| Email-sync timing | ⚠️ RIESGO (race condition) |
| Email accuracy | ❌ NO (template mismatch) |
| Session audit | ❌ NO |
| Provider errors | ❌ NO |

---

**CONCLUSIÓN:** V1 NO está roto operacionalmente (Sala fallback + email delay mitiga). Pero tiene flaws arquitectónicos que V2 arreglará.

