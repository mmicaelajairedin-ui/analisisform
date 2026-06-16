# Pathway — Brief de negocio (para reunión con mentor)

> Documento de trabajo para una sesión de mentoría sobre SaaS y emprendimiento.
> **Datos del producto/pricing/modelo = reales** (del código). **Cifras de mercado y
> proyecciones = estimaciones ilustrativas a validar** (marcadas como "[ESTIMADO]").

---

## 1. Resumen ejecutivo (el pitch en 30 segundos)

**Pathway** es un SaaS para coaches de carrera (y, en expansión, otros nichos:
fitness, finanzas, vida, negocios, ejecutivo). Le da al coach las herramientas
para profesionalizar y escalar su práctica:

- **Herramientas con IA**: generación de CV optimizado, análisis ATS, simulador de
  entrevistas, carta de presentación, análisis de LinkedIn, e informe/diagnóstico
  automático del cliente.
- **Portal del cliente white-label**: cada cliente del coach tiene su espacio
  privado con su progreso, recursos por semana, medallas y sesiones.
- **Panel del coach**: gestiona todos sus clientes, pagos, links y progreso en un
  solo lugar.
- **Directorio público + marketplace**: los candidatos encuentran al coach por
  especialidad y mercado. *Pathway le trae clientes al coach.*

**Frase clave:** "Tú haces lo único que solo tú puedes hacer —coachear—; Pathway
hace el resto." Y: "Tú cobras lo que quieras a tus clientes; Pathway no toca ese
dinero."

---

## 2. Modelo de negocio (esto es real)

### Quién paga
- **El coach paga** la suscripción. **El candidato/cliente NO paga** (gratis para él).
- Es un **B2B2C**: le vendemos al coach, el coach atiende a su cliente final.

### Pricing (vigente)
| Plan | Precio | Para quién | Incluye |
|------|--------|-----------|---------|
| **Basic** | **€58/mes** | Coaches que arrancan | Hasta 5 clientes simultáneos, todas las herramientas IA, perfil en directorio, botón de reserva (Calendly) + cobro con Stripe, soporte email |
| **Pro** | **€89/mes** | Coaches que escalan con su marca | Clientes ilimitados, **white-label** (su logo/colores en el portal), envío de emails al cliente desde el panel, acceso prioritario a features, soporte WhatsApp+email |

- **14 días gratis, sin tarjeta. Cancela cuando quieras** (sin permanencia).
- Los datos de los clientes son del coach (puede exportarlos al irse).

### Fuentes de ingreso
1. **Suscripción recurrente del coach** (€58 / €89 al mes) → el core, ingreso predecible (MRR).
2. **Comisión de presentación (finder's fee) del 20%** — SOLO la primera vez que
   Pathway le trae un cliente nuevo al coach a través del marketplace. Después de
   esa primera transacción, **0%**: ese cliente es 100% del coach.
3. **Clientes que el coach trae por su cuenta: 0% comisión, siempre.**

> Infra de cobro: **Stripe Connect** ya integrado (el dinero del coach va directo a
> su cuenta; Pathway solo retiene la comisión de presentación cuando aplica).

### Por qué este modelo es bueno (argumentos para el mentor)
- **Ingreso recurrente** (lo que más valoran los inversores en SaaS).
- **Incentivos alineados**: no le cobramos comisión sobre su trabajo, así que el
  coach no nos ve como un intermediario que le come margen. El finder's fee solo se
  cobra cuando *aportamos valor real* (un cliente que no tenía).
- **Bajo costo marginal**: el costo de servir a un coach extra es casi nulo
  (infra serverless + IA por uso).

---

## 3. Cómo nos diferenciamos (el "moat")

La mayoría de las plataformas para coaches son **solo software de gestión**
(agenda, cobros, CRM). El coach tiene que conseguir sus clientes por su cuenta.

**El diferencial de Pathway: el marketplace de dos lados que TRAE clientes.**
- Un candidato entra, busca coach por área/especialidad/mercado, y contrata.
- La competencia (Harbiz, CoachPilot/CoachAccountable, etc.) no genera demanda;
  solo administra la que el coach ya tiene.
- Esto convierte a Pathway de "una herramienta más" en "un canal de adquisición":
  mucho más difícil de cancelar.

**Otros diferenciales:**
- **Herramientas con IA específicas del nicho** (no un CRM genérico): para carrera,
  CV/ATS/entrevistas reales; para finanzas, presupuesto y salud financiera; para
  fitness, rutinas y composición corporal.
- **Portal del cliente con gamificación** (medallas, progreso, confeti) → mejor
  experiencia para el cliente final = el coach queda bien = retención.
- **White-label**: el coach pone su marca, no la nuestra. Vendemos "infra invisible".

---

## 4. Mercado

> ⚠️ Cifras de tamaño de mercado = **[ESTIMADO]**, a validar con fuentes (IBISWorld,
> Statista, ICF). Sirven para dimensionar, no como dato firme.

- **Mercado global de coaching**: industria multimillonaria en USD y en crecimiento
  sostenido (la International Coaching Federation reporta cientos de miles de
  coaches activos en el mundo). **[ESTIMADO / verificar cifra exacta]**
- **Nuestro foco geográfico inicial: España + Latinoamérica** (México, Argentina,
  Chile, Colombia). Mercado hispanohablante, menos saturado de herramientas en
  español que el de EE. UU.
- **Segmento concreto que atacamos**: coaches de carrera/empleabilidad independientes
  o pequeñas consultoras, que hoy trabajan con Excel + WhatsApp + Canva + ChatGPT
  suelto, sin una plataforma unificada en español.

### TAM / SAM / SOM (marco para la conversación) — [ESTIMADO]
- **TAM**: todos los coaches de habla hispana (todos los nichos) que pagarían por software.
- **SAM**: coaches de carrera + fitness + finanzas en España y LatAm con práctica activa y disposición a pagar ~€60-90/mes.
- **SOM (objetivo realista 12-18 meses)**: las primeras decenas/cientos de coaches alcanzables por canales directos (redes, referidos, directorio SEO).

> Pendiente real: poner números defendibles aquí. **Buena pregunta para el mentor:
> ¿cómo dimensiono el SAM/SOM sin gastar meses en research?**

---

## 5. Competencia

| Competidor | Qué es | Dónde ganamos nosotros |
|-----------|--------|------------------------|
| **Harbiz** | Plataforma de gestión para coaches (fuerte en fitness, España) | No trae clientes; nosotros sí (marketplace). IA específica de carrera. |
| **CoachAccountable / CoachPilot** | Software de seguimiento y gestión de coaching | Genérico, en inglés, sin adquisición de clientes ni herramientas IA de empleabilidad. |
| **Paperbell / Practice / Satori** | Admin de coaching (agenda, cobro, contratos) | Mismo punto: gestión, no demanda. Foco anglosajón. |
| **ChatGPT / IA suelta** | El coach arma CVs/informes a mano con IA genérica | Nosotros le damos el flujo completo + portal del cliente + marca, no un chat suelto. |
| **Agencias de empleabilidad** | Servicio completo, no software | Nosotros empoderamos al coach independiente a competir con ellas. |

**Síntesis para el mentor:** el mercado de "software de gestión para coaches" está
poblado, pero **nadie en español combina herramientas IA específicas + portal
white-label + un marketplace que genera demanda.** Ese cruce es nuestro ángulo.

---

## 6. Cliente objetivo (ICP)

**Coach ideal (quien paga):**
- Coach de carrera / empleabilidad / recolocación independiente o consultora chica.
- 3-15 clientes a la vez, los gestiona con herramientas dispersas.
- Quiere verse más profesional y ahorrar horas de trabajo manual.
- Habla español, opera en España o LatAm.
- Dolor concreto: "se me quedan clientes sin contactar", "armo cada CV a mano",
  "no tengo de dónde sacar clientes nuevos".

**Cliente final (gratis, lo trae el coach o el marketplace):**
- Persona en transición de carrera / buscando empleo.
- Valora acompañamiento humano + herramientas modernas.

---

## 7. Estado actual y tracción (honesto)

- **Producto funcionando en producción**: dominio propio (pathwaycareercoach.com),
  panel del coach, portal del cliente, herramientas IA, cobros con Stripe Connect,
  directorio, landing + SEO + blog, notificaciones push.
- **Etapa: muy temprana.** Las primeras coaches de pago se onboardean a mano (gente
  conocida, riesgo bajo) mientras se cierra un gap de seguridad técnico antes de
  escalar a 5+ coaches activos.
- **Construcción robusta para el tamaño**: tests/CI, observabilidad de errores en
  producción, agente semanal de analytics con IA. Señal de disciplina técnica.

> Para el mentor conviene ser transparente: **estamos en pre-/early-revenue, validando
> el primer puñado de coaches de pago.** La pregunta no es "cómo escalo a 10.000",
> sino "cómo consigo los primeros 10-20 coaches que pagan y se quedan".

---

## 8. Proyección / unit economics (marco, NO dato real)

> Todo esto es **[ILUSTRATIVO]** para estructurar la charla. Los supuestos hay que validarlos.

**Variables clave de un SaaS de suscripción:**
- **MRR** = nº de coaches pagos × precio medio. Ej.: 20 coaches × ~€75 ≈ **€1.500 MRR** → €18k ARR. 100 coaches ≈ €7.500 MRR → €90k ARR. **[ILUSTRATIVO]**
- **+ Ingreso por finder's fee** (20% de la primera contratación vía marketplace) — variable, depende del flujo del directorio.
- **Churn**: el número que mata o salva a un SaaS. Hay que medirlo desde el coach #1.
- **CAC** (costo de adquirir un coach): hoy casi orgánico/manual; medir cuando se invierta en marketing.
- **LTV** = precio medio × meses de permanencia. A más retención (el marketplace ayuda), mayor LTV.

**Costos principales (bajos):**
- Infra serverless (Supabase, Cloudflare Pages) — escala barato.
- **IA por uso** (Claude API) — costo variable por informe/CV generado; vigilar el margen por cliente.
- EmailJS / Brevo, Uploadcare, Stripe (comisión de pasarela).

**Pregunta para el mentor:** ¿qué métricas debería estar midiendo YA, con tan pocos
clientes, para no autoengañarme? (Probablemente: activación, retención semana a
semana y conversión trial→pago.)

---

## 9. Roadmap / visión de expansión

- **Multi-nicho con el mismo "cascarón"** (reusa ~85% del producto): además de
  Carrera (vivo), prototipos avanzados de **Fitness** y **Finanzas**; luego Vida,
  Negocios, Ejecutivo.
- **Marketplace como motor de crecimiento**: a más coaches y más candidatos, más
  match → efecto de red de dos lados.
- **Chat in-app con anti-fuga** (sin sacar la relación a WhatsApp) para que las
  transacciones del marketplace queden dentro de la plataforma.
- **Pendiente técnico crítico antes de escalar**: cerrar el gap de seguridad
  (aislamiento de datos por coach / RLS en la base de datos). Honestidad ante el
  mentor: es lo más importante a resolver antes de abrir el registro masivo.

---

## 10. Riesgos / preguntas abiertas (para pedirle consejo al mentor)

1. **El problema del huevo y la gallina del marketplace**: ¿cómo arranco los dos
   lados? ¿Primero llenar de coaches el directorio o primero traer candidatos?
2. **Adquisición de coaches**: ¿cuál es el canal más barato para conseguir los
   primeros 20-50 coaches de pago? (SEO, comunidades, referidos, partnership con
   agencias…).
3. **Pricing**: ¿€58/€89 está bien posicionado para España + LatAm, donde el poder
   adquisitivo varía mucho? ¿Conviene precio regional?
4. **Retención > adquisición**: ¿cómo bajo el churn desde el día 1?
5. **Foco vs. expansión**: ¿me conviene clavar el nicho de carrera primero, o el
   multi-nicho me da más mercado? (Riesgo de dispersión siendo equipo chico.)
6. **El finder's fee del 20%**: ¿es el mecanismo correcto o complica la venta?
7. **Métricas e instrumentación**: ¿qué tablero mínimo debería tener para tomar
   decisiones con datos y no por intuición?
8. **Financiación**: ¿esto es bootstrappeable o en algún momento necesito levantar capital?

---

## Anexo — Ficha técnica rápida (por si pregunta)
- **Stack**: HTML/CSS/JS vanilla, Supabase (Postgres + API), Claude API (vía Supabase
  Edge Functions) para la IA, Stripe Connect para cobros, Cloudflare Pages para deploy.
- **Costos de infra bajos y escalables** (serverless); el costo variable principal
  es la IA por uso.
- **Disciplina de ingeniería**: CI con tests, observabilidad de errores en
  producción, agente de analytics semanal automatizado.
