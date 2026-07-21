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
  nicho, marca (white-label), activo.
- `usuarios.org_id` — a qué red pertenece el coach. El dueño es un `usuarios`
  con `rol='owner'` y `org_id` = su propia org.
- `candidatos.org_id` — de qué empresa es el cliente. Sigue teniendo `coach_id`
  = el coach asignado dentro de esa red.

Migración: `supabase/migrations/organizaciones.sql` (aditiva y segura).

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
