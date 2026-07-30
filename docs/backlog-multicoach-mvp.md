# Backlog Priorizado — MultiCoach MVP Stabilization

**Principio:** Cada tarea desbloquea una funcionalidad REAL del Owner. No se suma complejidad sin desbloquear un caso de uso.

**Impacto:** ⭐⭐⭐ Crítico | ⭐⭐ Alto | ⭐ Medio

---

## FASE 1: Verificación + Estabilización (Antes de desbloquear Backend)

### T-1: Verificar Estado de Supabase en Producción [⭐⭐⭐ Crítico]
**Impacto:** Determina si el backend está ready para ser usado.

- [ ] Verificar accesibilidad: curl -I https://api.pathwaycareercoach.com/health
- [ ] Confirmar que migrations (7 tablas) están aplicadas
- [ ] Confirmar que Edge Functions están deployed (15 funciones)
- [ ] Verificar que RLS está configurado correctamente
- [ ] Test de login con usuario owner real

**Salida esperada:** Confirmar si Supabase está ready o no.  
**Bloqueantes:** Todas las tareas siguientes dependen de esto.

---

## FASE 2: Backend Integration (Solo si Supabase está Ready)

### T-2: Desbloquear CRUD Clientes [⭐⭐⭐ Crítico]
**Impacto:** El Owner puede agregar/asignar/suspender clientes → valor inmediato.

**Dependencias:** T-1 (Supabase ready)

**Cambios requeridos:**
1. Verificar que agregar-cliente-red + asignar-cliente están deployed
2. Test end-to-end: agregar cliente → aparece en tabla/Kanban
3. Test: arrastrar cliente a coach → se reasigna
4. Test: suspender cliente → desaparece de vista Activos

**Checklist:**
- [ ] Agregar cliente funciona end-to-end
- [ ] Asignar a coach funciona (dropdown + drag&drop)
- [ ] Suspender/reactivar funciona
- [ ] Datos persisten (reload → datos siguen)
- [ ] Errores manejados: email duplicado, coach inválido

**Reutilización:** Código ya existe en multicoach.html línea ~951-970  
**Tiempo estimado:** 1-2 horas (si Supabase ya está ready)

---

### T-3: Desbloquear CRUD Coaches [⭐⭐⭐ Crítico]
**Impacto:** El Owner puede invitar/suspender coaches → gestión del equipo.

**Dependencias:** T-1 (Supabase ready)

**Cambios requeridos:**
1. Verificar que agregar-coach-red + editar-coach-red están deployed
2. Test end-to-end: invitar coach → recibe email → activa cuenta
3. Test: cambiar permiso de coach (coach/colaborador)
4. Test: suspender coach → se oculta de asignaciones

**Checklist:**
- [ ] Invitar coach funciona (envía email)
- [ ] Coach puede activarse con link
- [ ] Permisos (coach vs colaborador) se guardan
- [ ] Suspender/reactivar funciona
- [ ] Datos persisten

**Reutilización:** Código en multicoach.html línea ~2364 (invitarCoach)  
**Tiempo estimado:** 1-2 horas (si Supabase ready)

---

### T-4: Desbloquear Agenda — Crear Sesiones [⭐⭐⭐ Crítico]
**Impacto:** El Owner puede agendar sesiones → coordina el equipo.

**Dependencias:** T-1 (Supabase ready), T-2 (coaches ready)

**Cambios requeridos:**
1. Verificar que crear-cita-red está deployed
2. Test end-to-end: crear sesión → aparece en calendario
3. Test: choque de horarios (misma hora, mismo coach)
4. Test: sesión repetida (cada semana × N semanas)
5. Test: editar/cancelar sesión

**Checklist:**
- [ ] Crear sesión 1:1 funciona
- [ ] Crear clase grupal funciona
- [ ] Repetición (semanal × 4/8/12) funciona
- [ ] Notificaciones de choque funcionan
- [ ] Datos persisten
- [ ] Cliente ve sesión en su portal

**Reutilización:** Código en multicoach.html línea ~1060-1073 (completo)  
**Tiempo estimado:** 2-3 horas (incluye testing de edge cases)

---

### T-5: Estabilizar Datos — Sync LocalStorage ↔ Supabase [⭐⭐ Alto]
**Impacto:** El Owner NO pierde datos si cierra/recarga la página.

**Dependencias:** T-2, T-3, T-4 (backend ya funciona)

**Cambios requeridos:**
1. Implementar sync automático cada 30s (polling)
2. Detectar conflictos (local ≠ remoto) y resolver
3. Mostrar indicador "Sincronizando..." en UI
4. Toast si sync falla

**Checklist:**
- [ ] Cambios locales se sincronizan a Supabase automáticamente
- [ ] Reload → datos frescos del servidor
- [ ] Si Supabase cae → usar local, reintentar cuando vuelve
- [ ] Sin conflictos visible para el user

**Reutilización:** Patrón ya usado en panel-v2.html (coach panel)  
**Tiempo estimado:** 3-4 horas

---

### T-6: Desbloquear Comunidad — Posts [⭐ Medio]
**Impacto:** El equipo comparte noticias/logros → engagement.

**Dependencias:** T-1 (Supabase ready)

**Cambios requeridos:**
1. Quitar "Próximamente" de "Publicar en Comunidad"
2. Implementar modal de nuevo post (imagen + texto)
3. Verificar que comunidad-red está deployed
4. Test end-to-end: crear post → aparece en feed

**Checklist:**
- [ ] Crear post funciona (texto + imagen)
- [ ] Reacciones (corazón, fuego, etc) funcionan
- [ ] Posts persisten
- [ ] Feed ordena por fecha (más recientes primero)

**Reutilización:** Código UI en multicoach.html línea ~2691-2850 (existe)  
**Tiempo estimado:** 1-2 horas (UI existe, solo conectar backend)

---

## FASE 3: Roadmap Futuro (NO MVP)

### ❌ T-7: Programas [⭐ Bajo — NO MVP]
**Status:** "Próximamente" (intencional, Etapa 2).

**Razón:** Requiere nueva tabla `programas`, templates, costo de learning.  
**Desbloquear después de:** T-2 + T-4 estables y validados.

---

### ❌ T-8: Cobros [⭐ Bajo — NO MVP]
**Status:** "Próximamente" (intencional, Etapa 2).

**Razón:** Requiere integración Stripe, webhook, validación de pagos.  
**Desbloquear después de:** Todas las funciones core estables.

---

## Resumen de Dependencias

```
T-1 (Verificación Supabase)
  ├─ T-2 (CRUD Clientes)
  │   └─ T-5 (Sync local/remote)
  ├─ T-3 (CRUD Coaches)
  │   └─ T-4 (Crear Sesiones)
  │       └─ T-5 (Sync)
  └─ T-6 (Comunidad Posts)

Roadmap:
  ├─ T-7 (Programas) — después T-2, T-4 estables
  └─ T-8 (Cobros) — después todo ready
```

---

## Criterio de "Listo para Producción"

✅ **MVP es listo cuando:**
1. T-1 confirma Supabase ready
2. T-2, T-3, T-4 completadas + testeadas end-to-end
3. T-5 implementada (datos no se pierden)
4. Zero crashes en modo real (durante 1h de testing)
5. Documentación: "Cómo invitar coaches" + "Cómo crear sesión"

⚠️ **Opcionales (pueden ir en v1.1):**
- T-6 Comunidad (nice-to-have, no bloquea valor core)
- Cobros (Etapa 2)
- Programas (Etapa 2)

