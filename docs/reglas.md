# Reglas y decisiones de Pathway (en tu idioma)

> **Para qué sirve esto:** que ninguna decisión importante se cuele sin que la
> veas. Acá quedan escritas, en palabras, las decisiones de producto y las
> reglas que las protegen. Si algo cambia sin pasar por acá, es una señal.
> Cada regla se verifica sola en el CI (`scripts/check-guardrails.js` y
> `scripts/check-parity.js`); hoy son **61 guardrails**.

## Cómo leer esto
- **Decisión** = una elección de producto tuya (ej. "el registro está abierto").
- **Regla/guardrail** = un test que **falla si alguien la rompe sin querer**.
- Si una decisión de acá ya no te gusta, se cambia — es tu plataforma. Decímelo
  y la doy vuelta (y actualizo la regla).

---

## Decisiones de producto

### Registro de coaches: ABIERTO (trial gratis) — jul 2026
Cualquier coach puede **auto-registrarse** y empezar el **trial de 14 días sin
tarjeta**, como promete la landing. Si vos (admin) ya le creaste la cuenta desde
el panel ("Dar acceso a un coach"), el registro la **activa**; si no, la **crea**.
- **Anti-abuso:** la cuenta nace con el email SIN verificar y el panel **bloquea
  generar informes con IA** hasta que la persona verifica su email. Así el alta
  abierta no habilita abuso de las features caras.
- **Historia:** el 4-jul-2026 esto se había cerrado a "solo invitación" **de
  contrabando dentro de un PR sobre Google Calendar** (no fue una decisión
  explícita) y contradecía la landing. Reabierto a propósito. Guardrail lo protege.

### Aislamiento entre coaches: cada coach ve/escribe SOLO lo suyo
Un coach nunca puede leer ni escribir datos de clientes de otro coach. El guard
`cg()` se aplica a todo guardado de `candidatos`. (Antes estaba definido pero no
se aplicaba — fuga real, ya cerrada.)

---

## Las 4 garantías de la base (las definiste vos)

| # | Garantía | Estado |
|---|----------|--------|
| **A** | La foto correcta siempre · nunca confundir coach/cliente | ✅ cumple |
| **B** | La información aislada · nunca mezclar datos entre coaches/clientes | ✅ cerrado |
| **C** | Los puntos/medallas unificados · coach y cliente ven lo mismo, no se pierden | ✅ (con migración) |
| **D** | El diseño unificado + color del coach (white-label) en lo nuevo | ✅ base + motor único |

Detalle técnico de cada una: `docs/base-plataforma.md`.

## Invariantes del chat (se congelaron porque hoy funcionan bien)
- El chat **no pierde mensajes** (re-lee antes de escribir).
- El texto del mensaje **se escapa** (no se puede inyectar código / XSS).
- Si la sesión venció → manda a **login** (no pantalla vacía).
- Los mensajes **no se duplican** (misma clave en las dos puntas).

---

## Cómo se protege todo esto
Antes de que cualquier cambio llegue a producción, corren 4 guardianes en el CI
(y no pueden decir "todo bien" si no lo está):
`node scripts/check-syntax.js && node scripts/check-smoke.js && node scripts/check-guardrails.js && node scripts/check-parity.js`

Si tocás algo y una regla de acá se rompe, el CI te frena **antes** de que salga.
Al agregar una decisión nueva, se suma acá + una regla que la vacune.
