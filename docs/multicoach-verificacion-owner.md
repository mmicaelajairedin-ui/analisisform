# Verificación manual de MultiCoach con sesión REAL de owner

**Rama:** `claude/multicoach-cierre-carril-a`
**Qué valida:** lo que ninguna prueba automática de este repositorio puede validar
— que los datos **sobreviven a una recarga** contra Supabase de verdad.

Los tests automáticos corren en modo demo (`?demo=1`), que no toca la base. Todo
lo de aquí necesita una cuenta con `rol='owner'` y su organización.

---

## Antes de empezar

Sin estos tres pasos, las pruebas A y B fallan por infraestructura, no por código.

1. **SQL Editor de Supabase** → ejecutar `supabase/migrations/0112_programs_rls_fix.sql`
2. `supabase functions deploy mi-red --no-verify-jwt`
3. `supabase functions deploy add-coach-to-org --no-verify-jwt`

**Recargar** siempre con Ctrl/Cmd+Shift+R (recarga dura). El panel cachea.

Tener a mano la consola del navegador (F12): si algo no guarda, el error real
aparece ahí, y el panel muestra un aviso abajo a la izquierda.

---

## A · PROGRAMAS

> Es lo que más puede fallar: si la migración 0112 no está aplicada, la tabla
> sigue siendo invisible y el listado sale vacío pase lo que pase.

| # | Paso | Qué tiene que pasar |
|---|---|---|
| A1 | Entrar a `/multicoach.html` → **Programas** | Carga sin errores. Si la red no tiene ninguno: estado vacío con el botón «Crear el primer programa». **No pueden salir nombres como «María García» o «Alex Chen»** — eso significaría que volvieron los datos de ejemplo |
| A2 | **Nuevo programa** → nombre «Prueba 1», coach a cargo, duración «8 semanas», avance 40 %, guardar | Aviso «Programa creado ✓» y aparece en la lista |
| A3 | **Recargar la página** → Programas | **«Prueba 1» sigue ahí, con su coach, duración y 40 %** |
| A4 | Abrir «Prueba 1» | Se abre la **ficha**, no un aviso. Muestra avance, datos, y los clientes del coach a cargo |
| A5 | **Editar** → cambiar nombre a «Prueba 2» y avance a 75 % → guardar | Aviso «Programa guardado ✓» y la ficha muestra lo nuevo |
| A6 | **Recargar** → Programas | Sale «Prueba 2» con 75 %. **No** puede seguir apareciendo «Prueba 1» |
| A7 | Abrir «Prueba 2» → **Eliminar** → confirmar | Vuelve al listado y ya no está |
| A8 | **Recargar** | Sigue sin estar |

**Si A3 falla** (crea pero no persiste): casi seguro la migración 0112 no está
aplicada. En la consola se verá un `401`/`403` del `POST` a `/rest/v1/programs`.

---

## B · NOTAS DEL CLIENTE

| # | Paso | Qué tiene que pasar |
|---|---|---|
| B1 | **Clientes** → abrir cualquier cliente → pestaña **Notas** | Carga el cuadro de notas internas |
| B2 | Escribir «Nota de prueba — <la fecha de hoy>» → **Guardar nota** | Aviso «Nota guardada ✓» |
| B3 | **Recargar** → mismo cliente → Notas | **El texto sigue ahí** |
| B4 | Borrar el texto, dejarlo vacío, guardar, recargar | Sigue vacío (borrar también persiste) |

**Si B3 falla:** falta redesplegar `mi-red`. El guardado usa
`editar-cliente-red` (que ya existía), pero la nota **vuelve** por el campo
`notas` que se añadió al `SELECT` de `mi-red`. Sin ese deploy, se guarda en la
base y no se ve al recargar.

**Cómo confirmarlo desde fuera:** en el SQL Editor,
`SELECT nombre, notas FROM candidatos WHERE id = '<id>';`

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
| D2 | Consola del navegador, sesión de owner A, pedir los programas de OTRA org:<br>`await (await fetch(SB+'/rest/v1/programs?org_id=eq.<ORG_B>&select=*',{headers:await PWAUTH.headers()})).json()` | **Array vacío `[]`**. Si devuelve filas, la 0112 no se aplicó bien |
| D3 | Intentar editar un programa de la org B:<br>`fetch(SB+'/rest/v1/programs?id=eq.<ID_DE_B>',{method:'PATCH',headers:{...await PWAUTH.headers(),'Content-Type':'application/json'},body:'{"name":"intruso"}'})` | **No cambia nada** (0 filas). Comprobar en la base que sigue con su nombre |
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
- **Falla A3 o A6** → migración 0112 sin aplicar.
- **Falla B3** → `mi-red` sin redesplegar.
- **Falla C2** → cerrar sesión del colaborador y repetir; si sigue, revisar
  `configuracion.mc_permisos` en la base.
- **Falla D2 o D3** → **PARAR**. Es un fallo de aislamiento entre organizaciones
  y no se despliega nada hasta resolverlo.
