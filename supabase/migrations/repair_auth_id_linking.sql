-- ===================================================================
-- REPARACIÓN: coaches "sin sesión ligada" (auth_id NULL) → no ven ni pueden
-- agregar clientes.
--
-- CAUSA: RLS identifica a cada coach por usuarios.auth_id (= auth.uid()). Al
-- entrar, el frontend hace un PATCH para guardarlo, pero la propia RLS lo
-- bloquea en varios casos:
--   • a los admin los frena el WITH CHECK `rol <> 'admin'` de usuarios_self_update
--   • a otros, porque el email del JWT no coincide exacto con usuarios.email
-- Sin auth_id, pw_coach_id() devuelve NULL → el coach queda "anónimo" para RLS
-- → no ve sus clientes y sus altas de candidato fallan (409/403).
--
-- SOLUCIÓN:
--   1) Backfill: ligar de una a todos los que ya tienen cuenta en auth.users.
--   2) RPC pw_link_auth_id(): SECURITY DEFINER (salta RLS), liga la fila cuyo
--      email coincide con el email VERIFICADO del JWT y que aún no esté ligada.
--      El frontend la llama en cada login (login.html / auth-callback.html).
--
-- Aplicar una vez en Supabase Studio → SQL Editor.
-- ===================================================================

-- ── PASO 1 — diagnóstico (solo lectura): cuántos están sin ligar ────────────
SELECT count(*) FILTER (WHERE auth_id IS NULL) AS sin_ligar,
       count(*) FILTER (WHERE auth_id IS NOT NULL) AS ligados
FROM usuarios
WHERE rol IN ('coach','admin');

-- ── PASO 2 — backfill: ligar por email contra auth.users (seguro: el email de
--    auth.users está verificado por Supabase Auth). Idempotente. ─────────────
UPDATE usuarios u
   SET auth_id = a.id
  FROM auth.users a
 WHERE u.auth_id IS NULL
   AND lower(u.email) = lower(a.email);

-- ── PASO 3 — RPC para ligar en cada login (saltando RLS de forma segura) ─────
-- Solo liga la fila cuyo email == email verificado del JWT y que NO esté ligada
-- (no permite "robar" una cuenta ya ligada, ni pasar un email arbitrario).
CREATE OR REPLACE FUNCTION public.pw_link_auth_id()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid   uuid := auth.uid();
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_id    uuid;
BEGIN
  IF v_uid IS NULL OR v_email = '' THEN
    RETURN NULL;
  END IF;
  -- Si ya está ligada a este uid, devolvemos su id (idempotente).
  SELECT id INTO v_id FROM usuarios WHERE auth_id = v_uid LIMIT 1;
  IF v_id IS NOT NULL THEN
    RETURN v_id;
  END IF;
  -- Ligar la fila no ligada cuyo email coincide con el del JWT.
  UPDATE usuarios
     SET auth_id = v_uid
   WHERE auth_id IS NULL
     AND lower(email) = v_email
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.pw_link_auth_id() TO authenticated;

-- ── PASO 4 — verificación: cuántos quedan sin ligar tras el backfill ────────
-- Los que queden acá no tienen cuenta en auth.users todavía: se ligan solos la
-- próxima vez que entren (gracias a la RPC del PASO 3).
SELECT email, nombre, rol
FROM usuarios
WHERE rol IN ('coach','admin') AND auth_id IS NULL
ORDER BY email;
