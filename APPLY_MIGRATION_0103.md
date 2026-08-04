# 🔧 APLICAR MIGRATION 0103: Citas RLS Policy

## Descripción
Esta migration abre acceso read-only a la tabla `citas` para usuarios anon.
**Impacto**: Desbloquea formulario de reservas (arregla 7× HTTP 401 errors).

---

## Pasos para aplicar en Supabase

### 1. Abre Supabase Dashboard
```
https://supabase.com/dashboard/project/ddxnrsnjdvtqhxunxbwj
```

### 2. Ve a SQL Editor
- Click en **SQL Editor** (lado izquierdo)
- Click en **+ New Query**

### 3. Copia y ejecuta el siguiente SQL

```sql
-- Fix: Allow anon role to read citas table (GET /rest/v1/citas)
-- Error: 7× HTTP 401 on reservar.html
-- Cause: RLS policy denies access to anon users
-- Solution: Open read-only access for anon to active bookings

-- Create policy for anon SELECT on citas
CREATE POLICY "citas_anon_select"
  ON citas
  FOR SELECT
  TO anon
  USING (estado IS NOT NULL);

-- Create policy for authenticated SELECT (coaches/admins)
CREATE POLICY "citas_authenticated_select"
  ON citas
  FOR SELECT
  TO authenticated
  USING (
    -- Coach can see citas they created or are assigned to
    coach_id = auth.uid() OR
    -- Admin can see all
    auth.jwt() ->> 'role' = 'admin'
  );

-- Ensure RLS is enabled
ALTER TABLE citas ENABLE ROW LEVEL SECURITY;
```

### 4. Ejecuta el query (Ctrl+Enter o click en ▶ Run)

### 5. Verifica el resultado
- Debe mostrar: `Success. No rows returned`
- Si hay error de política duplicada, ignora (ya existe)

---

## Verificación post-aplicación

### Test en navegador:
1. Abre https://pathwaycareercoach.com/reservar.html?c=<coach_id>
2. Debería cargar los slots disponibles (sin 401 error)
3. Abre DevTools > Network > busca `citas` → status 200 (antes era 401)

### Test en Supabase:
1. Ve a **Authentication** > **Users**
2. Anon user debería poder hacer:
   ```sql
   SELECT * FROM citas LIMIT 1;
   ```

---

## Rollback (si algo va mal)

```sql
DROP POLICY IF EXISTS "citas_anon_select" ON citas;
DROP POLICY IF EXISTS "citas_authenticated_select" ON citas;
```

---

## Contacto
Si hay error al ejecutar, verifica:
- ✓ Tabla `citas` existe (vai a **Tables** en sidebar)
- ✓ RLS está habilitado en `citas`
- ✓ No hay políticas duplicadas

Mensaje típico si ya existe: `ERROR: policy "citas_anon_select" for relation "citas" already exists`
→ Ignora, ya está aplicada.
