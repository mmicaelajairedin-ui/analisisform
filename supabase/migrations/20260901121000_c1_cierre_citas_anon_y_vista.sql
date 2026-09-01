-- C-1 + V-2 · se cierra la lectura y la escritura anonimas de `citas`, y la
-- ventana lateral que las rodeaba.
--
-- LO QUE ESTABA ABIERTO
--   citas_anon_select  FOR SELECT TO anon USING (true)
--   citas_anon_insert  FOR INSERT TO anon WITH CHECK (true)
--   GRANT SELECT, INSERT ON citas TO anon
-- Medido justo antes de este cierre: `anon` leia las 66 filas — 8 coaches, 2
-- organizaciones, 66 emails, 60 telefonos, 9 notas de llamada y 65 tokens de
-- gestion, que son los que dan acceso a cancelar, reprogramar y entrar a la Sala.
--
-- POR QUE SE PUEDE CERRAR AHORA (evidencia, no confianza)
-- 1. Los 7 consumidores anonimos estan migrados a RPC acotadas en `main`
--    (`pw_franjas_ocupadas`, `get_proxima_cita`, `pw_sala_coach`,
--    `pw_cita_meet_link`), verificado sobre el arbol de la rama principal.
-- 2. El INSERT directo desaparecio: `reservar.html` da de alta por `crear_cita`.
-- 3. EL DEPLOY ESTA VIVO. En los edge logs de las ultimas 24 h hay 17 llamadas a
--    /rest/v1/rpc/get_proxima_cita y 1 a /rest/v1/rpc/pw_franjas_ocupadas: el
--    frontend nuevo se esta usando de verdad.
-- 4. El trafico que quedaba contra /rest/v1/citas NO es anonimo:
--      · 93 GET desde `Deno/SupabaseEdgeRuntime` con apikey `sb_secret_...`
--        (service_role: ignora RLS, no le afecta este cierre) — es `mi-red`;
--      · 31 GET con rol `authenticated` (el panel del coach, cubierto por
--        `rls_citas_coach_network`);
--      · 16 OPTIONS de preflight CORS, sin apikey.
--    Con rol `anon` REAL solo hubo 1 peticion, el 31-ago 11:28, con el patron
--    viejo de `_loadNextCita` (navegador con JS cacheado). Ninguna desde entonces.
-- 5. Cero POST a /rest/v1/citas en la ventana de 24 h.
--
-- V-2 · POR QUE LA VISTA VA EN LA MISMA MIGRACION
-- `citas_sin_organizacion` es una vista SECURITY DEFINER (dueno `postgres`, sin
-- `reloptions`), asi que corre como su dueno y RODEA la RLS de `citas`. Cerrar
-- las dos policies sin tocarla dejaria a `anon` leyendo igualmente `id`,
-- `inicio`, `estado` y `coach_id` de 6 citas: seria cerrar la puerta y dejar la
-- ventana. No tiene NI UN consumidor en el repositorio (0 coincidencias) ni
-- trafico en los edge logs, asi que se le retira el SELECT a `anon` y se deja
-- intacta para `authenticated`, que es quien la usaria desde el panel.
--
-- LO QUE NO SE TOCA, A PROPOSITO
-- · Los GRANT de UPDATE y DELETE de `anon` sobre `citas` se DEJAN. Hoy la RLS ya
--   los deniega (no hay ninguna policy de UPDATE/DELETE para `anon`), asi que no
--   anaden exposicion. Revocarlos cambiaria el modo de fallo de los PATCH que
--   siguen vivos en `reservar.html:1114` y `sala.html:1123` — de "200 con []" a
--   "403" — y esa superficie es C-4, que es de F3. Se recomienda que lo haga F3
--   al cerrar C-4, no este cierre.
-- · `authenticated` conserva todos sus privilegios: el panel del coach lee por
--   `rls_citas_coach_network` y `rls_citas_owner_select`, sin cambios.
-- · Las edge functions con service_role no se ven afectadas por la RLS.
--
-- ROLLBACK (solo si algo se rompiera de verdad; reabre la fuga)
--   CREATE POLICY citas_anon_select ON public.citas FOR SELECT TO anon USING (true);
--   CREATE POLICY citas_anon_insert ON public.citas FOR INSERT TO anon WITH CHECK (true);
--   GRANT SELECT, INSERT ON public.citas TO anon;
--   GRANT SELECT ON public.citas_sin_organizacion TO anon;

DROP POLICY IF EXISTS citas_anon_select ON public.citas;
DROP POLICY IF EXISTS citas_anon_insert ON public.citas;

REVOKE SELECT, INSERT ON public.citas FROM anon;

REVOKE SELECT ON public.citas_sin_organizacion FROM anon;
