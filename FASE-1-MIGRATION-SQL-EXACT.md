# FASE 1 — MIGRATION SQL (EXACTA, SIN EJECUTAR)

**Propósito:** Lista precisa de TODOS los cambios SQL para V2, separados de audit.  
**Ejecución:** NOT YET. Esperar aprobación después del audit READ-ONLY.  
**Staging:** Deploy aquí primero. Production: solo con autorización explícita.

---

## RESUMEN DE CAMBIOS

| Tipo | Cambios | Impacto |
|------|---------|--------|
| Nuevas columnas | 6 (provider, provider_url, provider_ready_at, provider_error, provider_retry_count, sala_token) | Nullable, zero data loss |
| Índices nuevos | 2 (provider_pending, provider_error) | Async job processing |
| Constraints nuevos | 2 (provider CHECK, sala_token pathway_room only) | Data integrity |
| RLS changes | NINGUNO | Backend-only modifications |
| Rollback | Documented | Reversible |

---

## MIGRACIÓN FORWARD (V1 → V2)

### Archivo: `supabase/migrations/20260813_add_v2_provider_model.sql`

```sql
-- ============================================================================
-- MIGRATION: Add V2 Provider Model to Booking System
-- Version: 1.0
-- Date: Aug 13, 2026
-- Environment: Staging first, then Production (after FASE 1A approval)
-- ============================================================================

-- SAFETY CHECKS (ejecutar primero)
-- Verificar que estamos en el entorno correcto
DO $$
DECLARE
  env_name TEXT;
BEGIN
  -- SELECT current_setting('app.environment') INTO env_name;
  -- FOR NOW: Manual check required
  RAISE NOTICE 'MIGRATION WARNING: Verify you are in STAGING environment';
  RAISE NOTICE 'DO NOT RUN in production without explicit authorization';
END $$;

-- ============================================================================
-- FASE 1: ADD COLUMNS (6 nuevas, todas nullable)
-- ============================================================================

-- 1. COLUMN: provider
--    Decisión de qué proveedor usar (google_meet | zoom | pathway_room | none)
--    'none' = default legacy (V1)
ALTER TABLE citas
ADD COLUMN IF NOT EXISTS provider TEXT 
  DEFAULT 'none' 
  CONSTRAINT check_provider_values 
  CHECK (provider IN ('none', 'google_meet', 'zoom', 'pathway_room'));

COMMENT ON COLUMN citas.provider IS 
  'Video conference provider. Decidido por edge function select-provider.
   Values: none (legacy), google_meet, zoom, pathway_room.
   NUNCA modificar desde frontend; solo desde backend async functions.
   Default: none (backward compatible with V1).';

-- 2. COLUMN: provider_url
--    URL para unirse al meeting (completada por sync-provider-v2)
ALTER TABLE citas
ADD COLUMN IF NOT EXISTS provider_url TEXT;

COMMENT ON COLUMN citas.provider_url IS 
  'Meeting URL. Populated by edge function sync-provider-v2.
   NULL = sync in progress, error, or not yet started.
   Email service MUST wait for this before sending.
   Frontend reads only; backend writes only.';

-- 3. COLUMN: provider_ready_at
--    Timestamp cuando provider_url fue seteado exitosamente
ALTER TABLE citas
ADD COLUMN IF NOT EXISTS provider_ready_at TIMESTAMPTZ;

COMMENT ON COLUMN citas.provider_ready_at IS 
  'Timestamp when sync-provider-v2 completed successfully.
   NULL = sync not completed or failed.
   Used for: SLA monitoring, debugging, audit trail.';

-- 4. COLUMN: provider_error
--    Mensaje de error si sync-provider-v2 falla (non-retriable)
ALTER TABLE citas
ADD COLUMN IF NOT EXISTS provider_error TEXT;

COMMENT ON COLUMN citas.provider_error IS 
  'Error message if sync-provider-v2 fails definitively.
   Examples: "Gmail account does not support Google Meet",
             "Zoom token revoked",
             "Network timeout after 5 retries".
   NULL = no error (sync in progress or successful).
   Displayed in panel-v2 and cliente.html for debugging.';

-- 5. COLUMN: provider_retry_count
--    Número de reintentos intentados por sync-provider-v2
ALTER TABLE citas
ADD COLUMN IF NOT EXISTS provider_retry_count INT DEFAULT 0;

COMMENT ON COLUMN citas.provider_retry_count IS 
  'Retry count by sync-provider-v2.
   Backoff: [2s, 4s, 8s, 16s, 60s], max 5 retries.
   Incremented on each retry attempt.
   Used for: debugging, monitoring, retry decisions.';

-- 6. COLUMN: sala_token
--    Token JWT para Sala Pathway (si provider = pathway_room)
ALTER TABLE citas
ADD COLUMN IF NOT EXISTS sala_token TEXT;

COMMENT ON COLUMN citas.sala_token IS 
  'JWT token for Sala Pathway room access (only if provider = pathway_room).
   Generated in frontend (sala.html) and stored for audit/re-auth.
   NULL if provider != pathway_room.
   NOT a sensitive credential; time-limited access token per room.';

-- ============================================================================
-- FASE 2: ADD INDEXES (para async job processing y monitoring)
-- ============================================================================

-- INDEX 1: Find citas pending sync (where provider_url = NULL)
--   Used by: async job worker to find next citas to process
--   WHERE: provider_ready_at IS NULL AND provider_error IS NULL AND estado='confirmada'
--   ORDER BY: provider_ready_at DESC (FIFO)
CREATE INDEX IF NOT EXISTS idx_citas_provider_pending 
  ON citas (provider_ready_at DESC, provider_error) 
  WHERE provider_ready_at IS NULL 
    AND provider_error IS NULL 
    AND estado = 'confirmada';

COMMENT ON INDEX idx_citas_provider_pending IS 
  'Find citas waiting for provider sync.
   Used by: sync-provider-v2 to find next jobs.
   Selectivity: ~5% of total citas (pending ones).';

-- INDEX 2: Find citas with provider errors (for monitoring/alerts)
--   Used by: monitoring dashboard, retry worker, error alerting
--   WHERE: provider_error IS NOT NULL
--   ORDER BY: creada_at DESC (most recent first)
CREATE INDEX IF NOT EXISTS idx_citas_provider_error 
  ON citas (creada_at DESC, provider_error) 
  WHERE provider_error IS NOT NULL;

COMMENT ON INDEX idx_citas_provider_error IS 
  'Find citas with provider sync errors.
   Used by: monitoring, alerting, manual retry decisions.
   Selectivity: ~2% of total citas (error ones).';

-- ============================================================================
-- FASE 3: ADD CONSTRAINTS (data integrity)
-- ============================================================================

-- CONSTRAINT 1: provider_url NOT NULL requires provider != 'none'
--   Integrity: if URL exists, provider must be one of the real ones
ALTER TABLE citas
ADD CONSTRAINT IF NOT EXISTS check_provider_url_requires_provider 
CHECK (
  provider_url IS NULL 
  OR provider IN ('google_meet', 'zoom', 'pathway_room')
);

-- CONSTRAINT 2: sala_token NOT NULL requires provider = 'pathway_room'
--   Integrity: tokens only for Sala, not for other providers
ALTER TABLE citas
ADD CONSTRAINT IF NOT EXISTS check_sala_token_only_pathway 
CHECK (
  sala_token IS NULL 
  OR provider = 'pathway_room'
);

-- ============================================================================
-- FASE 4: VERIFY MIGRATION (sanity checks)
-- ============================================================================

DO $$
DECLARE
  col_count INT;
  idx_count INT;
BEGIN
  -- Count new columns
  SELECT COUNT(*) INTO col_count
  FROM information_schema.columns
  WHERE table_name = 'citas'
    AND column_name IN (
      'provider', 'provider_url', 'provider_ready_at',
      'provider_error', 'provider_retry_count', 'sala_token'
    );
  
  RAISE NOTICE 'Migration status: % of 6 columns created', col_count;
  
  -- Count new indexes
  SELECT COUNT(*) INTO idx_count
  FROM pg_indexes
  WHERE tablename = 'citas'
    AND indexname LIKE 'idx_citas_provider%';
  
  RAISE NOTICE 'Migration status: % of 2 indexes created', idx_count;
  
  IF col_count < 6 THEN
    RAISE WARNING 'MIGRATION INCOMPLETE: Only % of 6 columns created', col_count;
  END IF;
  
  IF idx_count < 2 THEN
    RAISE WARNING 'MIGRATION INCOMPLETE: Only % of 2 indexes created', idx_count;
  END IF;
END $$;

-- ============================================================================
-- RLS: NO CHANGES
-- ============================================================================
-- 
-- V2 introduces backend-only provider decisions:
-- - select-provider: Edge function (JWT service role)
-- - sync-provider-v2: Edge function (JWT service role)
-- - send-email-v2: Edge function (JWT service role)
--
-- Frontend reads provider_url (read-only), never modifies provider columns.
-- Therefore: NO RLS changes needed.
--
-- FUTURE (Phase 2): If frontend ever decides provider, add RLS:
--   ALTER TABLE citas ENABLE ROW LEVEL SECURITY;
--   CREATE POLICY "Coaches can read own citas"
--     ON citas FOR SELECT
--     USING (coach_id = auth.uid());
--
--   CREATE POLICY "No direct update to provider columns"
--     ON citas FOR UPDATE
--     WITH CHECK (
--       coach_id = auth.uid()
--       AND provider IS NOT DISTINCT FROM OLD.provider
--       AND provider_url IS NOT DISTINCT FROM OLD.provider_url
--       AND provider_error IS NOT DISTINCT FROM OLD.provider_error
--     );

-- ============================================================================
-- FINAL VERIFICATION
-- ============================================================================

-- List new columns
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'citas'
  AND column_name IN (
    'provider', 'provider_url', 'provider_ready_at',
    'provider_error', 'provider_retry_count', 'sala_token'
  )
ORDER BY ordinal_position;

-- List new indexes
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'citas'
  AND indexname LIKE 'idx_citas_provider%'
ORDER BY indexname;

-- List new constraints
SELECT constraint_name, check_clause
FROM information_schema.table_constraints
WHERE table_name = 'citas'
  AND (constraint_name LIKE 'check_%' OR constraint_name LIKE '%provider%')
ORDER BY constraint_name;
```

---

## ROLLBACK (V2 → V1)

### Archivo: `supabase/migrations/YYYYMMDD_rollback_v2_provider_model.sql`

**Usar SOLO si necesario (after decision to rollback Phase 1).**

```sql
-- ============================================================================
-- ROLLBACK: Remove V2 Provider Model from Booking System
-- Version: 1.0
-- SAFETY: Only execute after explicit authorization
-- ============================================================================

-- STEP 1: Drop constraints (SAFE, reversible)
ALTER TABLE citas
  DROP CONSTRAINT IF EXISTS check_provider_url_requires_provider;

ALTER TABLE citas
  DROP CONSTRAINT IF EXISTS check_sala_token_only_pathway;

-- STEP 2: Drop indexes (SAFE, reversible)
DROP INDEX IF EXISTS idx_citas_provider_pending;
DROP INDEX IF EXISTS idx_citas_provider_error;

-- STEP 3: Drop columns (DATA LOSS - only if certain)
-- WARNING: This removes all data in these columns permanently
-- ONLY execute if you are certain:
--   a) Backup of staging exists
--   b) No production citas have provider_url yet
--   c) Decision to fully revert to V1 is final

-- ALTER TABLE citas DROP COLUMN IF EXISTS provider CASCADE;
-- ALTER TABLE citas DROP COLUMN IF EXISTS provider_url CASCADE;
-- ALTER TABLE citas DROP COLUMN IF EXISTS provider_ready_at CASCADE;
-- ALTER TABLE citas DROP COLUMN IF EXISTS provider_error CASCADE;
-- ALTER TABLE citas DROP COLUMN IF EXISTS provider_retry_count CASCADE;
-- ALTER TABLE citas DROP COLUMN IF EXISTS sala_token CASCADE;

-- SAFER ALTERNATIVE: Leave columns, disable in app
-- - Set ENABLE_V2_BOOKING=false in environment
-- - Columns remain (nullable, no data loss)
-- - Frontend V1 flow used instead
-- - Columns can be dropped later if needed
-- - Re-enabling V2 is simple (set ENABLE_V2_BOOKING=true)

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Confirm constraints removed
SELECT constraint_name
FROM information_schema.table_constraints
WHERE table_name = 'citas'
  AND constraint_name LIKE '%provider%';
-- Should return ZERO rows

-- Confirm indexes removed
SELECT indexname
FROM pg_indexes
WHERE tablename = 'citas'
  AND indexname LIKE 'idx_citas_provider%';
-- Should return ZERO rows

-- Check if columns still exist (if not dropped)
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'citas'
  AND column_name IN (
    'provider', 'provider_url', 'provider_ready_at',
    'provider_error', 'provider_retry_count', 'sala_token'
  );
-- Should return 6 rows if columns NOT dropped (safer option)
-- Should return 0 rows if columns ARE dropped
```

---

## DEPLOYMENT STEPS (STAGING ONLY)

### 1. Backup current state

```bash
# In Supabase CLI (staging)
supabase db push --dry-run  # See what would change

# Or manual backup
pg_dump -Fc staging_db > backup_v2_20260813.dump
```

### 2. Apply migration

```bash
# Copy migration SQL to supabase/migrations/20260813_add_v2_provider_model.sql
cp FASE-1-MIGRATION-SQL-EXACT.md supabase/migrations/20260813_add_v2_provider_model.sql

# Deploy
supabase db push

# Verify
supabase db remote info  # Check schema version
```

### 3. Verify success

```bash
# In Supabase SQL Editor (staging):
-- Copy and run final verification queries (bottom of migration file)
```

---

## PRODUCTION DEPLOYMENT (Only after Phase 1A approval)

**DO NOT execute this section until:**
1. ✅ FASE 1A audit complete
2. ✅ 12 tests all PASS
3. ✅ Room isolation verified
4. ✅ Rollback procedure tested
5. ✅ Micaela explicit authorization

**When ready:**

```bash
# Production: same steps as staging
# 1. Backup production DB
# 2. Apply migration via Supabase CLI or SQL Editor
# 3. Deploy edge functions + frontend
# 4. Set ENABLE_V2_BOOKING=true gradually (10% → 100%)
# 5. Monitor for 24h for errors
```

---

## BREAKING CHANGES (If any)

**V2 introduces NO breaking changes to V1:**
- ✅ All new columns nullable (V1 data unaffected)
- ✅ V1 queries continue unchanged
- ✅ RLS policies unchanged (backend-only)
- ✅ Existing meet_link column untouched
- ✅ V1 flows (reservar.html, send-email) continue to work

**Dual deployment possible:**
- V1 bookings: use reservar.html, old email flow
- V2 bookings: use reservar-v2.html, new provider flow
- Can run both simultaneously via feature flag

---

## EXECUTION CHECKLIST

Before applying this migration:

- [ ] Audit SQL (FASE-0-AUDIT-SQL-READONLY.md) executed in staging
- [ ] Schema verified (6 columns NOT exist yet)
- [ ] Root cause confirmed (Gmail + Google Meet issue)
- [ ] Sala Pathway validated (code audit OK)
- [ ] Environment: STAGING (NOT production)
- [ ] Backup taken
- [ ] Rollback procedure understood
- [ ] Team notified
- [ ] Approval from Micaela: YES ✅

---

## SUMMARY

**Migration: READY TO APPLY (but NOT yet applied)**

✅ 6 columns (nullable, zero data loss)  
✅ 2 indexes (async processing)  
✅ 2 constraints (data integrity)  
✅ RLS: no changes  
✅ Rollback: documented and reversible  

**Next:** After audit READ-ONLY completes → authorization to apply this migration in staging.
