# Plan — Sala por modos (3 modos) + cerrar cabos sueltos del negocio

> Estado: **plan validado por auditoría** (julio 2026). Se hicieron 3 auditorías con
> agentes: dinero/comisiones, tipos de evento, y atribución de leads. Este doc es la
> fuente de verdad. Regla: **aditivo, por fases reversibles, sin romper cobros**.
> Complementa `proyecto-sala-sesion.md` (el diseño); acá está el CÓMO y los riesgos.

## Objetivo
La Sala hoy es **una sola, genérica** (solo cambia si sos coach o cliente). Queremos
**3 modos** según quién habla con quién, cada uno con su cierre:

| Modo (`kind`) | Quién | Cierre | Plata |
|---|---|---|---|
| `sesion` | Coach + cliente que ya está adentro | resumen + tareas | **0%** |
| `primera_llamada` | Coach + lead nuevo | dar acceso / cobrar servicio | comisión escalonada |
| `demo_pathway` | **Empleado/admin** + prospecto de coach | crear coach → suscripción | plan del coach |
| `personal` | Cualquiera | (sin Sala) | — |

## ⚠️ Cabos sueltos que YA existen (antes de sumar los cierres de pago)
La auditoría encontró estos problemas **ya presentes hoy**. Ordenados por a quién golpean:

### Le pega al COACH (confianza / reembolsos)
1. 🔴 **Comisión sobre clientes PROPIOS.** `connect-checkout` cobra comisión (5–18%) a
   **todo** cliente que paga, sin distinguir "propio" (lo trajo el coach → debería ser
   **0%**) de "pathway" (lo trajo el marketplace → sí paga). Causa raíz: `candidatos`
   **no tiene columna `origen`**. Resultado: el coach paga comisión por SUS clientes.
   *(connect-checkout: cuenta `pago_recibido=true` sin filtro de origen.)*

### Le pega a MICAELA (ingresos / atribución)
2. 🔴 **Tier inflado.** Como los propios cuentan para el escalón, un cliente real de
   pathway cae en un tramo más alto antes de tiempo (p.ej. 15% en vez de 5%).
3. 🔴 **Comisión de Gonzalo frágil.** `alta_coach_id` (el vínculo lead→coach) **nunca se
   escribía** → la comisión se calcula SOLO por match de email. Si el coach paga con otro
   email, la comisión se pierde. No hay ledger: si el coach cancela, la comisión histórica
   desaparece del conteo. **[Parcialmente cerrado: ya se escribe `alta_coach_id`.]**
4. 🟠 **Coach paga pero no se activa.** Si el email de Stripe ≠ email registrado, la cuenta
   no se activa sola (hoy: aviso a Micaela para hacerlo a mano). El coach paga y queda afuera.
5. 🟠 **Esquivar comisión.** Hoy el coach elige el tipo por el `?t=` del link → puede mandar
   un link de "sesión" a un desconocido y quedaría `propio` (0%). El sistema NO decide el kind.
6. 🟠 **Pagos huérfanos** (sin coach en la metadata) caen en la cuenta del primer admin.

### Le pega al CLIENTE
7. 🟠 **Reembolsos/chargebacks no se manejan.** Un pago reembolsado queda como
   `pago_recibido=true` (sigue contando) y una suscripción de cliente **no tiene hold**
   (se cobra cada 4 semanas sin aprobación del coach, a diferencia del pago único).

## El diseño técnico — cómo se arma sin romper nada

### Dato: `kind` canónico (no texto libre)
- `event_types` pasa de `{label,color,icon,people,questions}` a sumar **`kind`**
  (`sesion`|`primera_llamada`|`demo_pathway`|`personal`). El coach renombra el `label`,
  el `kind` es fijo. Backfill: los existentes → `kind:'sesion'`.
- **Seguro:** ningún lector valida la forma; leen `.label/.color/.icon`. Se default-coalesce
  `kind||'sesion'`. El ÚNICO sitio que hay que tocar sí o sí es el guardado
  (`panel-v2.html` `_tobj`), que rearma el objeto de cero y hoy **descartaría** `kind`.
- `citas` suma columna **`kind`** (migración aditiva) → cada reserva guarda su modo.

### El SISTEMA decide el kind (blindaje anti-esquive)
En el punto de reserva (`reservar.html`, único lugar donde se escribe `citas`):
- ¿el email ya es cliente de ESE coach? → `sesion`, `origen=propio`.
- ¿entra desde lo público/marketplace? → `primera_llamada`, `origen=pathway`.
- ¿link de admin/empleado? → `demo_pathway`.
- Aunque el coach mande "el link de sesión" a un desconocido, el sistema ve que **no es
  cliente conocido** → lo trata como primera llamada. **No se puede reclasificar para
  esquivar comisión.**

### Sala mode-aware
- `sala.html` ya tiene el "seam" limpio: hoy cambia solo por `mod` (coach/cliente). Se suma
  `var KIND=qp('kind')||'sesion'` y se ramifica el panel de trabajo + botón de cierre en el
  MISMO bloque. Los 3 generadores de link suman `&kind=` (`_agSalaUrl`, `_salaClientLink`,
  `reservar.html`).

### Dinero correcto (`origen` propio/pathway)
- `candidatos` suma **`origen TEXT DEFAULT 'propio'`** (backfill: todos `propio` = lo seguro,
  no cobra de más).
- `connect-checkout`: `fee=0` si `origen='propio'`; contar **solo `origen='pathway'`** para el
  tier. **CRÍTICO:** hay que estampar `origen='pathway'` en los sitios de compra del
  marketplace (accept de connect-checkout, `handleClientPayment`/`upsertClientSub` del webhook)
  **al mismo tiempo** — si no, todo queda `propio` y Pathway deja de cobrar comisión. Es un
  cambio **atómico**: columna + fee + estampado, todo junto.

## Plan por fases (reversible)

| Fase | Qué | Toca plata | Riesgo |
|---|---|---|---|
| **1** | `kind` en event_types + `citas.kind` + el sistema decide el kind + Sala visual por modo (cierres NO-plata: "dar acceso" es gratis) | **No** | Bajo |
| **2** | `candidatos.origen` + `connect-checkout` cobra 0% a propios y solo cuenta pathway (atómico con el estampado pathway) | **Sí** | Medio-alto |
| **3** | Comisión de Gonzalo robusta: usar `alta_coach_id` (ya se escribe) en vez de email + ledger "fue pago alguna vez" | Indirecto | Medio |
| **4** | Cierres de pago en la Sala por modo: Demo→crear-coach+suscripción · Primera llamada→cobrar (Connect, hold) | **Sí** | Alto |
| **5** | Manejo de reembolsos/chargebacks + hold en suscripciones de cliente | **Sí** | Medio |

## Qué necesito de Micaela (decisiones grave / plata)
- **Fase 2 (dinero):** OK para tocar `connect-checkout`. Es un cambio que **protege al coach**
  (deja de cobrarle comisión por sus propios clientes) y va en la dirección segura (cobra
  MENOS), pero toca cobros en vivo → requiere tu OK explícito y aplicar la migración
  `candidatos.origen`.
- **Fase 4:** los cierres de pago se hacen uno por uno, cada uno con tu visto.

## Ya hecho (de este plan)
- ✅ `alta_coach_id` se escribe al crear un coach desde el panel del empleado (base de la
  atribución robusta de la Fase 3).
