// Pathway Push — helper para suscribir el dispositivo a notificaciones push.
//
// Uso:
//   <script src="/pw-push.js?v=1"></script>
//   await PwPush.activate(userEmail);       // pide permiso, suscribe, guarda en Supabase
//   await PwPush.deactivate(userEmail);     // desuscribe y elimina de Supabase
//   PwPush.status();                        // 'unsupported' | 'denied' | 'inactive' | 'active'
//
// Requiere que el service worker (/sw.js) esté registrado.

(function (global) {
  "use strict";

  // VAPID pública: identifica a Pathway frente al push service. NO es secreta.
  // La privada vive como secret en la Edge Function 'send-push' (no en el cliente).
  var VAPID_PUBLIC = "BEeEjwY2wj-XTIfnXMlTtrB18eMKIvAj_9fF5-Hdj7_lMDwcEW4dZZPx2V_8BOf2iM1Nw3bx45oZvXggYNZYJro";

  // Endpoint del backend de Pathway (Supabase REST) para guardar/borrar suscripciones.
  // Reutiliza la anon key del proyecto — RLS permite INSERT/DELETE público sobre
  // la tabla push_subscriptions (cada uno gestiona sus propios endpoints).
  var SB_URL = "https://ddxnrsnjdvtqhxunxnwj.supabase.co";
  var SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkeG5yc25qZHZ0cWh4dW54bndqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxNDk5MzksImV4cCI6MjA5MDcyNTkzOX0.t82X1x-PDgFDGYhKC7YXoRKhga9I8Hjet60QUYvtZLU";

  function urlBase64ToUint8Array(b64) {
    var padding = "=".repeat((4 - (b64.length % 4)) % 4);
    var base64 = (b64 + padding).replace(/-/g, "+").replace(/_/g, "/");
    var raw = atob(base64);
    var out = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
    return out;
  }

  function bufToB64Url(buf) {
    var b = btoa(String.fromCharCode.apply(null, new Uint8Array(buf)));
    return b.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  function isSupported() {
    return (
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window
    );
  }

  function status() {
    if (!isSupported()) return "unsupported";
    if (Notification.permission === "denied") return "denied";
    // 'active' requiere chequear si hay subscription; lo resuelve hasSubscription().
    return Notification.permission === "granted" ? "granted" : "inactive";
  }

  async function getRegistration() {
    var reg = await navigator.serviceWorker.getRegistration();
    if (!reg) reg = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;
    return reg;
  }

  async function hasSubscription() {
    if (!isSupported()) return false;
    try {
      var reg = await getRegistration();
      var sub = await reg.pushManager.getSubscription();
      return !!sub;
    } catch (e) { return false; }
  }

  async function activate(userEmail) {
    if (!isSupported()) throw new Error("Tu navegador no soporta notificaciones push.");
    if (!userEmail) throw new Error("Falta el email del usuario.");

    var permission = await Notification.requestPermission();
    if (permission !== "granted") throw new Error("Permiso de notificaciones denegado.");

    var reg = await getRegistration();
    var sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC),
      });
    }

    // Extraer las llaves del PushSubscription en formato URL-safe base64.
    var p256dh = bufToB64Url(sub.getKey("p256dh"));
    var auth = bufToB64Url(sub.getKey("auth"));

    // Upsert por endpoint en Supabase (la columna endpoint es UNIQUE).
    var body = {
      user_email: (""+userEmail).toLowerCase().trim(),
      endpoint: sub.endpoint,
      p256dh: p256dh,
      auth: auth,
      ua: (navigator.userAgent || "").slice(0, 250),
      last_seen_at: new Date().toISOString(),
    };
    var res = await fetch(SB_URL + "/rest/v1/push_subscriptions?on_conflict=endpoint", {
      method: "POST",
      headers: {
        apikey: SB_KEY,
        Authorization: "Bearer " + SB_KEY,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error("No se pudo guardar la suscripción (" + res.status + ").");
    return true;
  }

  async function deactivate(userEmail) {
    if (!isSupported()) return false;
    try {
      var reg = await getRegistration();
      var sub = await reg.pushManager.getSubscription();
      if (!sub) return true;
      var endpoint = sub.endpoint;
      try { await sub.unsubscribe(); } catch (e) {}
      // Borrar del servidor también (todas las del endpoint).
      await fetch(SB_URL + "/rest/v1/push_subscriptions?endpoint=eq." + encodeURIComponent(endpoint), {
        method: "DELETE",
        headers: { apikey: SB_KEY, Authorization: "Bearer " + SB_KEY },
      });
      return true;
    } catch (e) { return false; }
  }

  global.PwPush = {
    isSupported: isSupported,
    status: status,
    hasSubscription: hasSubscription,
    activate: activate,
    deactivate: deactivate,
  };
})(this);
