# Checklist Pre-Deploy — Arquitectura Híbrida Estable

**Fecha planeada de merge a `main`**: [COMPLETAR]  
**Responsable de validación**: [COMPLETAR]  
**Proyecto antiguo**: mxkljqhlwiqavbjfjfov  
**Proyecto nuevo**: ddxnrsnjdvtqhxunxnwj  

---

## FASE 1: Infraestructura y Secrets

### A. Configuración de Secrets (Proyecto Nuevo)

- [ ] Login a Supabase console → proyecto nuevo (ddxnrsnjdvtqhxunxnwj)
- [ ] Edge Functions → Secrets
- [ ] Configurar las 3 URLs obligatorias:
  - [ ] `SUPABASE_AUTH_URL` = `https://mxkljqhlwiqavbjfjfov.supabase.co`
  - [ ] `SUPABASE_USERS_URL` = `https://mxkljqhlwiqavbjfjfov.supabase.co`
  - [ ] `SUPABASE_DATA_URL` = `https://ddxnrsnjdvtqhxunxnwj.supabase.co`
- [ ] Verificar que existen:
  - [ ] `SUPABASE_SERVICE_ROLE_KEY`
  - [ ] `SUPABASE_ANON_KEY`
- [ ] Ejecutar: `supabase secrets list --project-ref ddxnrsnjdvtqhxunxnwj` → debe mostrar 5 secrets

### B. Permisos y Keys

- [ ] Service role key del proyecto nuevo tiene acceso:
  - [ ] Lectura a `usuarios`, `candidatos` en proyecto antiguo (test con curl)
  - [ ] Lectura a `citas` en proyecto nuevo (test con curl)
- [ ] Anon key del proyecto nuevo tiene RLS configurado:
  - [ ] No puede leer `usuarios.password_hash` (proteggido)
  - [ ] Puede leer `citas` (si su `auth.uid()` coincide)

### C. Tablas Críticas

- [ ] Tabla `citas` existe en proyecto nuevo:
  ```sql
  SELECT column_name FROM information_schema.columns 
  WHERE table_name = 'citas' LIMIT 1;
  ```
- [ ] Columnas clave presentes: `id`, `coach_id`, `email`, `inicio`, `estado`, `meet_link`
- [ ] RLS habilitado en `citas` (verificar policy `citas_coach` o similar)

---

## FASE 2: Despliegue de Edge Functions

### A. GitHub Actions

- [ ] `.github/workflows/deploy-functions.yml` existe
- [ ] Deploy job incluye `--project-ref ddxnrsnjdvtqhxunxnwj` para las 6 funciones citas:
  - [ ] `crear-cita-red`
  - [ ] `editar-cita-red`
  - [ ] `sync-cita-to-gcal`
  - [ ] `recordatorios-citas`
  - [ ] `agenda-red-cliente`
  - [ ] `mi-red`

### B. Validación Post-Deploy

Después del primer push a rama feature:

- [ ] `crear-cita-red` está online (sin timeout 502)
- [ ] `editar-cita-red` está online
- [ ] `sync-cita-to-gcal` está online
- [ ] `recordatorios-citas` está online
- [ ] `agenda-red-cliente` está online
- [ ] `mi-red` está online

Verificar con:
```bash
supabase functions list --project-ref ddxnrsnjdvtqhxunxnwj
```

---

## FASE 3: Validación Funcional Agenda

### A. Crear Cita

**Actor**: Coach (role = coach/owner)  
**Endpoint**: `crear-cita-red` (POST)

- [ ] Prueba 1: Coach crea una cita válida → HTTP 200
  ```bash
  curl -X POST https://...supabase.co/functions/v1/crear-cita-red \
    -H "Authorization: Bearer <JWT_COACH>" \
    -H "Content-Type: application/json" \
    -d '{"coach_id":"<UUID>","nombre":"Cliente","email":"client@example.com","tipo":"Sesión","inicio":"2026-08-15T14:00:00Z"}'
  ```
  - [ ] Response contiene `cita.id`
  - [ ] Response contiene `cita.estado` = `confirmada`

- [ ] Prueba 2: Verificar que la cita está en proyecto nuevo
  ```sql
  SELECT id, coach_id, email, inicio FROM citas 
  WHERE coach_id = '<UUID>' LIMIT 1;
  ```
  - [ ] Fila existe en proyecto nuevo

- [ ] Prueba 3: Intentar crear sin JWT → HTTP 403
  ```bash
  curl -X POST https://...supabase.co/functions/v1/crear-cita-red \
    -H "Content-Type: application/json" \
    -d '{"coach_id":"...","email":"..."}'
  ```
  - [ ] Response contiene `error: "not_owner"`

### B. Editar Cita

**Endpoint**: `editar-cita-red` (POST)

- [ ] Prueba 1: Cambiar hora de cita existente → HTTP 200
  - [ ] Cita actualizadas en proyecto nuevo
  - [ ] Email enviado al cliente (check inbox o logs)

- [ ] Prueba 2: Cancelar cita → HTTP 200
  - [ ] Estado cambia a `cancelada`
  - [ ] Email enviado con "Tu sesión fue cancelada"

### C. Google Calendar + Meet Link

**Flujo**: Crear cita → sync-cita-to-gcal → meet_link generado

- [ ] Prueba 1: Crear cita con coach que tiene Google Calendar configurado
  - [ ] `sync-cita-to-gcal` se dispara automáticamente (best-effort)
  - [ ] Check BD: `citas.meet_link` está poblado (no NULL/vacío)
  - [ ] Link es válido (comienza con `https://meet.google.com/...`)

- [ ] Prueba 2: Ver evento en Google Calendar del coach
  - [ ] Evento aparece en el calendario
  - [ ] Descripción contiene Meet link

### D. Email

**Flujo**: Crear/editar cita → send-email se dispara

- [ ] Cliente recibe email con asunto "Tu sesión quedó agendada"
- [ ] Email contiene:
  - [ ] Tipo de sesión (Sesión, Clase, etc.)
  - [ ] Fecha/hora legible
  - [ ] Botón "Entrar a Google Meet" (si hay meet_link) o nota del link en Calendar
  - [ ] "Si necesitás reprogramar, respondé este correo"

---

## FASE 4: Lectura desde Cliente/Coach

### A. Portal Cliente (cliente.html)

**Flujo**: Cliente logueado → ve "Próxima sesión"

- [ ] Loguearse como cliente
- [ ] Página de inicio → sección "Próxima sesión" visible
- [ ] Muestra:
  - [ ] Tipo de sesión
  - [ ] Fecha/hora
  - [ ] Link si es online (botón "Entrar" o "Ver en Calendar")
  - [ ] Ubicación si es presencial

**Verificación de BD**:
```javascript
// En cliente.html, busca:
fetch(SB_CITAS+'/rest/v1/citas?email=eq.'+EMAIL+...
// Debería apuntar a proyecto nuevo
```

### B. Panel Coach (panel-v2.html)

**Flujo**: Coach logueado → ve su agenda de hoy/próximas

- [ ] Loguearse como coach
- [ ] Panel → Agenda (o tab equivalente)
- [ ] Muestra próximas citas con:
  - [ ] Nombre cliente
  - [ ] Hora
  - [ ] Tipo
  - [ ] Meet link (si online)

**Verificación de BD**:
```javascript
// En panel-v2.html, busca queries a citas:
SB_CITAS+'/rest/v1/citas...
// Debería apuntar a proyecto nuevo
```

### C. MultiCoach (multicoach.html)

**Flujo**: Owner → ve red completa + citas

- [ ] Loguearse como owner
- [ ] MultiCoach → Mi Red
- [ ] Ve:
  - [ ] Coaches de su org
  - [ ] Clientes de su org
  - [ ] Próximas citas (personal + grupales)

---

## FASE 5: Regresión y Estabilidad

### A. Auth no se rompe

- [ ] Login de coach → JWT válido
- [ ] Login de cliente → JWT válido
- [ ] Logout → sesión clara (localStorage limpio)
- [ ] Refresh de página → sesión persiste
- [ ] Cambio de contraseña → funciona

### B. Lectura de usuarios no se rompe

- [ ] Panel: lista de clientes completa
- [ ] Panel: lista de coaches completa (si admin)
- [ ] No hay 403 inesperados al cargar usuario details

### C. Escritura en proyecto antiguo no se rompe

- [ ] Crear cliente (formulario intake) → candidatos.creada
- [ ] Editar perfil de coach → usuarios.actualizados
- [ ] Subir CV → cv_publicados.guardado

### D. Consultas cruzadas

- [ ] mi-red lee usuarios + citas sin error
- [ ] recordatorios-citas lee citas + usuarios sin error
- [ ] agenda-red-cliente lee candidatos + citas sin error

---

## FASE 6: Documentación y Merge

### A. Documentación

- [ ] `docs/ARCHITECTURE_HYBRID.md` existe y es accesible
- [ ] README del repo menciona que es arquitectura temporal
- [ ] `.github/workflows/deploy-functions.yml` documentado (comentarios en el job)

### B. Pre-Merge Review

- [ ] Code review aprobado por al menos 1 persona
- [ ] git diff limpio (solo cambios intencionales)
- [ ] No hay `console.log` o debug code
- [ ] No hay secretos en el repo (verificar .env, secrets en comentarios)

### C. Merge a `main`

- [ ] Branch feature está actualizado con `main`
- [ ] Todos los checks de GitHub pasan (syntax, tests si existen)
- [ ] Merge commit message incluye referencia a arquitectura híbrida
- [ ] Verifica que GitHub Actions de deploy se dispara automáticamente

---

## FASE 7: Post-Merge Validation (Producción)

**Esto ocurre DESPUÉS del merge a main.**

### A. Verificar Deploy a Producción

- [ ] Esperar a que GitHub Actions termine (usually ~5-10 min)
- [ ] Verificar que funciones están actualizadas en Supabase
- [ ] Ejecutar smoke tests en producción (crear cita, enviar email)

### B. Monitor de Errores

- [ ] Revisar `client_errors` tabla en Supabase
  ```sql
  SELECT kind, email, page, detail FROM client_errors 
  ORDER BY ts DESC LIMIT 20;
  ```
  - [ ] No hay nuevos 401/403 relacionados a citas
  - [ ] No hay "failed to fetch" masivos

### C. Feedback del Usuario

- [ ] Confirmación de que calendario sincroniza
- [ ] Confirmación de que emails llegan
- [ ] Confirmación de que portal cliente ve sesiones

---

## Criterio de "Listo"

✅ **La arquitectura se considera estable cuando:**

1. Todos los checks de Infraestructura = ✅
2. Todos los checks de Despliegue = ✅
3. Al menos 3 citas creadas/editadas/canceladas sin error
4. Google Calendar sincroniza en al menos 1 caso
5. Emails llegan a inbox (sin spam)
6. Portal cliente y panel coach leen citas sin 401/403
7. No hay regresión en auth/usuarios/candidatos
8. Documentación = actualizada y accesible

---

## Roles y Responsabilidades

| Fase | Rol | Responsable |
|------|-----|-------------|
| 1-2 | DevOps / Backend | [COMPLETAR] |
| 3-5 | QA / Tester | [COMPLETAR] |
| 6 | Tech Lead / Owner | [COMPLETAR] |
| 7 | On-Call / Support | [COMPLETAR] |

---

## Notas Finales

- **Sin fallback silencioso**: Si falta un secret, error obligatorio (no continuamos).
- **No mergeamos sin validación**: Todo lo anterior debe tener ✅.
- **Reversible**: Si algo falla, git revert a commit anterior (Auth sigue funcionando).
- **Temporal**: Esta es una solución de transición hasta migrar Auth completamente.

---

**Versión**: 1.0  
**Última actualización**: Agosto 2026  
**Próxima revisión**: Después del primer deploy a producción
