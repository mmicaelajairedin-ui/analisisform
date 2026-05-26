// Service worker mínimo — habilita la instalación PWA.
//
// Chrome / Edge requieren un SW con un handler de `fetch` para mostrar
// el prompt "Instalar app". No cacheamos nada por ahora (Pathway necesita
// datos siempre frescos de Supabase); el SW solo deja pasar las requests
// de forma transparente. Más adelante podemos sumar cache de assets
// estáticos (CSS/JS/imágenes) si queremos modo offline básico.

self.addEventListener("install", (event) => {
  // Activar enseguida sin esperar a que se cierren las tabs viejas.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  // Tomar control de los clients abiertos sin recargar.
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  // Pasthrough: no toques las requests. La presencia de este listener es
  // lo que Chrome chequea para considerar la app "instalable".
  // Si en el futuro cacheamos, hacerlo solo para GET de mismo origen y
  // excluir las llamadas a Supabase/Stripe/Brevo.
  return;
});
