# FASE 0 CHECKPOINT — App Store Connect Prerequisites

**Status:** ✅ DOCUMENTATION COMPLETE — AWAITING MANUAL APP STORE SETUP  
**Date:** 2026-09-09  
**Branch:** `claude/iap-coach-plans-implementation`  
**Commits:** 2  

---

## Qué se hizo en Fase 0

1. ✅ **FASE_0_APP_STORE_SETUP.md creado**
   - Instrucciones paso-a-paso para configurar App Store Connect manualmente
   - Product IDs definidos: `coach.plan.basic.monthly`, `coach.plan.pro.monthly`
   - Subscription Group definido: `PathwayCoachPlans`
   - Server Notifications V2 configuración documentada
   - Regional pricing guidelines (USD, EUR, GBP, MXN, ARS, COP, CLP)
   - API Key setup process documented
   - Checklist completo para verificar completitud

2. ✅ **docs/app-store-connect-secrets-template.txt creado**
   - Template para llenar después de crear keys en App Store Connect
   - Placeholders para: Team ID, Key ID, Issuer ID, Private Key
   - Security notes
   - Checklist de verificación

3. ✅ **Rama dedicada creada**
   - Branch: `claude/iap-coach-plans-implementation`
   - Base: `main` (commit actual)
   - No cambios destructivos
   - No cambios a código existente

---

## Archivos modificados/creados

```
✅ FASE_0_APP_STORE_SETUP.md (NEW)
✅ docs/app-store-connect-secrets-template.txt (NEW)
✅ FASE_0_CHECKPOINT.md (NEW)
```

---

## Tests ejecutados en Fase 0

**N/A** — Fase 0 es documentación solamente. No hay código ejecutado.

---

## Resultado

| Aspecto | Status | Detalle |
|--------|--------|---------|
| Product IDs documentados | ✅ | `coach.plan.basic.monthly`, `coach.plan.pro.monthly` |
| Subscription Group documentado | ✅ | `PathwayCoachPlans` |
| Server Notifications V2 | ✅ | Webhook endpoint, eventos, configuración |
| API Key process | ✅ | Paso-a-paso documentado |
| Regional pricing | ✅ | Guidelines para 7 territorios |
| Secrets template | ✅ | Ready para llenar después de ASC setup |
| Código congelado | ✅ | Sin cambios a main, Stripe, MultiCoach, iOS, panel-v2.html |

---

## Riesgos identificados

| Riesgo | Probabilidad | Mitigación |
|--------|-------------|-----------|
| Valores inventados en ASC setup | MEDIUM | Documento claro: "No inventes datos" |
| Precios no optimizados por región | MEDIUM | Guidelines incluyen verificación en ASC |
| API Key revocation si se expone | LOW | Documentación de seguridad clara; backup .p8 guardado localmente |
| Webhook endpoint no existirá hasta Fase 1 | EXPECTED | ASC permite configurar antes; webhook se crea en Fase 1 |

---

## Qué está bloqueado

- ⛔ **Testing real de IAP** (requiere Sandbox en Xcode con Product IDs reales)
- ⛔ **Testing de webhook** (requiere endpoint existente)
- ⛔ **Fase 1 Backend** (bloqueada esperando App Store Connect secrets)

---

## Siguiente fase: Fase 1 Backend

**Condición de GO:** Micaela completa `FASE_0_APP_STORE_SETUP.md` en App Store Connect y documenta los valores en `docs/app-store-connect-secrets-template.txt`.

**Qué se hará en Fase 1:**

1. **Migraciones SQL:**
   - `usuarios_suscripciones_iap` — tabla principal de suscripciones (status, expires_date, etc.)
   - `app_store_server_notifications` — audit log de webhooks
   - `suspicious_double_charges` — monitoreo de doble cobro
   - Índices y RLS

2. **Types TypeScript:**
   - `AppleSubscriptionStatus` (active, expired, grace_period, etc.)
   - `AppleServerNotification` (estructura del webhook)
   - `AppStoreValidationResult`

3. **Edge Functions:**
   - `apple-iap-webhook` — manejo de eventos de Apple
   - `validate-iap` — validación de transacciones
   - `check-entitlement` — verificar si coach tiene acceso
   - `reconcile-apple-stripe` — reconciliación periódica

4. **Utilidades:**
   - Validación de Apple signatures (JWT)
   - Caché de App Store Server API responses
   - Polling de App Store Server API (fallback si webhook falla)

5. **Tests:**
   - Playwright tests para entitlement logic
   - Mocking de Apple webhooks
   - Validación de RLS

---

## Commits en Fase 0

```
1334cdd Fase 0: App Store Connect setup instructions
53faa22 Fase 0: App Store Connect secrets template
```

---

## Resumen

**Fase 0 completada:** ✅ Documentación lista, app Store Connect setup manual documentado, templates para secrets preparados.

**Estado general:** Código sin cambios, Stripe intacto, MultiCoach intacto, iOS protegido, panel-v2.html intacto.

**Siguiente:** Espera a que Micaela complete setup en App Store Connect → Fase 1 Backend lista para comenzar.

---

**Documento generado:** 2026-09-09  
**Responsable:** Claude Haiku 4.5  
**Session:** https://claude.ai/code/session_014B86acZLYtjvr8inWKRYqd
