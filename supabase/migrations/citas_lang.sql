-- Idioma del cliente en la reserva (es/en). Lo guarda reservar.html al reservar,
-- para que el RECORDATORIO automático (edge function recordatorios-citas, que se
-- manda del lado servidor 24 h / 1 h antes) salga en el MISMO idioma que vio el
-- cliente al reservar. Si esta columna no existe, la reserva igual se guarda (el
-- POST reintenta sin 'lang') y el recordatorio cae a español por defecto.
-- Correr UNA vez en el SQL editor de Supabase.
ALTER TABLE citas ADD COLUMN IF NOT EXISTS lang TEXT;
