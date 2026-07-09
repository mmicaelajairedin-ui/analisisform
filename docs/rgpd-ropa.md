# Registro de Actividades de Tratamiento (RAT / ROPA) — Pathway

> **Qué es:** el documento que exige el **art. 30 del RGPD**. Enumera qué datos
> personales trata Pathway, para qué, con qué base legal, quién los recibe y
> cuánto se conservan. No se publica: se guarda y se muestra si la autoridad
> (AEPD) lo pide.
>
> ⚠️ **Borrador técnico.** Está armado sobre los datos reales que maneja la
> plataforma, pero **antes de tratarlo como documento legal final, revisar con
> un asesor legal / DPO** (sobre todo la parte de datos de salud del nicho
> fitness y la relación responsable/encargado con los coaches).
>
> Versión: 1.0 (borrador) · Última actualización: 2026-07-09

---

## 0. Responsable del tratamiento

| Campo | Valor |
|---|---|
| Responsable | Micaela Jairedin — Pathway Career Coach *(completar razón social / NIF si aplica)* |
| Contacto de privacidad | hi@pathwaycareercoach.com |
| Sitio | https://pathwaycareercoach.com |
| Política de privacidad | https://pathwaycareercoach.com/privacidad.html |
| DPO | No designado *(no obligatorio a esta escala; revisar si se supera tratamiento a gran escala)* |

### ⚠️ Doble rol importante (responsable vs encargado)
- **Pathway es RESPONSABLE** de: cuentas de coaches, leads/contactos de la web,
  su propia analítica y marketing.
- **Pathway es ENCARGADO** de: los datos de los **clientes** que cada coach
  carga y gestiona (el **coach es el responsable** de los datos de sus clientes).
  → Por esto Pathway debe ofrecer un **contrato de encargo (DPA) a sus coaches**.
  Ver `docs/rgpd-encargados-dpa.md`, sección "Pathway como encargado".

---

## 1. Categorías de interesados
- **Coaches** (clientes de pago de la plataforma).
- **Clientes / candidatos** (las personas que cada coach acompaña).
- **Leads** (visitantes que dejan su contacto en la web / chatbot).

## 2. ⚠️ Categorías especiales de datos (art. 9)
El nicho **fitness** trata **datos de salud** (peso, altura, medidas
antropométricas, **lesiones**, **medicación**, restricciones). Son **categoría
especial** y exigen:
- **Consentimiento explícito** del cliente (no basta el general).
- Minimización y medidas reforzadas.

**Acción pendiente:** verificar que el consentimiento del formulario fitness sea
**explícito para datos de salud** (casilla específica), no solo el consentimiento
general. *(Hoy hay gate de consentimiento RGPD; falta confirmar el opt-in
explícito de salud.)*

---

## 3. Actividades de tratamiento

### A1 · Registro y gestión de cuentas de coaches
- **Finalidad:** dar de alta y operar la cuenta del coach en la plataforma.
- **Datos:** nombre, email, contraseña (hash SHA-256 / Supabase Auth), foto, configuración, datos de suscripción.
- **Base jurídica:** ejecución de contrato (art. 6.1.b) + consentimiento (registro).
- **Encargados:** Supabase (BD/auth), Cloudflare (hosting).
- **Conservación:** mientras la cuenta esté activa + plazos legales (facturación).

### A2 · Gestión de clientes por el coach (fichas + formulario de intake)
- **Finalidad:** que el coach cree y gestione las fichas de sus clientes.
- **Datos:** identificativos (nombre, email, teléfono), profesionales (cargo, experiencia, LinkedIn), **salud/fitness (art. 9)**, económicos (ingresos, gastos, deudas), imagen (foto), progreso.
- **Base jurídica:** el coach es responsable; base = consentimiento del cliente + ejecución del servicio de coaching. **Pathway actúa como encargado.**
- **Encargados:** Supabase (BD/storage).
- **Conservación:** mientras dure la relación coach-cliente; borrado a solicitud.

### A3 · Generación de informes/diagnósticos con IA
- **Finalidad:** generar el informe/diagnóstico del cliente con IA.
- **Datos:** los del intake del cliente (se envían al modelo para producir el informe).
- **Base jurídica:** ejecución del servicio + consentimiento.
- **Encargados:** **Anthropic (Claude API)** — transferencia internacional (EE.UU.).
- **Conservación:** el informe se guarda en `informes` mientras la cuenta esté activa. *(Confirmar que Anthropic no reentrena con estos datos — su API comercial no lo hace por defecto.)*

### A4 · Documentos del cliente (CV, carta, fotos de progreso)
- **Finalidad:** editar/guardar CV, carta y fotos.
- **Datos:** CV (datos profesionales), carta, **fotos** (imagen; en fitness pueden ser de cuerpo).
- **Base jurídica:** consentimiento + ejecución del servicio.
- **Encargados:** **Uploadcare** (subida de archivos), **Supabase Storage** (fotos).
- **Conservación:** mientras la cuenta esté activa.
- **Nota:** las fotos hoy viven en bucket público con URL no adivinable → mejora pendiente: bucket privado con links firmados.

### A5 · Comunicaciones por email
- **Finalidad:** notificaciones, onboarding, recordatorios, drip de trial.
- **Datos:** nombre, email, contenido del mensaje.
- **Base jurídica:** ejecución de contrato + interés legítimo (transaccionales) / consentimiento (marketing).
- **Encargados:** **Brevo** (envío de emails).
- **Conservación:** cola de emails y logs por el tiempo necesario a la operación.

### A6 · Cobros y suscripciones
- **Finalidad:** cobrar la suscripción del coach.
- **Datos:** email, datos de pago (los procesa el proveedor; **Pathway no guarda datos de tarjeta**).
- **Base jurídica:** ejecución de contrato + obligación legal (fiscal).
- **Encargados:** **Stripe** y **Mercado Pago**.
- **Conservación:** datos de facturación por el plazo legal fiscal (según país).

### A7 · Agenda y reservas de sesiones
- **Finalidad:** agendar sesiones coach-cliente.
- **Datos:** nombre, email, evento/horario.
- **Base jurídica:** ejecución del servicio + consentimiento.
- **Encargados:** **Calendly** y **Google Calendar** (si el coach conecta su calendario).
- **Conservación:** mientras dure la relación.

### A8 · Autenticación (login con Google)
- **Finalidad:** permitir entrar con Google.
- **Datos:** email, nombre, foto de perfil (Google), tokens.
- **Base jurídica:** ejecución de contrato + consentimiento (pantalla de Google).
- **Encargados:** **Google** (OAuth), **Supabase Auth**.
- **Conservación:** mientras la cuenta esté activa.

### A9 · Contacto / leads desde la web (chatbot)
- **Finalidad:** captar y contactar leads interesados.
- **Datos:** nombre/contacto (teléfono, email), página de origen.
- **Base jurídica:** consentimiento (el lead deja su dato voluntariamente).
- **Encargados:** Supabase (tabla `contactos_chat`).
- **Conservación:** hasta que el lead pida baja o deje de ser relevante.

### A10 · Analítica web
- **Finalidad:** medir tráfico y mejorar el sitio.
- **Datos:** datos técnicos/agregados (Cloudflare Web Analytics — sin cookies de terceros).
- **Base jurídica:** interés legítimo.
- **Encargados:** **Cloudflare**.
- **Conservación:** según agregados de Cloudflare.

---

## 4. Transferencias internacionales
Varios encargados están en **EE.UU.** (Anthropic, Stripe, Cloudflare, Google,
Uploadcare; Supabase según la región elegida). Requieren mecanismo válido:
**EU-US Data Privacy Framework (DPF)** o **Cláusulas Contractuales Tipo (SCC)**.
Detalle por proveedor en `docs/rgpd-encargados-dpa.md`.

## 5. Medidas de seguridad (art. 32)
- **RLS estricto** activo en las tablas con datos personales (aislamiento por coach — verificado).
- **Cifrado** en tránsito (HTTPS/TLS) y en reposo (Supabase).
- **Contraseñas** hasheadas; nunca en texto plano.
- Registro de errores de producción (`client_errors`) sin exponer datos sensibles.
- Control de acceso por rol (coach / cliente / admin).

## 6. Ejercicio de derechos
Acceso, rectificación, supresión, oposición, limitación y portabilidad vía
hi@pathwaycareercoach.com. Existe `eliminar-cuenta.html` para la baja.
**Pendiente:** flujo de "descargar mis datos" (portabilidad) + procedimiento
escrito de respuesta en plazo (1 mes).

## 7. Pendientes para conformidad completa
- [ ] Confirmar **consentimiento explícito de datos de salud** (fitness, art. 9).
- [ ] Firmar/registrar los **DPA de cada encargado** (ver otro doc).
- [ ] Ofrecer **DPA a los coaches** (Pathway como encargado).
- [ ] **Procedimiento de brechas** por escrito (notificación 72 h).
- [ ] Fotos de progreso → **bucket privado**.
- [ ] Flujo de **portabilidad** (exportar datos).
- [ ] Revisión legal final del documento.
