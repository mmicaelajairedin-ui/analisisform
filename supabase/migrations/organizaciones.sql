-- ═══════════════════════════════════════════════════════════════════════
-- MULTI-COACH — la "empresa/red" como entidad (columna vertebral)
-- ═══════════════════════════════════════════════════════════════════════
-- Modelo de 3 niveles (como una franquicia):
--   1. Pathway (vos)  → das de alta una organización y su DUEÑO (multicoach).
--   2. Dueño de la red (owner) → maneja SUS coaches, asigna clientes a cada
--      coach, y lleva la comunidad/recursos/clases de la empresa.
--   3. Coach de la red → ve e interactúa con los clientes que le asignaron,
--      agrega SUS propios recursos, pero NO agrega clientes.
--
-- Todo cuelga de `org_id`, EXACTAMENTE como hoy todo cuelga de `coach_id`.
-- Un coach o cliente SIN org_id = modelo normal (coach individual): no cambia
-- nada para ellos. Por eso esta migración es 100% aditiva y segura.

-- ── La organización (red / empresa) ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS organizaciones (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre       TEXT NOT NULL,               -- nombre de la red/empresa
  owner_email  TEXT NOT NULL,               -- el multicoach (dueño de la red)
  plan         TEXT DEFAULT 'prueba',       -- prueba | red | red_pro (el tipo de multicoach)
  nicho        TEXT,                         -- fitness | carrera | finanzas | multi
  marca        JSONB DEFAULT '{}'::jsonb,    -- white-label (logo, color) del owner
  -- ── Límites del plan (cuántos coaches / clientes puede tener) ──────────
  -- NULL = ilimitado (plan grande). El multicoach.html avisa y bloquea el
  -- alta cuando la red llega al tope (ej: "llegaste a tus 3 coaches").
  max_coaches  INT,                          -- tope de coaches (NULL = ilimitado)
  max_clientes INT,                          -- tope de clientes (NULL = ilimitado)
  -- ── Prueba / pago (misma lógica que el trial de 14 días de los coaches) ─
  estado_sub       TEXT DEFAULT 'prueba',    -- prueba | activa | vencida | inactiva
  fecha_fin_prueba DATE,                     -- cuándo se le vence la prueba
  activo       BOOLEAN DEFAULT true,
  created_at   TIMESTAMPTZ DEFAULT now()
);

COMMENT ON COLUMN organizaciones.plan IS
  'El tipo de multicoach. Ej: prueba (14 días, ~3 coaches/15 clientes) | red (~8 coaches/100 clientes) | red_pro (ilimitado + white-label). Los números viven en max_coaches/max_clientes; el precio es externo (Stripe). Vos lo setéas al dar de alta.';
COMMENT ON COLUMN organizaciones.estado_sub IS
  'prueba mientras está en los 14 días; activa cuando pagó; vencida/inactiva si no renovó. Igual que el ciclo de vida del coach individual.';

-- ── El coach pertenece a una organización (NULL = coach individual normal) ─
ALTER TABLE usuarios   ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizaciones(id);

-- ── El cliente pertenece a una organización (NULL = cliente normal) ───────
-- Ya tiene coach_id = el coach ASIGNADO dentro de esa red. org_id = de qué
-- empresa es. Un cliente "de empresa" no es igual al normal: además de su
-- coach, ve la comunidad de la empresa (revista/avisos/clases) en su portal.
ALTER TABLE candidatos ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizaciones(id);

-- ── Índices para las consultas del dueño (filtra su red por org_id) ──────
CREATE INDEX IF NOT EXISTS idx_usuarios_org   ON usuarios(org_id);
CREATE INDEX IF NOT EXISTS idx_candidatos_org ON candidatos(org_id);

-- ── El rol del dueño ─────────────────────────────────────────────────────
-- El dueño de la red es un `usuarios` con rol='owner' y org_id = su propia
-- organización. Los coaches de su red son rol='coach' con el mismo org_id.
-- (No hace falta migrar nada: los coaches individuales de hoy quedan con
--  org_id NULL y siguen igual.)

-- ── RLS (defensa en profundidad) ─────────────────────────────────────────
-- NOTA: igual que con coach_id, la primera capa es el filtro en el frontend
-- (el multicoach.html consulta SOLO su org_id). El RLS estricto por org_id
-- se activa junto con el resto del hardening RLS (ver "SECURITY MODEL" en
-- CLAUDE.md, Capa 3 — pendiente). Cuando se cierre ese gap, agregar acá:
--   USING (org_id = (SELECT org_id FROM usuarios WHERE auth_id = auth.uid()))
-- para que el dueño lea SOLO los clientes/coaches de su red.
