-- ─────────────────────────────────────────────────────────────────
-- DEMO CLIENT — María González
-- ─────────────────────────────────────────────────────────────────
-- Cómo usarlo:
-- 1. Abrí Supabase Dashboard → tu proyecto → SQL Editor
-- 2. Pegá el bloque "INSERT" (líneas 16-90) → click "Run"
-- 3. Hacé tu demo del coach mostrando este cliente
-- 4. Cuando termines, pegá el bloque "DELETE" (líneas 95-100) → "Run"
--
-- El cliente NO tiene login (no se inserta en usuarios) — solo Mica lo ve
-- desde el panel. Si querés también que el cliente ingrese al portal,
-- descomentá el INSERT en usuarios al final.
-- ─────────────────────────────────────────────────────────────────


-- ╔══════════════════════ INSERT (correr antes de la demo) ═══════════╗

INSERT INTO candidatos (
  email, nombre, semana_activa, activo,
  sector, rol, ciudad, objetivo, experiencia, educacion, habilidades,
  carta_presentacion,
  linkedin_titular, linkedin_resumen, linkedin_texto, linkedin_analisis, linkedin_prefs,
  notas_coach, sesiones_registro, fecha_registro
) VALUES (
  'maria.demo@pathway.com',
  'María González',
  3,
  true,
  'Tecnología',
  'Senior Marketing Manager',
  'Madrid',
  'Director de Marketing en una scaleup B2B SaaS. Liderar equipos de growth, demand gen y producto-marketing con foco en mercados internacionales (España + LATAM). Aportar visión estratégica end-to-end y experiencia probada escalando de €5M a €30M ARR.',
  'Senior Marketing Manager · TechFlow SaaS · 2022-Actual · Madrid
- Lideré rediseño de funnel B2B reduciendo CAC en 28% y subiendo conversión MQL→SQL del 12% al 19% en 9 meses.
- Implementé estrategia de account-based marketing con HubSpot + LinkedIn Sales Navigator, generando €1.2M en pipeline cualificado.
- Coordiné equipo de 6 personas (2 demand gen, 2 product marketing, 2 content) con metodología OKR trimestral.

Marketing Manager · Globo Digital · 2019-2022 · Barcelona
- Escalé operación de marketing digital de €5M a €18M ARR en 3 años, liderando expansión a 4 mercados LATAM.
- Diseñé y ejecuté estrategia de SEO técnico que aumentó tráfico orgánico 340% en 18 meses.

Marketing Specialist · Visualizar Inc · 2017-2019 · Madrid
- Gestioné campañas paid (Google Ads, Meta) con presupuesto de €500K/año, ROAS promedio 4.2x.',
  'Master en Marketing Digital · IE Business School · 2017
Licenciatura en Comunicación · Universidad Autónoma de Madrid · 2015',
  'Estrategia de marketing B2B, Demand generation, Account-based marketing, SEO/SEM, Analytics (GA4, HubSpot, Tableau), Liderazgo de equipos, Planificación OKR, Gestión presupuestaria, Inglés C1, Francés B2',
  'Estimado/a equipo de selección,

Me dirijo a ustedes con interés en la posición de Director de Marketing. Con más de 8 años de experiencia liderando estrategias de marketing B2B SaaS — incluyendo mi rol actual escalando TechFlow de €5M a €30M ARR — he desarrollado una visión estratégica end-to-end que combina pensamiento analítico, ejecución operativa y desarrollo de equipos.

A lo largo de mi carrera demostré capacidad para traducir objetivos de negocio en estrategias accionables. En TechFlow lideré el rediseño completo del funnel B2B reduciendo CAC en 28% y subiendo conversión MQL→SQL del 12% al 19% en 9 meses. Implementé también una estrategia ABM que generó €1.2M en pipeline cualificado.

Aporto una combinación diferenciadora: experiencia probada escalando operaciones de marketing en SaaS, dominio técnico de stack moderno (HubSpot, Salesforce, Tableau, GA4), y visión internacional con expansión a 4 mercados LATAM. Mi background combina rigor analítico con sensibilidad creativa para construir narrativas que conviertan.

Quedo a su disposición para profundizar sobre cómo mi experiencia puede contribuir a sus objetivos.

Atentamente,
María González',
  'Senior Marketing Manager · B2B SaaS · Demand Gen + ABM · Lideré rediseño de funnel reduciendo CAC 28%',
  'Marketing leader con 8+ años en B2B SaaS escalando operaciones de €5M a €30M ARR. Especializada en demand generation, account-based marketing y construcción de equipos high-performance. Apasionada por convertir data en decisiones de negocio.

Lo que me diferencia: combino pensamiento estratégico con ejecución técnica hands-on. He liderado expansiones internacionales (España + LATAM), implementado stack completo de marketing automation (HubSpot, Salesforce), y desarrollado equipos de 6+ personas con foco en mentoring y crecimiento profesional.

Buscando rol de Director/a de Marketing en scaleup B2B con foco internacional.',
  'Marketing Manager · TechFlow · Madrid · Lidero estrategia de marketing B2B...',
  '{"score_actual":68,"titular_actual":"Marketing Manager · TechFlow","titular_propuesto":"Senior Marketing Manager · B2B SaaS · Demand Gen + ABM · Lideré rediseño de funnel reduciendo CAC 28%","acerca_de_actual":"Marketing manager con experiencia en B2B.","acerca_de_propuesto":"Marketing leader con 8+ años en B2B SaaS escalando operaciones de €5M a €30M ARR. Especializada en demand generation, account-based marketing y construcción de equipos.","puntos_fuertes":["Experiencia comprobable en B2B SaaS","Mix de habilidades técnicas y de liderazgo","Resultados con números concretos"],"areas_mejora":["Activar opciones #OpenToWork con preferencias","Agregar reseñas de exjefes y compañeros","Subir 1-2 posts mensuales para visibilidad"],"habilidades_sugeridas":["Demand Generation","Account-Based Marketing","Marketing Operations","HubSpot","Salesforce","Growth Marketing","B2B SaaS","Team Leadership"],"experiencia_sugerencias":["En TechFlow agregar el bullet del rediseño de funnel con números específicos","En Globo Digital cuantificar la expansión a LATAM con países y resultados"],"keywords":["B2B SaaS","Demand Generation","ABM","Pipeline","HubSpot","Growth"]}',
  '{"cargo":"Director de Marketing","sector":"Tecnología","ubicacion":"Madrid","modalidad":"Hibrido","tipo":"Tiempo completo","disponibilidad":"En 1 mes"}',
  'Cliente DEMO. Excelente perfil técnico, foco en B2B SaaS. Sesión 1 completada — trabajamos sobre clarificar objetivo (paso de Manager a Director). Próxima sesión: revisar empresas target y preparar mensajes de outreach.',
  '[{"fecha":"2026-04-22","tipo":"sesion_1","titulo":"Sesión 1 — Diagnóstico y objetivo","completada":true,"notas":"Identificamos que el objetivo es director en scaleup B2B SaaS. Tareas: actualizar headline LinkedIn (hecho), redactar mensaje outreach (pendiente)","tareas":[{"texto":"Actualizar headline de LinkedIn con keywords B2B SaaS","done":true},{"texto":"Listar 10 empresas target","done":true},{"texto":"Pulir el resumen Acerca de","done":false}]},{"fecha":"2026-04-29","tipo":"sesion_2","titulo":"Sesión 2 — Estrategia de outreach","completada":false,"notas":"","tareas":[{"texto":"Redactar 3 versiones de mensaje cold outreach","done":false},{"texto":"Lista de hiring managers en empresas target","done":false}]}]',
  NOW() - INTERVAL '14 days'
);

-- Informe IA generado para María
INSERT INTO informes (email, prev, data) VALUES (
  'maria.demo@pathway.com',
  'Marketing leader con 8+ años escalando B2B SaaS. Lista para rol de Director con foco internacional.',
  '{"resumen_ejecutivo":"María González es una marketing leader con 8+ años de experiencia escalando operaciones B2B SaaS. Ha demostrado capacidad para combinar pensamiento estratégico con ejecución técnica hands-on, escalando TechFlow de €5M a €30M ARR. Su perfil es ideal para un rol de Director/a de Marketing en scaleup con foco internacional.","fortalezas":["Experiencia probada escalando ARR (de €5M a €30M)","Mix técnico-estratégico (HubSpot, Salesforce, OKRs)","Liderazgo de equipos multifuncionales","Visión internacional (España + LATAM)"],"areas_desarrollo":["Visibilidad personal en LinkedIn (posts, network)","Casos de uso publicados o conferencias","Networking activo con C-levels de scaleups target"],"plan_accion":[{"semana":1,"focus":"Diagnóstico y marca personal","acciones":["Pulir LinkedIn (headline + Acerca de)","Definir 5 objetivos profesionales SMART","Listar 20 empresas target"]},{"semana":2,"focus":"CV y posicionamiento","acciones":["Redactar CV optimizado para ATS","Cuantificar todos los logros con números","Adaptar carta de presentación al objetivo"]},{"semana":3,"focus":"Networking y outreach","acciones":["Conectar con 30 hiring managers","Mensaje outreach personalizado","Agendar 5 conversaciones informales"]},{"semana":4,"focus":"Aplicación y cierre","acciones":["Aplicar a 10 vacantes target","Preparar entrevistas (STAR + métricas)","Negociación de oferta"]}],"empresas_recomendadas":["Factorial","TravelPerk","Holded","JobAndTalent","Glovo Tech","Cabify","Kuvera"]}'
);

-- CV publicado para María (formato compatible con cv.html)
INSERT INTO cv_publicados (email, codigo, contenido) VALUES (
  'maria.demo@pathway.com',
  'demo123',
  '{"nombre":"María González","rol_objetivo":"Director de Marketing","objetivo":"Marketing leader con 8+ años escalando operaciones B2B SaaS. Especializada en demand generation, ABM y construcción de equipos high-performance.","contacto":{"tel":"+34 612 345 678","email":"maria.demo@pathway.com","ciudad":"Madrid, España","linkedin":"linkedin.com/in/mariademo"},"competencias":["Demand Generation","Account-Based Marketing","Liderazgo","Marketing Operations","Estrategia B2B SaaS"],"herramientas":["HubSpot","Salesforce","Tableau","GA4","LinkedIn Sales Navigator","Notion","Figma"],"idiomas":[{"idioma":"Español","nivel":"Nativo"},{"idioma":"Inglés","nivel":"C1"},{"idioma":"Francés","nivel":"B2"}],"experiencia":[{"titulo":"Senior Marketing Manager","empresa":"TechFlow SaaS","fecha":"2022 — Actual","ubicacion":"Madrid","bullets":["Lideré rediseño de funnel B2B reduciendo CAC en 28% y subiendo conversión MQL→SQL del 12% al 19%","Implementé estrategia de account-based marketing con HubSpot + LinkedIn Sales Navigator, generando €1.2M en pipeline","Coordiné equipo de 6 personas con metodología OKR trimestral","Diseñé scoring de leads que aumentó velocidad de cierre en 35%"]},{"titulo":"Marketing Manager","empresa":"Globo Digital","fecha":"2019 — 2022","ubicacion":"Barcelona","bullets":["Escalé operación de marketing digital de €5M a €18M ARR en 3 años","Lideré expansión a 4 mercados LATAM (México, Colombia, Argentina, Chile)","Diseñé estrategia de SEO técnico que aumentó tráfico orgánico 340%","Construí equipo de 4 personas desde cero"]},{"titulo":"Marketing Specialist","empresa":"Visualizar Inc","fecha":"2017 — 2019","ubicacion":"Madrid","bullets":["Gestioné campañas paid con presupuesto de €500K/año, ROAS 4.2x","Lancé 12 product launches coordinando con equipos de producto y ventas","Implementé attribution model multi-touch en HubSpot"]}],"educacion":[{"titulo":"Master en Marketing Digital","institucion":"IE Business School","fecha":"2017"},{"titulo":"Licenciatura en Comunicación","institucion":"Universidad Autónoma de Madrid","fecha":"2015"}],"cursos":["Account-Based Marketing Certification · HubSpot Academy (2023)","Growth Marketing Bootcamp · Reforge (2022)","Liderazgo de equipos · IE Talent (2021)"]}'
);

-- ╔════════════════ DELETE (correr DESPUÉS de la demo) ════════════════╗

-- DELETE FROM informes WHERE email = 'maria.demo@pathway.com';
-- DELETE FROM cv_publicados WHERE email = 'maria.demo@pathway.com';
-- DELETE FROM candidatos WHERE email = 'maria.demo@pathway.com';
-- DELETE FROM usuarios WHERE email = 'maria.demo@pathway.com';

-- Para ejecutar el delete: descomentá las 4 líneas anteriores y corré.


-- ╔══════════ OPCIONAL: si querés que también pueda ingresar ══════════╗
-- como cliente al portal con una contraseña. SHA-256 hash de "demo1234"
-- ya está pre-computado abajo:
--
-- INSERT INTO usuarios (email, password_hash, rol, nombre, activo) VALUES (
--   'maria.demo@pathway.com',
--   'cd6357efdd966de8c0cb2f876cce98f4e25e9c3c95d0ee4e6f8d2f36dfac20e3',
--   'cliente',
--   'María González',
--   true
-- );
-- Login con: maria.demo@pathway.com / demo1234
