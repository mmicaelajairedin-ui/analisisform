-- Se retira el andamiaje de la verificación de ACL. Las tres filas QA estaban
-- publicadas en una organización REAL: mientras existan, sus coaches las ven en
-- su panel. Una prueba no deja rastro en producción (R-44).
delete from public.mc_novedades
 where id in (
   '22222222-0000-4000-8000-000000000001',
   '22222222-0000-4000-8000-000000000002',
   '22222222-0000-4000-8000-000000000003'
 );

drop function if exists public.mc_verificar_acl();