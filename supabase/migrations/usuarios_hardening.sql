-- ============================================================================
-- Fase 5 — Endurecimiento de usuarios (cierra el agujero de takeover)
-- ============================================================================
-- PROBLEMA QUE CIERRA:
--   • "Permitir actualizar usuarios" (anon, USING true) → con la anon key pública
--     cualquiera podía  PATCH usuarios  y cambiar la contraseña de otro o ponerse
--     rol=admin. = account takeover / escalada de privilegios. (CRÍTICO)
--   • "permitir_login" / "Permitir leer usuarios" (SELECT true) → anon podía leer
--     TODAS las filas (emails/nombres de todos, incluidos clientes). (privacidad)
--
-- ENFOQUE: NO se puede prender un RLS cerrado a secas porque usuarios alimenta el
--   directorio público, el intake, el registro y el login. Reemplazamos las
--   políticas "abiertas" por políticas ACOTADAS por identidad/rol, conservando
--   las dos buenas que ya existen (usuario_ve_solo_su_fila, coach_ve_todo).
--
-- ⚠️ ROLLOUT (igual de estricto que la Fase 3 — PROBAR EN VIVO cada flujo):
--   Esta migración va de la mano con cambios de frontend YA hechos en la rama:
--     · login.html      → lee/escribe su fila con el JWT (no anon)
--     · formulario.html → intake con ignore-duplicates (no UPDATE anónimo)
--     · registro.html   → no lee password_hash (Fase 4)
--   ORDEN: 1) deploy del frontend  2) verificar login/registro/intake/panel con
--   las políticas viejas todavía activas  3) correr ESTE archivo  4) RE-verificar
--   los MISMOS flujos  5) si algo falla → ROLLBACK (al final).
--   Flujos a probar sí o sí: login coach, login cliente, activar coach invitado,
--   alta por formulario, crear/!ver acceso de cliente desde el panel, directorio
--   público de coaches.
-- ============================================================================

-- ── Helper: ¿el cliente (por email) pertenece al coach logueado? ──
-- SECURITY DEFINER para no chocar con la RLS de candidatos dentro de la policy.
CREATE OR REPLACE FUNCTION public.pw_coach_owns_email(p_email text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM candidatos c
    WHERE lower(c.email) = lower(p_email)
      AND c.coach_id = public.pw_coach_id()
  )
$$;
GRANT EXECUTE ON FUNCTION public.pw_coach_owns_email(text) TO authenticated;

-- ── 0) ENCENDER RLS en usuarios (el interruptor maestro) ─────────────────────
-- Sin esto, las políticas de abajo quedan DORMIDAS y anon sigue leyendo todo.
-- (Las tablas candidatos/informes/cv_publicados ya lo tenían; usuarios no.)
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;

-- ── 1) Borrar las políticas ABIERTAS ────────────────────────────────────────
DROP POLICY IF EXISTS "permitir_login"               ON usuarios;  -- SELECT true
DROP POLICY IF EXISTS "Permitir leer usuarios"        ON usuarios;  -- SELECT true (anon)
DROP POLICY IF EXISTS "Permitir actualizar usuarios"  ON usuarios;  -- UPDATE true (anon) ← takeover
DROP POLICY IF EXISTS "Permitir insertar usuarios"    ON usuarios;  -- INSERT (anon) sin restricción

-- (Se CONSERVAN: usuario_ve_solo_su_fila [SELECT propia fila] y coach_ve_todo
--  [ALL para el admin]. No hace falta recrearlas.)

-- ── 2) SELECT ────────────────────────────────────────────────────────────────
-- Directorio público: cualquiera puede ver SOLO filas de coaches/admin (no
-- clientes). Cubre el directorio, el match de access_code del intake y la
-- lectura de la config del coach desde el portal del cliente.
DROP POLICY IF EXISTS usuarios_directorio ON usuarios;
CREATE POLICY usuarios_directorio ON usuarios FOR SELECT
  TO anon, authenticated
  USING (rol IN ('coach','admin'));

-- Un coach puede ver la fila de SUS clientes (para gestionarlos en el panel).
DROP POLICY IF EXISTS usuarios_coach_ve_su_cliente ON usuarios;
CREATE POLICY usuarios_coach_ve_su_cliente ON usuarios FOR SELECT
  TO authenticated
  USING (rol = 'cliente' AND public.pw_coach_owns_email(email));

-- ── 3) INSERT ────────────────────────────────────────────────────────────────
-- Intake anónimo: solo puede crear filas rol='cliente' (no coaches/admin).
DROP POLICY IF EXISTS usuarios_intake_cliente ON usuarios;
CREATE POLICY usuarios_intake_cliente ON usuarios FOR INSERT
  TO anon
  WITH CHECK (rol = 'cliente');

-- Usuario autenticado creando su PROPIA fila (login con Google → auth-callback).
-- No puede auto-asignarse rol='admin' (misma restricción que usuarios_self_update).
DROP POLICY IF EXISTS usuarios_self_insert ON usuarios;
CREATE POLICY usuarios_self_insert ON usuarios FOR INSERT
  TO authenticated
  WITH CHECK (lower(email) = public.pw_email() AND rol <> 'admin');

-- Coach (autenticado) creando un cliente desde el panel.
DROP POLICY IF EXISTS usuarios_coach_crea_cliente ON usuarios;
CREATE POLICY usuarios_coach_crea_cliente ON usuarios FOR INSERT
  TO authenticated
  WITH CHECK (rol = 'cliente');

-- ── 4) UPDATE ────────────────────────────────────────────────────────────────
-- Activación de coach invitado (anon): SOLO filas SIN contraseña (pendientes) y
-- sin poder ponerse admin. Bloquea pisar cuentas activas (las que ya tienen pass).
DROP POLICY IF EXISTS usuarios_activacion_anon ON usuarios;
CREATE POLICY usuarios_activacion_anon ON usuarios FOR UPDATE
  TO anon
  USING (password_hash IS NULL)
  WITH CHECK (rol IN ('coach','cliente'));

-- Usuario autenticado actualizando su PROPIA fila (auth_id, last_login, perfil).
-- No puede auto-promoverse a admin.
DROP POLICY IF EXISTS usuarios_self_update ON usuarios;
CREATE POLICY usuarios_self_update ON usuarios FOR UPDATE
  TO authenticated
  USING (lower(email) = public.pw_email())
  WITH CHECK (lower(email) = public.pw_email() AND rol <> 'admin');

-- Coach gestionando a SU cliente (ej. setear/cambiar su contraseña desde el panel).
DROP POLICY IF EXISTS usuarios_coach_gestiona_cliente ON usuarios;
CREATE POLICY usuarios_coach_gestiona_cliente ON usuarios FOR UPDATE
  TO authenticated
  USING (rol = 'cliente' AND public.pw_coach_owns_email(email))
  WITH CHECK (rol = 'cliente' AND public.pw_coach_owns_email(email));

-- (El admin sigue con coach_ve_todo [ALL]. El stripe-webhook y las edge functions
--  usan service_role → bypassean RLS, no se ven afectados.)

-- ============================================================================
-- VERIFICACIÓN
-- ============================================================================
-- Como ANON (navegador sin login):
--   • /usuarios?select=*                       → solo filas de coaches/admin (no clientes)
--   • /usuarios?select=email&rol=eq.cliente     → []  (clientes ocultos)
--   • PATCH /usuarios?id=eq.<otro> {rol:'admin'} → 0 filas / denegado (no takeover)
-- Logueado: coach ve su fila + sus clientes; admin ve todo.

-- ============================================================================
-- ROLLBACK (restaura el estado anterior)
-- ============================================================================
-- El más rápido: apagar RLS (las políticas quedan dormidas, como antes):
--   ALTER TABLE usuarios DISABLE ROW LEVEL SECURITY;
-- O recrear las políticas abiertas:
-- CREATE POLICY "permitir_login" ON usuarios FOR SELECT USING (true);
-- CREATE POLICY "Permitir leer usuarios" ON usuarios FOR SELECT TO anon USING (true);
-- CREATE POLICY "Permitir actualizar usuarios" ON usuarios FOR UPDATE TO anon USING (true);
-- CREATE POLICY "Permitir insertar usuarios" ON usuarios FOR INSERT TO anon WITH CHECK (true);
-- DROP POLICY IF EXISTS usuarios_directorio ON usuarios;
-- DROP POLICY IF EXISTS usuarios_coach_ve_su_cliente ON usuarios;
-- DROP POLICY IF EXISTS usuarios_intake_cliente ON usuarios;
-- DROP POLICY IF EXISTS usuarios_self_insert ON usuarios;
-- DROP POLICY IF EXISTS usuarios_coach_crea_cliente ON usuarios;
-- DROP POLICY IF EXISTS usuarios_activacion_anon ON usuarios;
-- DROP POLICY IF EXISTS usuarios_self_update ON usuarios;
-- DROP POLICY IF EXISTS usuarios_coach_gestiona_cliente ON usuarios;
