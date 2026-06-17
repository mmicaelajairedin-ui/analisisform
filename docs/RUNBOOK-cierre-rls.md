# Runbook — Cierre del gap de seguridad RLS

> **Objetivo:** que cada coach/cliente vea SOLO sus datos. Hoy, con la anon key
> (pública en el JS del navegador), cualquiera podría bajarse `candidatos`,
> `informes` y `cv_publicados` de todos. Esto lo cierra.
>
> **Riesgo si se hace mal:** el panel/portal se queda sin ver datos. Por eso el
> orden importa y hay rollback en cada paso.

---

## Estado (lo que YA está hecho en el código)
- ✅ `pw-auth.js` + login con sesión real de Supabase Auth (`signInWithPassword`).
- ✅ `migrate-user-to-auth` llena `usuarios.auth_id` al loguearse.
- ✅ **Interceptor de fetch en `pw-auth.js`** (Fase A): toda página que lo incluye
  manda el JWT a `candidatos/informes/cv_publicados`. Es un **no-op mientras RLS
  esté apagado**.
- ✅ Migraciones escritas: `auth_id_on_usuarios.sql`, `rls_strict.sql`.

## Lo que falta (lo que tenés que hacer vos, en orden)

### Paso 0 — Pre-requisito de datos (una vez)
En **Supabase → SQL Editor**, correr (si no se corrió ya):
```sql
-- agrega la columna auth_id si falta
\i auth_id_on_usuarios.sql   -- o pegar el contenido del archivo
```
Verificar cuántos usuarios ya migraron:
```sql
SELECT count(*) FILTER (WHERE auth_id IS NULL)     AS pendientes,
       count(*) FILTER (WHERE auth_id IS NOT NULL) AS migrados
FROM usuarios;
```
👉 **No avances hasta que las coaches/clientes ACTIVOS tengan `auth_id`.** Se llena
solo cuando cada uno entra al login una vez. Si hay pendientes, pediles que
inicien sesión (o esperá unos días). Idealmente: `pendientes = 0` entre los activos.

### Paso 1 — Deploy del frontend (Fase A) a producción
Mergear esta rama a `main` (auto-deploy en Cloudflare Pages).
**Esto NO cambia nada visible todavía** (RLS sigue apagado). Solo hace que las
llamadas viajen con el JWT.

### Paso 2 — Verificar en producción CON RLS TODAVÍA APAGADO
Entrá a `pathwaycareercoach.com` y comprobá que todo sigue normal:
- [ ] Coach entra al panel y **ve sus clientes**.
- [ ] Cliente entra a su portal y **ve sus datos** (CV, informe, progreso).
- [ ] Un candidato nuevo completa `formulario.html` y **se guarda**.
- [ ] Editar/guardar CV (`cv.html`) y carta (`carta.html`) funciona.

👉 Si algo de esto falla **ya acá**, el problema es el frontend → revertí el merge
(no tocaste la base, no hay riesgo). Avisame y lo arreglo.

### Paso 3 — Prender RLS (el candado)
Solo si el Paso 2 salió perfecto. En **Supabase → SQL Editor**, pegar y correr el
contenido de **`rls_strict.sql`**.

### Paso 4 — Re-verificar (lo mismo del Paso 2)
- [ ] Coach ve **solo SUS** clientes (no los de otros).
- [ ] Cliente ve **solo lo suyo**.
- [ ] Admin (`rol='admin'`) ve **todo**.
- [ ] Candidato nuevo se guarda por el formulario (alta anónima permitida).
- [ ] Prueba del candado: en una pestaña sin login, en la consola del navegador:
  ```js
  fetch('https://ddxnrsnjdvtqhxunxnwj.supabase.co/rest/v1/candidatos?select=*', {
    headers:{ apikey:'<ANON_KEY>', Authorization:'Bearer <ANON_KEY>' }
  }).then(r=>r.json()).then(d=>console.log('filas:', d.length));
  ```
  👉 Debe devolver **0 filas** (antes devolvía todo). Ese 0 = gap cerrado.

### Si algo se rompe (ROLLBACK inmediato)
En Supabase → SQL Editor:
```sql
ALTER TABLE candidatos    DISABLE ROW LEVEL SECURITY;
ALTER TABLE informes      DISABLE ROW LEVEL SECURITY;
ALTER TABLE cv_publicados DISABLE ROW LEVEL SECURITY;
```
Todo vuelve a como estaba en segundos. Después investigamos con calma.

---

## Notas / límites conocidos
- **Sesión vencida con RLS prendido:** si a un usuario se le vence el token, sus
  lecturas devuelven vacío (no error). Solución: volver a iniciar sesión. (Mejora
  futura: avisar "iniciá sesión de nuevo" cuando no hay token.)
- **`usuarios` NO se blinda en este paso** (a propósito): el login viejo todavía
  consulta `usuarios` con la anon key antes de tener sesión. El dato sensible ahí
  es `password_hash`. Cerrarlo es la **Fase 4** (otra migración), después de que el
  login deje de leer `password_hash` con anon. No urge como las 3 tablas de datos.
- **`hub.html` y portales de nicho** (`pathway-fit/fin-cliente.html`) ya incluyen
  `pw-auth.js`, así que el interceptor también los cubre.
