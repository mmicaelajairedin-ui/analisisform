# Proyecto — Conectar Google Calendar desde el login (sin links)

> **Objetivo:** que el coach conecte su Google Calendar con el mismo **"Continuar
> con Google"** que ya usa para entrar — sin pegar ningún link (iCal ni embed).
> Pathway lee su calendario (agenda) y, en la fase de reservas, escribe las
> reuniones y crea los Meet. Es el modelo de Calendly: conectar Google una vez.
>
> **Estado:** documento de proyecto. Aprobado avanzar (jul 2026).
> **Diseño:** la coach enviará referencias visuales; la parte visual (agenda +
> pantalla de reservas) se ajusta a eso. Este doc es la plomería, no el diseño.

---

## 1. Qué se reutiliza (ya existe)
- **Login con Google vía Supabase Auth** (`login.html` → `signInWithOAuth({provider:'google'})`).
  La base de OAuth ya está montada y funcionando.
- **`usuarios.configuracion`** — para guardar el token/estado de conexión del coach.
- **Edge functions + Supabase** — patrón ya usado (analytics, coach-lifecycle, etc.).
- La **agenda nativa del Resumen** (Fase 1 ya hecha) — solo se cambia la fuente:
  en vez del iCal, lee vía la API de Google.

## 2. Cómo funciona (en criollo)
1. El coach toca **"Continuar con Google"**. Además del login, Google le pide
   permiso: *"Pathway quiere ver/gestionar tu calendario"*. Acepta.
2. Supabase devuelve un **token** de Google del coach. Lo **guardamos** (con su
   refresh token, para seguir teniendo acceso sin re-loguear).
3. Una edge function usa ese token para **leer los eventos** del coach vía la API
   de Google Calendar → alimenta la agenda del Resumen. **Cero links.**
4. (Fase reservas) el mismo permiso sirve para **crear reuniones** en su calendario
   (con Meet) y leer sus horarios ocupados para armar la disponibilidad.

## 3. El obstáculo externo (importante)
El acceso al calendario es un **permiso sensible** de Google. Para abrirlo a
**todos los coaches**, Google exige **verificar la app** (trámite de días: pantalla
de consentimiento, política de privacidad, dominio verificado). Es lo mismo que
hizo Calendly.
- **Para la dueña (Micaela)** → funciona **ya**, con un aviso de "app sin verificar"
  que se saltea. Sirve para probar todo el flujo end-to-end.
- **Para el resto de coaches** → recién cuando pase la verificación.

## 4. Fases
| # | Fase | Qué toca | Quién |
|---|------|----------|-------|
| 0 | **Config en Google Cloud + Supabase**: agregar el scope de Calendar a la pantalla de consentimiento y al proveedor Google de Supabase | Consola de Google + Supabase Auth | la coach (te guío) |
| 1 | Pedir el permiso de calendar en "Continuar con Google" + **guardar el token** del coach | `login.html` + tabla `usuarios` | Claude |
| 2 | Edge function `gcal` que **lee eventos** vía API de Google → la agenda del Resumen usa esto (reemplaza el iCal) | nueva function + `panel-v2.html` | Claude |
| 3 | **Reservas**: disponibilidad + página propia de agendado + **crear** el evento con Meet en el calendario del coach | nueva function + UI | Claude |
| 4 | **Verificación de Google** para abrir a todos los coaches | Consola de Google | la coach (te guío) |
| 5 | Retirar iCal/Calendly una vez todo probado | limpieza | Claude |

Cada fase de código corre `check-syntax` + `check-smoke` + `check-guardrails`.

## 5. Riesgos y cuidados
- **El login es crítico.** Tocar el flujo de "Continuar con Google" se hace con
  cuidado: el permiso de calendar se pide **sin romper** el login normal (si el
  coach no da el permiso, igual entra; solo no ve la agenda conectada).
- **Tokens.** Hay que pedir `access_type=offline` para tener refresh token y no
  perder el acceso; guardarlo seguro (solo lo usa la edge function con service role).
- **Verificación de Google.** Bloquea el rollout masivo, no la prueba con la dueña.

## 6. Qué NO se toca
- El login con email/contraseña sigue igual.
- La agenda Fase 1 (diseño) se mantiene; solo cambia de dónde saca los datos.
- Los coaches que no conecten Google ven la agenda con su estado "conectá tu Google".

## 7. Qué necesito de vos (Fase 0, primer paso)
En la **Consola de Google Cloud** del proyecto que usa tu login:
1. Pantalla de consentimiento OAuth → agregar el scope
   `https://www.googleapis.com/auth/calendar` (o `calendar.readonly` para empezar
   solo con lectura).
2. Agregarte como **usuario de prueba** (para saltar la verificación mientras probamos).
En **Supabase → Authentication → Providers → Google**: confirmar que el proveedor
está activo (ya lo está, porque el login anda).
> Te paso el paso a paso con capturas cuando arranquemos la Fase 0.

## 8. Próximo paso
Fase 0 (config en Google Cloud) — es lo único que desbloquea todo lo demás. En
cuanto esté, Claude hace la Fase 1 (pedir permiso + guardar token) y la Fase 2
(leer el calendario sin links).
