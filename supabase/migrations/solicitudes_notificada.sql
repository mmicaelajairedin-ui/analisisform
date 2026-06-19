-- Migration — flag `notificada` en `solicitudes`
--
-- Marca si ya se enviaron los mails de "pago retenido" (al comprador + al coach)
-- cuando la solicitud pasa a 'autorizada'. Evita el doble envío entre los dos
-- caminos que pueden disparar la notificación:
--   1. webhook de Stripe  (stripe-webhook → handleSolicitudPayment)
--   2. reconciliación sync (connect-checkout → action "sync", al abrir el panel)
-- El primero que llega manda los mails y deja notificada=true; el otro lo respeta.
--
-- Aplicar una vez en el SQL Editor de Supabase:

alter table solicitudes add column if not exists notificada boolean default false;
