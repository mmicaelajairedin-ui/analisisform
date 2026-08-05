# Política Definitiva de Datos — MultiCoach

**Efectiva desde:** 2026-08-05  
**Estado:** 🔒 CONGELADA (No cambiar sin expreso consentimiento)

---

## 1. Regla de Oro: Un cliente SIEMPRE tiene coach

- `coach_id` es **OBLIGATORIO** en toda la tabla `candidatos`
- No pueden existir clientes huérfanos (`coach_id IS NULL`)
- Si se intenta crear un cliente sin coach, la operación **DEBE FALLAR**
- Esta restricción es de base de datos, no de frontend

---

## 2. Dos estados del coach

### Coach Independiente
```
coach.org_id = NULL
cliente.coach_id = coach.id
cliente.org_id = NULL
```
→ No aparecen en MultiCoach

### Coach en Empresa
```
coach.org_id = empresa.id
cliente.coach_id = coach.id
cliente.org_id = empresa.id
```
→ Aparecen automáticamente en MultiCoach de esa empresa

---

## 3. El org_id nunca se elige manualmente

- `cliente.org_id` **siempre se copia automáticamente** desde `coach.org_id`
- Invariante: `cliente.org_id = coach.org_id`
- Nunca puede existir un cliente cuyo `org_id` no coincida con el del coach

---

## 4. Datos de prueba permitidos

Los siguientes bots se mantienen permanentemente para demostraciones y QA:
- Bot Coach (test)
- Bot Gym (test)
- Bot Fitness (test)

Estos son datos **válidos y necesarios**, no se eliminan.

---

## 5. Transición de Coach: Independiente → Empresa → Independiente

```sql
-- Coach entra en empresa
UPDATE usuarios SET org_id = empresa.id WHERE id = coach.id;
UPDATE candidatos SET org_id = empresa.id WHERE coach_id = coach.id;

-- Coach sale de empresa
UPDATE usuarios SET org_id = NULL WHERE id = coach.id;
UPDATE candidatos SET org_id = NULL WHERE coach_id = coach.id;
```

Sus clientes lo acompañan automáticamente en ambas direcciones.

---

## 6. Restricción de Base de Datos

La tabla `candidatos` debe tener:
```sql
ALTER TABLE candidatos 
  ADD CONSTRAINT candidatos_coach_id_not_null 
  CHECK (coach_id IS NOT NULL);
```

Esta restricción impide a nivel de base de datos crear clientes sin coach.

---

## 7. Resultado esperado para Multi-Tenant

Después de aplicar esta política, "Mi Empresa" mostrará:

| Coach | Clientes |
|-------|----------|
| Bot Coach (test) | 6 |
| Bot Gym (test) | 3 |
| coach1@test.com | 1 |
| coach2@test.com | 1 |

**Total: 4 coaches, 11 clientes** (todos con asignación clara)

---

## 8. Simplificación Arquitectónica

Con esta política:
- ✅ No hay estados ambiguos
- ✅ Todo cliente pertenece siempre a un coach
- ✅ La empresa se hereda del coach (no se gestiona por separado)
- ✅ Agenda, Chat, Analytics, Cobros, Programas tienen una verdad única
- ✅ Pregunta resuelta: "¿De quién es este cliente?" → Siempre del coach

---

## 9. Aplicación Inmediata

A partir de ahora, **TODO código nuevo debe respetar estas reglas**:
- Frontend: Nunca permitir crear cliente sin coach
- Backend: Restricción CHECK en BD
- Migraciones: Nunca crear `candidatos` con `coach_id IS NULL`
- Queries: Siempre asumir `coach_id IS NOT NULL`

