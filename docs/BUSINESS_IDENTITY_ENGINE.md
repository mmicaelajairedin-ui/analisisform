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
