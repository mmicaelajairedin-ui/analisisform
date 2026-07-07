-- usuarios_directorio_empleados — hacer que los EMPLEADOS sean reservables
-- desde el link público de demos (agendar.html?team=1).
--
-- Contexto: usuarios_hardening.sql cerró la lectura pública de `usuarios` a
-- filas con rol IN ('coach','admin'). Por eso el link de demos NO ve a los
-- empleados (ej. Gonzalo) y no aparecen en el selector "con quién".
--
-- Este cambio agrega 'empleado' al directorio público, PERO solo filas activas.
-- Igual que con coaches, se expone nombre/foto/config (NO password_hash, que ya
-- está protegido a nivel columna en usuarios_protect_password.sql).
--
-- Aplicar una vez en el SQL Editor.

DROP POLICY IF EXISTS usuarios_directorio ON usuarios;
CREATE POLICY usuarios_directorio ON usuarios FOR SELECT
  TO anon, authenticated
  USING (rol IN ('coach','admin') OR (rol = 'empleado' AND activo IS TRUE));

-- Verificación (como anon): debería devolver a los empleados activos.
--   SELECT id, nombre, rol FROM usuarios WHERE rol = 'empleado' AND activo;
