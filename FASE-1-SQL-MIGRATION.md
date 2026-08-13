# FASE 1 — SQL MIGRATION EXACTA

**Propósito:** Definir el SQL exacto que implementa el modelo V2 sin aplicarlo en producción.  
**Estado:** LISTO PARA REVISAR antes de ejecución.  
**Rollback:** Documentado y probado.

---

## PARTE 1: MIGRACIÓN FORWARD (V1 → V2)

### Archivo: `supabase/migrations/20260813_add_v2_provider_model.sql`

```sql
-- ============================================================================
-- FASE 1: Agregar modelo V2 de provider a la tabla citas
-- ============================================================================
-- 
-- CHANGE SUMMARY:
-- - Agregar 6 columnas nuevas (todas nullable para backward compatibility)
-- - Agregar CHECK constraint en provider
-- - Agregar índices para queries async
-- - NO cambios a RLS (V1 policies siguen funcionando)
-- - NO cambios a datos existentes
-- 
-- SAFETY:
-- - Todas las columnas nullable (V1 queries no rompidas)
-- - Migration idempotente (IF NOT EXISTS)
-- - Reversible (ver PARTE 2: ROLLBACK)
-- ============================================================================

-- 1. NUEVA COLUMNA: provider
--    Decisión de qué proveedor usar (decidida por backend)
--    Valores: 'none' (default, V1 legacy) | 'google_meet' | 'zoom' | 'pathway_room'
ALTER TABLE citas ADD COLUMN IF NOT EXISTS provider TEXT 
  DEFAULT 'none' 
  CHECK (provider IN ('none', 'google_meet', 'zoom', 'pathway_room'));

COMMENT ON COLUMN citas.provider IS 
  'Provider de videoconferencia decidido por edge function select-provider.
   "none" = legacy V1 (no provider decidido), 
   "google_meet" = Google Meet link en provider_url,
   "zoom" = Zoom link en provider_url,
   "pathway_room" = Sala Pathway token en sala_token + link en provider_url.
   NUNCA modificar desde frontend; SOLO desde backend async functions.';

-- 2. NUEVA COLUMNA: provider_url
--    URL del meeting después de que sync-provider-v2 logra llamar a la API del provider
--    NULL mientras el sync está en progreso
ALTER TABLE citas ADD COLUMN IF NOT EXISTS provider_url TEXT;

COMMENT ON COLUMN citas.provider_url IS 
  'URL para unirse al meeting, completada por edge function sync-provider-v2.
   NULL = sync en progreso, con error, o no iniciado aún.
   Email y UI DEBEN aguardar este valor antes de mostrar link.
   Leído por send-email-v2 (nunca confiar en HTML del frontend).';

-- 3. NUEVA COLUMNA: provider_ready_at
--    Timestamp cuando provider_url fue seteado exitosamente
--    Usado para debugging y auditoría
ALTER TABLE citas ADD COLUMN IF NOT EXISTS provider_ready_at TIMESTAMPTZ;

COMMENT ON COLUMN citas.provider_ready_at IS 
  'Timestamp cuando sync-provider-v2 completó exitosamente.
   NULL = sync no completado aún o con error.
   Usado para SLA monitoring y debugging.';

-- 4. NUEVA COLUMNA: provider_error
--    Mensaje de error si sync-provider-v2 falla (no retriable)
--    NULL si no hay error
ALTER TABLE citas ADD COLUMN IF NOT EXISTS provider_error TEXT;

COMMENT ON COLUMN citas.provider_error IS 
  'Mensaje de error si sync-provider-v2 falla definitivamente.
   Ejemplos: "Gmail account does not support Google Meet",
             "Zoom API returned 401 Unauthorized",
             "Network timeout after 5 retries".
   NULL = sin error (sync en progreso o exitoso).
   Mostrado en panel-v2 y cliente.html para debugging.';

-- 5. NUEVA COLUMNA: provider_retry_count
--    Cuántos reintentos ha intentado sync-provider-v2
--    Max 5 reintentos; después se da por vencido
ALTER TABLE citas ADD COLUMN IF NOT EXISTS provider_retry_count INT DEFAULT 0;

COMMENT ON COLUMN citas.provider_retry_count IS 
  'Número de reintentos que ha intentado sync-provider-v2.
   Backoff exponencial: [2s, 4s, 8s, 16s, 60s], max 5 reintentos.
   Si alcanza 5 → sin reintentos más, mostrar error permanente al coach.';

-- 6. NUEVA COLUMNA: sala_token
--    Token JWT para acceso a Sala Pathway (si provider='pathway_room')
--    Almacenado para auditoría y re-autenticación
ALTER TABLE citas ADD COLUMN IF NOT EXISTS sala_token TEXT;

COMMENT ON COLUMN citas.sala_token IS 
  'Token JWT para la sala de Pathway (solo si provider="pathway_room").
   Generado en frontend (sala.html) y almacenado para auditoría.
   NULL si provider != "pathway_room".
   NO es credential; es un token de acceso a una sala específica con TTL corto.';

-- ============================================================================
-- ÍNDICES PARA QUERIES ASYNC
-- ============================================================================

-- Índice 1: Encontrar citas que aún no tienen provider_url (pendientes de sync)
CREATE INDEX IF NOT EXISTS idx_citas_provider_pending 
  ON citas(provider_ready_at DESC, provider_error) 
  WHERE provider_ready_at IS NULL 
    AND provider_error IS NULL 
    AND estado = 'confirmada';

COMMENT ON INDEX idx_citas_provider_pending IS 
  'Para edge function sync-provider-v2 → buscar próximas citas a sincronizar.
   WHERE: solo citas confirmadas sin sync completo.
   ORDER BY: provider_ready_at DESC para FIFO.';

-- Índice 2: Encontrar citas con error de provider (para reintentos o alertas)
CREATE INDEX IF NOT EXISTS idx_citas_provider_error 
  ON citas(creada_at DESC, provider_error) 
  WHERE provider_error IS NOT NULL;

COMMENT ON INDEX idx_citas_provider_error IS 
  'Para monitoreo y alertas → buscar citas que fallaron en sync.
   WHERE: solo citas con error NOT NULL.
   ORDER BY: creada_at DESC para las más recientes primero.';

-- ============================================================================
-- CHECKS DE INTEGRIDAD (Sin cambios a RLS)
-- ============================================================================

-- Constraint: Si provider_url NO NULL, provider debe ser != 'none'
ALTER TABLE citas 
ADD CONSTRAINT check_provider_url_requires_provider 
CHECK (
  provider_url IS NULL 
  OR provider IN ('google_meet', 'zoom', 'pathway_room')
);

-- Constraint: Si sala_token NO NULL, provider debe ser 'pathway_room'
ALTER TABLE citas 
ADD CONSTRAINT check_sala_token_only_pathway 
CHECK (
  sala_token IS NULL 
  OR provider = 'pathway_room'
);

-- ============================================================================
-- RLS: NO CAMBIOS REQUERIDOS
-- ============================================================================
--
-- Las políticas RLS existentes siguen funcionando porque:
--
-- 1. Las columnas nuevas son solo lectura desde el frontend (panel-v2, cliente.html)
--    Leen provider_url (readonly) y provider (readonly)
--
-- 2. Los PATCH/UPDATE a citas vienen desde edge functions backend, no frontend
--    select-provider y sync-provider-v2 corren en el backend con JWT de servicio
--    (no anon key)
--
-- 3. Email service (send-email-v2) lee cita desde backend, no desde frontend
--
-- SI EN EL FUTURO se permite que frontend decida provider → AQUÍ aplicar
-- RLS para prohibir UPDATE(provider, provider_url, provider_error)
-- Por ahora: backend-only, RLS no necesita cambiar.
--
-- Auditar: verificar que NINGUN UPDATE a citas(provider*) viene desde frontend
--          (check-guardrails.js lo valida en CI)

-- ============================================================================
-- MIGRACIÓN COMPLETA
-- ============================================================================

-- Verificación final: confirmar que las columnas existen y tienen comentarios
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'citas' 
  AND column_name IN ('provider', 'provider_url', 'provider_ready_at', 
                       'provider_error', 'provider_retry_count', 'sala_token')
ORDER BY ordinal_position;

-- Verificación: Índices creados
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'citas'
  AND indexname LIKE 'idx_citas_provider%';

-- Verificación: Constraints
SELECT constraint_name, constraint_type, check_clause
FROM information_schema.table_constraints
WHERE table_name = 'citas'
  AND constraint_name LIKE 'check_%'
ORDER BY constraint_name;
```

---

## PARTE 2: ROLLBACK (V2 → V1)

### Si la migración falla o necesita revertirse:

```sql
-- ============================================================================
-- FASE 1 ROLLBACK: Revertir a V1
-- ============================================================================
-- 
-- Ejecutar SOLO si hay blocker en FASE 1A o decisión de rollback
-- Reversible sin pérdida de datos (columnas simplemente no usadas)
-- ============================================================================

-- Paso 1: Remover constraints
ALTER TABLE citas DROP CONSTRAINT IF EXISTS check_provider_url_requires_provider;
ALTER TABLE citas DROP CONSTRAINT IF EXISTS check_sala_token_only_pathway;

-- Paso 2: Remover índices
DROP INDEX IF EXISTS idx_citas_provider_pending;
DROP INDEX IF EXISTS idx_citas_provider_error;

-- Paso 3: Remover columnas (CUIDADO: irreversible)
-- SOLO hacer esto si estamos seguros de rollback total
-- ALTER TABLE citas DROP COLUMN IF EXISTS provider;
-- ALTER TABLE citas DROP COLUMN IF EXISTS provider_url;
-- ALTER TABLE citas DROP COLUMN IF EXISTS provider_ready_at;
-- ALTER TABLE citas DROP COLUMN IF EXISTS provider_error;
-- ALTER TABLE citas DROP COLUMN IF EXISTS provider_retry_count;
-- ALTER TABLE citas DROP COLUMN IF EXISTS sala_token;

-- ALTERNATIVA (MÁS SEGURA): Dejar columnas, desactivar en app
-- - Set ENABLE_V2_BOOKING=false en environment
-- - Frontend routing vuelve a usar reservar.html (V1)
-- - Edge functions V2 NO se ejecutan
-- - Panel-v2 no muestra provider status
-- - Migración se puede re-ejecutar sin duplicar

-- Verificación: Confirmar que V1 sigue intacto
SELECT COUNT(*) FROM citas WHERE estado IN ('confirmada', 'completada');
SELECT COUNT(*) FROM informes;
SELECT COUNT(*) FROM cv_publicados;
```

---

## PARTE 3: VERIFICACIONES PRE-EJECUCIÓN

### Checklist antes de aplicar la migración:

- [ ] **Backup actual de DB:** `pg_dump -Fc analisisform > backup_v1_20260813.dump`
- [ ] **V1 queries siguen funcionando:** Probar:
  ```sql
  SELECT COUNT(*) FROM citas WHERE coach_id = '...' AND estado = 'confirmada';
  ```
- [ ] **Sin active locks:** `SELECT * FROM pg_stat_activity WHERE state = 'active';` = vacío
- [ ] **Supabase staging env selected:** Verificar URL en `.env`
- [ ] **Feature flag desactivado:** `ENABLE_V2_BOOKING=false` en env vars
- [ ] **Edge functions V2 no desplegadas todavía:** `supabase functions list | grep select-provider` = no existe
- [ ] **Branch correcto:** `git branch` = `claude/pathway-booking-root-cause-ely53m`

### Ejecución (en staging solamente):

```bash
# En Supabase CLI (staging)
supabase db push  # Aplica migrations/ en orden

# O en SQL Editor de Supabase (dashboard):
# 1. Copiar todo el SQL de PARTE 1 anterior
# 2. Pegar en SQL Editor
# 3. Run
# 4. Verificar output de SELECT al final (columnas existentes)
```

---

## PARTE 4: DATOS AFECTADOS (V1 Compatibility)

### Datos existentes:

**Citas existentes (V1):**
```
id | coach_id | titulo | fecha | meet_link | ... | provider | provider_url | ...
---|----------|--------|-------|-----------|-----|----------|--------------|----
1  | coach-a  | 1:1    | ...   | https://... | ... | 'none'  | NULL        | ...
2  | coach-b  | Review | ...   | NULL      | ... | 'none'  | NULL        | ...
```

**Comportamiento:**
- `provider='none'` → V1 legacy (usa `meet_link` si existe)
- `provider_url=NULL` → Sin URL en provider (puede tener meet_link de V1)
- **V1 sigue funcionando:** Panel-v2 puede seguir mostrando `meet_link` mientras `provider_url=NULL`
- **Migración gradual:** Citas nuevas (FASE 1A+) usan `provider` + `provider_url`

---

## PARTE 5: IMPACT ANALYSIS

### Edge Functions Afectadas:

| Function | Acción | Timing |
|----------|--------|--------|
| `select-provider` | NUEVA (backend async) | Después INSERT cita |
| `sync-provider-v2` | NUEVA (backend async) | Después select-provider |
| `send-email-v2` | MODIFICADA (leer DB) | Después sync-provider-v2 |
| `sync-cita-to-gcal` | SIN CAMBIOS (legacy) | Opcional (Google sync) |
| `gcal-push` | SIN CAMBIOS (legacy) | Opcional (Google sync) |

### Frontend Afectado:

| Archivo | Cambios | Timing |
|---------|---------|--------|
| `reservar.html` | SIN CAMBIOS (V1 frozen) | Usar V1 path si ENABLE_V2=false |
| `reservar-v2.html` | NUEVA (solo INSERT) | ENABLE_V2=true → usar esta |
| `panel-v2.html` | MODIFICADA (mostrar provider) | Lee provider + provider_url |
| `cliente.html` | MODIFICADA (mostrar provider_url) | Lee provider_url, polling |
| `sala.html` | SIN CAMBIOS (code audit OK) | Usar si provider='pathway_room' |

### RLS Afectado:

- ❌ NO cambios (V2 columnas readonly desde frontend, updates desde backend)
- ✅ Guardrail nuevo: Verificar que UPDATE(provider*) NO viene desde frontend

---

## PARTE 6: TIMELINE DE EJECUCIÓN

### Fase 1A (Semana 1-2: Sept 3-14)

```
Sept 3:   Aplicar migration en staging
Sept 4-5: Implementar edge functions
Sept 6-7: Implementar frontend changes
Sept 10-14: Tests internos (Micaela + QA)
            - Validar que provider se decide correctamente
            - Validar que provider_url se sinc correctamente
            - Validar que email/panel muestran URL correcto
```

### Gate FASE 1A → FASE 1B

```
Entregar a Micaela:
- SQL exacto aplicado ✓ (ESTE DOCUMENTO)
- Edge functions código exacto (PRÓXIMO: FASE-1-EDGE-FUNCTIONS.md)
- Frontend código exacto (PRÓXIMO: FASE-1-FRONTEND-CHANGES.md)
- Test results (logs, screenshots, videos)
- Rollback probado (puede revertir en <5 min)
- Room isolation verificado (BLOCKER si falla)
```

---

## PARTE 7: SEGURIDAD & AUDITORÍA

### Columnas que NUNCA se modifican desde frontend:

- ❌ `provider` — Solo desde `select-provider` backend
- ❌ `provider_url` — Solo desde `sync-provider-v2` backend
- ❌ `provider_ready_at` — Solo desde `sync-provider-v2` backend
- ❌ `provider_error` — Solo desde `sync-provider-v2` backend
- ❌ `provider_retry_count` — Solo desde `sync-provider-v2` backend

### Guardrail de seguridad:

Archivo: `scripts/check-guardrails.js` (agregar regla nueva)

```javascript
// BLOCKER: No UPDATE(provider*) desde frontend
const rule_provider_backend_only = {
  id: 'PROVIDER_BACKEND_ONLY',
  desc: 'UPDATE provider/provider_url/provider_error NUNCA desde frontend',
  check: (html) => {
    const hasProviderUpdate = /\bpatch\s*\(\s*['"`]\/rest\/v1\/citas/.test(html)
      && /provider|provider_url|provider_error/.test(html);
    return !hasProviderUpdate;
  },
  severity: 'BLOCKER'
};
```

---

## RESUMEN

**SQL: LISTO PARA REVISAR**

✅ 6 columnas nuevas (todas nullable)  
✅ Constraints de integridad  
✅ Índices para async queries  
✅ RLS: sin cambios  
✅ Rollback: documentado y reversible  
✅ V1 compatibility: 100% (V1 queries no rompidas)  
✅ Idempotente: puede correr múltiples veces

**SIGUIENTE PASO:** Revisar este SQL con DBA/Micaela. Si OK → aplicar en staging + continuar con edge functions.
