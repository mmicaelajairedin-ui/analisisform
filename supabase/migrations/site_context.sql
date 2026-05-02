-- Tabla site_context: contexto que el coach configura sobre cada sitio
-- (objetivo, paginas clave, conversiones, audiencia). El agente
-- analytics-weekly lee esta tabla cada lunes y la inyecta en el prompt
-- de Claude para que las hipotesis y acciones sean especificas.

CREATE TABLE IF NOT EXISTS site_context (
  zone               TEXT PRIMARY KEY,    -- 'micaelajairedin.com' | 'pathwaycareercoach.com'
  display_name       TEXT,                -- Nombre amigable ('Pathway', 'Micaela')
  objetivo_principal TEXT,                -- "Que un coach se registre y haga onboarding"
  audiencia          TEXT,                -- "Coaches independientes hispanohablantes 30-50 años"
  paginas_clave      JSONB,               -- [{url:'/registro.html', proposito:'Registro coach', conversion:true}]
  conversiones       JSONB,               -- [{cta:'Comenzar prueba', donde:'/index.html', valor:'critico'}]
  notas              TEXT,                -- Texto libre adicional
  updated_at         TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE site_context ENABLE ROW LEVEL SECURITY;

-- Lectura: cualquier rol authenticated (mismo patron que Leads en panel.html).
-- La proteccion es a nivel UI: solo se muestra si ME.rol === 'admin'.
DROP POLICY IF EXISTS "anon read site_context" ON site_context;
CREATE POLICY "anon read site_context"
  ON site_context FOR SELECT USING (true);

DROP POLICY IF EXISTS "anon write site_context" ON site_context;
CREATE POLICY "anon write site_context"
  ON site_context FOR ALL USING (true) WITH CHECK (true);

-- ── Update RLS de analytics_reports para que el panel pueda leer ──
-- Sigue el mismo patron que site_context: lectura abierta, gateada en UI.
DROP POLICY IF EXISTS "anon read analytics_reports" ON analytics_reports;
CREATE POLICY "anon read analytics_reports"
  ON analytics_reports FOR SELECT USING (true);

-- ── Seed inicial (Micaela puede editarlo despues desde el panel) ──
INSERT INTO site_context (zone, display_name, objetivo_principal, audiencia, paginas_clave, conversiones, notas)
VALUES
  ('pathwaycareercoach.com', 'Pathway', 'Registrar coaches profesionales y que activen su trial.',
   'Coaches independientes de carrera, hispanohablantes, 30-55 años, en LatAm y España.',
   '[{"url":"/index.html","proposito":"Landing principal"},{"url":"/registro.html","proposito":"Registro de coach","conversion":true},{"url":"/soy-coach.html","proposito":"Pricing y propuesta de valor"},{"url":"/cv-express.html","proposito":"Pack express (compra puntual)","conversion":true}]'::jsonb,
   '[{"cta":"Empezar prueba gratis","donde":"/soy-coach.html","valor":"critico"},{"cta":"Comprar Pack Express","donde":"/cv-express.html","valor":"alto"}]'::jsonb,
   'Plataforma SaaS con 5 productos. El producto estrella es el acceso a un coach. Tambien venden Pack CV Express, plantillas, etc.'),
  ('micaelajairedin.com', 'Micaela', 'Captar leads cualificados para mentoria 1-a-1 con Micaela.',
   'Profesionales en transicion de carrera, 28-45 años, hispanohablantes, dispuestos a invertir en mentoria personal.',
   '[{"url":"/","proposito":"Landing personal de Micaela como coach"},{"url":"/contacto","proposito":"Form de contacto","conversion":true}]'::jsonb,
   '[{"cta":"Agendar llamada exploratoria","donde":"/","valor":"critico"}]'::jsonb,
   'Web personal de Micaela como coach individual. NO es Pathway. Las estrategias son distintas: aca el objetivo es atraer 5-10 clientes/mes para mentoria personal, no escalar.')
ON CONFLICT (zone) DO NOTHING;
