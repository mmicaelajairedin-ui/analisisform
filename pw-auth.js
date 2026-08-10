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
  var ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkeG5yc25qZHZ0cWh4dW54bndqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxNDk5MzksImV4cCI6MjA5MDcyNTkzOX0.t82X1x-PDgFDGYhKC7YXoRKhga9I8Hjet60QUYvtZLU';  // Hardcoded fallback (matching login.html, pw-observe.js)

  var _client = null;
  var _ready = null;

  // Carga el SDK (una vez) y crea el client reusando la sesión persistida.
  function ensure() {
    if (_ready) return _ready;
    _ready = new Promise(function (resolve) {
      function init() {
        try {
          var key = ANON || '';
          _client = window.supabase.createClient(SB_URL, key, {
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
      // Anti-cuelgue: si el CDN no responde (bloqueado, caído, red lenta), el
      // script tag puede quedar pendiente sin disparar onload NI onerror. Sin este
      // timeout, ensure() nunca resolvería y TODA lectura/escritura quedaría
      // colgada en "Procesando…". A los 6s seguimos sin SDK (headers cae al token
      // de localStorage / anon).
      var _to = setTimeout(function () { resolve(null); }, 6000);
      s.onload = function () { clearTimeout(_to); init(); };
      s.onerror = function () { clearTimeout(_to); resolve(null); };
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
      // supabase-js persiste la sesión bajo una key "sb-<algo>-auth-token", donde
      // "<algo>" lo DERIVA del hostname de la URL del cliente. Con el dominio custom
      // (api.pathwaycareercoach.com) eso NO es el ref del proyecto. Antes esta key
      // estaba hardcodeada al ref viejo → nunca se encontraba el token y TODO caía a
      // la anon key (invisible sin RLS, pero fatal con RLS: portales vacíos).
      // Ahora recorremos cualquier key sb-*-auth-token y devolvemos el primer token
      // válido (no vencido). Domain-agnóstico: sirve para cualquier dominio.
      var now = Date.now();
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (!k || k.indexOf("sb-") !== 0 || k.indexOf("-auth-token") < 0) continue;
        try {
          var o = JSON.parse(localStorage.getItem(k) || "null");
          var sess = o && (o.currentSession || o.session || o);
          var t = sess && sess.access_token;
          var exp = sess && sess.expires_at; // epoch en segundos
          if (!t) continue;
          // Vencido (o a < 10s de vencer) → seguir buscando otra key.
          if (exp && exp * 1000 < now + 10000) continue;
          return t;
        } catch (e) { /* key no parseable → probar la siguiente */ }
      }
      return null;
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

  // Fuerza un refresh del token con el refresh_token (self-healing de sesión).
  // Devuelve true si quedó una sesión válida. Deduplicado: refrescos concurrentes
  // comparten la MISMA promesa (no hay estampida cuando fallan varios fetch juntos).
  var _refreshing = null;
  function refreshOnce() {
    if (_refreshing) return _refreshing;
    _refreshing = ensure().then(function (c) {
      if (!c || !c.auth || !c.auth.refreshSession) return false;
      return c.auth.refreshSession().then(
        function (r) { return !!(r && r.data && r.data.session && r.data.session.access_token); },
        function () { return false; }
      );
    }).catch(function () { return false; });
    _refreshing.then(
      function () { setTimeout(function () { _refreshing = null; }, 2000); },
      function () { _refreshing = null; }
    );
    return _refreshing;
  }

  window.PWAUTH = {
    url: SB_URL,
    anon: ANON,
    ensure: ensure,
    token: token,
    // headers(extra) → Promise<{apikey, Authorization, ...extra}>
    // Usa el JWT si hay sesión; si no, la anon key.
    headers: function (extra) {
      // Anti-cuelgue (bug "se queda procesando…"): token() puede tardar o no
      // resolver nunca si el SDK del CDN no cargó o un refresh de sesión se
      // stallea. Como TODO fetch (lectura y escritura) espera acá, un token()
      // colgado congela la app entera. Solución: carrera contra un timeout — a
      // los 3.5s resolvemos con el token que YA está en localStorage (el SDK lo
      // mantiene fresco en background) o, en última instancia, la anon key. Así
      // ninguna acción queda trabada; a lo sumo, si el token venció, el server
      // responde 401 y el flujo normal manda a re-loguear (mejor que colgarse).
      return new Promise(function (resolve) {
        var done = false;
        function finish(t) {
          if (done) return; done = true;
          var h = { apikey: ANON, Authorization: "Bearer " + (t || tokenSync() || ANON) };
          if (extra) for (var k in extra) if (extra.hasOwnProperty(k)) h[k] = extra[k];
          resolve(h);
        }
        var timer = setTimeout(function () { finish(tokenSync()); }, 3500);
        token().then(
          function (t) { clearTimeout(timer); finish(t); },
          function () { clearTimeout(timer); finish(tokenSync()); }
        );
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
  // `usuarios` incluido: bajo RLS estricto, el coach edita SU fila (config, perfil)
  // y la policy usuarios_self_update exige el JWT. El interceptor solo sube el
  // token cuando HAY sesión (tok truthy); el registro/intake anónimo (sin sesión)
  // no se ve afectado. Los reads públicos del directorio siguen andando con o sin JWT.
  var RLS_TABLES = /\/rest\/v1\/(candidatos|informes|cv_publicados|usuarios)\b/;
  var _origFetch = (typeof window !== "undefined" && window.fetch)
    ? window.fetch.bind(window) : null;
  if (_origFetch) {
    window.fetch = function (input, init) {
      var _isStr = (typeof input === "string");
      var _url = _isStr ? input : (input && input.url) ? input.url : "";
      var _rls = (_url.indexOf(SB_URL) === 0 && RLS_TABLES.test(_url));
      try {
        if (_rls) {
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
      var _p = _origFetch(input, init);
      // ── Self-healing de sesión (todo Pathway) ──────────────────────────────
      // Si el server rechaza por sesión vencida (401/403) una lectura/escritura a
      // una tabla con RLS, refrescamos el JWT y REINTENTAMOS una vez con el token
      // fresco. Un 401/403 = 0 filas tocadas → seguro reintentar (incluso un POST).
      // Cubre panel + portales del cliente + cv/carta de una, sin tocar cada uno.
      // Solo para fetch con URL string (los inline del código); las llamadas del
      // SDK (Request) traen su propio manejo de auth y no se tocan.
      if (!_rls || !_isStr) return _p;
      return _p.then(function (r) {
        if ((r.status !== 401 && r.status !== 403) || (init && init.__pwRetried)) return r;
        return refreshOnce().then(function (ok) {
          if (!ok) return r;
          var t2 = tokenSync(); if (!t2) return r;
          var init2 = {}; if (init) for (var kk in init) if (init.hasOwnProperty(kk)) init2[kk] = init[kk];
          init2.__pwRetried = true;
          var hh = {}; var oh = init2.headers || {};
          if (oh instanceof Headers) { oh.forEach(function (v, k) { hh[k] = v; }); }
          else { for (var hk in oh) if (oh.hasOwnProperty(hk)) hh[hk] = oh[hk]; }
          hh.Authorization = "Bearer " + t2; if (!hh.apikey && !hh.apiKey) hh.apikey = ANON;
          init2.headers = hh;
          return _origFetch(input, init2);
        }).catch(function () { return r; });
      });
    };
  }

  // Gate de sesión para los portales de cliente: cuando (con RLS prendido) el
  // cliente no tiene sesión, su ficha viene vacía. En vez de un portal en blanco,
  // le mostramos una pantalla para iniciar sesión (reusa login.html, ya probado).
  // Es un NO-OP hoy (RLS apagado): los portales solo lo llaman si la ficha vino
  // vacía Y no hay sesión, cosa que hoy no pasa para un cliente real.
  PWAUTH.showLoginGate = function () {
    try {
      if (document.getElementById("pw-login-gate")) return;
      var d = document.createElement("div");
      d.id = "pw-login-gate";
      d.style.cssText = "position:fixed;inset:0;z-index:100000;background:#eef2ef;display:flex;align-items:center;justify-content:center;padding:24px;font-family:Inter,-apple-system,system-ui,sans-serif;";
      d.innerHTML =
        '<div style="max-width:340px;width:100%;text-align:center;background:#fff;border-radius:18px;padding:34px 26px;box-shadow:0 12px 44px rgba(0,0,0,.14);">' +
          '<div style="font-size:38px;margin-bottom:12px;">🔒</div>' +
          '<div style="font-family:Georgia,serif;font-size:21px;font-weight:600;color:#1b2e26;margin-bottom:8px;">Iniciá sesión para ver tu portal</div>' +
          '<div style="font-size:14px;color:#5a6b62;line-height:1.55;margin-bottom:22px;">Por tu seguridad, entrá con tu cuenta para acceder a tus datos.</div>' +
          '<button id="pw-gate-btn" type="button" style="display:inline-block;background:#2D6A4F;color:#fff;border:none;border-radius:11px;padding:13px 30px;font-size:15px;font-weight:700;cursor:pointer;">Iniciar sesión</button>' +
        "</div>";
      document.body.appendChild(d);
      var b = document.getElementById("pw-gate-btn");
      if (b) b.onclick = function () { location.href = "/login.html"; };
    } catch (e) {}
  };

  // Interruptor del gate: en true → RLS estricto está ACTIVO en Supabase, y los
  // portales/paneles sin sesión mandan a login (en vez de quedar vacíos). Se
  // enciende el mismo día que se corre rls_strict.sql en la base. Reversible:
  // si hay que hacer rollback del RLS en la base, volver esto a false y deployar.
  PWAUTH.RLS_ON = true;

  // Bootea el SDK al cargar el script, para que arranque el autoRefreshToken y
  // mantenga fresco el token en localStorage (lo que lee headersSync()).
  ensure();
})();
