-- Puntos del juego de la cabra + medalla por coach, para el ranking en Admin.
-- Cada coach escribe SU propia fila (game_pts = mejor puntaje, game_medal = nivel
-- de medalla 0..3 por hitos de arranque). El admin lee todas para el ranking.
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS game_pts   INT DEFAULT 0;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS game_medal INT DEFAULT 0;
