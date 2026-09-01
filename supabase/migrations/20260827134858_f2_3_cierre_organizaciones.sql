-- F2.3 — Cierre de `organizaciones`.
--
-- Antes: RLS DESACTIVADA y anon con SELECT/INSERT/UPDATE/DELETE/TRUNCATE.
-- Medido: CUALQUIER visitante anonimo leia las 5 organizaciones enteras
-- (nombre, slug, owner_email, marca, plan...) y podia escribirlas.
--
-- anon: se le retira TODO. El acceso publico legitimo (pagina /red/<slug>)
-- pasa ahora por `org_publica(p_slug)`, SECURITY DEFINER, que devuelve solo
-- id/nombre/slug/marca de una org activa y no permite enumerar.
--
-- authenticated: se retiran solo TRUNCATE/REFERENCES/TRIGGER (un cliente de
-- navegador nunca los necesita). Se CONSERVAN SELECT/INSERT/UPDATE/DELETE a
-- proposito: con RLS activa quedan acotados por `organizaciones_admin_owner`
-- (pw_is_admin() OR lower(owner_email)=pw_email()), que es justamente el camino
-- por el que el dueño edita su marca. Revocarlos romperia el editor de marca.
REVOKE ALL ON TABLE public.organizaciones FROM anon;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON TABLE public.organizaciones FROM authenticated;

-- Las 4 policies ya existian pero estaban inertes (RLS off). Esto las activa.
ALTER TABLE public.organizaciones ENABLE ROW LEVEL SECURITY;