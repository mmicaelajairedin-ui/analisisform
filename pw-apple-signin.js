/* pw-apple-signin.js — "Sign in with Apple" equivalente (Apple guideline 4.8).
 *
 * Apple EXIGE ofrecer "Sign in with Apple" como opción equivalente en CADA
 * pantalla donde la app iOS ofrezca login con un servicio social (Google). En
 * vez de duplicar el botón/lógica en cada archivo, esto es la ÚNICA fuente de
 * verdad: se incluye en cada pantalla con login por Google y:
 *   1) Muestra el botón #btn-apple SOLO en dispositivos Apple (iPhone/iPad) o
 *      dentro de la app iOS (Capacitor). En web normal (Android/escritorio)
 *      queda oculto → ahí se usa Google/email, sin ensuciar la UI.
 *   2) Define window.signInWithApple(): arranca el OAuth de Apple vía Supabase.
 *      El destino post-login sale del atributo data-apple-redirect del botón
 *      (para que cada pantalla enrute igual que su login de Google); si falta,
 *      cae a auth-callback?source=login.
 *
 * Uso en cada pantalla:
 *   <button id="btn-apple" onclick="signInWithApple()"
 *           data-apple-redirect="https://pathwaycareercoach.com/auth-callback.html?source=login"
 *           style="display:none;...">…Continuar con Apple…</button>
 *   <script src="pw-apple-signin.js"></script>
 *
 * Requiere: el SDK de Supabase (supabase-js) ya cargado en la página, y el
 * proveedor "Apple" habilitado en Supabase Auth (Service ID de Apple Developer).
 */
(function () {
  "use strict";
  var SB = "https://api.pathwaycareercoach.com";
  var KEY = null;
  fetch(SB+'/.well-known/config')
    .then(function(r){return r.json();})
    .then(function(cfg){KEY=cfg.anon_key;})
    .catch(function(err){
      KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkeG5yc25qZHZ0cWh4dW54bndqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxNDk5MzksImV4cCI6MjA5MDcyNTkzOX0.t82X1x-PDgFDGYhKC7YXoRKhga9I8Hjet60QUYvtZLU';
    });

  // ¿Dispositivo Apple o app iOS? → mostrar el botón.
  function gate() {
    try {
      var ua = navigator.userAgent || "";
      var iOS = /iphone|ipad|ipod/i.test(ua) ||
        (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
      try { if (window.Capacitor && window.Capacitor.getPlatform && window.Capacitor.getPlatform() === "ios") iOS = true; } catch (e) {}
      if (iOS) { var b = document.getElementById("btn-apple"); if (b) b.style.display = "flex"; }
    } catch (e) {}
  }
  if (document.readyState !== "loading") gate();
  else document.addEventListener("DOMContentLoaded", gate);

  window.signInWithApple = function () {
    var b = document.getElementById("btn-apple");
    var redirect = (b && b.getAttribute("data-apple-redirect")) ||
      "https://pathwaycareercoach.com/auth-callback.html?source=login";
    if (!window.supabase) { alert("Recarga la página e intenta de nuevo."); return; }
    if (b) { b.disabled = true; b.style.opacity = ".65"; var s = b.querySelector("span"); if (s) s.textContent = "Conectando con Apple..."; }
    try {
      window.supabase.createClient(SB, KEY).auth.signInWithOAuth({
        provider: "apple",
        options: { redirectTo: redirect },
      }).catch(function (err) {
        if (b) { b.disabled = false; b.style.opacity = "1"; var s2 = b.querySelector("span"); if (s2) s2.textContent = "Continuar con Apple"; }
        try { console.error("[apple signin]", err); } catch (e) {}
        alert("Error iniciando sesión con Apple: " + (err && err.message || "desconocido"));
      });
    } catch (e) {
      if (b) { b.disabled = false; b.style.opacity = "1"; }
      alert("No se pudo iniciar con Apple. Recarga la página.");
    }
  };
})();
