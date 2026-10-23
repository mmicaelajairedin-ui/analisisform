# ⚠️ DEPLOY A PRODUCCIÓN — NO EJECUTAR SIN AUTORIZACIÓN EXPLÍCITA DE MICAELA

**CRÍTICO:** Este documento contiene comandos que modifican la base de datos de PRODUCCIÓN. **NUNCA ejecutar sin aprobación escrita de Micaela.**

---

## Estado Actual

**Estado:** ⏸️ **NO DESPLEGAR AÚN.** Esperando confirmación explícita de Micaela.

**Requisitos previos antes de ejecutar:**
1. Todas las correcciones de código (Swift + JS) están en rama `fix/iap-webhook-security` y mergeadas a `main`
2. Supabase CLI instalado localmente: `supabase --version`
3. Acceso autenticado: `supabase projects list` debe mostrar `analisisform` (proyecto de producción)
4. Testing local completado y validado por Gonzalo
5. **AUTORIZACIÓN ESCRITA de Micaela con palabra clave: "AUTORIZO DEPLOY IAP"**

---

## Paso 1: Aplicar Migración a Producción

**Comando (ejecutar desde raíz del repositorio):**

```bash
supabase db push --project-ref ddxnrsnjdvtqhxunxnwj
```

**Qué hace:**
- Detecta `supabase/migrations/20261001_iap_subscriptions.sql` (nunca antes aplicada a producción)
- Detecta `supabase/migrations/20261023_add_last_signed_date.sql` (nunca antes aplicada a producción)
- Aplica las migraciones idempotentes en la tabla `public`
- Crea/modifica:
  - Tabla `usuarios_suscripciones_iap` (con FK a `usuarios.id`)
  - Columna `last_signed_date` para deduplicación atómica de webhooks
  - Índices (usuario_id, app_account_token, product_id, state, expires_at)
  - RLS policies (SELECT/UPDATE para service_role, restrictivo para anon/authenticated)

**Salida esperada:**
```
Pushing migrations to analisisform (ddxnrsnjdvtqhxunxnwj)...
Staging migrations...
  [20261001_iap_subscriptions.sql]
  [20261023_add_last_signed_date.sql]
Applying migrations...
✓ 20261001_iap_subscriptions
✓ 20261023_add_last_signed_date
```

**Verificación (post-deploy):**
```bash
supabase db remote diff --project-ref ddxnrsnjdvtqhxunxnwj | head -20
# Debería estar vacío (no hay cambios pendientes)
```

---

## Paso 2: Desplegar 3 Edge Functions a Producción

**Comando (ejecutar secuencialmente desde raíz):**

```bash
# 1. validate-iap
supabase functions deploy validate-iap --project-ref ddxnrsnjdvtqhxunxnwj

# 2. check-entitlement
supabase functions deploy check-entitlement --project-ref ddxnrsnjdvtqhxunxnwj

# 3. apple-iap-webhook
supabase functions deploy apple-iap-webhook --project-ref ddxnrsnjdvtqhxunxnwj
```

**Salida esperada (para cada una):**
```
Deploying function 'validate-iap'...
✓ Function deployed at https://api.pathwaycareercoach.com/functions/v1/validate-iap
```

**Verificación (post-deploy):**
```bash
supabase functions list --project-ref ddxnrsnjdvtqhxunxnwj | grep -E "(validate-iap|check-entitlement|apple-iap-webhook)"
# Debería mostrar 3 funciones en status "ACTIVE"
```

---

## Paso 3: Configurar Secretos en Producción

**Prerequisitos:**
- Micaela debe tener credenciales Apple Sandbox/Production de App Store Connect
- No compartir claves privadas en chat (comunicación privada/segura)

**Comando para cada secreto (ejecutar desde raíz):**

```bash
supabase secrets set --project-ref ddxnrsnjdvtqhxunxnwj \
  APPLE_ISSUER_ID="<issuer_id_de_Micaela>"

supabase secrets set --project-ref ddxnrsnjdvtqhxunxnwj \
  APPLE_KEY_ID="<key_id_de_Micaela>"

supabase secrets set --project-ref ddxnrsnjdvtqhxunxnwj \
  APPLE_PRIVATE_KEY_P8="<contenido_del_p8_de_Micaela>"

supabase secrets set --project-ref ddxnrsnjdvtqhxunxnwj \
  APPLE_BUNDLE_ID="com.pathwaycareercoach.twa"

supabase secrets set --project-ref ddxnrsnjdvtqhxunxnwj \
  APPLE_ENVIRONMENT="sandbox"  # Cambiar a "production" solo cuando se lance a App Store
```

**Lista completa de secretos requeridos:**
| Secreto | Descripción | Origen | Requerido |
|---------|-------------|--------|----------|
| `APPLE_ISSUER_ID` | Issuer ID de App Store Connect | Micaela (App Store Connect) | ✅ |
| `APPLE_KEY_ID` | Key ID de In-App Purchase (10 chars) | Micaela (App Store Connect) | ✅ |
| `APPLE_PRIVATE_KEY_P8` | Clave privada P8 (líneas sin saltos) | Micaela (descarga .p8) | ✅ |
| `APPLE_BUNDLE_ID` | Bundle ID de la app (com.pathway...) | Fijo en código | ✅ |
| `APPLE_ENVIRONMENT` | "sandbox" o "production" | Controlado por desplegador | ✅ |
| `SUPABASE_URL` | Auto (variables de entorno de Supabase) | Sistema | ✅ Auto |
| `SUPABASE_ANON_KEY` | Auto | Sistema | ✅ Auto |
| `SUPABASE_SERVICE_ROLE_KEY` | Auto | Sistema | ✅ Auto |

**Verificación:**
```bash
supabase secrets list --project-ref ddxnrsnjdvtqhxunxnwj
# Debería mostrar 5 secretos (APPLE_* + BUNDLE_ID)
```

---

## Paso 4: Habilitar Workflow de Deploy en GitHub

**IMPORTANTE:** El workflow de deploy en CI está **deshabilitado** (paso de deploy comentado en `.github/workflows/`).

**Para habilitar (Micaela autoriza):**

1. Abrir `.github/workflows/deploy-iap-functions.yml` (si existe) o el workflow relevante
2. Buscar la línea con condición de deploy:
   ```yaml
   - name: Deploy IAP Functions
     if: false  # ← Cambiar a `if: github.ref == 'refs/heads/main'`
   ```
3. Cambiar `if: false` a `if: github.ref == 'refs/heads/main'`
4. Commit + push a `main`
5. El próximo push a `main` ejecutará el deploy automáticamente

**Alternativa (sin workflow):**
Ejecutar manualmente los pasos 1-3 desde terminal (no depende de CI).

---

## Rollback — Reversión de Cambios

**⚠️ IMPORTANTE:** Una vez desplegados, los cambios son en VIVO. El rollback debe ser planeado.

### Opción A: Revertir Función (rápido, recomendado)

```bash
# Desplegar versión anterior desde rama/commit anterior
git checkout <commit_anterior_antes_de_iap>
supabase functions deploy validate-iap --project-ref ddxnrsnjdvtqhxunxnwj
# Repetir para check-entitlement y apple-iap-webhook
```

### Opción B: Deshabilitar Función (sin revertir código)

```bash
# Eliminar función (deja la tabla intacta)
supabase functions delete validate-iap --project-ref ddxnrsnjdvtqhxunxnwj
supabase functions delete check-entitlement --project-ref ddxnrsnjdvtqhxunxnwj
supabase functions delete apple-iap-webhook --project-ref ddxnrsnjdvtqhxunxnwj
```

**Consecuencia:** Las apps iOS verán errores 404 al llamar a las funciones. Clientes en la pantalla de compra no podrán proceder (fallback a Stripe).

### Opción C: Revertir Migración (máximo cuidado)

```bash
# Crear migración de reversión (manual)
touch supabase/migrations/$(date +%Y%m%d%H%M%S)_rollback_iap.sql
# Contenido: DROP TABLE IF EXISTS usuarios_suscripciones_iap CASCADE;
# Luego: supabase db push
```

**Riesgo:** Borra datos si ya hay compras en la tabla. Usar solo en caso de error crítico.

---

## Monitoreo Post-Deploy

**Logs en Supabase:**
```bash
# Ver errores de funciones en últimas 24h
supabase functions logs validate-iap --project-ref ddxnrsnjdvtqhxunxnwj --tail
supabase functions logs check-entitlement --project-ref ddxnrsnjdvtqhxunxnwj --tail
supabase functions logs apple-iap-webhook --project-ref ddxnrsnjdvtqhxunxnwj --tail
```

**Tabla de diagnostics en DB:**
- `usuarios_suscripciones_iap`: registros de compras (verificar que se registren)
- `client_errors` (si existe): reporta errores del lado del cliente

**Health check manual:**
```bash
# Probar que validate-iap responde (requiere JWT válido)
JWT_COACH=$(supabase auth admin create-user --email test@example.com --password Test123! --project-ref ddxnrsnjdvtqhxunxnwj | jq -r '.user_id')
curl -X POST https://api.pathwaycareercoach.com/functions/v1/validate-iap \
  -H "Authorization: Bearer $JWT_COACH" \
  -H "Content-Type: application/json" \
  -d '{}'
# Respuesta esperada: { "ok": true, "appAccountToken": "<uuid>" }
```

---

## Checklist Pre-Deploy

- [ ] Código Swift en `ios/CoachPlansViewModel.swift` con fixes de Oct 19+ (commit c5038d6+)
- [ ] Código JS en `pw-capgo-iap.js` con fixes de Oct 19+ (JWT, appAccountToken)
- [ ] Migración `20261001_iap_subscriptions.sql` está en `supabase/migrations/`
- [ ] Migración `20261023_add_last_signed_date.sql` está en `supabase/migrations/`
- [ ] Edge Functions (`validate-iap`, `check-entitlement`, `apple-iap-webhook`) compiladas sin errores Deno
- [ ] Tests locales ejecutados y validados por Gonzalo (Test Run 1 y Test Run 2 pasan)
- [ ] **Micaela autoriza deploy con palabra clave: "AUTORIZO DEPLOY IAP"** ✅ REQUERIDO
- [ ] Micaela proporciona credenciales Apple Sandbox (Issuer ID, Key ID, .p8)

---

## Próximos Pasos

1. **Testing local (Gonzalo):** Ejecutar suite de tests con Supabase local
2. **Micaela autoriza:** Esperar palabra clave "AUTORIZO DEPLOY IAP"
3. **Deploy:** Ejecutar comandos de pasos 1-3 secuencialmente
4. **Post-deploy:** Monitoreo 48h, validar que transacciones se registran en DB
5. **App Store:** Habilitar compras reales solo después de validación completa

---

**⚠️ NO HACER DEPLOY SIN AUTORIZACIÓN EXPLÍCITA DE MICAELA.**

Preguntas antes de ejecutar: escribir en el thread del proyecto.
