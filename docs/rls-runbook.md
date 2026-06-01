# Runbook — Cierre del gap de seguridad RLS

Cierra el agujero por el que cualquiera con la anon key podía bajarse TODOS los
candidatos/informes/CVs. Se hace en 2 fases para no romper la app en vivo.

## Qué cambió (Fase A — código, ya en esta rama)

- **`pw-auth.js`** (nuevo): helper compartido. Reusa la sesión de Supabase Auth
  que dejó el login, refresca el token solo, y expone `PWAUTH.headers()` /
  `PWAUTH.headersSync()`. **Fallback a la anon key** si no hay sesión → mientras
  RLS esté apagado todo funciona igual.
- **`login.html`**: tras el login (email+pass), establece una sesión real con
  `signInWithPassword` (además de la migración perezosa que ya existía). Google
  OAuth ya creaba sesión.
- **`panel-v2.html`**, **`cliente.html`**, **`cv.html`**, **`carta.html`**:
  todos los fetch a `candidatos` / `informes` / `cv_publicados` ahora mandan el
  JWT del usuario (vía `PWAUTH`), con fallback a anon.
- **`formulario.html`**: el intake pasa de `merge-duplicates` a
  `ignore-duplicates` (así la política de INSERT anónimo alcanza sin dar UPDATE
  a anon). Re-envíos no pisan datos; el coach corrige desde el panel.
- **`supabase/migrations/rls_strict.sql`** (nuevo): las políticas RLS. **NO se
  aplican solas** — las corrés vos en Fase B.

## Orden de rollout (IMPORTANTE)

### 1. Deploy de Fase A (sin riesgo, RLS sigue apagado)
- Mergear esta rama a `main` → Cloudflare deploya. **No prende RLS todavía**,
  así que no rompe nada (el código tiene fallback a anon key).
- **Antes de mergear**, probá en el preview de Cloudflare:
  - [ ] Coach entra al panel y ve sus clientes.
  - [ ] Cliente entra al portal y ve su CV/carta/informe.
  - [ ] Un candidato nuevo completa `formulario.html` y se guarda.
  - [ ] En la consola del navegador, logueado, mirá que exista en localStorage
        la key `sb-ddxnrsnjdvtqhxunxnwj-auth-token` (= hay sesión).

### 2. Esperar a que la gente entre (pobla `auth_id`)
La sesión se crea al loguearse. Dale unos días para que los coaches/clientes
activos entren al menos una vez. Diagnóstico en Supabase → SQL Editor:
```sql
SELECT count(*) FILTER (WHERE auth_id IS NULL)     AS sin_migrar,
       count(*) FILTER (WHERE auth_id IS NOT NULL)  AS migrados
FROM usuarios;
```

### 3. Fase B — prender el candado
Correr **`supabase/migrations/rls_strict.sql`** en Supabase → SQL Editor.

### 4. Verificar (clave)
- [ ] **Anónimo (sin login)**: en una pestaña incógnito, en consola:
  ```js
  fetch('https://ddxnrsnjdvtqhxunxnwj.supabase.co/rest/v1/candidatos?select=*&limit=5',
    {headers:{apikey:'<anon key>'}}).then(r=>r.json()).then(console.log)
  ```
  Debe devolver **`[]`** (antes devolvía todo). ✅ gap cerrado.
- [ ] **Coach**: entra al panel → ve SOLO sus clientes.
- [ ] **Cliente**: entra al portal → ve su CV/carta/informe.
- [ ] **Intake**: un candidato nuevo completa el formulario → se guarda.
- [ ] **Admin (Micaela)**: ve todo.

### 5. Si algo se rompe → ROLLBACK inmediato
```sql
ALTER TABLE candidatos    DISABLE ROW LEVEL SECURITY;
ALTER TABLE informes      DISABLE ROW LEVEL SECURITY;
ALTER TABLE cv_publicados DISABLE ROW LEVEL SECURITY;
```
La app vuelve a funcionar con anon key al instante (el fallback sigue ahí).

## Pendiente (Fase 4 — otra iteración)

- **`usuarios`** NO se bloquea acá. Razón: el login viejo consulta
  `usuarios?email=eq&password_hash=eq` con anon key ANTES de tener sesión, y
  `formulario.html`/`coach.html` leen la config pública de coaches. Cerrar
  `usuarios` requiere primero migrar el login para que NO consulte
  `password_hash` con anon (usar siempre `migrate-user-to-auth` +
  `signInWithPassword`). Recién ahí: ENABLE RLS en `usuarios` + esconder
  `password_hash`.
- **`cv_express`** (Pack Express) tampoco está en scope — sigue con anon key.

## Nota de seguridad sobre el INSERT anónimo en `candidatos`
La política de INSERT es `WITH CHECK (true)` para que el formulario público
funcione. Es **write-only** (no deja leer filas ajenas), así que el riesgo es
spam de filas, no fuga de datos. Si aparece spam, mover el intake a una edge
function con service_role + rate limit.
