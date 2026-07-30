# Matriz de Validación Funcional — multicoach.html

**Fecha:** 2026-07-30  
**Contexto:** Modo demo (MC_REAL=false). Modo real requiere login como owner + Edge Functions deployed.

## Matriz Principal

| Funcionalidad | UI Completa | Backend Disponible | Integración Completa | Estado | Notas |
|---|---|---|---|---|---|
| **Dashboard** | ✅ | ✅ Mock | ❌ | Ready (Demo) | Datos completos en memoria. Requiere mcLoadReal() para datos reales. |
| **Clientes** | ✅ | ✅ Mock | ❌ | Ready (Demo) | CRUD local. Llamadas a agregar-cliente-red, asignar-cliente fallarán si no está deployed. |
| **Coaches** | ✅ | ✅ Mock | ❌ | Ready (Demo) | CRUD local. Llamadas a agregar-coach-red, editar-coach-red fallarán. |
| **Agenda** | ✅ | ✅ Mock | ❌ | Ready (Demo) | Calendario renderiza. crear-cita-red/editar-cita-red no deployed. |
| **Comunidad** | ✅ | ✅ Mock | ⚠️ | Ready (Demo) | UI completa. Gateada por plan Studio+. Llamadas a comunidad-red no deployed. |
| **Configuración** | ✅ | ✅ Local | ✅ | Ready | Branding guardado en localStorage. guardar-red no required para demo. |
| **Canal (Chat)** | ✅ | ✅ Mock | ❌ | Ready (Demo) | Drawer funciona. canal-red no deployed. Gateada por plan Studio+. |
| **Analytics** | ✅ | ✅ Local | ✅ | Ready | KPIs calculados de DB object. Gateada por plan Studio+. No requiere backend. |
| **Cobros** | ✅ | ❌ | ❌ | Blocked | UI existe. red-checkout no existe ni está implementada. Etapa 2. |
| **Programas** | ✅ | ❌ | ❌ | Blocked | UI oculta (muestra "Próximamente"). No existe implementación. |

## Estado Crítico Actual

✅ **Frontend:** 100% funcional en modo demo  
✅ **Mock Data:** Completo + localStorage fallback  
❌ **Backend Real:** 0% deployado + accesible (no verificado)  
⚠️ **Edge Functions:** 15/15 existen en repo. Deployment status: **DESCONOCIDO**

---

## Bloqueantes por Sección (Modo Real)

### 🔴 Clientes — Agregar Cliente

- **Edge Function faltante:** `agregar-cliente-red` (existe en repo)
- **Endpoint:** POST `/functions/v1/agregar-cliente-red`
- **Tabla Supabase:** `candidatos` (multicoach_candidatos)
- **Implementación reutilizable:** Sí, existe en `panel-v2.html` línea ~960 (panel del coach)
- **Status:** Código ready. Deployment desconocido.

**Código actual (multicoach.html línea 951-970):**
```javascript
fetch(SB+'/functions/v1/agregar-cliente-red',{
  method:'POST',
  headers:h,
  body:JSON.stringify({nombre:n,email:em,coach_id:cid})
})
// Fallback a mock si falla
if(!res.ok||!res.d.ok){ __toast('No se pudo agregar. Reintenta'); }
```

### 🔴 Clientes — Asignar Coach

- **Edge Function:** `asignar-cliente` (existe en repo)
- **Endpoint:** POST `/functions/v1/asignar-cliente`
- **Tabla:** `coach_client_assignments`, `candidatos`
- **Reutilizable:** Sí, línea ~975 en multicoach.html (función _reassign)
- **Status:** Código ready. Deployment desconocido.

### 🔴 Coaches — Agregar Coach

- **Edge Function:** `agregar-coach-red` (existe en repo)
- **Endpoint:** POST `/functions/v1/agregar-coach-red`
- **Tabla:** `usuarios`, `organizaciones`
- **Reutilizable:** Sí, línea ~2364 en multicoach.html (invitarCoach)
- **Status:** Código ready. Deployment desconocido.

### 🔴 Agenda — Crear Sesión

- **Edge Function:** `crear-cita-red` (existe en repo)
- **Endpoint:** POST `/functions/v1/crear-cita-red`
- **Tabla:** `citas_red`
- **Reutilizable:** Sí, línea ~1060 en multicoach.html (prometido en __nuevaSesion)
- **Status:** Código ready. Deployment desconocido.

### 🔴 Agenda — Editar/Cancelar Sesión

- **Edge Functions:** `editar-cita-red`, `cancelar-cita-red` (existen en repo)
- **Endpoints:** PATCH/DELETE `/functions/v1/editar-cita-red` y `/cancelar-cita-red`
- **Tabla:** `citas_red`
- **Reutilizable:** Sí, línea ~1076, ~1100 en multicoach.html
- **Status:** Código ready. Deployment desconocido.

### 🔴 Comunidad — Crear/Editar Posts

- **Edge Function:** `comunidad-red` (existe en repo)
- **Endpoint:** POST/PATCH `/functions/v1/comunidad-red`
- **Tabla:** `posts_red`, `reacciones_red`
- **Reutilizable:** Sí, línea ~2865 (_comSave)
- **Status:** UI **intencionalmente oculta** (muestra "Próximamente"). No es bloqueante, es roadmap.

### ❌ Cobros — Red Checkout

- **Edge Function:** `red-checkout` (existe en repo como placeholder)
- **Endpoint:** POST `/functions/v1/red-checkout`
- **Tabla:** `pagos_red`, `planes_red`
- **Reutilizable:** No. Requiere integración Stripe.
- **Status:** No implementado. Etapa 2 (roadmap futuro).

### ❌ Programas

- **Edge Function:** NO EXISTE
- **Status:** Feature "Próximamente" (intencionalmente no implementada). Etapa 2.

---

## Resumen de Dependencias

### Modo Demo (Actual)
```
✅ Dashboard → DB object (memory)
✅ Clientes → DB object (memory) + localStorage backup
✅ Coaches → DB object (memory) + localStorage backup
✅ Agenda → MC_CITAS array (memory)
✅ Config → localStorage
⚠️ Comunidad → Mock (Studio+ gate)
⚠️ Canal → Mock (Studio+ gate)
⚠️ Analytics → Calculado de DB object
❌ Cobros → No implementado
❌ Programas → No implementado
```

### Modo Real (Si se activa con mcLoadReal)
```
❓ Todos dependen de:
  1. Supabase disponible y accesible
  2. JWT válido del dueño (rol=owner)
  3. Edge Functions deployed en proyecto
  4. Tablas con RLS correctamente configuradas
  5. Email_sent flag en usuarios (para confirmación)
```

---

## Verificación Pendiente

Necesita confirmar:
1. ¿Supabase está accesible en `https://api.pathwaycareercoach.com`?
2. ¿Las Edge Functions están deployed en el proyecto real?
3. ¿El JWT del owner está siendo generado correctamente?
4. ¿Las migrations (7 tablas) están aplicadas?

