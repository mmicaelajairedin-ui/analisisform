-- Atribución de la reserva: "¿Cómo me encontraste?" (Instagram, LinkedIn,
-- Búsqueda en Google, TikTok, YouTube, Recomendación, Otro). Lo elige quien
-- reserva en reservar.html y el coach lo ve en su calendario (panel-v2) para
-- saber qué canal le trae reservas. Opcional (puede quedar vacío).
ALTER TABLE citas ADD COLUMN IF NOT EXISTS origen text;
