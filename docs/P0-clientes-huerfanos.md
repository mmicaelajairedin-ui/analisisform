# DIAG-1 · Clientes sin coach — diagnóstico

**Fecha:** 2026-08-27 · **Estado:** diagnosticado, **no** reasignado.

> Este documento **no entrega P0**. P0/RLS se retiró íntegramente del lote. Esto
> es solo un diagnóstico: no ejecuta nada, no reasigna a nadie y su SQL vive
> fuera de `supabase/migrations/` a propósito.

> Este documento **no** está en `supabase/migrations/`, y es a propósito: esa
> carpeta se aplica sola al mergear a `main`. Reasignar clientes es una decisión
> con consecuencias de privacidad, así que el SQL de abajo se ejecuta a mano,
> cuando una persona lo apruebe.

## Por qué no se reasignan solos

Asignar un cliente al coach equivocado es **peor** que dejarlo huérfano: le da a
alguien acceso a los datos personales de otro. El criterio DIAG-1 que se fijó
antes de empezar dice "diagnosticados, no reasignados a ciegas", y eso es lo
que se ha hecho.

## Qué son los 20

Todos creados en **agosto de 2026** — no son deuda histórica, son de este mes.
Todos con `origen = 'propio'` (altas hechas por un coach, no venidas de Pathway).

| Señal | Cuántos | Qué significa |
|---|---|---|
| Con asignación en `coach_client_assignments` | **10** | **El coach es recuperable sin adivinar** |
| Con `org_id` (una red los reclama) | 9 | Pertenecen a una organización |
| Email con pinta de prueba (`test`, `demo`, `ejemplo`…) | 9 | Probablemente basura de pruebas |
| Sin ningún rastro (ni informe, ni cuenta, ni asignación) | 10 | No hay forma de saber de quién son |
| Con cuenta de usuario | 0 | Ninguno llegó a tener acceso |
| Con informe generado | 0 | Ninguno llegó a usarse |
| Entraron alguna vez al portal | 1 | |
| `activo = true` | 7 | |

## Lo que esto revela

Los 20 huérfanos son un síntoma del problema que el diagnóstico llamó
**"una sola verdad sobre quién atiende a quién"**: la relación coach↔cliente
vive en `candidatos.coach_id`, en `candidatos.org_id` y en
`coach_client_assignments`, y las tres no coinciden. Aquí se ve el coste: 10
clientes tienen asignación pero no `coach_id`, así que para el panel no existen.

Resolverlo de raíz es **AP6**, fuera del alcance aprobado. Esto solo repara las
filas concretas.

## Grupo A — 10 recuperables (revisar y ejecutar a mano)

El coach sale de `coach_client_assignments`, que la propia tabla declara como
fuente de verdad. No hay ninguna suposición.

```sql
-- 1) MIRAR primero qué se va a tocar (no modifica nada):
SELECT c.id, c.nombre, c.email, c.created_at,
       a.coach_id AS coach_que_se_asignaria,
       u.nombre   AS nombre_del_coach,
       a.estado   AS estado_asignacion
  FROM candidatos c
  JOIN coach_client_assignments a ON a.client_id = c.id
  LEFT JOIN usuarios u ON u.id = a.coach_id
 WHERE c.coach_id IS NULL
 ORDER BY c.created_at DESC;

-- 2) Solo si la lista de arriba cuadra, aplicar:
UPDATE candidatos c
   SET coach_id = a.coach_id
  FROM coach_client_assignments a
 WHERE a.client_id = c.id
   AND c.coach_id IS NULL
   AND a.estado = 'activa'
   AND a.coach_id IS NOT NULL;
```

## Grupo B — 10 sin rastro (decisión de la coach)

No hay dato del que deducir el dueño. Las opciones, por orden de seguridad:

1. **Desactivar** (`activo = false`) los que tengan email de prueba. Es
   reversible y los saca de listados y automatismos.
2. **Dejarlos como están** hasta que alguien los reclame.
3. **Asignarlos a mano** uno a uno, si la coach los reconoce.

No se propone borrarlos: son datos de personas y el borrado no se deshace.

```sql
-- Para revisarlos uno a uno antes de decidir:
SELECT id, nombre, email, created_at, activo, org_id, nicho
  FROM candidatos c
 WHERE coach_id IS NULL
   AND NOT EXISTS (SELECT 1 FROM coach_client_assignments a WHERE a.client_id = c.id)
 ORDER BY created_at DESC;
```

## Después de ejecutar

Volver a medir contra el baseline (era **20**):

```sql
SELECT count(*) FROM candidatos WHERE coach_id IS NULL;
```
