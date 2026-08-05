# Organization Model (Frozen)

**Versión:** 1.0  
**Estado:** 🔒 CONGELADO  
**Última revisión:** 2026-08-05  
**Cambios permitidos:** Solo por expreso consentimiento del Product Owner  

---

## 1. Tipos de Usuario

### Coach Independiente
- Usuario que compró **Pathway solo** (sin MultiCoach)
- Tiene sus propios clientes, agenda, archivos, conversaciones
- `org_id = NULL` en `usuarios` (legacy)
- No existe entrada en `organization_members`
- Acceso: Panel del coach (panel-v2.html) + Portal del cliente
- **Puede convertirse a MultiCoach** sin perder nada

### Coach de Organización
- Usuario que es **coach dentro de una empresa**
- Tiene sus clientes asignados por el Owner
- Existe entrada en `organization_members` con rol `['coach']`
- `org_id` en `usuarios` es legacy (compatibilidad)
- Acceso: Panel del coach + MultiCoach (solo sus clientes) + Portal del cliente

### Owner
- Usuario con **control administrativo de una organización**
- Facturación, configuración, invitación de miembros, roles, datos de la empresa
- Existe entrada en `organization_members` con rol `['owner']`
- **Puede ser simultáneamente coach** (roles múltiples en `organization_members`)
- Ejemplo: Gustavo es Owner + Coach en Org A
- Acceso: Mi Admin + Panel del coach (si también es coach) + MultiCoach

### Colaborador
- Usuario con **permisos limitados** dentro de una organización
- Tareas específicas (RRHH, reportes, configuración parcial)
- Existe entrada en `organization_members` con rol `['colaborador']`
- Permisos definidos por políticas de la organización
- Acceso: Funcionalidades específicas según permiso

### Cliente
- Candidato que se registró en el formulario de intake
- Tiene un coach asignado (obligatorio)
- Pertenece a una organización **derivada del coach**
- Acceso: Portal del cliente (cliente.html) durante 4+ semanas

---

## 2. Relaciones

### Usuario → Organización
**Fuente de verdad: `organization_members`**

```
organization_members (
  user_id UUID,
  org_id UUID,
  roles TEXT[] → ['owner'] | ['coach'] | ['colaborador'] | múltiples
)
```

- Un usuario puede pertenecer a **0 o más organizaciones**
- Cada relación tiene **1 o más roles**
- `usuarios.org_id` queda solo como compatibilidad (legacy)
- Cuando se elimine legacy, `organization_members` será la ÚNICA fuente

### Coach → Cliente
**Fuente de verdad: `candidatos.coach_id`**

```
candidatos (
  id, nombre, email, coach_id (NOT NULL), org_id, ...
)
```

- **Un cliente siempre pertenece a exactamente un coach** (obligatorio)
- `candidatos.coach_id` nunca es NULL
- `candidatos.org_id` **se deriva automáticamente** de `usuarios.org_id` (del coach)
- Invariante: `cliente.org_id = coach.org_id` (siempre sincronizado)

### Organización → Clientes
**Derivada, no directa**

```
Organización
    ↓ (coaches member)
  Coaches
    ↓ (coach_id)
  Clientes
```

- Los clientes de una org son: todos los clientes cuyo coach pertenece a esa org
- **Nunca un cliente pertenece directamente a una org** sin coach
- Si el coach se va de la org, sus clientes lo acompañan

---

## 3. Ciclos de Vida

### Ciclo 1: Coach Independiente → MultiCoach

**Trigger:** Coach hace clic en "Pasar a MultiCoach" en Mi Admin

**Flujo automático:**
1. Mostrar formulario: "Nombre empresa", "Email empresa"
2. Crear `organizaciones` con esos datos
3. Insertar en `organization_members`: (coach_id, org_id, ['owner', 'coach'])
4. Actualizar `usuarios.org_id = org_id` (legacy)
5. Migrar clientes: `UPDATE candidatos SET org_id = org_id WHERE coach_id = coach_id AND org_id IS NULL`
6. Listo: Coach es ahora Owner + Coach. Clientes migraron. Nada se perdió.

**Resultado:**
```
Antes: Coach independiente + 12 clientes (org_id = NULL)
Después: Owner + Coach + Organización + 12 clientes (org_id = Org A)
```

---

### Ciclo 2: Crear Organización (Nuevo Owner)

**Trigger:** Admin de Pathway crea organización para cliente nuevo

**Flujo:**
1. Crear `organizaciones`
2. Crear `usuarios` con datos del owner (email, nombre)
3. Insertar en `organization_members`: (owner_id, org_id, ['owner'])
4. Listo: Owner puede entrar a Mi Admin

**Resultado:**
```
Nueva organización con 1 owner, 0 coaches, 0 clientes
```

---

### Ciclo 3: Invitar Coach Nuevo

**Trigger:** Owner hace clic en "Invitar Coach" en Mi Admin

**Flujo:**
1. Mostrar formulario: "Email del coach"
2. Buscar usuario con ese email
   - **Si existe:** Insertar en `organization_members` (user_id, org_id, ['coach']) + enviar email
   - **Si no existe:** Crear `usuarios` + insertar en `organization_members` + enviar email de invitación
3. Coach aceptar invitación (email) o esperar a que Owner lo vincule manualmente
4. Insertar en `organization_members`

**Resultado:**
```
Coach nuevo (puede ser independiente o de otra org) ahora también pertenece a esta org con rol ['coach']
```

---

### Ciclo 4: Invitar Colaborador

**Igual que Ciclo 3 pero con rol `['colaborador']`**

---

### Ciclo 5: Invitar Owner

**Igual que Ciclo 3 pero con rol `['owner']`**

**Nota:** Puede coexistir otro Owner. Ambos tienen acceso a Mi Admin y facturación.

---

### Ciclo 6: Salir de una Organización

**Trigger:** Owner o usuario solicita salirse (o es removido)

**Flujo:**
1. Borrar entrada en `organization_members` (user_id, org_id)
2. Si el usuario es coach y tiene clientes en esa org:
   - Los clientes pasan a `org_id = NULL` (vuelven a ser independientes)
   - Mantienen `coach_id` (relación no se rompe)
3. Si el usuario era el único Owner: error ("Una organización necesita al menos 1 Owner")

**Resultado:**
```
Coach se va de Org A
Sus clientes: org_id = NULL, coach_id = coach.id (siguen siendo del coach, ahora independientes)
```

---

## 4. Reglas Invariantes

**Estas reglas NO pueden romperse bajo ninguna circunstancia:**

1. **Un cliente siempre tiene coach**
   - `candidatos.coach_id IS NOT NULL` (constraint en BD)
   - Si se intenta crear sin coach, operación falla

2. **El org_id del cliente se deriva del coach**
   - `candidatos.org_id = (SELECT org_id FROM usuarios WHERE id = candidatos.coach_id)`
   - Invariante que se verifica en cada operación que cambie coach o org_id

3. **Un coach puede existir sin organización**
   - `org_id = NULL` es estado válido
   - Coach independiente es un estado permanente válido

4. **organization_members es la fuente de verdad**
   - Solo `organization_members` define pertenencia a org y roles
   - `usuarios.org_id` es legacy, se ignora para decisiones de negocio
   - Cualquier consulta que importe pertenencia debe usar `organization_members`

5. **usuarios.org_id es legacy (compatibilidad temporal)**
   - Se mantiene mientras se migra el código
   - Debe eliminarse antes de versión 2.0
   - No debe ser la fuente de verdad para nuevas funcionalidades

6. **Un usuario puede tener múltiples roles en la misma org**
   - `organization_members.roles` es un array
   - Un usuario puede ser `['owner', 'coach']` o `['coach', 'colaborador']`, etc.

7. **Un owner también puede ser coach**
   - No es un rol excluyente
   - Ejemplo: Gustavo = Owner + Coach en Org A, solo Coach en Org B

8. **Los clientes viajan con el coach**
   - Cuando un coach cambia de org (o sale), sus clientes lo acompañan
   - La relación `coach_id` nunca se rompe

---

## 5. Qué NO Está Permitido

**Prohibido:**

- ❌ Clientes sin `coach_id` asignado
- ❌ Crear clientes modificando SQL manualmente
- ❌ Cambiar `usuarios.rol` directamente (solo legacy)
- ❌ Crear owners editando `usuarios` en Supabase
- ❌ Asignar clientes directamente a una org (deben ir al coach)
- ❌ Duplicar usuarios para crear otro owner/coach
- ❌ Editar `organization_members` manualmente en Supabase (solo desde app)
- ❌ Borrar un Owner si es el único de la organización
- ❌ Asignar un cliente a un coach de otra organización
- ❌ Migrar un coach a otra org sin migrar sus clientes

**Razón:** Estas operaciones rompen invariantes y crean estados inconsistentes.

---

## 6. Principios

1. **Nunca perder datos del usuario**
   - Cambios de licencia, org, o rol no eliminan historial, archivos, clientes o conversaciones
   - El data retention es perpetuo

2. **La continuidad del negocio es garantizada**
   - Un coach puede cambiar entre independiente ↔ multicoach sin perder nada
   - Un owner puede invitar/remover coaches sin afectar sus clientes

3. **Un cambio de licencia nunca implica crear usuario nuevo**
   - Misma cuenta (mismo email, mismo ID) en cualquier estado
   - Solo cambian los roles y la org

4. **El modelo de datos prevalece sobre la interfaz**
   - Si la interfaz choca con el modelo, se rediseña la interfaz
   - El modelo no se dobla para acomodar una pantalla

5. **Todas las organizaciones funcionan exactamente igual**
   - No hay orgs "especiales" o "de prueba"
   - Mismo código, mismas reglas, sin excepciones

---

## Validación de Cambios Futuros

**Antes de implementar cualquier nueva funcionalidad, verificar:**

- ¿Respeta la relación usuario → org → cliente?
- ¿Usa `organization_members` como fuente de verdad?
- ¿Qué ocurre cuando un coach cambia de org o sale?
- ¿Se pierden datos de algún usuario?
- ¿Hay clientes huérfanos posibles?
- ¿El modelo es igual para todas las orgs?

Si alguna respuesta es "no sé", rediseñar antes de implementar.

