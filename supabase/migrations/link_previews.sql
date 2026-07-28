-- Cache de previsualizaciones de enlaces (og:image) para la biblioteca de
-- Recursos. La Edge Function `link-preview` baja la página una vez, extrae la
-- imagen y la guarda acá; después reusa este cache (TTL 30 días) en vez de
-- re-bajar la página en cada visita del cliente.
--
-- Escribe/lee SOLO la Edge Function (service role). El navegador no la toca.
create table if not exists link_previews (
  url_hash text primary key,   -- SHA-256 (12 bytes) de la URL
  url      text,
  image    text,               -- URL de la imagen ('' = la página no tiene og:image)
  ts       timestamptz default now()
);

alter table link_previews enable row level security;
-- Sin políticas para anon: solo el service role (Edge Function) entra. RLS
-- activada y sin policy = nadie con la anon key puede leer/escribir.
