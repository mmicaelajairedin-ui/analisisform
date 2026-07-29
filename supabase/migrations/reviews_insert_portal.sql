-- ============================================================================
-- reviews_insert_portal — puente reseña → público.
--
-- El portal del cliente ahora, además de guardar la reseña en
-- `candidatos.review_rating` (privado, para el logro), la PUBLICA en la tabla
-- `reviews` que lee el perfil público del coach (coach.html / testimonios.js).
-- Regla: 3-5★ → publica=true (se muestran); 1-2★ → publica=false (feedback
-- privado, cuentan para el ranking pero no se muestran).
--
-- Para que ese INSERT funcione desde el navegador (anon/authenticated) hace falta
-- permiso + una policy de INSERT acotada. La LECTURA pública (publica=true) ya
-- existe; esto solo agrega la ESCRITURA controlada.
--
-- Deploy: pegar en el SQL Editor de Supabase y Run (idempotente).
-- ============================================================================

grant insert on public.reviews to anon, authenticated;

alter table public.reviews enable row level security;

drop policy if exists reviews_insert_portal on public.reviews;
create policy reviews_insert_portal on public.reviews
  for insert to anon, authenticated
  with check (
    rating between 1 and 5
    and coach_slug is not null
  );

-- NOTA: si `reviews.id` usa una SECUENCIA clásica (serial) en vez de IDENTITY,
-- el INSERT de anon puede fallar por permiso de secuencia. En ese caso, correr:
--   grant usage on sequence public.reviews_id_seq to anon, authenticated;
-- (Con `bigint generated ... as identity` no hace falta.)
