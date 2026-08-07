# Arquitectura Híbrida — Pathway Career Coach (Agosto 2026)

## Resumen Ejecutivo

La plataforma actualmente está distribuida en **dos proyectos Supabase**:
- **Proyecto Antiguo (`mxkljqhlwiqavbjfjfov`)**: Autenticación + Datos de usuarios
- **Proyecto Nuevo (`ddxnrsnjdvtqhxunxnwj`)**: Datos de agenda (citas) + Edge Functions

**Esta es una solución temporal** mientras se completa la migración de Auth. La configuración es explícita y obligatoria — no hay fallbacks silenciosos.

---

## Distribución de Recursos

### Proyecto Antiguo (`mxkljqhlwiqavbjfjfov`)
| Recurso | Ubicación | Responsabilidad |
|---------|-----------|-----------------|
| Auth | Supabase Auth | JWT, login/logout, password reset |
| `usuarios` | Tabla | Coaches, owners, colaboradores |
| `candidatos` | Tabla | Clientes (formulario intake) |
| `informes` | Tabla | Análisis generados por Claude |
| `cv_publicados` | Tabla | CVs editados/almacenados |
| `organizaciones` | Tabla | Empresas/redes (multicoach) |

### Proyecto Nuevo (`ddxnrsnjdvtqhxunxnwj`)
| Recurso | Ubicación | Responsabilidad |
|---------|-----------|-----------------|
| `citas` | Tabla | Sesiones coach-cliente (booking + agenda) |
| `sesiones_registro` | Tabla | Histórico de sesiones realizadas |
| `fit_habitos` | Tabla | Datos fitness/nutrición del cliente |
| `fit_antro` | Tabla | Mediciones antropométricas |
| Edge Functions | Compute | crear-cita-red, editar-cita-red, sync-cita-to-gcal, recordatorios-citas, agenda-red-cliente, mi-red |

---

## Edge Functions y Su Alcance

### Funciones que tocan `citas` (TODAS en proyecto nuevo)

#### 1. **crear-cita-red** (`POST /functions/v1/crear-cita-red`)
```
Auth: JWT validado contra SB.AUTH (proyecto antiguo)
Lookup: owners/coaches en SB.USERS (proyecto antiguo)
Insert: cita en SB.DATA (proyecto nuevo)
Side effects: llama sync-cita-to-gcal, send-email
```

#### 2. **editar-cita-red** (`POST /functions/v1/editar-cita-red`)
```
Auth: JWT validado contra SB.AUTH (proyecto antiguo)
Lookup: owners/coaches en SB.USERS (proyecto antiguo)
Update: cita en SB.DATA (proyecto nuevo)
Side effects: send-email
```

#### 3. **sync-cita-to-gcal** (`POST /functions/v1/sync-cita-to-gcal`)
```
Read: cita en SB.DATA (proyecto nuevo)
Integration: Google Calendar API
Update: meet_link en SB.DATA (proyecto nuevo)
```

#### 4. **recordatorios-citas** (cron cada ~15 min)
```
Read: citas en SB.DATA (proyecto nuevo)
Lookup: coaches/tz en SB.USERS (proyecto antiguo)
Update: rem_24h_at, rem_1h_at en SB.DATA (proyecto nuevo)
Integration: Email via send-email
```

#### 5. **agenda-red-cliente** (`POST /functions/v1/agenda-red-cliente`)
```
Lookup: clientes en SB.USERS (proyecto antiguo)
Read: clases/eventos en SB.DATA (proyecto nuevo)
Return: listado de citas grupales
```

#### 6. **mi-red** (`GET /functions/v1/mi-red`)
```
Auth: JWT validado contra SB.AUTH (proyecto antiguo)
Read: usuarios, candidatos, organizaciones en SB.USERS (proyecto antiguo)
Read: citas en SB.DATA (proyecto nuevo)
Return: red completa del owner (coaches + clientes + eventos)
```

---

## Configuración Requerida

### Secrets en Supabase (proyecto nuevo)

**OBLIGATORIO** — sin estos, las funciones lanzan error.

```env
# Autenticación (proyecto antiguo)
SUPABASE_AUTH_URL=https://mxkljqhlwiqavbjfjfov.supabase.co

# Usuarios (proyecto antiguo)
SUPABASE_USERS_URL=https://mxkljqhlwiqavbjfjfov.supabase.co

# Datos (proyecto nuevo)
SUPABASE_DATA_URL=https://ddxnrsnjdvtqhxunxnwj.supabase.co

# Ya existen (heredados)
SUPABASE_SERVICE_ROLE_KEY=...
SUPABASE_ANON_KEY=...
```

**Verificación:**
```bash
supabase secrets list --project-ref ddxnrsnjdvtqhxunxnwj
```

---

## Por qué esta arquitectura

### ✅ Ventajas

1. **Bajo riesgo**: Auth sigue en proyecto estable (viejo).
2. **Aislamiento**: Citas están en proyecto nuevo — puedo iterar sin afectar login.
3. **Explícito**: Cada edge function sabe exactamente dónde está cada tabla.
4. **Reversible**: Si algo sale mal con nuevas tablas, la vieja Auth sigue funcionando.

### ⚠️ Deuda técnica

1. **Dos proyectos**: Duplicar secretos, permisos RLS, backups.
2. **Cross-project queries**: Las edge functions hacen fetch a dos proyectos.
3. **JWT mismatch**: El JWT viene del proyecto viejo, pero las funciones están en el nuevo.
4. **RLS distribuido**: Algunas policies están en viejo, otras en nuevo.

---

## Ruta de Migración (Futuro)

**Fase 1 (actual)**: Híbrida estable.  
**Fase 2**: Migrar `usuarios` y `candidatos` al proyecto nuevo + reconfigurar Auth.  
**Fase 3**: Consolidar en un único proyecto + deprecar el viejo.  
**Fase 4**: Limpiar secrets y proyecto antiguo.

---

## Validación Post-Deploy

### Checklist antes de considerar "estable"

#### Infraestructura
- [ ] `SUPABASE_AUTH_URL` configurado y accesible
- [ ] `SUPABASE_USERS_URL` configurado y accesible
- [ ] `SUPABASE_DATA_URL` configurado y accesible
- [ ] Service role key tiene permisos en ambos proyectos
- [ ] Anon key tiene RLS configurado (lecturas públicas)

#### Funciones
- [ ] `crear-cita-red` desplegada → devuelve 200 al crear cita
- [ ] `editar-cita-red` desplegada → PATCH sin 403
- [ ] `sync-cita-to-gcal` desplegada → genera meet_link
- [ ] `recordatorios-citas` desplegada → envía emails
- [ ] `agenda-red-cliente` desplegada → lista clases
- [ ] `mi-red` desplegada → lee usuarios + citas

#### Flujos funcionales
- [ ] **Login**: JWT válido → acceso a panel
- [ ] **Crear cita**: Coach crea → aparece en proyecto nuevo
- [ ] **Editar cita**: Cambio hora → actualiza sin error
- [ ] **Cancelar cita**: Estado → `cancelada`
- [ ] **Google Calendar**: meet_link generado automáticamente
- [ ] **Email**: Cliente recibe confirmación con link
- [ ] **Portal cliente**: Ve próxima sesión (lee desde proyecto nuevo)
- [ ] **Panel coach**: Ve su agenda (lee desde proyecto nuevo)

#### Regresión
- [ ] Panel coach (panel-v2.html) sin cambios
- [ ] Portal cliente (cliente.html) sin cambios
- [ ] Multicoach (si aplica) sin cambios
- [ ] Login/logout/refresh sin cambios

---

## Troubleshooting

### Error: "Missing required environment variable: SUPABASE_AUTH_URL"

**Causa**: Los secrets no están configurados en el proyecto nuevo.

**Solución**:
```bash
supabase secrets set \
  SUPABASE_AUTH_URL=https://mxkljqhlwiqavbjfjfov.supabase.co \
  SUPABASE_USERS_URL=https://mxkljqhlwiqavbjfjfov.supabase.co \
  SUPABASE_DATA_URL=https://ddxnrsnjdvtqhxunxnwj.supabase.co \
  --project-ref ddxnrsnjdvtqhxunxnwj
```

### Error: "401 Unauthorized" al crear cita

**Causa**: El ANON_KEY o SERVICE_ROLE_KEY pertenece al proyecto equivocado.

**Verificación**:
```bash
# Asegúrate de que los keys usados pertenecen al proyecto nuevo
supabase secrets list --project-ref ddxnrsnjdvtqhxunxnwj | grep KEY
```

### Error: "404 citas table not found"

**Causa**: La tabla `citas` no existe en el proyecto nuevo.

**Solución**: Migración `supabase/migrations/citas.sql` no fue aplicada.

```bash
supabase db push --project-ref ddxnrsnjdvtqhxunxnwj
```

---

## Contacto / Responsable

- **Arquitectura**: Micaela Jairedin (decisiones de split)
- **Edge Functions**: Equipo de desarrollo
- **Deployment**: GitHub Actions (`.github/workflows/deploy-functions.yml`)

---

**Última actualización**: Agosto 2026  
**Estado**: Fase 1 — Híbrida estable (temporal)
