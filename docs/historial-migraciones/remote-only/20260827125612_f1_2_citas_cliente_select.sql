-- F1.2 — El cliente autenticado puede leer SUS citas.
-- Hoy no existia ninguna policy para el cliente: por eso los tres portales
-- (cliente.html, pathway-fit-cliente, pathway-fin-cliente) leen `citas` con la
-- anon key. Esta policy es el prerrequisito para que dejen de hacerlo (F2.4).
-- Guarda `pw_email() <> ''`: sin ella, un JWT sin email casaria con las 2 citas
-- que tienen email vacio.
CREATE POLICY citas_cliente_select ON public.citas
  FOR SELECT TO authenticated
  USING (pw_email() <> '' AND lower(email) = pw_email());