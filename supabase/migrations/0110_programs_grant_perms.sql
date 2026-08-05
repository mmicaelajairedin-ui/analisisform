-- ═══════════════════════════════════════════════════════════════════════
-- Migration 0110: Add GRANT permissions for programs table
-- ═══════════════════════════════════════════════════════════════════════
-- Propósito: La tabla programs (creada en 0102) tiene RLS pero no GRANT
--           para anon/authenticated. Multicoach.html la consulta y obtiene
--           404 aunque la tabla exista y tenga policies. Agregar GRANT
--           para que PostgREST no bloquee antes de evaluar RLS.
--
-- Nota: Las RLS policies filtran por org_id + auth.uid() así que el
--      acceso sigue siendo seguro — solo ciertos usuarios ven ciertos
--      programas. El GRANT solo permite el acceso a la tabla.

GRANT SELECT ON programs TO anon, authenticated;
GRANT INSERT ON programs TO authenticated;
GRANT UPDATE ON programs TO authenticated;
GRANT DELETE ON programs TO authenticated;

-- Permiso para sequences (si se insertaran nuevos programas)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

COMMENT ON TABLE programs IS
  'Programas de coaching con RLS por org_id. Asegurar GRANT SELECT para que PostgREST permita acceso (RLS policies filtran lo que cada usuario ve).';
