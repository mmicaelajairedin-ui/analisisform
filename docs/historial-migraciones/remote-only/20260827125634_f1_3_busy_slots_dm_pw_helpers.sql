-- F1.3 — Mismo defecto que F1.1 en dos tablas VACIAS (0 filas ambas):
-- coach_busy_slots y mensajes_dm comparaban auth.uid() contra usuarios.id / FKs
-- hacia ella. Se corrige para que no sea una trampa para el proximo que las use.
-- Riesgo nulo por volumen; su prueba es una insercion en transaccion revertida.

ALTER POLICY coach_busy_slots_read ON public.coach_busy_slots
  USING ((pw_coach_id() = coach_id) OR pw_is_admin());

ALTER POLICY coach_busy_slots_write ON public.coach_busy_slots
  WITH CHECK (pw_is_admin());

ALTER POLICY coach_busy_slots_update ON public.coach_busy_slots
  USING (pw_is_admin());

ALTER POLICY "DM: leer propios" ON public.mensajes_dm
  USING ((pw_coach_id() = de_id) OR (pw_coach_id() = para_id));

ALTER POLICY "DM: escribir propios" ON public.mensajes_dm
  WITH CHECK (pw_coach_id() = de_id);