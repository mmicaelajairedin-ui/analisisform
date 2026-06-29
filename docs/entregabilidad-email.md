# Entregabilidad de email — que el acceso NO caiga en spam

Cuando invitás a un cliente desde el panel ("Enviar invitación"), le llega un
email para crear su contraseña y entrar. Si ese email cae en spam, el cliente
no llega nunca al portal ni al formulario. Esta es la causa #1 de "no llenan
el form". Checklist para asegurarlo.

> El email sale desde `hi@pathwaycareercoach.com` (dominio autenticado) vía
> **Brevo**. El nombre visible del remitente ahora es el del coach (más
> aperturas), pero el dominio real sigue siendo el de Pathway — por eso importa
> que el dominio esté bien autenticado.

## 1. Autenticación del dominio en Brevo (lo más importante)

En Brevo → **Senders, Domains & Dedicated IPs → Domains**, el dominio
`pathwaycareercoach.com` tiene que estar **verificado** con estos 3 registros
DNS (se configuran en Cloudflare → DNS del dominio):

- [ ] **SPF** — registro TXT que autoriza a Brevo a enviar por tu dominio.
- [ ] **DKIM** — registro(s) que Brevo te da (firma criptográfica). Sin DKIM,
      Gmail/Outlook desconfían.
- [ ] **DMARC** — registro TXT `_dmarc.pathwaycareercoach.com`. Empezá suave:
      `v=DMARC1; p=none; rua=mailto:hi@pathwaycareercoach.com`
      (monitorea sin bloquear). Más adelante subir a `p=quarantine`.

En Brevo el dominio debe figurar con el tilde verde **"Authenticated"**. Si
está en amarillo/rojo, ahí está el problema.

## 2. Testear si caés en spam (5 minutos, gratis)

1. Entrá a **https://www.mail-tester.com** → te da una dirección temporal.
2. Desde el panel, "Enviar invitación" a esa dirección.
3. Volvé a mail-tester y mirá el puntaje (**apuntá a 9-10/10**).
4. Te dice exactamente qué falla (SPF, DKIM, DMARC, contenido, blacklist).

Repetir después de tocar DNS (los cambios DNS tardan hasta ~1 h en propagar).

## 3. Señales de contenido (ya cubiertas en código, no tocar)

- ✅ Remitente con nombre del coach (reconocible, no "no-reply").
- ✅ `reply_to` al email del coach (responder funciona → buena señal).
- ✅ Versión texto plano además del HTML (lo arma `send-email`).
- ✅ Header `List-Unsubscribe`.
- ✅ Asunto sin clickbait ("X te dio acceso a tu espacio — entrá a tu sesión").

## 4. Decirle al cliente que lo espere (refuerzo humano)

Lo más efectivo además de lo técnico: cuando le pasás el acceso por WhatsApp,
avisale: *"Te llega un mail de [tu nombre] para entrar a tu espacio — si no lo
ves en unos minutos, revisá spam/promociones y marcalo como 'no es spam'."*
Eso entrena al buzón del cliente y sube la entregabilidad futura.

## 5. Si seguís con problemas

- Verificá que el email del cliente esté bien escrito (typo = rebota).
- Revisá en Brevo → **Logs / Statistics** si el email figura como *delivered*,
  *soft bounce*, *hard bounce* o *spam*. Eso dice si el problema es entrega
  (DNS) o apertura (asunto/cliente).
- Dominios nuevos tienen baja reputación al principio; mejora con el tiempo y
  con destinatarios que abren/responden.
