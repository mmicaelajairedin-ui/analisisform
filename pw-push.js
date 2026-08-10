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
  var VAPID_PUBLIC = "BPssOKlQEcIo0V3sGQJNpieJt54zUZULa-2r2bJPHtvvdVG-s-EjpWprAB6wyTW5jvwJrsag_vxrX14WM1HBclA";

  // Endpoint del backend de Pathway (Supabase REST) para guardar/borrar suscripciones.
  // Reutiliza la anon key del proyecto — RLS permite INSERT/DELETE público sobre
  // la tabla push_subscriptions (cada uno gestiona sus propios endpoints).
  var SB_URL = "https://api.pathwaycareercoach.com";
  var SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkeG5yc25qZHZ0cWh4dW54bndsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjM5ODAwMDAsImV4cCI6MTg4MTc0NjAwMH0.WyY8_f_mTGJfRJLZ_b4A_rC8_r-9qOqNM8gfDg6xxRk";

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

  // autoPrompt: muestra una barra discreta abajo invitando a activar las
  // notificaciones. Solo aparece si: hay soporte, no fue denegado, no hay
  // suscripción activa, y el usuario no la cerró en esta sesión. Espera
  // unos segundos para no asustar apenas se abre la app.
  // Devuelve instrucciones específicas por navegador para des-bloquear notifs.
  function blockedHelpHtml() {
    var ua = (navigator.userAgent || "").toLowerCase();
    var isIOS = /iphone|ipad|ipod/.test(ua);
    var isAndroidChrome = /android/.test(ua) && /chrome/.test(ua) && !/firefox/.test(ua);
    var isFirefox = /firefox/.test(ua);
    if (isIOS) return "<strong>iPhone:</strong> Configuración → Notificaciones → Pathway → Permitir.<br><em>(Pathway tiene que estar agregada a la pantalla de inicio: Safari → Compartir → Añadir a inicio.)</em>";
    if (isAndroidChrome) return "<strong>Chrome Android:</strong> tocá el candado 🔒 a la izquierda de la URL → Permisos → Notificaciones → Permitir. Recargá la página.";
    if (isFirefox) return "<strong>Firefox:</strong> click en el candado 🔒 a la izquierda de la URL → Configuración → Permisos → Notificaciones → Permitir.";
    return "<strong>Tu navegador:</strong> click en el candado 🔒 a la izquierda de la URL → Permisos del sitio → Notificaciones → Permitir. Después recargá la página.";
  }

  // autoPrompt: muestra banner abajo. Si están BLOQUEADAS por el navegador,
  // muestra cómo desbloquearlas (porque requestPermission ya no puede hacer
  // nada). La decisión se respeta por sesión (sessionStorage).
  async function autoPrompt(userEmail, opts) {
    opts = opts || {};
    if (!isSupported()) return;
    if (await hasSubscription()) return;
    var key = "pw_push_dismissed_" + (userEmail || "global");
    try { if (sessionStorage.getItem(key)) return; } catch (e) {}

    var blocked = Notification.permission === "denied";

    setTimeout(function () {
      if (document.getElementById("pw-push-banner")) return;
      var st = document.createElement("style");
      st.textContent =
        "@keyframes pwPushIn{from{opacity:0;transform:translate(-50%,12px)}to{opacity:1;transform:translate(-50%,0)}}" +
        ".pw-push-banner{position:fixed;left:50%;bottom:14px;transform:translateX(-50%);z-index:9500;background:#fff;border:1px solid rgba(45,106,79,.18);box-shadow:0 10px 28px rgba(45,106,79,.22);font-family:Inter,-apple-system,sans-serif;font-size:13px;color:#1B2E26;max-width:92vw;animation:pwPushIn .25s ease-out;}" +
        ".pw-push-banner.pill{border-radius:99px;padding:8px 10px 8px 16px;display:flex;align-items:center;gap:10px;}" +
        ".pw-push-banner.card{border-radius:14px;padding:14px 16px 14px 16px;display:block;width:340px;max-width:90vw;line-height:1.45;position:fixed;}" +
        ".pw-push-yes{background:#2D6A4F;color:#fff;border:none;padding:6px 14px;border-radius:99px;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;}" +
        ".pw-push-no{background:transparent;border:none;font-size:18px;cursor:pointer;color:#888;line-height:1;padding:0 4px;font-family:inherit;}" +
        ".pw-push-x{position:absolute;top:6px;right:8px;background:transparent;border:none;font-size:18px;cursor:pointer;color:#888;line-height:1;padding:2px 6px;font-family:inherit;}";
      document.head.appendChild(st);

      var b = document.createElement("div");
      b.id = "pw-push-banner";

      function showBlocked() {
        b.className = "pw-push-banner card";
        b.innerHTML =
          "<button class='pw-push-x' aria-label='Cerrar'>×</button>" +
          "<div style='display:flex;align-items:center;gap:8px;font-weight:600;margin-bottom:6px;'>" +
            "<span aria-hidden='true'>🔔</span><span>Notificaciones bloqueadas</span>" +
          "</div>" +
          "<div style='color:#5A5A55;font-size:12.5px;'>" + blockedHelpHtml() + "</div>";
        b.querySelector(".pw-push-x").onclick = function () {
          try { sessionStorage.setItem(key, "1"); } catch (e) {}
          b.remove();
        };
      }

      if (blocked) {
        showBlocked();
      } else {
        b.className = "pw-push-banner pill";
        b.innerHTML =
          "<span aria-hidden='true'>🔔</span><span>Activá las notificaciones del chat</span>" +
          "<button class='pw-push-yes'>Activar</button>" +
          "<button class='pw-push-no' aria-label='Cerrar'>×</button>";
        b.querySelector(".pw-push-yes").onclick = async function () {
          try { await activate(userEmail); b.remove(); }
          catch (e) {
            // Si lo bloquearon en el momento, mostrar las instrucciones inline.
            if (Notification.permission === "denied") {
              showBlocked();
            } else {
              // El mensaje de error puede traer contenido no confiable → textContent
              // (no innerHTML) para evitar inyección de HTML/JS.
              b.innerHTML = "<span style='color:#c0756e'></span>";
              b.firstChild.textContent = (e && e.message) || "No se pudo activar.";
              setTimeout(function () { if (b && b.parentNode) b.remove(); }, 4500);
            }
          }
        };
        b.querySelector(".pw-push-no").onclick = function () {
          try { sessionStorage.setItem(key, "1"); } catch (e) {}
          b.remove();
        };
      }
      document.body.appendChild(b);
    }, opts.delay || 6000);
  }

  global.PwPush = {
    isSupported: isSupported,
    status: status,
    hasSubscription: hasSubscription,
    activate: activate,
    deactivate: deactivate,
    autoPrompt: autoPrompt,
  };
})(this);
