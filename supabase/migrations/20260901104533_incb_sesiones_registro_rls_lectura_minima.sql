-- INC-B — `sesiones_registro` recupera lectura, con el minimo privilegio posible.
--
-- QUE PASO (la regresion, medida, no supuesta)
-- `20260827130248_f2_3_cierre_sesiones_registro` hizo dos cosas correctas
-- (revocar escrituras a anon/authenticated y encender RLS) y una equivocada:
-- no dejo NINGUNA policy, con este razonamiento textual en su cabecera:
--
--     "Ninguna edge function ni pantalla la lee."
--
-- Eso era falso. La auditoria de INC-B encontro TRES lectores:
--
--   1. `supabase/functions/dashboard/index.ts:107-113`  ← EL AFECTADO
--      Construye su cliente con SUPABASE_ANON_KEY + el Authorization del
--      llamante (index.ts:363-370), asi que consulta como `authenticated`,
--      NO como service_role. La RLS SI le aplica.
--   2. `supabase/functions/fetch-coach-detail/index.ts:104`  ← no afectado
--   3. `supabase/functions/coach-metrics-daily/index.ts:109` ← no afectado
--      Las dos usan SUPABASE_SERVICE_ROLE_KEY: la RLS no les aplica.
--
-- El fallo fue SILENCIOSO porque el GRANT de SELECT a `authenticated` seguia
-- vivo. Con GRANT presente y 0 policies, PostgREST no devuelve 403: devuelve
-- 200 con `[]`. Por eso `if (todayError) throw todayError` (index.ts:113) nunca
-- se disparo, y `processTodayStats(todayStats || [])` (index.ts:184) calculo
-- tranquilamente 0 sesiones, 0 canceladas y completion_rate 0. El dashboard no
-- se rompio: mintio.
--
-- MEDIDO ANTES DEL CAMBIO (impersonando identidades reales)
--   owner  bot-coach@pathwaycareercoach.com (org c5a3c407) →  0 de 14 filas
--   coach  bot-gym@pathwaycareercoach.com   (org c5a3c407) →  0 de  8 propias
--   owner  gus@axonimpact.com               (otra org)     →  0
--   anon                                                   →  0
--
-- QUIEN DEBE PODER LEER, Y POR QUE NO VALE `USING (true)`
-- La tabla guarda `titulo`, `descripcion`, `participantes` y `metadata` de
-- sesiones con clientes: son notas de sesion, no un contador. Abrirla entera a
-- `authenticated` dejaria a cualquier coach de cualquier organizacion leer las
-- notas de los clientes de los demas. Se acota a dos accesos, ambos con
-- consumidor demostrado:
--
--   a) el coach que impartio la sesion  → sus propias filas;
--   b) el owner/admin de la organizacion duena de la fila → las de SU org.
--
-- No se anade acceso para el cliente: los portales (`cliente.html`,
-- `pathway-fit-cliente.html`) NO leen esta tabla — leen la columna TEXT del
-- mismo nombre en `candidatos`, que es otra cosa. Sin consumidor, no hay policy.
--
-- POR QUE NO SE COPIA `rls_citas_coach_network` TAL CUAL
-- Se compararon las columnas antes de reutilizar el patron:
--   org_id    → uuid en citas, agenda_bloques Y sesiones_registro  ✔ equivalente
--   coach_id  → TEXT en citas y agenda_bloques, UUID aqui          ✘ NO equivalente
-- Por eso la mitad de organizacion replica `agenda_bloques_owner_org`, y la del
-- coach compara `coach_id = pw_coach_id()` SIN el `::text` que llevan las otras.
-- Copiado literal, el cast habria fallado o forzado una comparacion textual.
--
-- POR QUE UNA FUNCION AUXILIAR NUEVA (`pw_org_admin_id`)
-- `agenda_bloques_owner_org` resuelve la organizacion con un subselect a
-- `usuarios`, que dentro de la policy se ejecuta CON la RLS del llamante: hoy
-- funciona porque existe `user_self_select`, pero si esa policy se endurece, la
-- de aqui se vuelve a vaciar en silencio — exactamente el fallo que INC-B esta
-- cerrando. `pw_org_admin_id()` es SECURITY DEFINER con `search_path` fijado,
-- igual que `pw_coach_id()` y `pw_is_admin()`, y no depende de la RLS de
-- `usuarios`. Devuelve la organizacion SOLO si quien pregunta es owner/admin de
-- ella; para cualquier otro devuelve NULL, y `org_id = NULL` es NULL (falso).
--
-- ALCANCE DELIBERADO: un coach raso NO ve las sesiones del resto de su
-- organizacion. Es coherente con `rls_citas_coach_network`, donde un coach
-- tampoco ve las citas individuales de sus companeros. Consecuencia asumida y
-- documentada: si un coach abre el dashboard de red, el KPI "sesiones hoy" solo
-- cuenta las suyas; para el owner/admin, que es quien mira ese panel, es
-- completo.
--
-- Se revoca ademas el SELECT de `anon`: no le queda ningun consumidor
-- (`pw-scheduler.js` solo escribe, y ademas vive tras `USE_NEW_SCHEDULER=false`
-- en panel-v2.html:1453) y asi la tabla no puede volver a abrirse a anonimos
-- por una policy futura que se escriba `TO public` por descuido.
--
-- No se restauran INSERT/UPDATE/DELETE a anon/authenticated: los escritores
-- vivos son edge functions con service_role. Fuera de alcance de INC-B.
--
-- ROLLBACK
--   DROP POLICY IF EXISTS sesiones_registro_coach_select ON public.sesiones_registro;
--   DROP POLICY IF EXISTS sesiones_registro_org_admin_select ON public.sesiones_registro;
--   DROP FUNCTION IF EXISTS public.pw_org_admin_id();
--   GRANT SELECT ON public.sesiones_registro TO anon;

CREATE OR REPLACE FUNCTION public.pw_org_admin_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT u.org_id
    FROM usuarios u
   WHERE u.auth_id = auth.uid()
     AND u.rol IN ('owner','admin')
     AND u.org_id IS NOT NULL
   LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.pw_org_admin_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pw_org_admin_id() TO authenticated;

DROP POLICY IF EXISTS sesiones_registro_coach_select ON public.sesiones_registro;
CREATE POLICY sesiones_registro_coach_select
  ON public.sesiones_registro
  FOR SELECT
  TO authenticated
  USING (coach_id = public.pw_coach_id());

DROP POLICY IF EXISTS sesiones_registro_org_admin_select ON public.sesiones_registro;
CREATE POLICY sesiones_registro_org_admin_select
  ON public.sesiones_registro
  FOR SELECT
  TO authenticated
  USING (org_id = public.pw_org_admin_id());

REVOKE SELECT ON public.sesiones_registro FROM anon;
