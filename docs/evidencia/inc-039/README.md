# INC-039 — Evidencia antes/después

Ramas vacías de las fichas de **Cliente** y **Coach** (`multicoach.html`).
Ficha completa del incidente: `docs/ERROR_REGISTRY.md` → *INC-039*.

Las capturas se tomaron con Playwright sobre el repo (servidor estático local),
en **modo red REAL** (`MC_REAL = true`), con el mismo escenario en ambas versiones:
una red con un coach (Ana Ruiz) y un cliente (Juan Pérez).

---

## 1 · Ficha del CLIENTE · pestaña «Recursos» · cero datos

| | |
|---|---|
| Antes | `inc039-cliente-recursos-cero-antes.png` |
| Después | `inc039-cliente-recursos-cero-despues.png` |

**Antes** — el cliente no tiene ningún recurso, pero la tarjeta "Recursos del
programa" lista tres inventados, que en realidad son la plantilla de
**mediciones** de la maqueta:

```
Recursos del programa.
Materiales y recursos que el cliente puede consultar.
📘 9 jul · 78.2 kg   Semana 1
📘 9 jun · 79.5 kg   Semana 2
📘 9 may · 81.0 kg
```

Su estado vacío ("Sin recursos cargados aún") era **inalcanzable**: la fuente
(`DET().prog`) nunca está vacía.

**Después** — la tarjeta lee la fuente real (`k.recursos`) y su rama vacía sí se
alcanza:

```
Recursos del programa.
Materiales y recursos que el cliente puede consultar.
Sin recursos cargados aún
```

Con datos, lista el recurso real **una sola vez** (antes aparecía únicamente en
la tarjeta de abajo, "Subir recursos", que ahora se queda solo con la zona de
subida).

---

## 2 · Ficha del COACH · pestaña «Sesiones» · con citas reales

| | |
|---|---|
| Antes | `inc039-coach-sesiones-con-citas-antes.png` |
| Después | `inc039-coach-sesiones-con-citas-despues.png` |

Escenario: el coach **tiene dos citas** ya cargadas en `MC_CITAS` (las trae
`mi-red`, son las mismas que la ficha del CLIENTE sí muestra), y el
`coach-api-gateway` no responde.

**Antes** — el estado vacío miente:

```
Agenda de Ana.
Cuando Ana agende sesiones con sus clientes, las ves acá.
```

**Después** — las mismas citas, con el cliente cruzado:

```
Agenda de Ana.
Sesión de seguimiento    12 ago · 15:30 · Juan Pérez · Repasamos el CV
Revisión de plan         26 ago · 17:00 · Juan Pérez
```

El estado vacío se sigue mostrando **solo** cuando no hay sesiones en ninguna de
las dos fuentes.

---

## 3 · Regresión — el resto del panel no se toca

Comparación del texto renderizado de cada sección, versión previa vs. corregida
(demo, mismo escenario):

| Sección | Resultado |
|---|---|
| Dashboard | ✅ idéntico |
| Clientes (lista) | ✅ idéntico |
| Coaches (lista) | ✅ idéntico |
| Programas | ✅ idéntico |
| Agenda | ✅ idéntico |
| Comunidad | ✅ idéntico |
| Analytics | ✅ idéntico |
| Cobros | ✅ idéntico |
| Configuración | ✅ idéntico |
| Ficha del coach (7 pestañas, maqueta) | ✅ idéntico |
| Ficha del cliente (7 pestañas) | ⚠️ solo cambia «Recursos» — el cambio buscado |

---

## 4 · Tests

`tests/inc-039-fichas-empty-states.spec.js` — 10 casos (cero datos, datos, campo
ausente, gateway caído, gateway + citas, anti-XSS ×2, maqueta intacta).

- Sobre el código **previo**: 5 fallan (las que reproducen el bug), 5 pasan (los controles).
- Sobre el código **corregido**: 10/10 pasan.

Blindado además por la regla `INC-039 fichas: las ramas vacias de Cliente y Coach
dicen la verdad` en `scripts/check-guardrails.js`.
