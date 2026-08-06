/* pw-observe.js — DETECTOR DE HUMO.
 *
 * Hace que la app deje de "mentir": cuando algo falla en el navegador de un
 * coach o cliente, lo registra en la tabla `client_errors` de Supabase para que
 * la coach se entere — aunque el codigo se trague el error en silencio.
 *
 * Atrapa 3 cosas:
 *   1) Llamadas a Supabase que fallan (guardados que no llegan). Esto cubre los
 *      cientos de `.catch(function(){})` silenciosos: interceptamos fetch, asi
 *      vemos el fallo aunque nadie lo maneje.
 *   2) Errores de JavaScript no atrapados (window.onerror).
 *   3) Promesas rechazadas sin catch (unhandledrejection).
 *
 * Es best-effort y a prueba de fallos: si algo aca falla, NUNCA rompe la pagina
 * ni interfiere con el flujo normal. Incluir con:  <script src="pw-observe.js"></script>
 */
(function () {
  "use strict";
  try {
    var SB = "https://mxkljqhlwiqavbjfjfov.supabase.co";
    var KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkeG5yc25qZHZ0cWh4dW54bndqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxNDk5MzksImV4cCI6MjA5MDcyNTkzOX0.t82X1x-PDgFDGYhKC7YXoRKhga9I8Hjet60QUYvtZLU";
    var ENDPOINT = SB + "/rest/v1/client_errors";

    var seen = {};        // dedupe por firma
    var sent = 0;         // tope por sesion
    var MAX = 25;
    var origFetch = window.fetch ? window.fetch.bind(window) : null;

    function who() {
      try {
        var u = JSON.parse(localStorage.getItem("mj_user") || "null");
        if (u && u.email) return ("" + u.email).toLowerCase();
      } catch (e) {}
      try { return (localStorage.getItem("pw_cli_email") || "").toLowerCase() || "anon"; } catch (e) {}
      return "anon";
    }

    function report(kind, detail) {
      try {
        if (sent >= MAX || !origFetch) return;
        var sig = kind + "|" + (detail || "").slice(0, 120);
        if (seen[sig]) return; seen[sig] = 1; sent++;
        var row = {
          kind: kind,
          detail: ("" + (detail || "")).slice(0, 600),
          page: location.pathname + location.hash,
          email: who(),
          ua: (navigator.userAgent || "").slice(0, 200),
          ts: new Date().toISOString()
        };
        // usamos el fetch original para no auto-dispararnos
        origFetch(ENDPOINT, {
          method: "POST",
          headers: { "apikey": KEY, "Authorization": "Bearer " + KEY, "Content-Type": "application/json", "Prefer": "return=minimal" },
          body: JSON.stringify(row),
          keepalive: true
        }).catch(function () {});
      } catch (e) {}
    }
    window.__pwReport = report; // por si queremos reportar a mano algun caso

    // 1) interceptar fetch: detectar fallos contra Supabase
    if (origFetch) {
      window.fetch = function (input, init) {
        var url = ""; try { url = typeof input === "string" ? input : (input && input.url) || ""; } catch (e) {}
        var method = (init && init.method) || (input && input.method) || "GET";
        var isSb = /\/rest\/v1\/|\/functions\/v1\/|\/storage\/v1\//.test(url);
        var isSelf = url.indexOf("/client_errors") >= 0;
        var p = origFetch(input, init);
        if (!isSb || isSelf) return p;
        return p.then(function (res) {
          try {
            if (res && !res.ok && res.status >= 400) {
              report("http_" + res.status, method + " " + shortUrl(url));
            }
          } catch (e) {}
          return res;
        }, function (err) {
          try { report("neterror", method + " " + shortUrl(url) + " — " + (err && err.message || err)); } catch (e) {}
          throw err; // no cambiamos el comportamiento original
        });
      };
    }

    function shortUrl(u) {
      try { return ("" + u).replace(SB, "").split("?")[0].slice(0, 160); } catch (e) { return "" + u; }
    }

    // 2) errores JS no atrapados
    window.addEventListener("error", function (e) {
      try {
        if (e && e.message) report("jserror", e.message + " @" + (e.filename || "").split("/").pop() + ":" + (e.lineno || ""));
      } catch (x) {}
    });

    // 3) promesas rechazadas sin catch
    window.addEventListener("unhandledrejection", function (e) {
      try {
        var r = e && e.reason;
        report("promise", (r && (r.message || r.toString && r.toString())) || "rejection");
      } catch (x) {}
    });
  } catch (e) { /* nunca romper la pagina por el observador */ }
})();
