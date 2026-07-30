# Multi-Coach — modelo y plan de cableado

> Fuente de verdad para el producto "red de coaches" (una empresa/dueño con
> varios coaches). Si tocás algo de multicoach, leé esto primero.

## El modelo — 3 niveles (como una franquicia)

```
1. Pathway (Micaela)  ──da de alta──▶  2. Dueño de la red (multicoach/owner)
                                            │
                                            ├─ maneja SUS coaches
                                            ├─ asigna clientes a cada coach
                                            └─ lleva comunidad + recursos + clases/webinars de la empresa
                                                 │
                                        3. Coach de la red
                                            ├─ VE e interactúa con los clientes que le asignaron
                                            ├─ agrega SUS propios recursos
                                            └─ NO agrega clientes ni maneja la comunidad de la empresa
                                                 │
                                            Cliente "de empresa"
                                            ├─ pertenece a la red (org_id) + tiene coach asignado (coach_id)
                                            └─ ve la comunidad de la empresa (revista/avisos/clases) en su portal
```

- **Micaela NO carga clientes.** Solo da de alta al dueño (multicoach) y, según
  el plan, le habilita llevar toda su red.
- **El cliente de empresa NO es igual al normal:** viene de la empresa (tiene
  `org_id`), y además de su coach ve la comunidad de la empresa.

## La columna vertebral: `org_id`

Todo cuelga de `org_id`, **exactamente como hoy todo cuelga de `coach_id`**.
Un coach/cliente **sin** `org_id` = modelo normal (coach individual): no cambia
nada para ellos.

- `organizaciones` (tabla nueva) — la red/empresa: nombre, owner_email, plan,
  nicho, marca (white-label), límites (max_coaches/max_clientes), prueba/pago
  (estado_sub, fecha_fin_prueba), activo.
- `usuarios.org_id` — a qué red pertenece el coach. El dueño es un `usuarios`
  con `rol='owner'` y `org_id` = su propia org.
- `candidatos.org_id` — de qué empresa es el cliente. Sigue teniendo `coach_id`
  = el coach asignado dentro de esa red.

Migración: `supabase/migrations/organizaciones.sql` (aditiva y segura).

## Planes / tipos de multicoach

Al dar de alta un multicoach, Micaela elige el **tipo** (prueba o comprado) y
los **límites** (cuántos coaches / cuántos clientes). Mismo ciclo de vida que
el coach individual (14 días de prueba → paga → activa). Números de ejemplo
(ajustables, el esquema no depende de ellos):

| Tipo (`plan`) | Coaches (`max_coaches`) | Clientes (`max_clientes`) | Precio |
|---------------|-------------------------|---------------------------|--------|
| `boutique` | 3 | 45 | $149/mes |
| `studio` | 8 | 120 | $249/mes |
| `pro` | ilimitado (NULL) | ilimitado (NULL) | $399+/mes |

`max_coaches`/`max_clientes` en NULL = ilimitado (~15 clientes por coach). El
`multicoach.html` avisa y bloquea el alta al llegar al tope ("llegaste a tus 3
coaches"). El precio es externo (Stripe). Todos arrancan con prueba de N días
(la elige el admin al dar de alta).

### Beneficios por plan (propuesta — más allá de los cupos)

Los cupos (coaches/clientes) los enforcea el sistema HOY. Los demás beneficios
se gatean a medida que se construye cada feature (marcar acá cuál está activo).

> **Nicho:** cada multicoach tiene UN solo nicho (fitness / carrera / finanzas),
> elegido por el admin al darlo de alta y fijo. No se mezclan nichos ni es un
> beneficio de plan — toda la red opera en ese nicho.

Lógica de los saltos: **Studio = monetizar** (dar clases y cobrar). **Pro =
operar la red grande** (la plata y la agenda de muchos coaches, automatizado).

| Beneficio | Boutique | Studio | Pro |
|-----------|:--------:|:------:|:---:|
| Coaches y clientes | 3 / 45 | 8 / 120 | ilimitado |
| Panel del dueño (ver red, asignar clientes) | ✅ | ✅ | ✅ |
| White-label (logo + colores en el portal) | ✅ | ✅ | ✅ |
| Comunidad: avisos + revista | ✅ | ✅ | ✅ |
| Chat interno de la empresa (dueño ↔ coaches ↔ equipo) | ✅ | ✅ | ✅ |
| Recursos compartidos de la red | ✅ | ✅ | ✅ |
| Clases / webinars de la empresa | — | ✅ | ✅ |
| Cobrar a clientes (pagos) | — | ✅ | ✅ |
| Analytics de la red (ranking, clientes en riesgo) | básico | completo | completo + agente IA semanal |
| Agenda unificada / calendario grupal de la red | — | — | ✅ |
| Emails a clientes / campañas de la red | — | — | ✅ |
| Reparto de pagos a coaches (comisiones) | — | — | ✅ |
| Datos del negocio (ingresos, retención, rendimiento por coach · exportable) | — | — | ✅ |
| Automatizaciones (onboarding, recordatorios) | — | — | ✅ |
| Dominio propio / subdominio | — | — | ✅ |
| Soporte | email | WhatsApp prioritario | dedicado + onboarding/migración |

> **Nota de build:** pagos, comisiones y agenda unificada son features grandes
> (procesar plata, repartir a cada coach, calendario central). Definen qué
> desbloquea cada plan; se construyen por etapas. Hoy el sistema solo enforcea
> los cupos (coaches/clientes).

## Mapa de archivos (canónico vs a retirar)

| Archivo | Qué es | Estado |
|---------|--------|--------|
| `multicoach.html` | **Panel del dueño de la red** (Pathway Multi-Coach) | ✅ CANÓNICO — hoy es maqueta, hay que cablearlo |
| `panel-empresa.html` | Otro intento viejo del mismo panel ("Ranking del equipo") | ⚠️ DUPLICADO — retirar cuando multicoach esté cableado |
| `empresa-hub.html` | Comunidad de la empresa (revista/clases) | Parcial — conecta con `empresa_revista/clases` |
| `empresa.html` | Landing de marketing "Pathway para Empresas" | Landing, no panel |

## Qué YA existe (no rehacer)

- **Multi-tenant por coach** en `panel-v2.html`: cada coach ve solo lo suyo por
  `coach_id`, ya sabe asignar clientes "Sin asignar → coach", ya crea coaches
  (edge function `crear-coach`).
- **Contenido de empresa a medias**: `candidatos.empresa_nombre/revista/avisos/
  clases` (migración `empresa_cliente.sql`). El **portal del cliente ya los
  muestra** read-only (pestaña Comunidad, solo aparece si hay contenido).

## Chat de la red (dueño ↔ coaches)

Dos canales, ambos separados del soporte de Pathway (`mensajes_admin_coach`) y
gateados por edge function con service role (nadie escribe/lee directo con la
anon key):

1. **1-a-1 dueño ↔ un coach** — tabla `mensajes_owner_coach`, edge function
   `mensaje-red`. El dueño lo abre desde la ficha del coach en `multicoach.html`
   (pestaña Mensajes); el coach responde desde su bandeja de chat en
   `panel-v2.html` (hilo "Dueño de tu red", junto a "Soporte Pathway"). El coach
   usa su propio id como `coach_id` → el backend lo valida con `isSelf`, así que
   ambos ven el MISMO hilo (keyed por `org_id`+`coach_id`).
2. **Canal de equipo (grupo)** — tabla `mensajes_red_canal`, edge function
   `canal-red`. Un solo hilo compartido por org: el dueño + TODOS sus coaches
   escriben y leen ("sala del equipo"). El dueño lo ve en la sección **Canal del
   equipo** de `multicoach.html`; el coach en su bandeja (hilo "Canal · <red>").
   Gate: `esMiembro` = dueño o coach con ese `org_id`. Cada mensaje guarda
   `autor_id/autor_nombre/autor_rol` (denormalizado) para pintar la burbuja.

Sin sesión real (JWT) los dos canales degradan con un aviso ("volvé a iniciar
sesión"), no rompen. Aplicar migraciones `mensajes_owner_coach.sql` y
`mensajes_red_canal.sql`; las edge functions se despliegan solas al mergear a
`main` (`deploy-functions.yml`).

## Qué falta — plan por etapas

1. **[BASE] La empresa existe** — migración `organizaciones.sql` + `org_id` en
   usuarios/candidatos. ✅ hecho (aplicar en Supabase).
2. **[PROVISIÓN] Micaela da de alta un multicoach** — extender el flujo admin /
   `crear-coach` para crear una `organizaciones` + su dueño (rol='owner').
3. **[OWNER VE SU RED] Cablear `multicoach.html`** — que el dueño vea SUS coaches
   (`usuarios` where org_id=mío) y SUS clientes (`candidatos` where org_id=mío),
   no la maqueta. Reusar el patrón de `panel-v2.html`.
4. **[ASIGNAR] Cliente → coach** desde el multicoach (reusar mecánica "Sin
   asignar" de panel-v2).
5. **[COMUNIDAD] Revista/avisos/clases** editables por el dueño desde el
   multicoach → el cliente ya los ve. El coach los ve pero no los edita.
6. **[RECURSOS] Del coach** — cada coach agrega sus propios recursos a sus
   clientes (ya existe en el portal; confirmar que no hereda los de la empresa).
7. **[PLANES] Gating** — qué desbloquea cada plan del dueño (llevar toda la red).

## Reglas para no volver a enredarlo

- El panel del dueño es **`multicoach.html`**. No agregar features de red a
  `panel-empresa.html` (está para retirar).
- Toda query nueva del dueño filtra por `org_id` (patrón de `coach_id`).
- El coach NO agrega clientes ni edita la comunidad de la empresa.
- **Ficha del cliente = "estructura Pathway".** Cuando se cablee la ficha de
  `multicoach.html` a los datos reales del cliente, armarla con el MISMO patrón
  que ya tiene `panel-v2.html` (decisión de jul 2026, para no hacer el trabajo
  visual dos veces): secciones en tarjetas con ícono de línea (Perfil), listas
  con la info completa en columnitas + acciones en menú ⋮ (Progreso/mediciones),
  clamp de 2 líneas + "ver más" en textos largos, y el ojo "Visto por el
  cliente" (abre si el cliente entró a su portal) en las pestañas que el cliente
  ve. Hoy la ficha de multicoach es más simple y en parte demo; NO tiene estos
  cambios a propósito hasta que lea datos reales.

## Aprendizajes de Priority 2 (Programas) — Julio 2026

**Cuándo agregar una sección a multicoach.html**:

1. Identificar qué archivo `owner-*.html` existe (ej: `owner-programs.html`)
2. Auditar Supabase: ¿la tabla existe o hay que crearla?
3. Extraer literal: CSS 100%, HTML 85%, JS 98% (reusar sin reinterpretar)
4. Adaptar para SPA:
   - Router: `else if(s==='programas')renderPrograms();`
   - Sidebar: `<a data-s="programas">Icon Label</a>`
   - Data: reemplazar MOCK por `loadPrograms(cb)`

### Errores Comunes (y cómo evitarlos)

#### ❌ Error 1: Múltiples `v.innerHTML+=` → botones no responden

**Síntoma**: Usuario hace clic en filtro/búsqueda → nada pasa.

**Causa**: Cada `v.innerHTML+=` recrea el DOM, destruyendo los event listeners anteriores.

```javascript
// ESTO ROMPE:
v.innerHTML='<header>...'          // DOM creado
v.innerHTML+='<button>...'         // ← Se recrea TODO, listener anterior se pierde
v.innerHTML+='<table>...'          // ← Otra reconstrucción
// Luego attachar listeners no funciona porque el DOM se recreó
```

**Fix**: Construir HTML completo en variable, asignar UNA sola vez, LUEGO attach listeners.

```javascript
var html='<header>...' + '<button>...' + '<table>...</table></div>';
v.innerHTML=html;  // Una sola asignación
document.querySelector('button').addEventListener('click', handler); // Ahora funciona
```

**Status Priority 2**: ✅ Arreglado en commit 66e64b1

#### ❌ Error 2: KPIs Hardcodeados → todos los owners ven "6, 187, 87%"

**Síntoma**: Owner A tiene 3 programas, Owner B tiene 10 → ambos ven "6 Programas Activos".

**Causa**: HTML fijo con valores literales.

```javascript
v.innerHTML+='<div class="kpi-value">6</div>';  // Siempre 6
v.innerHTML+='<div class="kpi-value">187</div>'; // Siempre 187
```

**Fix**: Calcular desde datos ANTES de construir HTML.

```javascript
var activeCount=data.filter(p => p.status==='active').length;
var totalClients=data.reduce((s,p) => s+(p.clients||0), 0);
var avgCompletion=data.length ? Math.round(...) : 0;

html='...<div class="kpi-value">'+activeCount+'</div>...';
```

**Status Priority 2**: ✅ Arreglado en commit a42138b

#### ❌ Error 3: Filtro opera en datos equivocados

**Síntoma**: Se cargan 10 programas reales, pero filtro muestra 6 de template.

**Causa**: Filtro hardcodeado a fuente incorrecta.

```javascript
function loadPrograms(cb){
  fetch(...).then(data => cb(data)); // Carga real data
}

function filterData(){
  filtered = MOCK_PROGRAMS.filter(...); // ← Siempre template!
  render(filtered);
}
```

**Fix**: Guardar datos cargados en variable modular y usar para filtro.

```javascript
var _mcProgCurrentData = MOCK_PROGRAMS; // Almacén

function loadPrograms(cb){
  fetch(...).then(data => {
    _mcProgCurrentData = data;  // Guardar aquí
    cb(data);
  });
}

function filterData(){
  filtered = (_mcProgCurrentData||MOCK_PROGRAMS).filter(...); // Usar variable
  render(filtered);
}
```

**Status Priority 2**: ✅ Arreglado en commit a42138b

### Checklist para Próximas Prioridades

Antes de mergear código a `multicoach.html`:

- [ ] HTML completo construido en variable (no múltiples `+=`)
- [ ] `v.innerHTML=html` asignación única
- [ ] Event listeners attachados DESPUÉS de `v.innerHTML=`
- [ ] Valores/KPIs calculados desde datos, NO hardcodeados
- [ ] Filtros usan variable de datos cargados (`_mcProgCurrentData`), NO MOCK directo
- [ ] MC_REAL fallback: funciona sin backend, degrada gracefully
- [ ] Multi-user testing: Owner A → Owner B → datos distintos (sin mezcla)
- [ ] Botones responden (test: hace clic, tab actualiza)
- [ ] Logout funciona (redirige a `/login.html`)
- [ ] No hay `console.log` ni `console.error` en prod
- [ ] Testado en demo (`MC_REAL=false`) y real (`MC_REAL=true`)
