/* pw-observe.js — DETECTOR DE HUMO.
 *
 * PROPUESTA — NO APLICADA. Rehecha sobre origin/main 5029ea96 (2026-08-20).
 *
 * Dos cosas distintas, y conviene no mezclarlas:
 *
 * A) OBSERVABILIDAD. El detector registraba `MÉTODO /ruta` y nada más: sin
 *    cuerpo de respuesta y sin query string. Con eso hay fallos vivos que no se
 *    pueden diagnosticar — el 502 de gcal-refresh no dice cuál de sus dos ramas
 *    se ejecuta, y el 400 de login.html no dice qué consulta lo provoca.
 *      1) El query string de la LLAMADA se sanea en vez de descartarse: se
 *         conservan nombres y operadores, se redactan los valores y se eliminan
 *         enteros los parámetros que puedan portar un secreto.
 *      2) Se captura el SOBRE del error (code/message/hint/error), nunca los
 *         datos, y cada valor pasa por scrub(): PostgreSQL mete el valor que
 *         choca dentro de `details` —`Key (email)=(alguien@…)`— así que sin ese
 *         filtro el sobre habría empezado a guardar correos. Se lee sobre
 *         res.clone(), así el flujo original queda intacto.
 *      3) La deduplicación se conserva, pero deja de perder volumen: cuenta las
 *         repeticiones y las vuelca en un resumen al abandonar la página.
 *
 * B) REVISIÓN DE `page`. Esto SUSTITUYE al saneado que entró en 914c6c75. No es
 *    un añadido: cambia una decisión de seguridad reciente, y por eso va
 *    explicado en detalle abajo, en safePage().
 *
 * Cero cambios de esquema: las columnas siguen siendo las seis de hoy y todo lo
 * nuevo viaja dentro de `detail`. La clave anon NO se toca.
 */
(function () {
  "use strict";
  try {
    var SB = "https://api.pathwaycareercoach.com";
    var KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkeG5yc25qZHZ0cWh4dW54bndqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxNDk5MzksImV4cCI6MjA5MDcyNTkzOX0.t82X1x-PDgFDGYhKC7YXoRKhga9I8Hjet60QUYvtZLU';
    var ENDPOINT = SB + "/rest/v1/client_errors";

    var seen = {};        // firma -> nº de veces vista
    var sent = 0;         // tope por sesion
    var MAX = 25;
    var origFetch = window.fetch ? window.fetch.bind(window) : null;

    // ── Saneado del query string DE LA LLAMADA ─────────────────────────────
    // Aquí sí hace falta el valor a veces: `distinct=true` es lo que explica un
    // 400. Se conservan los nombres y los operadores, se redactan los valores y
    // se elimina entero cualquier parámetro que pueda portar un secreto.
    var DENY = /(token|handoff|apikey|api_key|password|passwd|secret|jwt|bearer|session|refresh|access)/i;
    var SCHEMA_OK = { select: 1, order: 1, limit: 1, offset: 1, columns: 1, on_conflict: 1 };
    var SAFE_LITERAL = /^[A-Za-z0-9_*.-]{1,20}$/;

    function safeValue(v) {
      if (!v) return "";
      var dot = v.indexOf(".");
      if (dot > 0 && dot <= 12) {
        var op = v.slice(0, dot);
        if (/^[a-z]+$/.test(op)) return op + ".<v>";   // eq.<v>, ilike.<v>, in.<v>
      }
      if (SAFE_LITERAL.test(v) && v.indexOf("@") < 0) return v;  // true, 1, asc
      return "<v>";
    }

    function safeQuery(q) {
      try {
        if (!q) return "";
        var parts = q.split("&"), out = [], i, kv, k, v;
        for (i = 0; i < parts.length && out.length < 12; i++) {
          kv = parts[i].split("=");
          k = decodeURIComponent(kv[0] || "");
          if (!k || DENY.test(k)) continue;             // fuera entero
          v = kv.length > 1 ? decodeURIComponent(kv.slice(1).join("=")) : "";
          if (SCHEMA_OK[k.toLowerCase()]) out.push(k + "=" + v.slice(0, 80));
          else out.push(k + "=" + safeValue(v));
        }
        return out.length ? "?" + out.join("&") : "";
      } catch (e) { return "?<ilegible>"; }
    }

    function shortUrl(u) {
      try {
        var s = ("" + u).replace(SB, "");
        var i = s.indexOf("?");
        var path = (i < 0 ? s : s.slice(0, i)).slice(0, 160);
        return path + (i < 0 ? "" : safeQuery(s.slice(i + 1)).slice(0, 200));
      } catch (e) { return "" + u; }
    }

    // ── Sobre del error: solo estas claves, nunca los datos ────────────────
    var ENVELOPE = ["code", "message", "hint", "error", "error_description", "reason", "details"];

    // Capturar el sobre no basta: PostgreSQL escribe el VALOR que choca dentro
    // de `details` —`Key (email)=(alguien@ejemplo.com) already exists.`— y en
    // esta app hay 409 sobre `candidatos`. Sin este filtro, arreglar `page`
    // habría cerrado una puerta y abierto otra. Se redacta por FORMA, no por
    // nombre: no hay que saber cómo se llama el dato para no guardarlo.
    function scrub(v) {
      try {
        return ("" + v)
          .replace(/=\([^)]*\)/g, "=(<v>)")                                     // Key (col)=(valor)
          .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "<email>")
          .replace(/eyJ[A-Za-z0-9_-]{6,}/g, "<jwt>")                            // cualquier JWT
          .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "<uuid>");
      } catch (e) { return "<ilegible>"; }
    }

    function envelope(text) {
      try {
        if (!text) return "";
        var o = JSON.parse(text);
        if (!o || typeof o !== "object" || Object.prototype.toString.call(o) === "[object Array]") return "";
        var out = [], i, k;
        for (i = 0; i < ENVELOPE.length; i++) {
          k = ENVELOPE[i];
          if (typeof o[k] === "string" && o[k]) out.push(k + "=" + scrub(o[k]).slice(0, 120));
          else if (o[k] && typeof o[k] === "object" && o[k].message) out.push(k + "=" + scrub(o[k].message).slice(0, 120));
        }
        return out.length ? " {" + out.join("; ").slice(0, 240) + "}" : "";
      } catch (e) { return ""; }
    }

    // ── `page`: SUSTITUYE al saneado de 914c6c75 ───────────────────────────
    //
    // Aquello hacía dos cosas:
    //   `page = location.pathname + location.search`, y del fragmento borraba
    //   nueve nombres conocidos dejando pasar el resto.
    //
    // Dos problemas, y el primero es el grave:
    //
    //   1) Guardar `location.search` ENTERO metió datos personales donde antes
    //      no los había. En estas páginas viajan por query string `email`,
    //      `coach`, `name`, `photo`, `id` y `slug`. Ya hay filas en
    //      `client_errors` con el correo del cliente y el UUID del coach dentro
    //      de `page`, escritas después de ese cambio.
    //   2) Borrar por lista de nombres exige conocerlos todos. Hoy deja pasar
    //      `expires_in`, `expires_at`, `token_type` —inocuos— y también
    //      `provider_refresh_token`, que no lo es, si el proveedor lo emite.
    //      Una lista negra siempre va por detrás de lo que hay que proteger.
    //
    // La forma de arreglarlo no es alargar la lista: es dejar de guardar
    // valores. Para diagnosticar hace falta saber EN QUÉ PÁGINA pasó y QUÉ
    // PARÁMETROS había, nunca cuáles eran.
    //
    //   · de la ruta: entera;
    //   · del query string: solo los NOMBRES, nunca los valores;
    //   · del fragmento: solo la señal de que existía.
    //
    // Así no hace falta saber cómo se llaman los secretos: no se guarda ningún
    // valor, venga de donde venga. Es una lista blanca por forma, no por nombre.
    // Y no toca el flujo de autenticación: esto solo decide qué se registra.
    var NOMBRE_OK = /^[A-Za-z0-9_-]{1,24}$/;

    function safePage() {
      try {
        var p = ("" + (location.pathname || "")).slice(0, 160);
        var s = "" + (location.search || "");
        if (s.length > 1) {
          var nombres = [], partes = s.slice(1).split("&"), i, k;
          for (i = 0; i < partes.length && nombres.length < 8; i++) {
            k = partes[i].split("=")[0];
            if (k && NOMBRE_OK.test(k)) nombres.push(k);
          }
          if (nombres.length) p += "?" + nombres.join(",");
        }
        if (location.hash) p += "#";     // hubo fragmento; su contenido, jamás
        return p.slice(0, 200);
      } catch (e) { return ""; }
    }

    function who() {
      try {
        var u = JSON.parse(localStorage.getItem("mj_user") || "null");
        if (u && u.email) return ("" + u.email).toLowerCase();
      } catch (e) {}
      try { return (localStorage.getItem("pw_cli_email") || "").toLowerCase() || "anon"; } catch (e) {}
      return "anon";
    }

    function post(row) {
      try {
        origFetch(ENDPOINT, {
          method: "POST",
          headers: { "apikey": KEY, "Authorization": "Bearer " + KEY, "Content-Type": "application/json", "Prefer": "return=minimal" },
          body: JSON.stringify(row), keepalive: true
        }).catch(function () {});
      } catch (e) {}
    }

    function report(kind, detail) {
      try {
        if (!origFetch) return;
        var sig = kind + "|" + (detail || "").slice(0, 120);
        if (seen[sig]) { seen[sig]++; return; }        // dedupe, pero contando
        seen[sig] = 1;
        if (sent >= MAX) return;
        sent++;
        post({
          kind: kind,
          detail: ("" + (detail || "")).slice(0, 600),
          page: safePage(),
          email: who(),
          ua: (navigator.userAgent || "").slice(0, 200),
          ts: new Date().toISOString()
        });
      } catch (e) {}
    }
    window.__pwReport = report; // por si queremos reportar a mano algun caso

    // Resumen al abandonar la página: recupera el volumen que la dedupe ocultaba.
    function flush() {
      try {
        var reps = [], k;
        for (k in seen) if (seen[k] > 1) reps.push(seen[k] + "x " + k.slice(0, 80));
        if (!reps.length) return;
        post({
          kind: "summary",
          detail: reps.join(" | ").slice(0, 600),
          page: safePage(),
          email: who(), ua: (navigator.userAgent || "").slice(0, 200),
          ts: new Date().toISOString()
        });
      } catch (e) {}
    }
    try { window.addEventListener("pagehide", flush); } catch (e) {}

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
              var base = method + " " + shortUrl(url);
              var ct = ""; try { ct = (res.headers && res.headers.get && res.headers.get("content-type")) || ""; } catch (e) {}
              if (/json/i.test(ct) && res.clone) {
                // CLAVE: se lee sobre una COPIA. El cuerpo original queda intacto.
                res.clone().text().then(function (t) {
                  report("http_" + res.status, base + envelope(t));
                }, function () { report("http_" + res.status, base); });
              } else {
                report("http_" + res.status, base);
              }
            }
          } catch (e) {}
          return res;   // se devuelve YA, sin esperar a la lectura del cuerpo
        }, function (err) {
          try { report("neterror", method + " " + shortUrl(url) + " — " + (err && err.message || err)); } catch (e) {}
          throw err; // no cambiamos el comportamiento original
        });
      };
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
