-- Anti doble-booking a nivel BASE de datos.
--
-- El panel/reserva ya re-chequean el hueco antes de confirmar, pero queda una
-- ventana de carrera (TOCTOU): dos personas confirmando el MISMO coach a la MISMA
-- hora en el mismo segundo pueden insertar las dos filas. Este índice único parcial
-- lo cierra de raíz: una sola cita activa por (coach_id, inicio).
--
-- Excluye las canceladas: una hora que se liberó (cita cancelada) puede volver a
-- reservarse sin chocar con el registro viejo.
--
-- Aditivo y seguro. Si hubiera duplicados históricos ACTIVOS en la misma hora, el
-- CREATE UNIQUE INDEX fallará; en ese caso, cancelar/eliminar los duplicados y
-- volver a aplicar esta migración.
CREATE UNIQUE INDEX IF NOT EXISTS citas_no_doble_booking
  ON citas (coach_id, inicio)
  WHERE estado IS DISTINCT FROM 'cancelada';
