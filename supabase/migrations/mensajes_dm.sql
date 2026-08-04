-- DMs (Direct Messages) entre coaches de una red
CREATE TABLE IF NOT EXISTS public.mensajes_dm (
  id BIGSERIAL PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES public.organizaciones(id) ON DELETE CASCADE,
  de_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  para_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  cuerpo TEXT NOT NULL,
  creado_at TIMESTAMPTZ DEFAULT now(),
  leido_at TIMESTAMPTZ,
  CONSTRAINT dm_order CHECK (de_id < para_id OR de_id > para_id)
);

-- Índices para queries eficientes
CREATE INDEX IF NOT EXISTS idx_mensajes_dm_org_id ON public.mensajes_dm(org_id);
CREATE INDEX IF NOT EXISTS idx_mensajes_dm_coaches ON public.mensajes_dm(org_id, de_id, para_id);
CREATE INDEX IF NOT EXISTS idx_mensajes_dm_creado ON public.mensajes_dm(creado_at DESC);

-- RLS: cada coach puede leer/escribir solo sus DMs
ALTER TABLE public.mensajes_dm ENABLE ROW LEVEL SECURITY;

CREATE POLICY "DM: leer propios" ON public.mensajes_dm
  FOR SELECT USING (
    auth.uid() = de_id OR auth.uid() = para_id
  );

CREATE POLICY "DM: escribir propios" ON public.mensajes_dm
  FOR INSERT WITH CHECK (
    auth.uid() = de_id
  );

-- Vista de DMs abiertos: últimos mensajes + contador
CREATE OR REPLACE VIEW public.v_coach_dms AS
SELECT
  m.org_id,
  CASE WHEN m.de_id = auth.uid() THEN m.para_id ELSE m.de_id END as with_id,
  MAX(m.creado_at) as ultimo_at,
  COUNT(*) FILTER (WHERE m.leido_at IS NULL AND m.para_id = auth.uid()) as sin_leer
FROM public.mensajes_dm m
WHERE m.de_id = auth.uid() OR m.para_id = auth.uid()
GROUP BY m.org_id, with_id
ORDER BY MAX(m.creado_at) DESC;

-- Function para listar DMs de un coach (llamada por el edge function)
CREATE OR REPLACE FUNCTION public.get_coach_dms(p_coach_id UUID, p_org_id UUID)
RETURNS TABLE(with_id UUID, nombre TEXT, ultimo_at TIMESTAMPTZ)
LANGUAGE sql
SECURITY DEFINER
AS $$
SELECT
  CASE WHEN m.de_id = p_coach_id THEN m.para_id ELSE m.de_id END as with_id,
  COALESCE(u.nombre, 'Coach') as nombre,
  MAX(m.creado_at) as ultimo_at
FROM public.mensajes_dm m
LEFT JOIN public.usuarios u ON u.id = (CASE WHEN m.de_id = p_coach_id THEN m.para_id ELSE m.de_id END)
WHERE m.org_id = p_org_id AND (m.de_id = p_coach_id OR m.para_id = p_coach_id)
GROUP BY with_id, u.nombre
ORDER BY MAX(m.creado_at) DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_coach_dms TO authenticated, anon;
