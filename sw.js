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

// ─── Push notifications ─────────────────────────────────────────────────
// El servidor manda payload JSON {title, body, url, tag} via web-push.
// El SW lo recibe y muestra la notificación nativa del SO.

self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) {}
  const title = data.title || "Pathway";
  const options = {
    body: data.body || "",
    icon: "/icon-192.png?v=1",
    badge: "/icon-192.png?v=1",
    tag: data.tag || "pathway",   // mismo tag = reemplaza (no se apilan iguales)
    renotify: !!data.renotify,
    data: { url: data.url || "/" }
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ("focus" in c) {
          c.focus();
          if ("navigate" in c) { try { c.navigate(targetUrl); } catch (e) {} }
          return;
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
    })
  );
});
