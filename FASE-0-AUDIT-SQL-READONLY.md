# FASE 0 — AUDIT SQL (READ-ONLY)

**Propósito:** Validar estado actual de Booking, Sala, schema de `citas`, Google Meet issues.  
**Ejecución:** STAGING SOLAMENTE. Queries SELECT/inspection, zero modifications.  
**Output:** Evidencia para decisiones de FASE 1.

---

## PARTE 1: SCHEMA ACTUAL DE CITAS

### Query 1: Estructura exacta de la tabla

```sql
-- Tabla citas: estructura completa
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default,
  ordinal_position
FROM information_schema.columns
WHERE table_name = 'citas'
ORDER BY ordinal_position;

-- Verificar constraints
SELECT constraint_name, constraint_type, check_clause
FROM information_schema.table_constraints
WHERE table_name = 'citas'
ORDER BY constraint_name;

-- Verificar índices existentes
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'citas'
ORDER BY indexname;

-- Verificar RLS policies
SELECT schemaname, tablename, policyname, permissive, roles, qual, with_check
FROM pg_policies
WHERE tablename = 'citas'
ORDER BY policyname;
```

**Esperado:** Confirmar columnas existentes (sin provider, provider_url, etc. si V1 puro)

---

## PARTE 2: ESTADO DE CITAS (Google Meet, Zoom, Sala)

### Query 2: Distribución de meet_link (Google Meet status)

```sql
-- ¿Cuántas citas tienen meet_link?
SELECT 
  COUNT(*) as total_citas,
  COUNT(CASE WHEN meet_link IS NOT NULL THEN 1 END) as citas_con_link,
  COUNT(CASE WHEN meet_link IS NULL THEN 1 END) as citas_sin_link,
  ROUND(
    100.0 * COUNT(CASE WHEN meet_link IS NOT NULL THEN 1 END) / COUNT(*),
    2
  ) as pct_con_link
FROM citas
WHERE estado IN ('confirmada', 'completada');
```

**Esperado:** Muestra % de citas con Google Meet link (antes eran ~1.6%)

---

### Query 3: Citas sin meet_link (potenciales Google Meet failures)

```sql
-- Listar últimas 20 citas sin meet_link
SELECT 
  id,
  coach_id,
  titulo,
  fecha,
  meet_link,
  creada_at,
  estado
FROM citas
WHERE meet_link IS NULL
  AND estado IN ('confirmada', 'completada')
ORDER BY creada_at DESC
LIMIT 20;
```

**Evidencia:** Confirma que Google Meet sync falla regularmente

---

### Query 4: Coaches con Gmail personal vs Workspace

```sql
-- Identificar coaches con @gmail.com (NO generan Google Meet links)
SELECT 
  id,
  email,
  nombre,
  CASE 
    WHEN email ILIKE '%@gmail.com' THEN 'Gmail Personal'
    WHEN email ILIKE '%@%workspace.com' OR email ILIKE '%@%company.com' THEN 'Workspace'
    ELSE 'Other'
  END as email_type,
  CASE 
    WHEN google_refresh_token IS NOT NULL AND google_refresh_token != '' THEN 'Yes'
    ELSE 'No'
  END as has_google_token
FROM usuarios
WHERE rol = 'coach'
ORDER BY email;
```

**Root cause evidence:** Confirma coaches con @gmail.com + Google token (explica por qué no generan Meet links)

---

### Query 5: Zoom vs Google vs Sala distribution

```sql
-- Si estuviera implementado: ¿qué provider se usa?
-- (Esto es para V1, debería ser todo NULL o meet_link)
SELECT 
  COUNT(*) as total,
  COUNT(CASE WHEN meet_link LIKE 'https://zoom.us%' THEN 1 END) as via_zoom,
  COUNT(CASE WHEN meet_link LIKE 'https://meet.google.com%' THEN 1 END) as via_google,
  COUNT(CASE WHEN meet_link LIKE '%sala%' OR meet_link LIKE '%pathway%' THEN 1 END) as via_sala,
  COUNT(CASE WHEN meet_link IS NULL THEN 1 END) as no_link
FROM citas
WHERE estado IN ('confirmada', 'completada');
```

**Current state:** Distribuir de providers actuales (si existen)

---

## PARTE 3: GOOGLE MEET SYNC ISSUES

### Query 6: Citas con google_event_id (si se almacena)

```sql
-- Verificar si existe columna google_event_id
SELECT 
  column_name
FROM information_schema.columns
WHERE table_name = 'citas'
  AND column_name = 'google_event_id';

-- Si existe:
SELECT 
  COUNT(*) as total,
  COUNT(CASE WHEN google_event_id IS NOT NULL THEN 1 END) as with_event_id,
  COUNT(CASE WHEN google_event_id IS NULL THEN 1 END) as without_event_id
FROM citas
WHERE estado IN ('confirmada', 'completada');
```

**Root cause:** google_event_id NULL = sync nunca pasó, o falló en Google Calendar

---

### Query 7: Últimas 10 citas con estado y links

```sql
-- Timeline reciente: ¿qué pasó con los últimos bookings?
SELECT 
  id,
  coach_id,
  titulo,
  fecha,
  estado,
  meet_link,
  creada_at,
  EXTRACT(DAY FROM (now() - creada_at)) as dias_desde_creacion
FROM citas
ORDER BY creada_at DESC
LIMIT 10;
```

**Evidence:** Confirma si meet_link se sinc después de crear cita

---

## PARTE 4: SALA PATHWAY VALIDATION

### Query 8: Verificar sala.html en sistema de archivos

```bash
# Ejecutar en CLI (no SQL)
# ¿Existe sala.html? ¿Tiene token validation?

ls -la sala.html

# Verificar token validation function
grep -n "_validateToken\|room_access\|sala_token" sala.html | head -20

# Verificar WebRTC setup
grep -n "new RTCPeerConnection\|p2p\|TURN" sala.html | head -10
```

**Expected:**
- ✅ sala.html exists
- ✅ `_validateToken()` function present
- ✅ WebRTC P2P + TURN fallback configured
- ✅ No obvious security issues

---

### Query 9: Sala tokens en DB (si se almacenan)

```sql
-- Verificar si hay columna sala_token o similar
SELECT 
  column_name
FROM information_schema.columns
WHERE table_name = 'citas'
  AND (column_name LIKE '%sala%' OR column_name LIKE '%token%');

-- Si existe columna con tokens:
SELECT 
  COUNT(*) as total_with_sala_token,
  COUNT(CASE WHEN sala_token IS NOT NULL THEN 1 END) as populated,
  COUNT(CASE WHEN sala_token IS NULL THEN 1 END) as null
FROM citas
WHERE estado = 'completada';
```

**Current state:** Confirmar si Sala se usa o no

---

## PARTE 5: EMAIL & NOTIFICATION TRACKING

### Query 10: Informes guardados y emails enviados

```sql
-- ¿Cuántos informes se han generado y enviado?
SELECT 
  COUNT(*) as total_informes,
  COUNT(CASE WHEN email_enviado = true THEN 1 END) as emails_sent,
  COUNT(CASE WHEN email_enviado = false THEN 1 END) as emails_not_sent
FROM informes_guardados;

-- Últimos informes (si existe timestamp)
SELECT 
  id,
  candidato_id,
  fecha_creacion,
  email_enviado,
  fecha_envio
FROM informes_guardados
ORDER BY fecha_creacion DESC
LIMIT 10;
```

**Verification:** Confirma que email service funciona en general

---

### Query 11: Notificaciones de videconferencia

```sql
-- Si existe tabla de notificaciones/logs de envío
SELECT 
  table_name
FROM information_schema.tables
WHERE table_name IN ('notificaciones', 'email_logs', 'send_logs', 'client_errors')
  AND table_schema = 'public';

-- Si existe:
SELECT 
  COUNT(*) as total_logs,
  COUNT(CASE WHEN status LIKE '%error%' OR status LIKE '%fail%' THEN 1 END) as errors,
  COUNT(CASE WHEN status LIKE '%success%' THEN 1 END) as success
FROM client_errors
WHERE page LIKE '%booking%' OR page LIKE '%cita%';
```

**Error tracking:** Identificar patrones de fallos

---

## PARTE 6: CHAT & MENSAJES (Si aplica)

### Query 12: Chat existente

```sql
-- Verificar tabla de chat
SELECT 
  table_name
FROM information_schema.tables
WHERE table_name IN ('chat', 'mensajes', 'contactos_chat')
  AND table_schema = 'public';

-- Si existe:
SELECT 
  COUNT(*) as total_messages,
  COUNT(DISTINCT cita_id) as unique_citas,
  COUNT(DISTINCT sender_id) as unique_senders
FROM chat;  -- (nombre de tabla real)
```

**Verification:** Chat implementation status

---

## PARTE 7: DATABASE SIZE & PERFORMANCE

### Query 13: Tamaño y estadísticas

```sql
-- Tamaño de tabla citas
SELECT 
  pg_size_pretty(pg_total_relation_size('citas')) as total_size,
  pg_size_pretty(pg_relation_size('citas')) as table_size,
  pg_size_pretty(pg_total_relation_size('citas') - pg_relation_size('citas')) as indexes_size,
  reltuples as estimated_rows
FROM pg_class
WHERE relname = 'citas';

-- Número real de filas
SELECT COUNT(*) as real_row_count FROM citas;
```

**Baseline:** Para monitoreo post-migration

---

### Query 14: Índices actuales y uso

```sql
-- ¿Qué índices existen y se usan?
SELECT 
  indexname,
  idx_scan as scan_count,
  idx_tup_read as tuples_read,
  idx_tup_fetch as tuples_fetched
FROM pg_stat_user_indexes
WHERE relname = 'citas'
ORDER BY idx_scan DESC;
```

**Performance baseline:** Para comparar post-V2

---

## EJECUCIÓN (PASO A PASO)

### En Supabase SQL Editor (STAGING):

```bash
# 1. Ejecutar Query 1 (schema)
# Copiar output completo

# 2. Ejecutar Query 2 (meet_link distribution)
# Copiar resultado (pct_con_link)

# 3. Ejecutar Query 3 (citas sin link)
# Verificar últimas 10-20 sin meet_link

# 4. Ejecutar Query 4 (coaches Gmail vs Workspace)
# Confirmar root cause: coaches con @gmail.com

# 5. Ejecutar Query 5 (provider distribution)
# Ver qué tan adoptado está cada provider

# 6-7. Queries Google Meet (event_id, etc.)

# 8. Bash: verificar sala.html
# (Ejecutar en terminal local, no Supabase)

# 9-14. Queries restantes
```

---

## SALIDA ESPERADA (Summary)

| Métrica | Query | Expected Output | Implicación |
|---------|-------|-----------------|------------|
| Schema | Q1 | Sin columnas V2 (provider, provider_url, etc.) | V1 puro |
| Meet links | Q2 | <5% citas con meet_link | Google Meet failures confirmas |
| Gmail coaches | Q4 | N coaches con @gmail.com + google_token | Root cause: Gmail no genera Meet links |
| Sala status | Q9 | Sin sala_token o pocos | Sala no usado actualmente |
| Errors | Q11 | N errores relacionados a provider sync | Problemas conocidos |
| DB size | Q13 | XXX MB, YYY rows | Baseline para monitoring |

---

## NEXT STEP DESPUÉS DE AUDIT

Una vez completado este audit:

1. ✅ Confirmar schema actual exacto
2. ✅ Confirmar root cause Google Meet (Gmail)
3. ✅ Confirmar sala.html es viable
4. ✅ Confirmar baseline de errors/performance

→ **Entonces:** Proceder a FASE-1-MIGRATION-SQL-EXACT.md (modificaciones)

---

## BLOQUEO

❌ **NO ejecutar Query que modifican datos**  
✅ **SOLO SELECT / inspect queries**  
❌ **NO DROP / ALTER / INSERT / UPDATE**  
✅ **STAGING ENVIRONMENT ONLY**
