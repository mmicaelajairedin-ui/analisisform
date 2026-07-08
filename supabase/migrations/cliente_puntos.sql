-- Puntos/medalla del CLIENTE, para que coach y cliente vean la MISMA medalla.
-- Antes: el cliente calculaba la medalla por PUNTOS (logros*100 + bonus del
-- juego) y el coach la calculaba por semana_activa → medallas distintas para la
-- misma persona. Ahora el cliente persiste su total y el coach lo lee.
--
--   puntos    = total del cliente (logros*100 + bonus del juego, tope bonus 150).
--               Fuente única: la calcula el cliente en su portal y la guarda acá.
--   game_pts  = mejor puntaje del juego "La cabra a la cima" del cliente. Se
--               persiste para que el bonus NO se pierda al cambiar de dispositivo
--               (antes vivía solo en localStorage). Nunca baja.
--
-- Idempotente: se puede correr varias veces sin romper.
ALTER TABLE candidatos ADD COLUMN IF NOT EXISTS puntos   INT DEFAULT 0;
ALTER TABLE candidatos ADD COLUMN IF NOT EXISTS game_pts INT DEFAULT 0;
