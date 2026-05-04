-- ─────────────────────────────────────────────────────────────────
-- Demo client María: completar para que la demo del martes muestre TODO
-- ─────────────────────────────────────────────────────────────────
-- Mica preparó la demo del martes y notó que María tiene datos del
-- formato VIEJO (sin experiencias_optimizadas). Este UPDATE actualiza
-- el linkedin_analisis con el formato NUEVO (3 experiencias completas
-- con bullets + aptitudes + keywords) + agrega foto.
--
-- IMPORTANTE: ejecutar DESPUÉS del SQL inicial demo-cliente.sql
-- (María ya debe existir en candidatos).
--
-- Pegá esto en Supabase → SQL Editor → Run.
-- ─────────────────────────────────────────────────────────────────

UPDATE candidatos
SET
  -- Foto demo (placeholder con SVG inline data URL — avatar femenino genérico)
  foto_perfil = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><defs><linearGradient id="g" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="%2352B788"/><stop offset="1" stop-color="%232D6A4F"/></linearGradient></defs><circle cx="100" cy="100" r="100" fill="url(%23g)"/><circle cx="100" cy="80" r="32" fill="%23fff" opacity="0.95"/><path d="M40 200 Q40 130 100 130 Q160 130 160 200 Z" fill="%23fff" opacity="0.95"/></svg>',

  -- LinkedIn análisis con formato NUEVO (experiencias_optimizadas con
  -- bullets + aptitudes + keywords por puesto). Score 68/100, titular y
  -- acerca de optimizado, 3 experiencias ricas.
  linkedin_analisis = '{
    "score_actual": 68,
    "titular_actual": "Marketing Manager · TechFlow",
    "titular_propuesto": "Senior Marketing Manager · B2B SaaS · Demand Gen + ABM · Lideré rediseño de funnel reduciendo CAC 28%",
    "acerca_de_actual": "Marketing manager con experiencia en B2B y crecimiento de empresas SaaS. Apasionada por el growth y los datos.",
    "acerca_de_propuesto": "Marketing leader B2B SaaS con 8+ años escalando ARR de €5M a €30M. Especializada en demand gen y ABM. Buscando rol de Director/a en scaleup.",
    "puntos_fuertes": [
      "Experiencia probada escalando ARR de €5M a €30M en TechFlow",
      "Mix técnico-estratégico: HubSpot + Salesforce + Tableau + OKRs",
      "Liderazgo de equipos multifuncionales (6 personas) con resultados medibles"
    ],
    "areas_mejora": [
      "Activar #OpenToWork con preferencias específicas (rol, sector, ubicación)",
      "Subir 1-2 posts mensuales para visibilidad en feed de LinkedIn",
      "Pedir reseñas de exjefes y colegas para credibilidad social"
    ],
    "habilidades_sugeridas": [
      "Demand Generation",
      "Account-Based Marketing",
      "Marketing Operations",
      "HubSpot",
      "Salesforce",
      "Growth Marketing",
      "B2B SaaS",
      "Team Leadership"
    ],
    "experiencias_optimizadas": [
      {
        "rol": "Senior Marketing Manager",
        "empresa": "TechFlow SaaS",
        "fecha": "2022 — Actual",
        "ubicacion": "Madrid",
        "bullets": [
          "Lideré rediseño completo del funnel B2B reduciendo CAC en 28% y subiendo conversión MQL→SQL del 12% al 19% en 9 meses",
          "Implementé estrategia de account-based marketing con HubSpot + LinkedIn Sales Navigator, generando €1.2M en pipeline cualificado",
          "Coordiné equipo de 6 personas (2 demand gen, 2 product marketing, 2 content) con metodología OKR trimestral",
          "Diseñé scoring de leads que aumentó velocidad de cierre en 35% y reduce drop-off entre etapas",
          "Aporté insights en reuniones de board mensuales sobre métricas de adquisición y retención"
        ],
        "aptitudes": [
          "Demand Generation",
          "Account-Based Marketing",
          "Pipeline Acceleration",
          "HubSpot",
          "Marketing Operations"
        ],
        "keywords": [
          "B2B SaaS",
          "Pipeline",
          "ABM",
          "Funnel Optimization",
          "OKRs"
        ]
      },
      {
        "rol": "Marketing Manager",
        "empresa": "Globo Digital",
        "fecha": "2019 — 2022",
        "ubicacion": "Barcelona",
        "bullets": [
          "Escalé operación de marketing digital de €5M a €18M ARR en 3 años",
          "Lideré expansión a 4 mercados LATAM (México, Colombia, Argentina, Chile) con paid + content + partnerships locales",
          "Diseñé estrategia de SEO técnico que aumentó tráfico orgánico 340% en 18 meses",
          "Construí equipo de 4 personas desde cero, contratando + onboarding + ramp-up",
          "Implementé attribution model multi-touch en HubSpot con ventana de 90 días"
        ],
        "aptitudes": [
          "Growth Marketing",
          "International Expansion",
          "SEO Strategy",
          "Team Building",
          "Attribution Modeling"
        ],
        "keywords": [
          "LATAM Expansion",
          "ARR Growth",
          "SEO",
          "Multi-touch Attribution",
          "Demand Gen"
        ]
      },
      {
        "rol": "Marketing Specialist",
        "empresa": "Visualizar Inc",
        "fecha": "2017 — 2019",
        "ubicacion": "Madrid",
        "bullets": [
          "Gestioné campañas paid (Google Ads, Meta) con presupuesto de €500K/año, ROAS promedio 4.2x",
          "Lancé 12 product launches coordinando con equipos de producto, ventas y customer success",
          "Implementé attribution model multi-touch en HubSpot con ventana de 90 días",
          "Optimicé landing pages con A/B testing aumentando conversión 22%"
        ],
        "aptitudes": [
          "Paid Advertising",
          "Product Launches",
          "A/B Testing",
          "ROAS Optimization"
        ],
        "keywords": [
          "Performance Marketing",
          "Paid Media",
          "ROAS",
          "Conversion Rate Optimization"
        ]
      }
    ]
  }'

WHERE email = 'maria.demo@pathway.com';


-- Verificar (debería retornar 1 row con todo lleno)
SELECT email, nombre, foto_perfil IS NOT NULL AS tiene_foto,
  jsonb_array_length((linkedin_analisis::jsonb)->'experiencias_optimizadas') AS num_experiencias
FROM candidatos
WHERE email = 'maria.demo@pathway.com';
