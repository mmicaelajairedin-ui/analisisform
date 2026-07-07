// pw-auth.js — Helper de sesión Supabase Auth para las páginas con datos
// sensibles (panel-v2, cliente, cv, carta).
//
// POR QUÉ EXISTE:
// Hasta ahora todo el frontend lee/escribe con la anon key directo a PostgREST.
// Para poder prender RLS estricto sin romper la app, cada request a las tablas
// con datos personales (candidatos, informes, cv_publicados, usuarios) tiene que
// viajar con el JWT del usuario logueado, no con la anon key. Este helper:
//   1) carga el SDK de Supabase (si no está),
//   2) reusa la MISMA sesión que dejó login.html / auth-callback.html
//      (mismo project ref → misma storageKey "sb-<ref>-auth-token"),
//   3) refresca el access_token solo cuando hace falta (autoRefreshToken),
//   4) expone PWAUTH.headers() → { apikey, Authorization: Bearer <jwt> }.
//
// FALLBACK SEGURO: si no hay sesión (usuario viejo sin migrar, o intake anónimo),
// devuelve la anon key. Mientras RLS esté APAGADO esto funciona igual que antes;
// cuando se prenda RLS, un request sin sesión simplemente no ve datos (que es
// justo el lockdown buscado). Por eso se puede deployar este cambio sin romper
// nada y prender RLS después, en una ventana controlada.
(function () {
  var SB_URL = "https://api.pathwaycareercoach.com";
  var ANON =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkeG5yc25qZHZ0cWh4dW54bndqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxNDk5MzksImV4cCI6MjA5MDcyNTkzOX0.t82X1x-PDgFDGYhKC7YXoRKhga9I8Hjet60QUYvtZLU";

  var _client = null;
  var _ready = null;

  // Carga el SDK (una vez) y crea el client reusando la sesión persistida.
  function ensure() {
    if (_ready) return _ready;
    _ready = new Promise(function (resolve) {
      function init() {
        try {
          _client = window.supabase.createClient(SB_URL, ANON, {
            auth: { persistSession: true, autoRefreshToken: true },
          });
        } catch (e) {
          _client = null;
        }
        resolve(_client);
      }
      if (window.supabase && window.supabase.createClient) {
        init();
        return;
      }
      var s = document.createElement("script");
      s.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
      s.onload = init;
      s.onerror = function () {
        resolve(null);
      };
      document.head.appendChild(s);
    });
    return _ready;
  }

  // Lee el access_token directo de localStorage (donde el SDK persiste la
  // sesión, key "sb-<ref>-auth-token"). SÍNCRONO → sirve para reemplazar los
  // objetos de headers inline sin volver async cada fetch. El SDK (booteado en
  // ensure()) refresca ese token en background, así que se mantiene fresco.
  function tokenSync() {
    try {
      var raw = localStorage.getItem("sb-ddxnrsnjdvtqhxunxnwj-auth-token");
      if (!raw) return null;
      var o = JSON.parse(raw);
      var sess = o && (o.currentSession || o.session || o);
      var t = sess && sess.access_token;
      var exp = sess && sess.expires_at; // epoch en segundos
      if (!t) return null;
      // Si está vencido (o a < 10s de vencer) → null → fallback a anon.
      if (exp && exp * 1000 < Date.now() + 10000) return null;
      return t;
    } catch (e) {
      return null;
    }
  }

  // Devuelve un access_token fresco, o null si no hay sesión.
  function token() {
    return ensure()
      .then(function (c) {
        if (!c) return null;
        return c.auth.getSession();
      })
      .then(function (r) {
        var s = r && r.data && r.data.session;
        return (s && s.access_token) || null;
      })
      .catch(function () {
        return null;
      });
  }

  window.PWAUTH = {
    url: SB_URL,
    anon: ANON,
    ensure: ensure,
    token: token,
    // headers(extra) → Promise<{apikey, Authorization, ...extra}>
    // Usa el JWT si hay sesión; si no, la anon key.
    headers: function (extra) {
      return token().then(function (t) {
        var h = { apikey: ANON, Authorization: "Bearer " + (t || ANON) };
        if (extra) for (var k in extra) if (extra.hasOwnProperty(k)) h[k] = extra[k];
        return h;
      });
    },
    // Versión SÍNCRONA de headers() (lee el token de localStorage). Úsala para
    // reemplazar objetos de headers inline sin volver async el fetch.
    headersSync: function (extra) {
      var t = tokenSync();
      var h = { apikey: ANON, Authorization: "Bearer " + (t || ANON) };
      if (extra) for (var k in extra) if (extra.hasOwnProperty(k)) h[k] = extra[k];
      return h;
    },
    // ¿Hay sesión autenticada activa? (para que el frontend pueda avisar
    // "iniciá sesión de nuevo" cuando RLS ya esté prendido y no haya token).
    hasSession: function () {
      return token().then(function (t) {
        return !!t;
      });
    },
  };

  // ── Interceptor de fetch (Fase A del cierre de RLS) ─────────────────────
  // Sube el Authorization al JWT del usuario logueado para las llamadas a las
  // tablas con RLS estricto (candidatos / informes / cv_publicados). Centraliza
  // la migración: con esto TODA página que incluya pw-auth.js manda la sesión a
  // esas tablas, sin tener que reescribir cada fetch inline.
  //
  // Garantías de seguridad de este cambio:
  //   • Es un NO-OP mientras RLS esté APAGADO (solo cambia el token; el server
  //     devuelve lo mismo). Se puede deployar sin coordinar con el SQL.
  //   • SIN sesión (intake anónimo del formulario, lecturas públicas, pre-login)
  //     deja la anon key intacta → esos flujos siguen funcionando.
  //   • Solo toca headers en objeto plano (los fetch inline del código). Si la
  //     request viene del SDK de Supabase (Request/Headers), no la toca: el SDK
  //     ya manda su propio JWT.
  var RLS_TABLES = /\/rest\/v1\/(candidatos|informes|cv_publicados)\b/;
  var _origFetch = (typeof window !== "undefined" && window.fetch)
    ? window.fetch.bind(window) : null;
  if (_origFetch) {
    window.fetch = function (input, init) {
      try {
        var url = (typeof input === "string") ? input
                : (input && input.url) ? input.url : "";
        if (url.indexOf(SB_URL) === 0 && RLS_TABLES.test(url)) {
          var tok = tokenSync();
          if (tok) {
            var anonBearer = "Bearer " + ANON, jwtBearer = "Bearer " + tok;
            var h = init && init.headers;
            if (h instanceof Headers) {
              var cur = h.get("Authorization") || "";
              if (cur === "" || cur === anonBearer) {
                h.set("Authorization", jwtBearer);
                if (!h.get("apikey")) h.set("apikey", ANON);
              }
            } else if (h && typeof h === "object" && !Array.isArray(h)) {
              var c2 = h.Authorization || h.authorization || "";
              if (c2 === "" || c2 === anonBearer) {
                init = Object.assign({}, init);
                init.headers = Object.assign({}, h, { Authorization: jwtBearer });
                if (!init.headers.apikey) init.headers.apikey = ANON;
              }
            }
            // Si no hay headers (o es un Request del SDK) no tocamos nada.
          }
        }
      } catch (e) { /* ante cualquier duda, fetch normal */ }
      return _origFetch(input, init);
    };
  }

  // Bootea el SDK al cargar el script, para que arranque el autoRefreshToken y
  // mantenga fresco el token en localStorage (lo que lee headersSync()).
  ensure();
})();
