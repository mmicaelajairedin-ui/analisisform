# Diagnóstico Riguroso: Errores 500 en Pathway (30 Jul 2026)

**Objetivo:** Determinar causa raíz EXACTA de cada error 500 antes de aplicar cambios en Supabase.

---

## Paso 1: Capturar Respuesta Completa del Servidor

### Opción A: Ver logs en Supabase Console (tiempo real)

1. **Abrir Supabase Dashboard**
   - Project → Logs (esquina inferior izquierda)
   - Filter por timestamp últimas 24h

2. **Ver logs de PostgREST API**
   - Buscar `PATCH /rest/v1/usuarios` o `GET /rest/v1/informes`
   - Anotar línea completa con:
     - Timestamp exacto
     - Request completa (headers, body)
     - Response completa (status, body, error message)
     - SQLSTATE (si es error SQL)

3. **Exportar o copiar**
   ```
   Clic derecho en log → Copy → Pegar en archivo
   ```

### Opción B: Ver en `client_errors` table (histórico)

```sql
-- Abrir Supabase SQL Editor y ejecutar:

SELECT 
  ts,
  email,
  kind,
  page,
  detail,
  ua
FROM client_errors
WHERE kind LIKE 'http_5%'
  AND ts > now() - interval '48 hours'
ORDER BY ts DESC
LIMIT 50;
```

**Buscar patrones por endpoint:**

```sql
-- Errores en PATCH usuarios
SELECT ts, email, detail FROM client_errors 
WHERE detail LIKE 'PATCH%usuarios%' AND kind='http_500'
ORDER BY ts DESC LIMIT 20;

-- Errores en GET informes
SELECT ts, email, detail FROM client_errors 
WHERE detail LIKE 'GET%informes%' AND kind='http_500'
ORDER BY ts DESC LIMIT 20;
```

---

## Paso 2: Construir Árbol de Causa Raíz

**Para cada endpoint, documentar:**

### Caso 1: PATCH /rest/v1/usuarios (44 errores)

```
ENDPOINT: PATCH /rest/v1/usuarios?id=eq.{coach_id}&select=id
METHOD: PATCH
BODY: { "last_seen": "2026-07-30T13:45:22.123Z" }
CALLED BY: coachBeat() en panel-v2.html línea 14276

RESPUESTA DEL SERVIDOR:
- Status: 500 Internal Server Error
- Content-Type: text/plain | application/json | text/html
- Body (primeros 500 chars):
  [COPIAR EXACTO DESDE SUPABASE LOGS]
- SQLSTATE (si aplica): [ej. 42703, 23505, etc.]
- Error message:
  [COPIAR EXACTO DEL LOG]

ANÁLISIS:

1. ¿Es error de SQL o de PostgREST?
   - Si dice "column does not exist" → falta una migración
   - Si dice "permission denied" → falta GRANT
   - Si dice "violates unique constraint" → constraint roto
   - Si dice "new row violates row-level security policy" → RLS bloqueando
   - Si hay función SQL nombrada → trigger o función fallando

2. Rastrear línea de ejecución:
   Panel → _sbw() → fetch POST /rest/v1/usuarios
   ↓
   [Servidor] PostgREST recibe → valida permisos (RLS) → ejecuta UPDATE
   ↓
   [¿DÓNDE FALLA?]
   - Si antes de RLS: problema con JWT o headers
   - Si en RLS: política de fila o columna rechazando
   - Si en UPDATE: constraint, trigger, o columna no existe
   - Si en return: lectura de columna prohibida

3. Evidencia que apunta a causa:
   [Listar evidencia concreta del log]

HIPÓTESIS ACTUAL:
   ❌ Falta GRANT UPDATE en usuarios_gamif_grant.sql
   ❌ Falta GRANT SELECT en usuarios_gamif_grant.sql
   ✓ [OTRA: basada en log exacto]

SOLUCIÓN PROPUESTA:
   [Acción concreta, no genérica]
```

### Caso 2: GET /rest/v1/informes (12 errores)

Repetir estructura anterior:

```
ENDPOINT: GET /rest/v1/informes?[query_params]
CALLED BY: pathway-fit-cliente.html línea [X]

RESPUESTA DEL SERVIDOR:
[COPIAR EXACTO]

ANÁLISIS:
[Mismo árbol de decisión]

SOLUCIÓN PROPUESTA:
[Concreta]
```

---

## Paso 3: Validar Hipótesis (No Asumir)

### ✓ Verificar GRANT UPDATE en usuarios

```sql
-- En Supabase SQL Editor:
SELECT grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_name = 'usuarios' 
  AND grantee IN ('anon', 'authenticated')
  AND privilege_type = 'UPDATE';
```

**Esperado:** Filas para `anon` y `authenticated` con privilege `UPDATE`

**Si falta:** El GRANT de `usuarios_gamif_grant.sql` NO se ejecutó

### ✓ Verificar permisos por columna

```sql
-- Ver qué columnas puede escribir anon:
SELECT column_name
FROM information_schema.table_privileges
WHERE table_name = 'usuarios' 
  AND grantee = 'anon'
  AND privilege_type = 'UPDATE';
```

**Esperado:** `last_seen`, `game_pts`, `game_medal`, `xp`, `badges`

**Si falta alguna:** El GRANT por columna está incompleto

### ✓ Verificar RLS en usuarios

```sql
-- Ver si hay política de UPDATE para anon:
SELECT policy_name, definition
FROM pg_policies
WHERE tablename = 'usuarios' 
  AND qual_name LIKE '%update%';
```

**Esperado:** Política `usuarios_anon_gamif` con `using (true) with check (true)`

**Si falta:** El RLS no permite UPDATE desde anon

---

## Paso 4: Reproducir el Error (Opcional pero Recomendado)

### Crear script de diagnóstico en panel-v2.html

```javascript
// Agregar temporalmente en consola del navegador:

// 1. Simular el PATCH que falla
fetch('https://api.pathwaycareercoach.com/rest/v1/usuarios?id=eq.' + RME.id + '&select=id', {
  method: 'PATCH',
  headers: {
    'Content-Type': 'application/json',
    'apikey': KEY,
    'Authorization': 'Bearer ' + KEY,
    'Prefer': 'return=representation'
  },
  body: JSON.stringify({ last_seen: new Date().toISOString() })
})
.then(r => {
  console.log('Status:', r.status);
  console.log('Headers:', Object.fromEntries(r.headers.entries()));
  return r.text();
})
.then(body => {
  console.log('Body:', body);
  console.log('---');
  if (body.includes('SQLSTATE')) {
    var m = /SQLSTATE\s+(\w+)/i.exec(body);
    if (m) console.log('SQLSTATE:', m[1]);
  }
})
.catch(e => console.error('Network error:', e));
```

Ejecutar y **copiar output completo**.

---

## Paso 5: Documentar Hallazgos

Una vez tengas la respuesta completa del servidor, completa esta tabla:

| Endpoint | Status | SQLSTATE | Mensaje Exacto | Tabla/Función | Causa Probable | Solución Propuesta |
|----------|--------|----------|---|---|---|---|
| PATCH /usuarios | 500 | [SQLSTATE] | [Copiar exacto] | usuarios (UPDATE) | [Análisis] | [Concreta] |
| GET /informes | 500 | [SQLSTATE] | [Copiar exacto] | informes (RLS?) | [Análisis] | [Concreta] |

---

## Mejora de `pw-observe.js`

Se agregó captura mejorada de errores 500:
- Ahora intenta leer los primeros 200 caracteres del body del servidor
- Sin consumir la respuesta original (usa `.clone()`)
- Se guarda en `client_errors.detail` para análisis

**Nueva estructura de detail:**
```
PATCH /rest/v1/usuarios | Column "last_seen" does not exist
GET /rest/v1/informes | permission denied for schema "public"
```

Ejecuta en el navegador después de recargar y revisa `client_errors` nuevamente.

---

## ⚠️ Antes de Aplicar Cambios

**NO ejecutes migraciones en Supabase hasta que:**

1. ✓ Tengas la respuesta completa del servidor (no solo "http_500")
2. ✓ Hayas identificado el SQLSTATE exacto (ej. 42703, 23505, etc.)
3. ✓ Hayas rastreado la línea de ejecución (RLS → Trigger → Constraint)
4. ✓ Hayas validado que la causa propuesta es consistente con los datos
5. ✓ Hayas verificado que la solución aborda LA CAUSA, no síntomas

**Si no tienes todos esos puntos:** STOP y recolecta más evidencia.

---

## Recursos

- [Supabase RLS Debugging](https://supabase.com/docs/guides/auth/row-level-security)
- [PostgreSQL Error Codes](https://www.postgresql.org/docs/current/errcodes-appendix.html)
- [PostgREST API Errors](https://postgrest.org/en/v12/errors.html)

