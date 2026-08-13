# SALA PATHWAY — Auditoría de Diagnóstico (Agosto 2026)

**Fecha:** Agosto 13, 2026  
**Estado:** DIAGNÓSTICO EN PROGRESO (NO DEPLOYMENT)  
**Objetivo:** Identificar exactamente qué funciona, qué falla, causa raíz y fix mínimo

---

## PART 1: FLUJO COMPLETO DE SALA (Análisis Estático)

### Arquitectura de Video — Dos Motores:

```
SALA (sala.html)
  ├─ ENGINE='p2p' (DEFAULT)
  │   ├─ pw-p2p.js (WebRTC 1:1)
  │   │   ├─ Signaling: Supabase Realtime (canal "sala:{room}")
  │   │   ├─ STUN: Google (free)
  │   │   ├─ TURN: pw-turn.js → 91.98.155.217:3478
  │   │   └─ Fallback trigger: 10s (failTimer) + 25s (negTimer) sin conexión
  │   │       → _p2pFallbackToJaas()
  │   └─ Si fallback: ENGINE='jaas', borra contenedor P2P, llama boot()
  │
  └─ ENGINE='jaas' (RESPALDO + MODO GRUPAL)
      ├─ 8x8 Jitsi as a Service
      ├─ jaas-token (edge function)
      │   ├─ Secrets: JAAS_APP_ID, JAAS_KID, JAAS_PRIVATE_KEY
      │   └─ Firma JWT RS256 (3 horas TTL)
      ├─ Carga external_api.js de 8x8
      └─ Muestra video dentro del iframe
```

### Flujo de Acceso (Validación de Token):

```
ENTRADA A SALA
  │
  ├─ Coach (MOD=true)
  │   └─ Validación LOCAL: localStorage.mj_user.id === COACHID extraído de room
  │       (Línea 364-370 en sala.html)
  │
  └─ Cliente (MOD=false)
      ├─ Si tiene ?token=
      │   └─ Validate contra Supabase: SELECT citas.token WHERE token=eq.TOKEN
      │       (Línea 400-425)
      │       └─ Coach_id check: debe coincidir con room
      │
      └─ Si NO tiene token, solo email
          └─ Validate contra candidatos.email y check activo
              (Línea 431-444)
```

### Guardado de Sesión (Persistencia):

```
DURANTE LA SESIÓN (coach=MOD)
  ├─ Objetivos: localStorage (local only)
  ├─ Notas: localStorage + autosave a citas.notas_llamada (PATCH best-effort)
  ├─ Tareas: localStorage (local only)
  └─ Chat: candidatos.notas_coach (merge-safe)

AL FINALIZAR
  └─ saveSesion(): PATCH citas
      ├─ notas_llamada = blob de todo ↑
      ├─ resultado = res (convirtio | seguimiento | perdido)
      └─ keepalive:true (si se cierra la tab, igual guarda)
```

---

## PART 2: COMPONENTES Y SU ESTADO

### 1. sala.html (LÍNEAS DE ENTRADA CLAVE)

| Función | Línea | Estado | Notas |
|---------|-------|--------|-------|
| Validación de token | 394-446 | ✅ Código OK | Pero ver si consulta Supabase funciona |
| bootP2P() | 676-698 | ✅ Código OK | Llama PWP2P.start() |
| boot() (JaaS) | 534-612 | ✅ Código OK | Pero ver si jaas-token funciona |
| _p2pFallbackToJaas() | 702-709 | ✅ Código OK | Limpia contenedor, reintenta |
| wireControls() | 614-628 | ✅ Código OK | API commands |
| wireControlsP2P() | 747-754 | ✅ Código OK | Mic/cam toggles |
| saveSesion() | 1109-1121 | ✅ Código OK | keepalive:true |

**Conclusión:** Código HTML/JavaScript parece correcto. Problema ≠ lógica de sala.html.

---

### 2. pw-p2p.js (Motor P2P)

| Función | Línea | Estado | Notas |
|---------|-------|--------|-------|
| _sdk() | 34-42 | ⚠️ CDN | Carga supabase.js de CDN (npm cdn.jsdelivr) |
| _newPc() | 49-94 | ✅ Código OK | Perfect negotiation |
| _onSignal() | 96-126 | ✅ Código OK | Maneja desc, ice, chat, hello, bye |
| start() | 129-180 | ✅ Código OK | MediaDevices.getUserMedia, crea PC, se suscribe |
| failover timers | 79-90, 171-174 | ✅ Código OK | 10s + 25s watchdogs |
| Realtime suscripción | 164-167 | ⚠️ CRÍTICO | sb.channel("sala:"+room) |

**Punto crítico:** Supabase Realtime debe estar funcional. Si falla la suscripción, los SDP/ICE no llegan.

**Pregunta:** ¿Está Supabase Realtime habilitado en el proyecto? ¿Funciona la suscripción?

---

### 3. pw-turn.js (Servidor TURN)

```js
window.PW_TURN = [
  { urls: "stun:91.98.155.217:3478" },
  { urls: "turn:91.98.155.217:3478", username: "pathway", credential: "PathwayTurn2026xk9q" },
  { urls: "turn:91.98.155.217:3478?transport=tcp", username: "pathway", credential: "PathwayTurn2026xk9q" }
];
```

| Check | Status | Evidencia | Acción |
|-------|--------|-----------|--------|
| IP 91.98.155.217 existe | ❓ DESCONOCIDO | No pudimos hacer telnet | **VERIFICAR:** ping/curl desde prod |
| Puerto 3478 escucha | ❓ DESCONOCIDO | Timeout en telnet | **VERIFICAR:** ¿VPS coturn sigue corriendo? |
| Credenciales válidas | ❓ DESCONOCIDO | No probadas | **VERIFICAR:** ¿Se cambió la contraseña? |
| TURN es solo fallback ~10% casos | ✅ Diseño OK | Mayoría usa P2P directo | N/A |

**Acción inmediata:** SSH al VPS y verificar si coturn está running.

---

### 4. jaas-token (Edge Function)

| Check | Status | Notas |
|-------|--------|-------|
| Código compilable | ✅ SÍ | Tipo TypeScript correcto |
| Secrets configurados | ❓ DESCONOCIDO | Supabase debe tener JAAS_APP_ID, JAAS_KID, JAAS_PRIVATE_KEY |
| Llamada desde sala.html | ✅ SÍ | Línea 523-527 |
| Fallback a JaaS | ✅ Diseño OK | Si P2P falla, se llama boot() |

**Acción inmediata:** Verificar en Supabase → Edge Functions → Secrets que estén configurados.

---

## PART 3: SÍNTOMAS REPORTADOS vs CAUSA PROBABLE

### Síntoma: "Sala no funciona actualmente"

Necesitamos clarificar exactamente QUÉ falla:

#### Opción A: P2P No Conecta, JaaS Tampoco

**Síntomas posibles:**
- ❌ Pantalla negra "Preparando la sala…" ∞ sin conectar
- ❌ No aparecen participantes
- ❌ Audio/video nunca inicia

**Causas probables:**
1. **Supabase Realtime caído** → P2P nunca inicia (signaling channel no suscribe)
2. **TURN server 91.98.155.217 down** → ~15% de usuarios bloquean P2P directo, sin TURN caen
3. **jaas-token secrets faltando** → Fallback a JaaS también falla
4. **Ambos fallan** → Usuario queda con video negro ∞

**Fix mínimo:**
- [ ] Verificar Supabase Realtime: `SELECT status FROM realtime` (o similar)
- [ ] Verificar TURN: SSH a VPS, `systemctl status coturn`
- [ ] Verificar jaas-token: Supabase → Secrets (están configurados?)

---

#### Opción B: P2P Parcialmente Funciona, Pero Llamadas Se Caen

**Síntomas:**
- ⚠️ Se conectan inicialmente
- ⚠️ Audio/video durante 30s-2min
- ❌ Luego desconexión sin reintento

**Causas probables:**
1. **ICE negotiation timeout** → watchdog (25s negTimer) dispara pero no hay fallback retardo
2. **TURN credential caducadas** → Si credenciales no se actualiza periódicamente, caduca
3. **Supabase Realtime inestable** → SDP/ICE pierden paquetes

**Fix mínimo:**
- [ ] Aumentar timeouts en pw-p2p.js (negTimer: 25s → 40s)
- [ ] Verificar rotación de credenciales TURN (¿hay cronjob que las renueva?)
- [ ] Revisar logs de Supabase Realtime

---

#### Opción C: JaaS Falla (Fallback Incompleto)

**Síntomas:**
- ⚠️ P2P intenta, falla
- ❌ Fallback a JaaS → "Video en modo fallback" o error 500
- ❌ Nunca carga external_api.js o JWT es inválido

**Causas probables:**
1. **JAAS_APP_ID/KID/PRIVATE_KEY no configurados** → jaas-token devuelve 500
2. **JWT firmado pero expira rápido** → 3 horas (línea 110) pero token_request es lento
3. **external_api.js CDN lento o rechazado** → Timeout al cargar desde 8x8.vc
4. **Dominio 8x8.vc no resuelve en red cliente** → VPN/proxy bloquea

**Fix mínimo:**
- [ ] Verify Secrets en Supabase
- [ ] Test jaas-token manualmente: `curl -X POST https://api.pathwaycareercoach.com/functions/v1/jaas-token`
- [ ] Revisar logs de edge function

---

## PART 4: DIAGNÓSTICO ACTUAL (Sin Pruebas en Vivo)

### Basándonos en auditoría estática:

```
✅ QUÉ FUNCIONA (Código OK):
  • sala.html lógica de validación y UI
  • pw-p2p.js Perfect Negotiation pattern
  • pw-turn.js configuración estructura
  • jaas-token firma JWT
  • Fallback mechanism (P2P → JaaS)
  • Guardado de sesión (persistencia)

❌ QUÉ POSIBLEMENTE FALLA (Infraestructura / Config):
  • Supabase Realtime: ¿está habilitado? ¿conecta?
  • TURN server 91.98.155.217: ¿VPS coturn running?
  • jaas-token secrets: ¿están en Supabase?
  • Credenciales TURN: ¿"PathwayTurn2026xk9q" es correcta?

⚠️ PUNTOS DE INCERTIDUMBRE:
  • No hay logs de error Sala disponibles
  • No hay test de verdadera conexión P2P vs JaaS
  • No se sabe si falla al 10% de usuarios (red firma) o al 100%
```

---

## PART 5: PASOS INMEDIATOS DE DIAGNÓSTICO

### Paso 1: Verificar Supabase Realtime

```bash
# En Supabase SQL Editor:
SELECT * FROM realtime.subscriptions LIMIT 10;
-- ¿Hay suscripciones activas?

SELECT pg_current_wal_flush_lsn() - '0/0';
-- ¿Está escribiendo datos?
```

### Paso 2: Verificar TURN Server

```bash
ssh root@91.98.155.217
systemctl status coturn
netstat -tlun | grep 3478
tail -f /var/log/syslog | grep coturn
```

**Esperado:**
```
● coturn.service - TURN server
     Loaded: loaded
     Active: active (running)
```

**Si falla:**
- Check IP: ¿es correcta?
- Check firewall: ¿puerto 3478 abierto?
- Check credenciales: `/etc/turnserver.conf` tiene `user=pathway:...`?

### Paso 3: Verificar jaas-token Secrets

```bash
# En Supabase Dashboard:
Edge Functions → Select "jaas-token" → Settings → Secrets
# Debe haber:
#  JAAS_APP_ID = "vpaas-..."
#  JAAS_KID = "..."
#  JAAS_PRIVATE_KEY = "-----BEGIN PRIVATE KEY-----..."
```

**Si falta algo:**
- Obtener credenciales de 8x8
- Pegarlas en Secrets
- Redeploy: `supabase functions deploy jaas-token --no-verify-jwt`

### Paso 4: Test Manual de P2P

```javascript
// En navegador (DevTools → Console):
// 1. Abrir dos pestañas de Sala en MISMO dominio
// 2. En ambas:
window.PWP2P && console.log("✓ pw-p2p.js cargó");
window.PW_TURN && console.log("✓ pw-turn.js cargó");
// 3. Ver si "Esperando al cliente" desaparece
// 4. Revisar WebRTC stats: chrome://webrtc-internals
```

### Paso 5: Test de JaaS Fallback

```javascript
// Si P2P falla, debe caer a JaaS:
// DevTools → Application → Storage → Logs
// Buscar: "Conectando por el canal de respaldo…"
// Si aparece pero luego no conecta → jaas-token falla
```

---

## PART 6: COMPONENTES BLOQUEADOS EN BOOKING V2

### Si Sala está rota, Booking V2 también lo está:

```
Booking V2 → select-provider → sync-provider-v2 (Sala)
              └─ provider='pathway_room'
                 ├─ Genera JWT (nuevo mecanismo V2: SALA_JWT_SECRET)
                 └─ cita.sala_token = JWT ← AQUÍ Falla si Sala base es rota
```

**Bloqueador:**
> Booking V2 depende de que Sala base funcione. Si Realtime está caído, TURN down, o jaas-token roto, Booking V2 hereda esos problemas.

**Solución:**
1. Arreglar Sala base (diagnosticar ↑)
2. LUEGO implementar Booking V2 con seguridad

---

## PART 7: PRÓXIMOS PASOS (Acción del Usuario)

### Micaela debe hacer:

1. **SSH a TURN server** (91.98.155.217):
   ```bash
   ssh root@91.98.155.217
   systemctl status coturn
   ```
   → Report: ¿está running o down?

2. **Verificar Supabase Realtime** (via SQL Editor):
   ```sql
   SELECT * FROM realtime.subscriptions LIMIT 5;
   ```
   → Report: ¿hay suscripciones?

3. **Verificar jaas-token Secrets** (Dashboard → Edge Functions):
   → Screenshot de Secrets configurados (sin pegar valores)

4. **Test manual en staging**:
   - Coach abre Sala (?engine=p2p)
   - Cliente abre Sala
   - ¿Se conectan? ¿Tiempo?
   → Report: ✓ conectan o ✗ no conectan (screenshot)

5. **Si falla** → Copiar error exacto de DevTools (Console tab)
   → Report error

---

## PART 8: IMPACTO EN BOOKING V2

### Actual Plan:
- Booking V2 crea nuevos tokens JWT con SALA_JWT_SECRET
- Sala.html los valida contra citas.sala_token
- Coach/Cliente entran vía nuevo flujo

### Riesgo:
> Si la infraestructura base (Realtime, TURN, jaas-token) es rota, Booking V2 también será roto aunque el código sea correcto.

### Decisión Bloqueada:
- **NO desplegar Booking V2** hasta que Sala base esté 100% funcional
- **Diagnosticar Sala primero** (↑ pasos 1-5 de Part 7)
- **Fix Sala base** (minimal)
- **LUEGO retomar Booking V2**

---

## SUMMARY

| Aspecto | Status | Acción |
|---------|--------|--------|
| Código de Sala | ✅ Auditado OK | Ninguna |
| Infraestructura | ❌ DESCONOCIDA | **Verificar TURN, Realtime, jaas-token** |
| P2P + Fallback | ✅ Diseño OK | Testing en vivo requerido |
| Booking V2 | 🛑 BLOQUEADO | Esperar fix de Sala |

**No hacer deployment de Booking V2 hasta Sala esté diagnosticada y funcionando.**

---

**Documento generado:** 2026-08-13  
**Proxima acción:** Micaela verifica TURN server (ssh) + Realtime (SQL) + jaas-token (Secrets) + test manual
