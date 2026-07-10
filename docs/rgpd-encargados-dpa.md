# Encargados del tratamiento y contratos (DPA) — Pathway

> **Qué es:** la lista de **proveedores (encargados)** que tratan datos personales
> por cuenta de Pathway, con el estado de su **contrato de encargo (DPA)** y el
> mecanismo de **transferencia internacional** (para los de fuera de la UE).
> El RGPD (art. 28) obliga a tener un DPA firmado/aceptado con cada uno.
>
> ⚠️ **Borrador técnico.** Los enlaces son un punto de partida y **pueden
> cambiar** — verificá el DPA vigente en el "trust center" de cada proveedor.
> Revisar con asesor legal antes de darlo por cerrado.
>
> Versión: 1.0 (borrador) · Última actualización: 2026-07-09

---

## Cómo se "firma" un DPA
La mayoría de estos proveedores tienen el DPA **incorporado en sus términos** o
lo aceptás con un clic en su panel. Para cada uno: (1) entrar al enlace, (2)
aceptar/descargar el DPA, (3) marcar la casilla acá abajo con la fecha.

---

## Encargados actuales

| # | Proveedor | Qué trata | Ubicación | Mecanismo transfer. | DPA (verificar) | Firmado |
|---|-----------|-----------|-----------|---------------------|-----------------|---------|
| 1 | **Supabase** | Base de datos, auth, storage (todos los datos) | US/EU (según región del proyecto) | SCC · elegir **región UE** para residencia | https://supabase.com/legal/dpa | ☐ |
| 2 | **Anthropic (Claude)** | Datos del intake → generación de informes IA | EE.UU. | SCC (DPA comercial) | https://www.anthropic.com/legal | ☐ |
| 3 | **Uploadcare** | Subida de CVs y archivos | EE.UU. | SCC | https://uploadcare.com/about/trust/ | ☐ |
| 4 | **Brevo** | Envío de emails | **UE (Francia)** | Datos en UE (bajo riesgo) | https://www.brevo.com/gdpr/ | ☐ |
| 5 | **Stripe** | Cobros/suscripciones | EE.UU./UE | **DPF** + SCC | https://stripe.com/legal/dpa | ☐ |
| 6 | **Mercado Pago** | Cobros (LatAm) | Argentina/Brasil | Verificar (régimen no-UE) | Términos de privacidad de Mercado Pago | ☐ |
| 7 | **Cloudflare** | Hosting, CDN, analítica | EE.UU./global | **DPF** + SCC | https://www.cloudflare.com/cloudflare-customer-dpa/ | ☐ |
| 8 | **Calendly** | Agenda / reservas | EE.UU. | **DPF** + SCC | https://calendly.com/legal/data-processing-addendum | ☐ |
| 9 | **Google** | Login OAuth + Google Calendar | EE.UU./global | **DPF** | https://cloud.google.com/terms/data-processing-addendum | ☐ |

> **DPF** = EU-US Data Privacy Framework (marco de adecuación EE.UU.-UE).
> **SCC** = Cláusulas Contractuales Tipo de la Comisión Europea.

---

## Notas por proveedor (para verificar)
- **Supabase (#1):** lo más importante — confirmá la **región** del proyecto.
  Si está en EE.UU., evaluá mover/confirmar a una región **UE** para minimizar
  transferencias. El DPA cubre a sus sub-encargados (AWS).
- **Anthropic (#2):** su API **comercial no reentrena** con los datos por
  defecto. Confirmá el DPA y que el tratamiento sea "no training".
- **Brevo (#4):** empresa **francesa**, datos en la UE → el más "tranquilo".
- **Mercado Pago (#6):** régimen fuera de la UE (LatAm). Si tus coaches/clientes
  son de la UE, revisá con legal el mecanismo de transferencia. Si Mercado Pago
  es solo para LatAm, delimitá su uso.

---

## Pathway como ENCARGADO (DPA hacia tus coaches)
Como los datos de los **clientes** los controla cada **coach** (él es el
responsable), Pathway es su **encargado**. El art. 28 exige que Pathway le
ofrezca a cada coach un **contrato de encargo (DPA)** donde consten:
- Objeto, duración, naturaleza y finalidad del tratamiento.
- Que Pathway trata los datos **solo según las instrucciones** del coach.
- Confidencialidad, medidas de seguridad (art. 32).
- **Lista de sub-encargados** (los de la tabla de arriba) y aviso de cambios.
- Asistencia en derechos de los interesados y en brechas.
- Devolución/borrado de datos al terminar.

**Acción:** redactar un **DPA de Pathway** (plantilla) y ponerlo disponible para
que los coaches lo acepten al registrarse (o enlazado en los Términos). *(Se
puede hacer en el próximo paso.)*

---

## Checklist de cierre
- [ ] Aceptar/registrar el DPA de cada encargado (tabla) con fecha.
- [ ] Confirmar **región UE** en Supabase (o documentar la transferencia).
- [ ] Confirmar "no training" con Anthropic.
- [ ] Delimitar/verificar Mercado Pago si hay interesados de la UE.
- [ ] Redactar el **DPA de Pathway hacia los coaches** y publicarlo.
- [ ] Guardar copias de los DPA firmados en un lugar seguro.
- [ ] Revisión legal final.
