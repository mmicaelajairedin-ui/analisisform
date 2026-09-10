# Verificación manual de MultiCoach con sesión REAL de owner

**Rama:** `claude/multicoach-cierre-carril-a`
**Qué valida:** lo que ninguna prueba automática de este repositorio puede validar
— que los datos **sobreviven a una recarga** contra Supabase de verdad.

Los tests automáticos corren en modo demo (`?demo=1`), que no toca la base. Todo
lo de aquí necesita una cuenta con `rol='owner'` y su organización.

---

## Antes de empezar

Sin estos deploys, las pruebas A y B fallan por infraestructura, no por código.
**No hay ninguna migración que aplicar**: el esquema ya está en producción.

1. `supabase functions deploy mi-red --no-verify-jwt`
2. `supabase functions deploy editar-cliente-red --no-verify-jwt`
3. `supabase functions deploy add-coach-to-org --no-verify-jwt`

**Recargar** siempre con Ctrl/Cmd+Shift+R (recarga dura). El panel cachea.

Tener a mano la consola del navegador (F12): si algo no guarda, el error real
aparece ahí, y el panel muestra un aviso abajo a la izquierda.

---

## A · PROGRAMAS

> Los programas viven en **`mc_programas`**, con **`mc_programa_coaches`** para
> los coaches asignados. Es el esquema real de producción, ya creado y con RLS
> forzada — **no hay ninguna migración que aplicar**. Lo que se prueba aquí es
> que el panel habla bien con él.
>
> Ojo con una cosa al empezar: la organización ya tiene **un programa real**.
> Que aparezca no es un fallo; es justo lo que confirma que el panel está
> leyendo la tabla buena.

| # | Paso | Qué tiene que pasar |
|---|---|---|
| A1 | Entrar a `/multicoach.html` → **Programas** | Carga sin errores y **lista el programa que ya existe** en la organización. **No pueden salir nombres como «María García» o «Alex Chen»** — eso significaría que volvieron los datos de ejemplo |
| A2 | Mirar la tarjeta de ese programa | Muestra su nombre real, el coach a cargo, la duración en semanas y su estado. Nada de porcentajes de avance ni de «clientes inscritos»: esos campos no existen |
| A3 | **Nuevo programa** → nombre «Prueba 1», coach a cargo, duración **8**, estado **Activo** → Crear | Aviso «Programa creado ✓» y aparece en la lista |
| A4 | **Recargar** (Ctrl/Cmd+Shift+R) → Programas | **«Prueba 1» sigue ahí**, con su coach, «8 semanas» y estado Activo |
| A5 | Abrir «Prueba 1» | Se abre la **ficha**, no un aviso. Muestra Datos del programa (coach a cargo, estado, duración, fecha de creación) y el bloque **Coaches del programa** |
| A6 | **Editar** → nombre «Prueba 2», duración **12**, estado **Completado** → Guardar | Aviso «Programa guardado ✓» y la ficha muestra lo nuevo |
| A7 | **Recargar** → Programas | Sale «Prueba 2», **12 semanas**, Completado. **No** puede seguir apareciendo «Prueba 1» ni la duración vieja |
| A8 | Probar los límites: editar y poner duración **0**, y luego **200** | En ambos casos avisa «La duración va entre 1 y 104 semanas» y **no** guarda. Son los límites que impone la base |
| A9 | Abrir «Prueba 2» → **Sumar al programa** con otro coach del equipo | Aviso «Coach sumado ✓» y aparece en Coaches del programa. El coach a cargo sale marcado «a cargo» |
| A10 | **Recargar** → abrir «Prueba 2» | El coach sumado **sigue ahí** |
| A11 | En Coaches del programa, pulsar la **✕** del coach sumado | Aviso «Coach quitado ✓» y desaparece. El coach **a cargo** no tiene ✕: se cambia desde Editar |
| A12 | **Recargar** → abrir «Prueba 2» | Sigue quitado |
| A13 | Abrir «Prueba 2» → **Eliminar** → confirmar | Vuelve al listado y ya no está. El programa que existía de antes **sigue ahí** |
| A14 | **Recargar** | «Prueba 2» sigue sin estar |

**Comprobar que la organización es la correcta.** En el SQL Editor, con el
`org_id` de la red del owner:

```sql
-- El programa creado tiene que llevar el org_id del owner, no otro.
SELECT p.id, p.nombre, p.estado, p.duracion_semanas, p.org_id, p.owner_coach_id, p.creado_por
FROM mc_programas p
WHERE p.nombre IN ('Prueba 1','Prueba 2')
ORDER BY p.created_at DESC;

-- Y sus coaches asignados, también con el org_id correcto.
SELECT c.programa_id, c.usuario_id, c.org_id
FROM mc_programa_coaches c
JOIN mc_programas p ON p.id = c.programa_id
WHERE p.nombre = 'Prueba 2';
```

Las dos consultas tienen que devolver **el `org_id` de la red del owner** y
nada más. Si aparece otro `org_id`, parar: es un fallo de aislamiento.

**Si A4 falla** (crea pero no persiste): mirar la consola. Un `401`/`403` en el
`POST` a `/rest/v1/mc_programas` significa que el JWT no llegó o que quien entró
no es el dueño de esa organización — la RLS solo deja escribir al owner.

---

## B · NOTAS DEL CLIENTE

| # | Paso | Qué tiene que pasar |
|---|---|---|
| B1 | **Clientes** → abrir cualquier cliente → pestaña **Notas** | Carga el cuadro de notas internas |
| B2 | Escribir «Nota de prueba — <la fecha de hoy>» → **Guardar nota** | Aviso «Nota guardada ✓» |
| B3 | **Recargar** → mismo cliente → Notas | **El texto sigue ahí** |
| B4 | Borrar el texto, dejarlo vacío, guardar, recargar | Sigue vacío (borrar también persiste) |

**La nota vive en `candidatos.notas_privadas`** — la misma columna que usa el
panel del coach, así que lo que escriba el dueño lo ve el coach y al revés.
Merece la pena comprobarlo: abrir ese cliente en `panel-v2.html` y ver la nota.

**Si B2 falla al guardar:** falta redesplegar `editar-cliente-red`.
**Si B2 guarda pero B3 no la trae de vuelta:** falta redesplegar `mi-red`.

**Cómo confirmarlo desde fuera:** en el SQL Editor,
`SELECT nombre, notas_privadas FROM candidatos WHERE id = '<id>';`

---

## C · PERMISOS (mc_permisos)

Necesita **dos cuentas**: el owner y un `colaborador` de la misma organización.

### C1 · El owner los cambia y persisten

| # | Paso | Qué tiene que pasar |
|---|---|---|
| C1.1 | **Coaches** → abrir al colaborador → pestaña **Acceso** | Siete módulos. Si nunca se tocaron, dice «Acceso completo» |
| C1.2 | Apagar **Cobros** y **Analytics** → **Guardar acceso** | Aviso «Acceso guardado ✓» y el resumen dice «Entra a 5 de 7 secciones» |
| C1.3 | **Recargar** → misma ficha → Acceso | **Cobros y Analytics siguen apagados** |

Confirmación en la base:
```sql
SELECT nombre, configuracion->'mc_permisos' FROM usuarios WHERE email = '<colaborador>';
-- Debe devolver {"v":1,"org_id":"<tu org>","grants":["clientes","coaches","programas","agenda","comunidad"]}
```

### C2 · El colaborador lo nota de verdad

> Esto es lo importante: que el permiso **cambie el acceso**, no solo que se
> guarde. Usar una ventana de incógnito para no mezclar sesiones.

| # | Paso | Qué tiene que pasar |
|---|---|---|
| C2.1 | Incógnito → login como el colaborador | Aterriza en `/multicoach.html` |
| C2.2 | Mirar el menú lateral | **No** aparecen Cobros ni Analytics |
| C2.3 | Escribir a mano `…/multicoach.html#analytics` | **No** abre Analytics (el router no lo deja) |
| C2.4 | Reducir la ventana a móvil → botón **Más** | Cobros y Analytics **tampoco** están en la hoja |
| C2.5 | Volver como owner, devolver los dos permisos, guardar; recargar como colaborador | Vuelven a aparecer |

**Si C2.2 falla y se ve todo:** el colaborador tiene `mc_permisos` sin guardar
(entonces es «acceso completo» a propósito), o su sesión es anterior al cambio
— cerrar sesión y volver a entrar.

---

## D · MULTI-TENANT (aislamiento por org_id)

> Un dueño no puede ver ni tocar datos de otra organización. Hay dos capas: la
> RLS de la base y el filtro por `org_id` del panel. Se prueban las dos.

| # | Paso | Qué tiene que pasar |
|---|---|---|
| D1 | Como owner A, en Clientes y Coaches | Solo salen los suyos. Contrastar con `SELECT count(*) FROM candidatos WHERE org_id = '<org A>';` |
| D2 | Consola del navegador, sesión de owner A, pedir los programas de OTRA org:<br>`await (await fetch(SB+'/rest/v1/mc_programas?org_id=eq.<ORG_B>&select=*',{headers:await PWAUTH.headers()})).json()` | **Array vacío `[]`**. Si devuelve filas, la RLS de `mc_programas` no está haciendo su trabajo |
| D3 | Intentar editar un programa de la org B:<br>`fetch(SB+'/rest/v1/mc_programas?id=eq.<ID_DE_B>',{method:'PATCH',headers:{...await PWAUTH.headers(),'Content-Type':'application/json'},body:'{"nombre":"intruso"}'})` | **No cambia nada** (0 filas). Comprobar en la base que sigue con su nombre |
| D4 | Repetir D2 con `candidatos` y `usuarios` | Nada de la org B |

Si hay una sola organización, D2–D4 se pueden hacer creando una segunda de
prueba desde el panel admin, o pidiéndole a alguien de otra red que lo mire.

---

## E · EQUIPO (invitación y actualización)

| # | Paso | Qué tiene que pasar |
|---|---|---|
| E1 | **Coaches** → **Sumar a la red** → nombre y un email nuevo, tipo «Colaborador» | Aviso de alta y sale el modal con el enlace de activación. Edge: `agregar-coach-red` |
| E2 | **Recargar** | La persona aparece en la lista con estado «Invitación pendiente» |
| E3 | En su ficha, cambiar **Tipo** de Colaborador a Coach y volver | Persiste tras recargar. Edge: `editar-coach-red` |
| E4 | En la ficha, **Servicios y precios** → añadir uno → guardar → recargar | Persiste. Edge: `editar-coach-red` |
| E5 | Suspender a esa persona y reactivarla | El estado cambia y persiste. Edge: `editar-coach-red` |
| E6 | Quitarla de la red | Desaparece de la lista y no vuelve al recargar. Edge: `eliminar-coach-red` |
| E7 | Abrir el email de invitación en otra ventana | Lleva a `registro.html?email=…` con el email ya puesto |

**Cupo del plan:** si la red está en el límite de coaches de su plan, E1 debe
mostrar el upsell en vez de sumar. Es correcto, no un fallo.

> `add-coach-to-org` (sumar a la red un coach que YA existe como independiente)
> tiene el gate abierto al dueño en esta rama, pero **no tiene pantalla**: es P2
> y no entra en el cierre. No hay nada que probar desde la interfaz.

---

## F · Comprobaciones transversales

| # | Qué mirar | Qué tiene que pasar |
|---|---|---|
| F1 | Consola del navegador durante todo el recorrido | **Cero errores rojos de JS** |
| F2 | Entrar por `/login.html` con el owner | Aterriza en `/multicoach.html`. **No** en `pathwayplatforms.com` ni en `panel-v2.html` |
| F3 | Entrar con Google como owner | Mismo destino |
| F4 | Recorrer las 9 secciones del menú | Ninguna muestra «Etapa próxima» ni «en desarrollo» |
| F5 | Copiar la URL con `#agenda` y abrirla en otra pestaña | Abre directamente en Agenda |
| F6 | En móvil, recorrer barra inferior + botón **Más** | Se llega a las 10 secciones |
| F7 | Dashboard de una red nueva | La tarjeta «Puesta en marcha» muestra los 6 pasos con su estado real |
| F8 | Ficha de cliente → Progreso / Recursos / Sesiones | Al soltar un archivo dice **«vista previa, aún no se guarda»**. Es lo correcto: el almacenamiento está pendiente de decisión |

---

## Qué hacer con el resultado

- **Todo verde de A a F** → MultiCoach queda verificado y se puede plantear el merge.
- **Falla A4 o A7** → revisar la consola: un 401/403 contra `mc_programas`
  significa que quien entró no es el dueño de esa organización.
- **Falla B2** → `editar-cliente-red` sin redesplegar.
- **Falla B3** → `mi-red` sin redesplegar.
- **Falla C2** → cerrar sesión del colaborador y repetir; si sigue, revisar
  `configuracion.mc_permisos` en la base.
- **Falla D2 o D3** → **PARAR**. Es un fallo de aislamiento entre organizaciones
  y no se despliega nada hasta resolverlo.
