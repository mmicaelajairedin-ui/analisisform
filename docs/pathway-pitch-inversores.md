# Pathway — Documento para inversores

> **Qué es este documento.** El "todo en uno" que pediste para preparar el pitch:
> producto, roadmap, equipo, costes, inversión, competencia, clientes, pricing,
> métricas e historia fundacional. Cubre las secciones A–J.
>
> **Regla de honestidad (la misma de tus otros docs).** Los datos de producto,
> pricing y stack son **reales** (salen del código). Las cifras de mercado y
> benchmarks salen de fuentes citadas (ICF, World Bank, ChartMogul, a16z/Lenny's).
> Las proyecciones son **ilustrativas, a validar** — van marcadas `[ESTIMADO]`.
> Un buen inversor valora que distingas lo uno de lo otro.
>
> **3 decisiones tuyas pendientes** (marcadas 🔴 en el texto): (1) qué pricing
> presentar, (2) composición y coste del equipo, (3) tamaño de la ronda. Puse la
> opción más defendible como default; cambialas si querés.

---

## El pitch en 30 segundos (elevator speech)

> *"Pathway es la plataforma que le da al coach independiente todo lo que no es
> coachear: herramientas con IA (CV, informe de diagnóstico, simulador de
> entrevistas, análisis de LinkedIn), un portal white-label para sus clientes, y
> cobros integrados. Pero el diferencial no es el software de gestión —de eso hay
> ocho competidores—: es que Pathway, vía su directorio, **le trae clientes al
> coach**. Ninguna de las ocho plataformas del mercado hace eso para el coach
> independiente. Empezamos por coaching de carrera en español (España + LatAm),
> un cruce prácticamente desocupado, y el mismo cascarón ya corre en fitness y
> finanzas. Yo vengo de Talent Acquisition: llevo años viendo a la gente perderse
> buscando orientación profesional, y construí la solución que me hubiera gustado
> poder darles."*

**Versión de una línea:** *"Software de gestión que además genera demanda, para
coaches independientes, en español. Nadie más ocupa ese cruce."*

---

## A · Producto

### A.1 — Qué es
SaaS **B2B2C**: le vendemos al **coach** (él paga la suscripción); el **cliente
final** (candidato) usa la plataforma **gratis**, invitado por su coach. Está en
**producción**, con dominio propio (`pathwaycareercoach.com`), y ya es
**multi-nicho**: Carrera (vivo), Fitness y Finanzas (prototipos avanzados en
producción).

### A.2 — Pantallas (mapa real del producto)

El producto tiene **~60 páginas HTML** en producción. Agrupadas por función:

**Producto núcleo — Coach**
| Pantalla | Qué hace |
|---|---|
| `panel-v2.html` | **Panel del coach** (el que se usa). Gestión de clientes, pagos, links, progreso, mensajes, analytics. ~7.100 líneas. |
| `registro.html` / `login.html` | Alta y acceso del coach. |
| `bienvenida-coach.html` | Onboarding del coach. |
| `hub.html` | Hub alternativo del coach. |
| `coaches.html` / `coach.html` | **Directorio público** de coaches + perfil público (motor del marketplace). |

**Producto núcleo — Cliente (portal)**
| Pantalla | Qué hace |
|---|---|
| `cliente.html` | **Portal del cliente** de carrera. Progreso, medallas, recursos por semana, sesiones, empleos. ~5.250 líneas. |
| `pathway-fit-cliente.html` | Portal del cliente **fitness** (hábitos, calendario, antropometría). |
| `pathway-fin-cliente.html` | Portal del cliente **finanzas** (presupuesto, gastos, objetivos). |
| `formulario.html` | Formulario de intake de 7 pasos (carrera). |
| `pathway-fit-form.html` / `pathway-fin-form.html` | Intake de fitness / finanzas. |
| `app.html` + `instalar.html` + `sw.js` | **App instalable (PWA)** — funciona en Android como app propia. |

**Herramientas con IA**
| Pantalla | Qué hace |
|---|---|
| `cv.html` / `cv-ats.html` / `cv-express.html` | Editor de CV, optimización ATS, CV express. |
| `carta.html` | Editor de carta de presentación. |
| `linkedin-viewer.html` | Análisis de perfil de LinkedIn. |
| (Edge Function `generar-informe`) | **Informe/diagnóstico automático** del cliente con Claude. |
| (Edge Function `conversacion`) | Simulador de entrevistas / chat. |
| (Edge Function `categorizar-gastos`) | Categorización de gastos con IA (finanzas). |

**Marketing / adquisición (SEO)**
Landing (`index.html`), páginas públicas (`soy-coach.html`, `soy-candidato.html`),
pricing (`precios-coaching.html`), **blog** (`blog.html` + ~15 posts SEO:
CV con IA, checklist LinkedIn, calculadoras de sueldo por rol, etc.),
versiones en inglés (`index-en.html`, `soy-coach-en.html`…), `comunidad.html`,
`resena.html` (reseñas), legales/privacidad/GDPR.

**Backend (Supabase Edge Functions — 20 funciones):**
IA (`generar-informe`, `conversacion`, `categorizar-gastos`), pagos
(`connect-checkout`, `connect-onboard`, `stripe-webhook`), emails
(`send-email`, `send-queued-emails`, `password-reset`), notificaciones push
(`send-push`, `notif-new-client`, `notif-coach`, `notif-landing-lead`),
marketplace (`listar-coaches-publicos`, `obtener-perfil-coach`,
`contacto-coach`), auth (`migrate-user-to-auth`), analytics (`analytics-weekly`),
salud (`health-check`).

### A.3 — Qué puede hacer un COACH
- Gestionar todos sus clientes desde **un panel** (ficha por cliente, estado activo/inactivo, filtros).
- Generar con IA: **informe de diagnóstico**, **CV optimizado + ATS**, **carta**, **análisis de LinkedIn**.
- Portal **white-label** para cada cliente (su marca/logo/colores — en plan Pro).
- Cobrar con **Stripe Connect** (el dinero va directo a su cuenta; Pathway no lo toca).
- Botón de reserva (**Calendly**) integrado.
- **Emails al cliente** desde el panel (7 plantillas: bienvenida, acceso, CV listo, recordatorio, nueva semana, informe, personalizado; ES/EN).
- Perfil en el **directorio público** → canal de adquisición de clientes.
- **Sesiones compartidas** coach↔cliente (tareas que el cliente marca como hechas).
- **Analytics semanal con IA** (agente que corre los lunes, métricas Cloudflare + hipótesis + acciones; solo admin).
- Notificaciones push cuando entra un cliente nuevo.

### A.4 — Qué puede hacer un CLIENTE (candidato)
- Completar su **formulario de intake** y recibir su informe.
- Ver su **progreso gamificado**: medallas Bronce/Plata/Oro, confeti, feed de actividad ("tu timeline").
- Descargar su **CV y carta** en PDF; ver su **análisis de LinkedIn**.
- **Recursos por semana** (CV, LinkedIn, networking, entrevistas) durante las 4 semanas.
- **Portales de empleo** pre-filtrados por sector y ubicación (Indeed, LinkedIn Jobs, InfoJobs, Glassdoor, CompuTrabajo).
- Agendar sesiones (Calendly) y marcar tareas.
- Usar la plataforma como **app instalable** en el móvil (PWA).
- (Fitness) calendario de hábitos, antropometría. (Finanzas) presupuesto, gastos, objetivos.

### A.5 — Qué está TERMINADO ✅
- Panel del coach, portal del cliente (3 nichos), herramientas IA de carrera, formularios de intake.
- Cobros **Stripe Connect** integrados; directorio público + perfiles; landing + SEO + blog.
- Notificaciones push; app instalable (PWA/Android); emails transaccionales.
- **Disciplina de ingeniería** poco común en esta etapa: CI con tests
  (`check-syntax`, `check-smoke`, `check-guardrails`), observabilidad de errores
  en producción (`client_errors`), agente de analytics semanal automatizado.

### A.6 — Qué FALTA ⏳ (honesto)
- 🔴 **Cerrar el gap de seguridad (RLS en Supabase)** — aislamiento estricto de
  datos por coach. **Es lo #1 técnico antes de abrir registro masivo** (hoy las
  primeras coaches se onboardean a mano, gente conocida, riesgo bajo).
- Por nicho (vs los especialistas): **Carrera** → extensión de navegador + tracker
  de postulaciones + ATS más profundo. **Fitness** → app iOS, biblioteca de
  videos, sync wearables, conteo de macros. **Finanzas** → sync bancaria.
- Migrar login custom (SHA-256) → **Supabase Auth** (habilita el RLS estricto).

> **Nota de posicionamiento honesto:** NO auto-generamos los planes con IA a
> propósito. Del otro lado hay un coach real; la IA **asiste** (CV, informes,
> categorización), no reemplaza. Ese es el ángulo: *humano + herramientas, no un bot.*

---

## B · Roadmap

**Dónde estamos:** `Idea [✔] → Producto [✔] → ▶ PRIMERAS COACHES QUE PAGAN (ACÁ) → Fórmula repetible → Escala`

| Fase | Qué incluye | Estado |
|---|---|---|
| **MVP** | Panel + portal + herramientas IA de carrera + intake | ✅ Hecho |
| **IA** | Informe automático, CV/ATS, entrevistas, LinkedIn, categorización de gastos | ✅ Hecho (asiste, no reemplaza) |
| **Pagos** | Stripe Connect (cobro directo a la cuenta del coach + finder's fee) | ✅ Hecho |
| **App** | PWA instalable (Android ya) | ✅ Hecho / iOS ⏳ |
| **Calendario** | Sesiones coach↔cliente + Calendly; calendario de hábitos (fitness) | ✅ Hecho |
| **Multi-nicho** | Carrera (vivo) + Fitness + Finanzas (mismo cascarón, ~85% reuso) | ✅ Prototipos en producción |
| **Seguridad (RLS)** | Aislamiento estricto por coach en base de datos | 🔴 **Prioridad #1** |
| **Marketplace** | Descubrimiento candidato→coach (motor de red de dos lados) | 🟡 Directorio hecho; matching = expansión posterior |
| **Cerrar gaps por nicho** | Extensión navegador (carrera); iOS + wearables + macros (fitness); sync bancaria (finanzas) | ⏳ Priorizado por tracción |

**Orden estratégico recomendado (de tu propio estudio de mercado):**
1. **Come for the tool** — vender el SaaS por su valor *solo* (funciona con cero marketplace). Pitch del trial: *"mejora los resultados de tus clientes actuales"*, no *"te traigo clientes"*.
2. **Un nicho × un país** — concentrar la red atómica: coaches de carrera en el mercado hispano más denso. Fitness y finanzas son redes **separadas**, no extensiones gratis.
3. **Validar retención** antes de invertir en matching.
4. **Stay for the network** — encender el marketplace recién con una bolsa densa de coaches activos (patrón OpenTable/HoneyBook).

---

## C · Equipo

**Micaela Jairedin — Fundadora / CEO.**
- Background en **Talent Acquisition** (~8 años en RR.HH. y selección).
- Acompañó a **+200 profesionales** en transición de carrera.
- Rol en Pathway: **producto, ventas, onboarding** de las primeras coaches, contenido/SEO, y —vía herramientas de IA (Claude Code)— el **desarrollo del producto**.

**Gonzalo — Comercial (se incorpora en octubre).**
- Se suma al equipo para cubrir la **parte comercial / ventas** a partir de **octubre 2026**.
- Libera a la fundadora de la venta directa para que se concentre en producto y estrategia — clave justo cuando arranca la adquisición de coaches a escala.

**Modelo de equipo actual:** *lean* y en crecimiento. El producto se construyó con
**asistencia de IA**, lo que explica cómo un equipo mínimo levantó ~60 páginas +
20 funciones backend + CI + observabilidad. Es una **ventaja de coste** (ver sección
D) y una señal de ejecución; con Gonzalo en comercial desde octubre, se separan los
dos motores del negocio: **construcción** (Micaela) y **ventas** (Gonzalo).

> **Para seguir sumando al pitch:** un/a advisor da mucha credibilidad. Si el mentor
> de finanzas/negocios con el que trabajás acepta figurar como advisor, súmalo acá.

---

## D · Costes (cuánto cuesta Pathway HOY)

> Costes **reales de caja hoy** — muy bajos por diseño (arquitectura serverless +
> IA por uso). Este es un punto **fuerte** ante inversores: capital-eficiente.

| Concepto | Proveedor | Coste actual estimado |
|---|---|---|
| **Servidor / base de datos** | Supabase (Postgres + API + Edge Functions) | $0 (free tier) → ~$25/mes al pasar a Pro |
| **Hosting / CDN** | Cloudflare Pages | $0 (free tier) |
| **IA (por uso)** | Anthropic Claude API | Variable; hoy bajo (~$0–30/mes a volumen actual) |
| **Emails** | EmailJS / Brevo | $0–15/mes (free/low tier) |
| **Subida de archivos (CV)** | Uploadcare | $0 (free tier) |
| **Pagos** | Stripe Connect | Sin fijo; solo % por transacción |
| **Dominio** | `pathwaycareercoach.com` (+ `micaelajairedin.com`) | ~$12–30/año |
| **Desarrollo** | 🔴 Fundadora + IA (Claude Code ~$20–200/mes) | Ver nota abajo |
| **Diseño** | In-house (fundadora) | $0 |

**Coste de infra + herramientas hoy: por debajo de ~€100/mes de caja real.**

> 🔴 **El gran número que falta es el coste de desarrollo.** Si construís vos +
> IA (sin dev pagado), el coste de dev en caja ≈ €0 y el verdadero coste es tu
> **tiempo** (coste de oportunidad de tu salario en TA). Si pagás a alguien,
> decime cuánto y lo meto. **Este dato define la sección E.**

**Coste variable a vigilar al escalar:** la **IA por uso** (cada informe/CV
generado cuesta unos céntimos de Claude API). Hay que vigilar el **margen por
cliente**, pero a $29–59/mes de suscripción el margen bruto es muy alto.

---

## E · Inversión (cuánto necesitás — calculado, no al azar)

> 🔴 **Rango a validar con vos** según objetivo de la ronda. No es un número
> mágico: es la suma de lo que cuesta comprar **12–18 meses de runway** para pasar
> de 0→1 (primeras coaches que pagan y se quedan). Todos los supuestos, explícitos.

**Qué financia la ronda (el uso de fondos):**
1. **Tu salario de fundadora** — para que dejes de subsidiar el proyecto con tu tiempo. Supuesto España: ~€2.000–2.500/mes.
2. **Cerrar el gap de seguridad (RLS)** — lo podés hacer vos, pero conviene presupuestar una **auditoría de seguridad** externa antes de escalar: ~€1.500–2.500.
3. **Test de adquisición de coaches** — primer marketing pago para encontrar el canal más barato: ~€500–1.000/mes.
4. **Infra + IA al escalar** — ~€150–300/mes conforme suben coaches y uso de IA.
5. **Legal / contable** — constitución (SL), GDPR, contratos: ~€1.500–3.000 one-off.
6. **Buffer ~15%.**

**Escenarios:**

| Escenario | Runway | Contrataciones | Total `[ESTIMADO]` |
|---|---|---|---|
| **Mínimo** (solo cerrar seguridad + test marketing) | ~6 meses | Ninguna | **~€20–30k** |
| **Pre-seed lean** (validar 0→1, solo fundadora) | ~12 meses | Ninguna | **~€45–60k** |
| **Pre-seed +1 hire** (escalar tras validar) | ~18 meses | 1 (dev o growth) | **~€90–120k** |

**Recomendación:** apuntar a un **pre-seed de ~€50–70k** para 12–15 meses. Es
suficiente para pagarte un sueldo, cerrar la seguridad, correr un test de
adquisición real y llegar a la métrica que importa: **primeras 10–20 coaches que
pagan y retienen**. Con esa tracción, una seed posterior se levanta en condiciones
mucho mejores (y con opción de bootstrapping si la conversión aparece antes).

**Cálculo de referencia (pre-seed lean, 12 meses):**
`Salario €2.200×12 = €26.400 · Marketing €700×12 = €8.400 · Infra+IA €200×12 = €2.400 · Seguridad €2.000 · Legal €2.500 · Buffer 15% ≈ €6.250` → **≈ €48.000**.

---

## F · Competencia

**Pregunta clave que ordena todo el mapa: ¿la plataforma le TRAE clientes al coach?**
De **8 competidores analizados, 0 lo hacen** para el coach independiente.

| Plataforma | Precio/mes | Foco | Español | ¿Trae clientes? |
|---|---|---|---|---|
| **Harbiz** | ~€30+ | Fitness (Madrid) | Sí | **No** |
| **CoachAccountable** | $20–120 | General/negocios | No | **No** |
| **Paperbell** | $57 plano | General | No | **No** |
| **Simply.Coach** | $19–69 | General + verticales | Sí | **No** |
| **Satori** | $33–124 | General / ICF | No | **No** |
| **CoachPilot** | $35–100 | Fitness/IA | No | **No** |
| **Profi.io** | (cerró dic-2025) | Terapeutas/equipos | No | — |
| **Coaching.com** | listado +15–25% | General | No | Directorio pasivo |
| **▸ PATHWAY** | **$29 / $59** | **Carrera + IA (multi)** | **Sí** | **SÍ — marketplace** |

**Competidores por nicho (los especialistas nos ganan en profundidad, no en cruce):**
- **Fitness:** Trainerize, TrueCoach, Everfit, Harbiz (app móvil, videos, wearables, macros).
- **Finanzas:** YNAB, Monarch, RightCapital (sync bancaria).
- **Carrera:** Jobscan, Teal, Huntr (extensión de navegador, tracker ATS) — pero **no existe un "todo en uno para el coach"** de carrera.
- **Enterprise (otra liga):** BetterUp, CoachHub — sí generan demanda, pero el coach es *contratado*, no dueño de su cartera. No compiten por el coach independiente.

**El espacio en blanco (el moat):** *"software de gestión + genera demanda, para
el coach independiente, en español, nicho carrera"* es un cruce **prácticamente
desocupado**. Timing extra: **Profi.io cerró en dic-2025** y su base está migrando;
Simply.Coach (el rival vivo más directo con español nativo) es **horizontal** — sin
informe de carrera con IA ni job-matching.

**Nuestra desventaja honesta:** **profundidad por nicho** (sobre todo fitness). No
le ganamos a Trainerize en features. Ganamos con *"todo en uno multi-nicho + te
traigo clientes + simple"*.

---

## G · Clientes (quién compra)

**Quien paga = el COACH.** Segmentos, por prioridad:

| Segmento | Prioridad | Nota |
|---|---|---|
| **Career / Empleabilidad coach** | 🥇 **Foco inicial** | Nuestro nicho vivo. Segmento más grande de plataformas (~28%). Cruce desocupado en español. |
| **Fitness coach** | 🥈 Expansión | Mercado grande pero **el más competido** (Trainerize et al). Prototipo en producción. |
| **Financial coach** | 🥉 Expansión | Mercado **menos maduro** → competimos bien. Prototipo en producción. |
| **Life / Executive coach** | Futuro | Mismo cascarón, redes separadas. |
| **Empresas (outplacement/RR.HH.)** | Futuro B2B | Mercado outplacement ~$4,6B (CAGR ~6%). Vía distinta (venta enterprise). |
| **Universidades / career services** | Futuro B2B | Canal institucional; ciclo de venta largo. |

**ICP (coach ideal que paga):** coach de carrera/empleabilidad independiente o
consultora chica, 3–15 clientes a la vez, hoy los gestiona con Excel + WhatsApp +
Canva + ChatGPT suelto. Habla español, opera en España o LatAm. Dolor:
*"se me quedan clientes sin contactar", "armo cada CV a mano", "no tengo de dónde
sacar clientes nuevos".*

**Cliente final (gratis, lo trae el coach):** persona en transición de carrera /
buscando empleo, que valora acompañamiento humano + herramientas modernas.

> ⚠️ **Riesgo a nombrar ante el inversor:** hoy los clientes finales llegan **vía
> una agencia externa** (ya compraron la mentoría). Un marketplace de descubrimiento
> candidato→coach es una **expansión** del modelo, no solo una feature.

---

## H · Pricing

**Pricing vigente (el de la landing).**

**Modelo:** suscripción recurrente del coach (MRR) + comisión de marketplace.

**Mensual (vigente en la landing):**
| Plan | Precio | Para quién | Incluye |
|---|---|---|---|
| **Basic** | **$29/mes** | Coaches que arrancan | Hasta 5 clientes, herramientas IA, perfil en directorio, botón de reserva + cobro Stripe, soporte email. |
| **Pro** | **$59/mes** | Coaches que escalan con su marca | Clientes ilimitados, **white-label**, emails al cliente desde el panel, soporte prioritario WhatsApp+email. |

**Anual `[PROPUESTO — aún no está en la landing]`:** convención SaaS = **2 meses
gratis** al pagar por año (≈17% de descuento). Sube el compromiso y baja el churn.
| Plan | Anual | Equivale a | Ahorro |
|---|---|---|---|
| **Basic** | **$290/año** | ~$24/mes | 2 meses gratis |
| **Pro** | **$590/año** | ~$49/mes | 2 meses gratis |

> **Por qué agregar el anual (argumento para el inversor):** cobra 12 meses por
> adelantado → mejora el *cash flow* y **reduce el churn** (el cliente ya pagó el año).
> Es una de las palancas más baratas para subir el LTV. Recomendado activarlo pronto.

- **14 días gratis, sin tarjeta. Cancela cuando quieras** (sin permanencia).
- Los **datos del cliente son del coach** (puede exportarlos si se va).

**Fuentes de ingreso:**
1. **Suscripción recurrente** ($29/$59) → el core, MRR predecible.
2. **Finder's fee 20%** — SOLO la primera vez que Pathway le trae un cliente nuevo vía marketplace. Después, **0%**: ese cliente es 100% del coach.
3. **Clientes que el coach trae por su cuenta: 0% comisión, siempre.** (Incentivos alineados: no le comemos margen sobre su trabajo.)

**Posicionamiento de precio (de tu mapa de valor):**
La mayoría del mercado arranca entre **$19 y $39/mes**. A **$29/$59** quedamos
**dentro de la banda del mercado** (Basic al nivel de los planes de entrada, Pro
cerca de Paperbell $57) — pero somos los únicos que además **traemos clientes** +
white-label + multi-nicho, así que a igual precio ofrecemos más.

> **Oportunidad de pricing (para Q&A con el inversor):** tu propio análisis sugiere
> que el **Basic tiene poder de subida** ($29 con límite de 5 clientes está barato
> vs. la competencia) y que el Pro podría escalar hacia ~$79 conforme se cierran
> los gaps por nicho. Es decir: **hay palanca de precio hacia arriba sin salir de
> la banda**, un buen argumento de upside de ingresos.

**Pricing regional (LatAm):** España/Europa mantiene tarifa plena; un coach latino
tiene **38–62%** del poder adquisitivo de uno español. Práctica Netflix/Spotify:
precio único global en USD **primero**; si la conversión en LatAm queda muy por
debajo de España, recién ahí evaluar descuento regional (~40–55% México/Colombia,
~35% Chile; Argentina en moneda local por fricción FX). Blindaje anti-arbitraje:
exigir método de pago/dirección local.

**Empresas / universidades:** plan enterprise a cotizar (fuera del self-serve).

---

## I · Métricas

> ⚠️ **Lo más importante que decir con honestidad: estamos en 0→1.** Producto
> construido y ancho, **pero ~0 coaches pagando aún**. El reto no es el producto,
> es la tracción. El mercado (abajo) es el *fondo de cancha*, no nuestra posición.

**Los 4 números propios que importan hoy (a instrumentar desde la coach #1):**
| Métrica | Valor hoy |
|---|---|
| Coaches que pagan | 🔴 `[completar]` (≈0, onboarding manual) |
| Coaches en prueba (trial) | 🔴 `[completar]` |
| % trial → pago | 🔴 `[completar]` (media del sector ~9%) |
| % que sigue al mes 2 (retención) | 🔴 `[completar]` |

**Tracción / actividad a rellenar desde tus paneles** (Cloudflare + Supabase):
`[completar]` visitas a la landing · leads del chatbot (`contactos_chat`) ·
lista de espera · reuniones/demos hechas · emails enviados · usuarios registrados
(`usuarios`) · candidatos en sistema (`candidatos`).

> Ya tenés la instrumentación montada para llenar esto: tabla `contactos_chat`
> (leads del chatbot), `leads_pricing` (trial/pago), agente `analytics-weekly`
> (tráfico Cloudflare semanal), `client_errors` (observabilidad). **Antes del
> pitch, exportá los números reales de estos paneles y reemplazá los `[completar]`.**

**Benchmarks de la liga (bajo ticket $29–59/mes, trial sin tarjeta) — no te midas contra enterprise:**
| Métrica | Meta sana | Fuente |
|---|---|---|
| Churn mensual | ≤5% (6–8% amarillo) | ChartMogul |
| Conversión trial→pago (sin tarjeta) | media ~9%; genial 10–15% | Lenny's / Kyle Poyar |
| LTV : CAC | ≥ 3 : 1 | OpenView |
| Payback de CAC | ≤ 8–12 meses | SMB self-serve |
| Bajas en primeros 90 días | ~43% (SMB) → el 1er ciclo de 4 semanas define la retención | — |

**Tamaño de mercado (el fondo de cancha, fuente ICF/World Bank):**
- Mercado global de coaching **$5,34B en 2025** (+17% vs 2023).
- **~123.000 coaches** en el mundo (+15% en 2 años, ICF).
- **~53% de coaches sin plataforma** → es *adopción*, no creación de categoría.
- Career coaching **$1,43B** (→$2,5B en 2034); outplacement **$4,6B**.
- **0 de 8** competidores traen clientes al coach independiente.

---

## J · Tu historia (para escribir juntas — el borrador)

> Esta es la parte que conecta con el inversor. **No** sos "una desarrolladora que
> tuvo una idea". Sos alguien que **vivió el problema desde adentro**. Borrador para
> que lo hagas tuyo:

*"Trabajo en **Talent Acquisition**. Mi trabajo, todos los días, es mirar cómo la
gente se presenta al mercado laboral: sus CVs, sus perfiles, cómo cuentan lo que
saben hacer. Y desde ese lado del escritorio vi el mismo patrón durante años:
**gente con talento que se pierde buscando orientación** — no porque no valga, sino
porque nadie les enseñó a mostrarse, y porque la ayuda buena (un coach de carrera de
verdad) es cara, dispersa y difícil de encontrar.*

*Al mismo tiempo vi el otro lado: **coaches buenísimos ahogados en tareas manuales**
—armando cada CV a mano, gestionando clientes por WhatsApp y Excel, sin forma de
conseguir clientes nuevos— y sin herramientas a la altura de lo que hacen.*

*Pathway nace de ese cruce. No lo construí porque vi un mercado en una hoja de
cálculo; lo construí porque **conozco el coaching y la empleabilidad desde adentro**,
acompañé a más de 200 personas, y sé exactamente dónde se rompe el proceso. Le doy al
coach las herramientas para profesionalizar y escalar su práctica, y le doy al que
busca trabajo el acompañamiento humano + la tecnología que yo hubiera querido poder
ofrecerle."*

**Por qué esto convence a un inversor:** *founder-market fit*. El problema no te lo
contaron; lo viviste. Eso predice que vas a tomar mejores decisiones de producto y
que vas a aguantar el 0→1.

> **Para afinar juntas:** el número exacto de años en TA, un momento concreto
> (una persona real que acompañaste, un "clic"), y por qué *ahora*.

---

## Anexo — Ficha técnica rápida
- **Stack:** HTML/CSS/JS vanilla, Supabase (Postgres + API + Edge Functions), Claude API (IA), Stripe Connect (cobros), Cloudflare Pages (deploy), EmailJS/Brevo, Uploadcare, PWA.
- **Costes de infra bajos y escalables** (serverless); coste variable principal = IA por uso.
- **Disciplina de ingeniería:** CI con tests, observabilidad de errores en producción, agente de analytics semanal automatizado con IA.
- **Estado:** producción, dominio propio, multi-nicho, pre/early-revenue.

## Anexo — Riesgos (nombralos vos antes de que los nombre el inversor)
1. **Seguridad de datos** — cerrar el gap RLS antes de registro masivo. Crítico.
2. **Churn de bajo ticket** — la retención se gana en el 1er ciclo de 4 semanas.
3. **Dispersión** — multi-nicho + multi-país a la vez mata el foco. Una red atómica primero.
4. **Dependencia de agencia** — hoy los clientes finales llegan vía agencia externa. ¿Qué pasa si ese canal cambia?
5. **Bus factor** — equipo de una persona. La ronda mitiga con la primera contratación.

---

*Fuentes de mercado: ICF Global Coaching Study 2023/2025; World Bank/IMF (PPA 2024);
ChartMogul, Lenny's/Kyle Poyar, OpenView, SaaS Capital (métricas SaaS); a16z/NFX
(estrategia de marketplace); pricing/features públicos de los competidores citados.
Datos de producto, pricing y stack = reales (del código de Pathway). Proyecciones =
ilustrativas, a validar.*
