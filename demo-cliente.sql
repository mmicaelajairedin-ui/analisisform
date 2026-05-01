-- ─────────────────────────────────────────────────────────────────
-- DEMO COACH ACCOUNT — para mostrar la plataforma en demos en vivo
-- ─────────────────────────────────────────────────────────────────
-- Crea una cuenta de coach DEMO con 2 clientes ficticios asociados.
-- Te logueás como el coach demo durante la demo y ves SOLO sus clientes —
-- no los tuyos reales (privacidad).
--
-- LOGIN PARA LA DEMO:
--   Email:    demo.coach@pathway.com
--   Password: demo1234
--
-- Cómo usarlo:
-- 1. Abrí Supabase Dashboard → SQL Editor
-- 2. Pegá el bloque INSERT (líneas ~30-200) → click "Run"
-- 3. Andá a https://pathwaycareercoach.com/login.html
-- 4. Login con demo.coach@pathway.com / demo1234 → ves panel con 2 clientes demo
-- 5. Hacé tu demo
-- 6. Cuando termines, corré el bloque DELETE al final
-- ─────────────────────────────────────────────────────────────────


-- ╔══════════════════ ALTER TABLE pre-flight (idempotent) ════════════╗
-- Crear columnas si no existen — no rompe si ya están.

ALTER TABLE candidatos ADD COLUMN IF NOT EXISTS activo BOOLEAN DEFAULT true;
ALTER TABLE candidatos ADD COLUMN IF NOT EXISTS sector TEXT;
ALTER TABLE candidatos ADD COLUMN IF NOT EXISTS rol TEXT;
ALTER TABLE candidatos ADD COLUMN IF NOT EXISTS ciudad TEXT;
ALTER TABLE candidatos ADD COLUMN IF NOT EXISTS objetivo TEXT;
ALTER TABLE candidatos ADD COLUMN IF NOT EXISTS experiencia TEXT;
ALTER TABLE candidatos ADD COLUMN IF NOT EXISTS educacion TEXT;
ALTER TABLE candidatos ADD COLUMN IF NOT EXISTS habilidades TEXT;
ALTER TABLE candidatos ADD COLUMN IF NOT EXISTS carta_presentacion TEXT;
ALTER TABLE candidatos ADD COLUMN IF NOT EXISTS linkedin_titular TEXT;
ALTER TABLE candidatos ADD COLUMN IF NOT EXISTS linkedin_resumen TEXT;
ALTER TABLE candidatos ADD COLUMN IF NOT EXISTS linkedin_texto TEXT;
ALTER TABLE candidatos ADD COLUMN IF NOT EXISTS linkedin_analisis TEXT;
ALTER TABLE candidatos ADD COLUMN IF NOT EXISTS linkedin_prefs TEXT;
ALTER TABLE candidatos ADD COLUMN IF NOT EXISTS notas_coach TEXT;
ALTER TABLE candidatos ADD COLUMN IF NOT EXISTS sesiones_registro TEXT;
ALTER TABLE candidatos ADD COLUMN IF NOT EXISTS foto_perfil TEXT;


-- ╔══════════════════════ INSERT (correr antes de la demo) ═══════════╗

-- 1) Coach DEMO en tabla usuarios
-- ON CONFLICT: si ya existe el email, no crashea (idempotent)
INSERT INTO usuarios (email, password_hash, rol, nombre, activo)
VALUES (
  'demo.coach@pathway.com',
  '0ead2060b65992dca4769af601a1b3a35ef38cfad2c2c465bb160ea764157c5d', -- SHA-256 de 'demo1234'
  'coach',
  'Coach Demo',
  true
)
ON CONFLICT (email) DO NOTHING;

-- 2) Cliente demo #1: María González (perfil completo, semana 3)
-- coach_id se obtiene via subquery del coach demo recién insertado
INSERT INTO candidatos (
  email, nombre, semana_activa, coach_id,
  sector, rol, ciudad, objetivo, experiencia, educacion, habilidades,
  carta_presentacion,
  linkedin_titular, linkedin_resumen, linkedin_texto, linkedin_analisis, linkedin_prefs,
  notas_coach, sesiones_registro, created_at
) VALUES (
  'maria.demo@pathway.com',
  'María González',
  3,
  (SELECT id FROM usuarios WHERE email = 'demo.coach@pathway.com'),
  'Tecnología',
  'Senior Marketing Manager',
  'Madrid',
  'Director de Marketing en una scaleup B2B SaaS. Liderar equipos de growth, demand gen y producto-marketing.',
  'Senior Marketing Manager · TechFlow · 2022-Actual · Madrid. Lideré rediseño funnel B2B reduciendo CAC 28%. Implementé ABM con HubSpot generando €1.2M pipeline. Coordiné equipo de 6 personas con metodología OKR.',
  'Master en Marketing Digital · IE Business School · 2017. Licenciatura en Comunicación · UAM · 2015',
  'Demand generation, ABM, SEO/SEM, HubSpot, Salesforce, Liderazgo de equipos, OKRs, Inglés C1, Francés B2',
  'Estimado/a equipo de selección, me dirijo con interés en la posición de Director de Marketing. Con 8+ años en B2B SaaS escalando TechFlow de €5M a €30M ARR, he desarrollado una visión estratégica end-to-end. En TechFlow lideré el rediseño completo del funnel B2B reduciendo CAC en 28%. Atentamente, María González.',
  'Senior Marketing Manager · B2B SaaS · Demand Gen + ABM · Lideré rediseño de funnel reduciendo CAC 28%',
  'Marketing leader con 8+ años en B2B SaaS escalando operaciones de €5M a €30M ARR. Especializada en demand generation, account-based marketing y construcción de equipos high-performance. Buscando rol de Director/a de Marketing en scaleup B2B con foco internacional.',
  'Marketing Manager · TechFlow · Madrid · Lidero estrategia de marketing B2B...',
  '{"score_actual":68,"titular_actual":"Marketing Manager · TechFlow","titular_propuesto":"Senior Marketing Manager · B2B SaaS · Demand Gen + ABM · Lideré rediseño de funnel reduciendo CAC 28%","acerca_de_actual":"Marketing manager con experiencia en B2B.","acerca_de_propuesto":"Marketing leader con 8+ años en B2B SaaS escalando operaciones de €5M a €30M ARR. Especializada en demand generation y ABM.","puntos_fuertes":["Experiencia comprobable en B2B SaaS","Mix de habilidades técnicas y de liderazgo","Resultados con números concretos"],"areas_mejora":["Activar #OpenToWork con preferencias","Subir 1-2 posts mensuales para visibilidad","Pedir reseñas de exjefes y compañeros"],"habilidades_sugeridas":["Demand Generation","Account-Based Marketing","Marketing Operations","HubSpot","Salesforce","Growth Marketing","B2B SaaS","Team Leadership"],"experiencia_sugerencias":["En TechFlow agregar el bullet del rediseño de funnel con números específicos","En Globo Digital cuantificar la expansión a LATAM con países y resultados"],"keywords":["B2B SaaS","Demand Generation","ABM","Pipeline","HubSpot","Growth"]}',
  '{"cargo":"Director de Marketing","sector":"Tecnología","ubicacion":"Madrid","modalidad":"Hibrido","tipo":"Tiempo completo","disponibilidad":"En 1 mes"}',
  'Cliente DEMO. Excelente perfil técnico, foco en B2B SaaS. Sesión 1 completada — trabajamos sobre clarificar objetivo (paso de Manager a Director). Próxima sesión: revisar empresas target.',
  '[{"fecha":"2026-04-22","tipo":"sesion_1","titulo":"Sesión 1 — Diagnóstico y objetivo","completada":true,"notas":"Identificamos que el objetivo es director en scaleup B2B SaaS","tareas":[{"texto":"Actualizar headline LinkedIn","done":true},{"texto":"Listar 10 empresas target","done":true},{"texto":"Pulir el resumen Acerca de","done":false}]},{"fecha":"2026-04-29","tipo":"sesion_2","titulo":"Sesión 2 — Estrategia de outreach","completada":false,"notas":"","tareas":[{"texto":"Redactar 3 versiones de mensaje cold outreach","done":false}]}]',
  NOW() - INTERVAL '14 days'
);

-- 3) Cliente demo #2: Carlos Pérez (semana 1, recién empieza, perfil más simple)
INSERT INTO candidatos (
  email, nombre, semana_activa, coach_id,
  sector, rol, ciudad, objetivo,
  notas_coach, created_at
) VALUES (
  'carlos.demo@pathway.com',
  'Carlos Pérez',
  1,
  (SELECT id FROM usuarios WHERE email = 'demo.coach@pathway.com'),
  'Producto',
  'Product Manager',
  'Barcelona',
  'Product Lead en startup tech con foco B2C',
  'Cliente DEMO. Empezó hace 2 días. Falta diagnóstico inicial — agendar primera sesión esta semana.',
  NOW() - INTERVAL '2 days'
);


-- ╔════════════════ DELETE (correr DESPUÉS de la demo) ════════════════╗
-- Descomentá las 4 líneas y corré para limpiar todo.

-- DELETE FROM candidatos WHERE email IN ('maria.demo@pathway.com','carlos.demo@pathway.com');
-- DELETE FROM usuarios WHERE email = 'demo.coach@pathway.com';
