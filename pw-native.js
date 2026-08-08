// ===================================================================
// pw-native.js — Capa nativa de Pathway (solo dentro de la app Capacitor).
//
// En la web normal y en la PWA esto es un NO-OP total: se sale en la primera
// linea. Solo hace algo cuando Pathway corre empaquetada como app iOS/Android.
//
// Que hace dentro de la app:
//   1) Marca el flag pw_native para que pw-app.js oculte los cobros (Apple/Google).
//   2) Barra de estado con el color de marca + oculta el splash al cargar.
//   3) Los links a OTROS dominios (blog externo, etc.) se abren en el navegador
//      del sistema (Safari), no dentro de la app. Asi la app se queda siempre en
//      pathwaycareercoach.com y no se "traba" en una web ajena. (Apple regla 4.2)
//   4) Notificaciones push nativas: pide permiso y guarda el token APNs/FCM en
//      Supabase (tabla native_push_tokens). Solo si el usuario ya inicio sesion.
//
// Usa el puente window.Capacitor.Plugins directamente (sin bundler), porque la
// app carga el sitio remoto (server.url) y ese es el patron soportado para
// apps con contenido remoto. Encaja con el estilo vanilla del proyecto.
// ===================================================================
(function () {
  "use strict";

  var C = window.Capacitor;
  var isNative = !!(C && (typeof C.isNativePlatform === "function" ? C.isNativePlatform() : C.isNative));
  if (!isNative) return; // <-- en la web no pasa absolutamente nada.

  var P = (C && C.Plugins) || {};

  // Backend de Pathway (mismas credenciales publicas que pw-push.js).
  var SB_URL = "https://api.pathwaycareercoach.com";
  var SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkeG5yc25qZHZ0cWh4dW54bndsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjM5ODAwMDAsImV4cCI6MTg4MTc0NjAwMH0.WyY8_f_mTGJfRJLZ_b4A_rC8_r-9qOqNM8gfDg6xxRk";

  // El flag hace que pw-app.js oculte los botones de pago en TODAS las pantallas.
  try { localStorage.setItem("pw_native", "1"); } catch (e) {}

  function platform() {
    try { return (typeof C.getPlatform === "function" ? C.getPlatform() : "ios"); }
    catch (e) { return "ios"; }
  }

  function currentEmail() {
    try {
      var u = localStorage.getItem("mj_user");
      if (!u) return null;
      var p = JSON.parse(u);
      return (p && p.email) ? ("" + p.email).toLowerCase().trim() : null;
    } catch (e) { return null; }
  }

  // ---- 1) Barra de estado + splash ----------------------------------
  function setupChrome() {
    try {
      if (P.StatusBar) {
        // Iconos oscuros sobre fondo claro (la app es clara).
        if (P.StatusBar.setStyle) P.StatusBar.setStyle({ style: "LIGHT" }); // LIGHT = contenido oscuro
        if (P.StatusBar.setBackgroundColor) P.StatusBar.setBackgroundColor({ color: "#FAFDF9" }); // Android
      }
    } catch (e) {}
    // Ocultar el splash una vez que la web ya pinto.
    try {
      if (P.SplashScreen && P.SplashScreen.hide) {
        setTimeout(function () { try { P.SplashScreen.hide(); } catch (e) {} }, 400);
      }
    } catch (e) {}
  }

  // ---- 2) Links externos -> navegador del sistema -------------------
  // Cualquier <a> hacia otro host (que no sea pathwaycareercoach.com ni el
  // backend) se abre en Safari, en vez de navegar dentro del webview.
  function isExternal(href) {
    try {
      if (!href) return false;
      if (/^(mailto:|tel:|sms:)/i.test(href)) return false; // los maneja el SO
      var u = new URL(href, location.href);
      if (u.protocol !== "http:" && u.protocol !== "https:") return false;
      var host = u.hostname.toLowerCase();
      var internal =
        host === "pathwaycareercoach.com" ||
        host === "www.pathwaycareercoach.com" ||
        host === location.hostname.toLowerCase();
      return !internal;
    } catch (e) { return false; }
  }

  function setupExternalLinks() {
    document.addEventListener("click", function (ev) {
      try {
        var a = ev.target && ev.target.closest ? ev.target.closest("a[href]") : null;
        if (!a) return;
        var href = a.getAttribute("href");
        if (!isExternal(href)) return;
        ev.preventDefault();
        var abs = new URL(href, location.href).href;
        if (P.Browser && P.Browser.open) P.Browser.open({ url: abs });
        else window.open(abs, "_blank");
      } catch (e) {}
    }, true);
  }

  // ---- 3) Notificaciones push nativas -------------------------------
  function saveToken(token) {
    if (!token) return;
    var body = {
      user_email: currentEmail(),
      token: token,
      platform: platform(),
      ua: (navigator.userAgent || "").slice(0, 250),
      last_seen_at: new Date().toISOString(),
    };
    fetch(SB_URL + "/rest/v1/native_push_tokens?on_conflict=token", {
      method: "POST",
      headers: {
        apikey: SB_KEY,
        Authorization: "Bearer " + SB_KEY,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify(body),
    }).catch(function () {});
  }

  function setupPush() {
    var Push = P.PushNotifications;
    if (!Push) return;
    // Solo pedimos permiso si el usuario ya inicio sesion (como en la web).
    if (!currentEmail()) return;

    try {
      Push.addListener("registration", function (t) {
        saveToken(t && (t.value || t.token));
      });
      Push.addListener("registrationError", function () {});
    } catch (e) {}

    // Pedir permiso y registrar en APNs/FCM.
    var reqP = Push.checkPermissions ? Push.checkPermissions() : Promise.resolve({ receive: "prompt" });
    Promise.resolve(reqP).then(function (perm) {
      var granted = perm && perm.receive === "granted";
      if (granted) { try { Push.register(); } catch (e) {} return; }
      if (perm && perm.receive === "denied") return;
      Push.requestPermissions().then(function (r) {
        if (r && r.receive === "granted") { try { Push.register(); } catch (e) {} }
      }).catch(function () {});
    }).catch(function () {});
  }

  function boot() {
    setupChrome();
    setupExternalLinks();
    // Damos unos segundos antes de pedir el permiso de notificaciones para no
    // asustar apenas abre la app (mismo criterio que el push web).
    setTimeout(setupPush, 4000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
