# Business Identity Engine — Especificación v1.0

**Estado:** Especificación | **Prioridad:** P0 | **Arquitectura:** Core Platform

---

## 🎯 Visión

Pathway no es un "Landing Builder". Es un **Business Identity Engine**.

El coach relena **un único formulario** sobre su negocio. La IA genera automáticamente:
- Landing
- Marketplace
- Emails
- Portal del cliente
- SEO
- Prompt del asistente IA
- PDFs
- Textos del onboarding

**Nunca duplica información. Nunca edita bloque por bloque. Una fuente única de verdad.**

---

## 📊 Arquitectura

```
┌──────────────────────────────────────────────────────────────┐
│                    BUSINESS IDENTITY FORM                     │
│  (Única fuente de verdad del coach)                           │
│                                                               │
│  ¿Qué haces?                                                 │
│  ¿A quién ayudas?                                            │
│  ¿Qué problema resuelves?                                    │
│  ¿Cómo trabajas?                                             │
│  ¿Qué servicios ofreces?                                     │
│  ¿Qué resultados consiguen?                                  │
│  ¿Cuál es tu tono?                                           │
│  País + Idiomas + CTA                                        │
└────────────────┬─────────────────────────────────────────────┘
                 │
                 ▼
        ┌────────────────────┐
        │  AI Generator      │
        │  (Claude API)      │
        │  Specialidades:    │
        │  - Fitness         │
        │  - Executive       │
        │  - Carrera         │
        │  - Finanzas        │
        │  - Nutrición       │
        └────────┬───────────┘
                 │
        ┌────────┴──────────────────────────────────────────┐
        │                                                  │
        ▼                                                  ▼
  ┌─────────────┐                              ┌──────────────────┐
  │  Business   │◄──── TRIGGER on UPDATE     │  Business        │
  │  Identity   │       (Regenera TODO)       │  Outputs         │
  │             │                              │                  │
  │ • nombre    │                              │ • landing        │
  │ • especialidad                             │ • emails         │
  │ • qué_haces │                              │ • seo            │
  │ • a_quién   │                              │ • marketplace    │
  │ • problema  │                              │ • portal         │
  │ • cómo      │                              │ • ai_prompt      │
  │ • servicios │                              │ • onboarding     │
  │ • resultados│                              │ • pdfs           │
  │ • tono      │                              │                  │
  │ • país      │                              │ updated_at       │
  │ • idiomas   │                              │ version          │
  │ • cta       │                              └──────┬───────────┘
  │             │                                     │
  │ updated_at  │                                     │
  │ version     │                                     │
  └─────────────┘                                     │
        ▲                                             │
        │                                             │
   Coach edita                                   Consumidores
                                                     │
                    ┌────────────────────────────────┼────────────────┐
                    │                                │                │
                    ▼                                ▼                ▼
            ┌──────────────┐         ┌──────────────────┐   ┌──────────────┐
            │   Landing    │         │   Cliente.html   │   │    Emails    │
            │   (renderiza)│         │   (Portal)       │   │  (Templates) │
            └──────────────┘         └──────────────────┘   └──────────────┘
                    │                        │                      │
                  ✓ Hero                    ✓ Welcome             ✓ Bienvenida
                  ✓ Beneficios             ✓ Portal hero          ✓ Propuesta
                  ✓ Servicios              ✓ IA Prompt           ✓ Follow-up
                  ✓ FAQs                   ✓ Success msgs        ✓ Onboarding
                  ✓ CTA                    ✓ Textos onboarding
                  ✓ SEO tags
                  ✓ OG tags

                    │                                │                │
                    └────────────────────────────────┴────────────────┘
                                        │
                            ┌───────────┴──────────┐
                            │                      │
                            ▼                      ▼
                    ┌──────────────┐      ┌──────────────────┐
                    │  Marketplace │      │  AI Assistant    │
                    │   (Bio)      │      │   (System Prompt)│
                    └──────────────┘      └──────────────────┘
                            │                      │
                          ✓ Bio                  ✓ Instrucciones
                          ✓ Teaser               ✓ Tono
                          ✓ CTA                  ✓ Contexto
```

---

## 📋 Esquema de Base de Datos

### Tabla: `business_identity`
```sql
CREATE TABLE business_identity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  
  -- Identidad base
  nombre TEXT NOT NULL,
  especialidad TEXT,  -- fitness, executive, carrera, finanzas, nutrición
  pais TEXT,
  idiomas TEXT[] DEFAULT '{es}',
  
  -- Posicionamiento (the SOURCE OF TRUTH)
  qué_haces TEXT NOT NULL,
  a_quién_ayudas TEXT NOT NULL,
  problema_resuelve TEXT NOT NULL,
  cómo_trabajas TEXT,
  servicios TEXT[],
  resultados_clientes TEXT[],
  tono TEXT,  -- directo, inspirador, profesional, amigable
  
  -- Operacional
  cta_texto TEXT,
  cta_url TEXT,
  
  -- Metadata
  generated_at TIMESTAMPTZ,
  version INT DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS: Coach solo ve su propia identidad
ALTER TABLE business_identity ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Coaches can view own identity"
  ON business_identity FOR SELECT
  USING (auth.uid()::TEXT = coach_id::TEXT OR auth.role() = 'admin');
```

### Tabla: `business_outputs`
```sql
CREATE TABLE business_outputs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identity_id UUID NOT NULL REFERENCES business_identity(id) ON DELETE CASCADE,
  
  -- Landing (JSON)
  landing_hero TEXT,
  landing_subhero TEXT,
  landing_benefits JSONB,  -- [{title, desc, icon}]
  landing_services JSONB,  -- [{title, desc}]
  landing_faq JSONB,       -- [{question, answer}]
  landing_cta_primary TEXT,
  landing_cta_secondary TEXT,
  
  -- SEO
  seo_title TEXT,
  seo_description TEXT,
  seo_keywords TEXT[],
  seo_og_title TEXT,
  seo_og_description TEXT,
  
  -- Email templates (JSON)
  emails_welcome JSONB,    -- {subject, body}
  emails_proposal JSONB,
  emails_followup JSONB,
  emails_onboarding JSONB,
  
  -- Portal del cliente
  portal_hero TEXT,
  portal_welcome TEXT,
  portal_success_messages JSONB,
  
  -- Marketplace
  marketplace_bio TEXT,
  marketplace_teaser TEXT,
  
  -- IA Assistant
  ai_system_prompt TEXT,
  ai_opening_message TEXT,
  
  -- Onboarding
  onboarding_welcome TEXT,
  onboarding_steps JSONB,
  
  -- Metadata
  generated_at TIMESTAMPTZ DEFAULT now(),
  version INT DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Trigger: Cuando business_identity cambia, regenerar todos los outputs
CREATE TRIGGER regenerate_outputs_on_identity_change
AFTER UPDATE ON business_identity
FOR EACH ROW
EXECUTE FUNCTION queue_regenerate_business_outputs(NEW.id);
```

---

## 🧠 Edge Function: `business-identity-generate`

### Input
```json
{
  "identity_id": "uuid",
  "force": true  // Regenerar aunque sea la misma versión
}
```

### Output
```json
{
  "success": true,
  "identity_id": "uuid",
  "generated_at": "2026-08-03T10:30:00Z",
  "outputs": {
    "landing_hero": "Lidera con confianza.",
    "landing_subhero": "Executive coaching para directivos que quieren...",
    "landing_benefits": [...],
    "seo_title": "Executive Coaching para Directivos | Executive Growth",
    "emails_welcome": {...},
    "ai_system_prompt": "Eres un asistente de coaching..."
  }
}
```

### Prompt para Claude
```
Eres un copywriter especialista en coaches.

IDENTIDAD DEL COACH:
- Nombre: {nombre}
- Especialidad: {especialidad}
- Qué hace: {qué_haces}
- A quién ayuda: {a_quién_ayudas}
- Problema que resuelve: {problema_resuelve}
- Cómo trabaja: {cómo_trabajas}
- Servicios: {servicios}
- Resultados: {resultados}
- Tono: {tono}
- País: {país}
- Idioma: {idiomas[0]}
- CTA: {cta_texto}

TAREA: Genera la identidad digital COMPLETA en {idioma} manteniendo consistencia absoluta:

1. LANDING (JSON):
   - hero: máx 10 palabras, impactante
   - subhero: máx 20 palabras, clarity
   - benefits: [{title, description}] máx 5
   - services: [{title, description}]
   - faq: [{question, answer}] máx 5
   - cta_primary: "{cta_texto}"

2. SEO:
   - title: máx 60 chars, keywords naturales
   - description: máx 160 chars
   - og_title: máx 50 chars
   - og_description: máx 160 chars
   - keywords: 3-5 palabras clave

3. EMAILS (JSON por template):
   - welcome: {subject, body_html}
   - proposal: {subject, body_html}
   - followup: {subject, body_html}

4. PORTAL:
   - hero: Bienvenida del coach (máx 50 palabras)
   - welcome: Primer mensaje (máx 100 palabras)

5. MARKETPLACE:
   - bio: máx 150 chars
   - teaser: máx 50 chars

6. IA PROMPT:
   - system_prompt: Instrucciones para el chat (200-300 palabras)
   - opening_message: Primer mensaje (máx 100 palabras)

RESTRICCIONES:
- Tono CONSISTENTE en TODO
- Valor único diferenciador debe repetirse
- Sin duplicación conceptual
- Lenguaje accesible pero profesional
```

---

## 📝 Ejemplos Reales por Nicho

### EJEMPLO 1: Coach de Fitness (Laura)

**Entrada (Formulario):**
```
Nombre: TrainLaura
Especialidad: Fitness
Qué haces: Diseño planes de entrenamiento personalizados con nutrición
A quién ayudas: Mujeres ocupadas que quieren estar en forma sin obsesionarse
Problema: No tienen tiempo, fracasan con dietas genéricas, necesitan soporte real
Cómo trabajas: Apps + seguimiento semanal + grupo privado en Telegram
Servicios: 
  - Plan de entrenamiento 12 semanas
  - Asesoramiento nutricional
  - Seguimiento de progreso
  - Acceso grupo privado
Resultados:
  - 5-8 kg en 8 semanas
  - Energía consistente
  - Hábitos que duran
Tono: Directo, sin filtros, motivador
País: España
Idiomas: Español, Inglés
CTA: Mira mi plan gratis 7 días
```

**Output generado automáticamente:**
```
LANDING:
  hero: "Entrena como mereces. Sin dietas, sin culpa."
  subhero: "12 semanas de transformación real. Soporte real. Comunidad real."
  benefits: [
    { title: "Planes 100% personalizados", desc: "Para tu cuerpo, tu agenda, tu vida" },
    { title: "Nutrición que funciona", desc: "Sin contar calorías, sin renunciar" },
    { title: "Grupo privado de apoyo", desc: "Mujeres como tú en el mismo viaje" },
    { title: "Seguimiento semanal", desc: "Tu entrenadora viendo tu progreso" }
  ]
  cta: "Mira mi plan gratis 7 días"

SEO:
  title: "Entrenador Personal Online | Fitness Personalizado Mujeres"
  description: "Planes de entrenamiento + nutrición para mujeres ocupadas. Resultados reales, sin dietas."
  keywords: ["entrenador personal online", "fitness mujeres", "nutrición personalizada"]

EMAIL WELCOME:
  subject: "¡Bienvenida! Tu primer entrenamiento llega mañana 💪"
  body: "Hola! En 24h recibiras tu primer workout. Mientras, te mando 3 cosas importantes..."

MARKETPLACE BIO:
  "Entrenadora online. 200+ mujeres transformadas. 5-8kg en 8 semanas garantizado o devuelvo tu dinero."

AI SYSTEM PROMPT:
  "Eres Laura, entrenadora de fitness. Trabajas con mujeres ocupadas. Tu tono es directo, motivador, sin excusas. Responde en español. Si alguien pregunta por peso/medidas, pregunta por su objetivo real (fuerza, energía, confianza). Siempre propone 'plan gratis 7 días'."

PORTAL WELCOME:
  "¡Hola! Soy Laura. Estos 7 días van a ser diferentes. No es solo un plan. Es un sistema que te enseña a entrenar para VIVIR mejor. ¿Vamos?"
```

---

### EJEMPLO 2: Coach de Carrera Profesional (Carlos)

**Entrada:**
```
Nombre: NextCareer Coaching
Especialidad: Carrera
Qué haces: Ayudo ingenieros y tech a conseguir su siguiente rol en 90 días
A quién ayudas: Ingenieros de software mid-level + seniors
Problema: Letargo en empresa, inseguridad en entrevista, CV muerto, networking cero
Cómo trabajas: 1:1 bi-weekly + grupo de accountability + entrevista simulada
Servicios:
  - CV rebuilding (14 días)
  - Estrategia de búsqueda (30 días)
  - 3 mock interviews
  - Coaching presalario
  - Contactos directos a 50+ empresas tech
Resultados:
  - Ofertas en 60-90 días
  - Sueldos 20-40% más altos
  - Nuevas skills
Tono: Confiado, pragmático, sin BS
País: Remote (worldwide)
Idiomas: Español, Inglés
CTA: Agenda llamada estratégica gratis
```

**Output generado:**
```
LANDING:
  hero: "Tu siguiente rol en 90 días. Garantizado."
  subhero: "Estrategia + CV + Mock Interviews + Acceso 50+ empresas tech"
  benefits: [
    { title: "CV que abre puertas", desc: "De ignorado a top 5% candidatos" },
    { title: "Estrategia de búsqueda", desc: "No esperes ofertas, atráelas" },
    { title: "3 mock interviews", desc: "Practica con alguien que hiringea" },
    { title: "Contactos directos", desc: "Acceso a 50+ empresas tech" }
  ]

SEO:
  title: "Career Coaching para Ingenieros | Get Your Next Role"
  description: "Ayuda a ingenieros a conseguir ofertas 40% más altas en 90 días. CV + Estrategia + Coaching."

MARKETPLACE BIO:
  "Career coach para ingenieros. 120+ en nuevos roles. Promedio +35% salary. Garantía 90 días."

AI SYSTEM PROMPT:
  "Eres Carlos, career coach especializado en ingenieros. Trabajas en remoto. Tu tono es pragmático, sin motivación barata. Enfócate en estrategia, CV, y habilidades de entrevista. Siempre sugiere 'llamada estratégica gratis' para conocer su situación. Responde en inglés o español según el usuario."

EMAIL PROPOSAL:
  subject: "Tu estrategia de búsqueda (personalized para ti)"
  body: "Basado en nuestra llamada, creé tu plan 90 días. Aquí está..."
```

---

### EJEMPLO 3: Coach de Nutrición Deportiva (Marta)

**Entrada:**
```
Nombre: FuelAthletics
Especialidad: Nutrición
Qué haces: Nutrición deportiva para runners y ciclistas serios
A quién ayudas: Atletas amateurs que quieren competir sin sacrificar salud
Problema: Comen por instinto, lesiones recurrentes, bajo rendimiento en carreras
Cómo trabajas: Plan nutricional seasonal + coaching en competiciones + grupo WhatsApp
Servicios:
  - Plan nutricional seasonal
  - Coaching en competencias
  - Análisis bioquímico
  - Suplementos personalizados
Resultados:
  - PBs en maratón/ultra
  - 0 lesiones por nutrición
  - Mejor recuperación
Tono: Científico pero cercano, empoderante
País: Argentina
Idiomas: Español
CTA: Reserva evaluación nutricional
```

**Output generado:**
```
LANDING:
  hero: "Come para vencer. No por vencer, come mejor."
  subhero: "Nutrición científica + coaching en competencias. Para athletes que entienden que la nutrición es entrenamiento."
  benefits: [
    { title: "Plan nutricional seasonal", desc: "Adaptado a tu calendario de carreras" },
    { title: "Coaching en competencias", desc: "Estrategia de fueling antes y durante" },
    { title: "Análisis bioquímico", desc: "Sabe exactamente qué te falta" },
    { title: "Grupo de atletas", desc: "Compartes experiencias con runners como tú" }
  ]

SEO:
  title: "Nutrición Deportiva para Corredores | Rendimiento + Salud"
  description: "Planes nutricionales para runners y ciclistas. Optimiza rendimiento sin lesiones. Coaching científico."

MARKETPLACE BIO:
  "Nutricionista deportiva. Especializada en atletas. 80+ clientes con PBs. Cientifica, cercana, resultados."

AI SYSTEM PROMPT:
  "Eres Marta, nutricionista deportiva. Trabajas con runners y ciclistas serios. Tu tono es científico pero empoderador. Entiende que la nutrición es parte del entrenamiento. Pregunta siempre: ¿cuál es tu objetivo de carrera? ¿ya tienes análisis? Ofrece 'evaluación nutricional' como siguiente paso. Responde en español."
```

---

### EJEMPLO 4: Bot IA de Productividad (AutoFlow)

**Entrada:**
```
Nombre: AutoFlow
Especialidad: Productividad
Qué haces: Automatizo flujos de trabajo en equipos remotos
A quién ayudas: Startups tech y agencias que pierden 20+ horas/semana en tareas manuales
Problema: Tareas repetitivas, desorden, handoffs lentos, equipos agotados
Cómo trabajas: Auditoría de procesos + automatización con Zapier/Make + entrenamiento
Servicios:
  - Auditoría de procesos
  - Automatización (50+ integraciones)
  - Templates lista para usar
  - Soporte 30 días post-implementación
Resultados:
  - 30-40 horas ahorradas/mes
  - 0 tareas manuales repetitivas
  - Equipos más felices
Tono: Técnico pero accesible, optimista
País: Global
Idiomas: Inglés, Español, Portugués
CTA: Reserva auditoría gratis
```

**Output generado:**
```
LANDING:
  hero: "Recupera 40 horas al mes. Automatización que funciona."
  subhero: "Sin code. Sin complicaciones. Soporte incluido. Tu equipo respira."
  benefits: [
    { title: "Auditoría personalizada", desc: "Identifica 20+ horas desperdiciadas" },
    { title: "Automatización end-to-end", desc: "Zapier, Make, Integromat: todo conectado" },
    { title: "Templates listos", desc: "Implementa en 48h, no en 48 días" },
    { title: "Soporte post-launch", desc: "30 días. Ajustes ilimitados." }
  ]

SEO:
  title: "Automatización de Procesos | No-Code Workflow Automation"
  description: "Ahorra 40+ horas/mes. Automatización sin código para startups y agencias. Zapier + Make experto."
  keywords: ["workflow automation", "zapier expert", "no-code automation"]

MARKETPLACE BIO:
  "Automatización specialist. 50+ startups con 30-40h ahorradas/mes. Implementación 48h. ROI garantizado."

AI SYSTEM PROMPT:
  "Eres AutoFlow, especialista en automatización no-code. Trabajas con startups y agencias. Tu tono es técnico pero optimista, no intimidante. Siempre pregunta: ¿cuántas horas pierden por tareas manuales? ¿qué herramientas usan? Luego sugiere 'auditoría gratis' para mapear oportunidades. Responde en inglés, español o portugués según el usuario."

EMAIL WELCOME:
  subject: "Tu auditoría de automatización llega mañana"
  body: "Hola! Mañana te envío un formulario de 5 minutos. Con eso, sabré exactamente dónde recuperas 40 horas..."
```

---

## 🎨 UI: Formulario en MultiCoach

Ubicación: **Configuración → Mi Identidad** (reemplaza "Branding")

```
┌────────────────────────────────────────────────────┐
│              MI IDENTIDAD                          │
│  La fuente única de verdad sobre tu negocio        │
├────────────────────────────────────────────────────┤
│                                                    │
│ PASO 1: TU NEGOCIO                                │
│ ┌──────────────────────────────────────────────┐  │
│ │ Nombre de tu empresa/marca                   │  │
│ │ [Executive Growth              ]             │  │
│ │                                              │  │
│ │ Especialidad                                 │  │
│ │ [Executive Coaching ▼]                       │  │
│ │                                              │  │
│ │ País                                         │  │
│ │ [España ▼]                                   │  │
│ │                                              │  │
│ │ Idiomas                                      │  │
│ │ [☑ Español] [☑ Inglés] [☐ Portugués]        │  │
│ └──────────────────────────────────────────────┘  │
│                                                    │
│ PASO 2: TU POSICIONAMIENTO                        │
│ ┌──────────────────────────────────────────────┐  │
│ │ ¿Qué haces?                                  │  │
│ │ (En máx 15 palabras, sé específico)          │  │
│ │ [Ayudo a directivos a desarrollar            │  │
│ │  liderazgo y acelerar su carrera ]           │  │
│ │                                              │  │
│ │ ¿A quién ayudas?                             │  │
│ │ [Directivos y ejecutivos en transición]      │  │
│ │                                              │  │
│ │ ¿Qué problema resuelves?                     │  │
│ │ [Falta de confianza, networking débil,      │  │
│ │  síndrome del impostor]                      │  │
│ │                                              │  │
│ │ ¿Cómo trabajas?                              │  │
│ │ [Sesiones 1:1 + grupo mensual + plataforma]  │  │
│ │                                              │  │
│ │ ¿Qué servicios ofreces?                      │  │
│ │ [☑ Coaching ejecutivo]                       │  │
│ │ [☑ Desarrollo de liderazgo]                  │  │
│ │ [☑ Gestión del cambio]                       │  │
│ │ [☑ Comunicación estratégica]                 │  │
│ │ [+ Añadir]                                   │  │
│ │                                              │  │
│ │ ¿Qué resultados consiguen tus clientes?     │  │
│ │ • Mayor confianza en decisiones              │  │
│ │ • Red de 50+ contactos estratégicos          │  │
│ │ • Promoción o cambio de empresa              │  │
│ │ [+ Añadir resultado]                         │  │
│ │                                              │  │
│ │ ¿Cuál es tu tono de comunicación?            │  │
│ │ [Directo y profesional ▼]                    │  │
│ └──────────────────────────────────────────────┘  │
│                                                    │
│ PASO 3: TU CTA                                    │
│ ┌──────────────────────────────────────────────┐  │
│ │ ¿Qué quieres que hagan?                      │  │
│ │ [Reserva tu sesión]                          │  │
│ │                                              │  │
│ │ ¿Dónde?                                      │  │
│ │ [https://calendly.com/executivegrowth]       │  │
│ └──────────────────────────────────────────────┘  │
│                                                    │
│                                                    │
│ ┌──────────────────────────────────────────────┐  │
│ │          🤖 GENERAR IDENTIDAD DIGITAL        │  │
│ │                                              │  │
│ │ Esto generará automáticamente:              │  │
│ │ ✓ Landing pública                           │  │
│ │ ✓ Perfil Marketplace                        │  │
│ │ ✓ Email templates                           │  │
│ │ ✓ Portal del cliente                        │  │
│ │ ✓ Textos SEO                                │  │
│ │ ✓ Prompt del asistente IA                   │  │
│ │                                              │  │
│ │ Toma ~30 segundos. Luego puedes editar.     │  │
│ └──────────────────────────────────────────────┘  │
│                                                    │
└────────────────────────────────────────────────────┘
```

### Preview en vivo
Mientras el coach relena, mostrar preview en tiempo real de:
- Landing hero + subhero
- Email de bienvenida
- SEO title
- Marketplace bio

---

## 🔄 Flujo de Cambios

**El coach cambia:**
```
"Ayudo a ingenieros a conseguir empleo"
        ↓
business_identity.update()
        ↓
TRIGGER: regenerate_outputs_on_identity_change()
        ↓
POST /functions/v1/business-identity-generate
        ↓
Claude API genera TODO
        ↓
Guarda en business_outputs
        ↓
REGENERA AUTOMÁTICAMENTE:
  ✓ landing.html (si está abierta)
  ✓ cliente.html portal texts
  ✓ emails en bandeja
  ✓ SEO metadata
  ✓ marketplace profile
  ✓ ai_chat system prompt
```

**Cero manual. Cero duplicación.**

---

## 📦 Integración con Componentes Existentes

### landing.html
```javascript
// No edita. Solo renderiza.
const identity = await fetchIdentity(orgSlug);
const outputs = await fetchOutputs(identity.id);

renderLanding({
  hero: outputs.landing_hero,
  subhero: outputs.landing_subhero,
  benefits: outputs.landing_benefits,
  services: outputs.landing_services,
  faq: outputs.landing_faq,
  cta: outputs.landing_cta_primary,
  seo: outputs.seo_*,
  og: outputs.seo_og_*
});
```

### cliente.html (Portal)
```javascript
const outputs = await fetchOutputs(identity.id);

// Inyecta automáticamente
renderPortal({
  hero: outputs.portal_hero,
  welcome: outputs.portal_welcome,
  successMessages: outputs.portal_success_messages,
  aiSystemPrompt: outputs.ai_system_prompt
});
```

### pw-ia-chat.js (AI Assistant)
```javascript
const outputs = await fetchOutputs(identity.id);

// El prompt viene de business_identity, no hardcodeado
systemPrompt = outputs.ai_system_prompt;
openingMessage = outputs.ai_opening_message;
```

### Email templates
```javascript
const outputs = await fetchOutputs(identity.id);

// Las plantillas se generan, no se editan
templates = {
  welcome: outputs.emails_welcome,
  proposal: outputs.emails_proposal,
  followup: outputs.emails_followup
};
```

### Marketplace
```javascript
const outputs = await fetchOutputs(identity.id);

renderMarketplaceCard({
  bio: outputs.marketplace_bio,
  teaser: outputs.marketplace_teaser,
  cta: identity.cta_texto
});
```

---

## 🚀 Roadmap

| Sprint | Deliverable |
|--------|-------------|
| **B.6.6** | Business Identity table + UI form + Edge function (no IA) |
| **B.6.7** | Claude integration + Landing renderizada |
| **B.6.8** | Portal + Emails + Marketplace integration |
| **B.6.9+** | PDFs + Marketplace + IA Assistant + Onboarding |

---

## ✅ Principios

1. **Una fuente de verdad** — Todo sale de `business_identity`
2. **Generación, no edición** — El coach no edita bloques, solo configura
3. **Consistencia garantizada** — Un tono, un mensaje, en todo
4. **Sin duplicación** — Nunca escribir dos veces
5. **Escalable** — 100 coaches, 100 identidades únicas, 0 trabajo manual

---

**Autor:** Claude Code  
**Fecha:** 2026-08-03  
**Estado:** Ready to implement
