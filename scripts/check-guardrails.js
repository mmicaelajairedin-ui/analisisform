// GUARDIAN DE REGRESIONES — "vacuna" los bugs ya resueltos.
// Cada regla corresponde a un problema que YA arreglamos. Si alguien (humano o
// IA) lo vuelve a romper sin querer, esta prueba falla y frena el merge.
//
// Como agregar una regla: cuando arreglemos un bug, sumamos un objeto a RULES
// que detecte si vuelve. Asi el arreglo queda blindado para siempre.
//
// Correr local:  node scripts/check-guardrails.js
const fs = require("fs");

function read(f) { try { return fs.readFileSync(f, "utf8"); } catch (e) { return ""; } }

// Devuelve el JS inline concatenado + defs de scripts locales, para reglas que
// necesitan saber si una funcion esta definida.
function inlineJs(html) {
  let out = ""; const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi; let m;
  while ((m = re.exec(html))) { if (!/\bsrc\s*=/.test(m[1] || "")) out += "\n" + (m[2] || ""); }
  return out;
}
function isDefined(name, js) {
  return new RegExp("\\bfunction\\s+" + name + "\\b").test(js) ||
         new RegExp("\\b" + name + "\\s*=\\s*function\\b").test(js) ||
         new RegExp("\\b" + name + "\\s*=\\s*(?:async\\s*)?\\(").test(js) ||
         new RegExp("\\b(?:var|let|const)\\s+" + name + "\\s*=").test(js) ||
         new RegExp("\\bwindow\\." + name + "\\s*=").test(js);
}

const RULES = [
  {
    name: "auth-callback: foto de Google se setea/refresca, respeta la propia",
    bug: "La foto del coach por Google no aparecia (se guardaba en foto_perfil " +
         "y el panel lee foto_url). La de Google se setea si no tiene foto Y se " +
         "REFRESCA si la actual es de Google (esas URLs vencen/rotan). Una foto " +
         "subida a mano (no-Google) NO se pisa.",
    check() {
      const s = read("auth-callback.html");
      if (!s) return null;
      // El bug era guardar la foto del COACH en configuracion.foto_perfil. El
      // cliente SI usa candidatos.foto_perfil (eso es correcto), por eso solo
      // marcamos el caso del coach: cfg.foto_perfil = photoUrl.
      if (/cfg\.foto_perfil\s*=\s*photoUrl/.test(s))
        return "auth-callback.html guarda la foto del coach en configuracion.foto_perfil; debe ser foto_url.";
      if (!/foto_url\s*[:=]\s*photoUrl/.test(s) && !/cfg\.foto_url\s*=\s*photoUrl/.test(s))
        return "auth-callback.html ya no guarda la foto de Google en foto_url.";
      // Debe: setear si no hay foto O si la actual es de Google (refresca), y
      // recien ahi asignar photoUrl. Asi respeta una foto propia (no-Google).
      if (!/!cfg\.foto_url\s*\|\|[\s\S]*?googleusercontent[\s\S]*?cfg\.foto_url\s*=\s*photoUrl/.test(s))
        return "auth-callback.html: la foto del coach debe setearse si no tiene O si la actual es de Google (refresca), respetando una propia.";
      return null;
    },
  },
  {
    name: "panel-v2 recupera la foto del coach desde foto_perfil (fallback)",
    bug: "Coaches que ya tenian la foto en configuracion.foto_perfil deben seguir " +
         "viendola: el panel debe leer foto_url || foto_perfil.",
    check() {
      const s = read("panel-v2.html");
      if (!s) return null;
      if (!/cfg\s*&&\s*\(cfg\.foto_url\s*\|\|\s*cfg\.foto_perfil\)/.test(s))
        return "panel-v2.html perdio el fallback cfg.foto_url||cfg.foto_perfil para la foto del coach.";
      return null;
    },
  },
  {
    name: "drag&drop universal: pw-dropzone incluido y subidas nuevas cableadas",
    bug: "pw-dropzone.js convierte cada input[type=file] en dropzone sin tocar el " +
         "guardado (soltar = feed al input + change). La foto del cliente (fcli-foto) " +
         "persiste en candidatos.foto_perfil y el logo por archivo (cfb-logo-file) " +
         "llena #cfb-logo. Si algo se desconecta, la subida por drop deja de andar.",
    check() {
      const dz = read("pw-dropzone.js");
      if (!dz) return "falta pw-dropzone.js (helper de drag&drop universal).";
      if (!/input\[type="file"\]/.test(dz)) return "pw-dropzone.js ya no registra los input[type=file].";
      for (const f of ["panel-v2.html", "cliente.html", "pathway-fit-cliente.html", "pathway-fin-cliente.html", "cv.html", "empleado.html", "multicoach.html"]) {
        if (!/pw-dropzone\.js/.test(read(f))) return f + " ya no incluye pw-dropzone.js.";
      }
      const p = read("panel-v2.html");
      if (!/fcli-foto/.test(p)) return "panel-v2.html perdio la subida de foto del cliente (fcli-foto).";
      if (!/candidatos\?id=eq\.[\s\S]{0,160}foto_perfil/.test(p)) return "panel-v2.html: la foto del cliente ya no persiste en candidatos.foto_perfil.";
      if (!/cfb-logo-file/.test(p)) return "panel-v2.html perdio la subida de logo por archivo (cfb-logo-file).";
      return null;
    },
  },
  {
    name: "esc() (anti-XSS) esta definida donde se usa",
    bug: "esc() escapa HTML para evitar inyeccion. Si un archivo la usa pero no la " +
         "define (ni la importa), hay un agujero de seguridad / pagina rota.",
    check() {
      const offenders = [];
      for (const f of fs.readdirSync(".").filter((x) => x.endsWith(".html"))) {
        const html = read(f);
        const js = inlineJs(html);
        if (!/[^.\w]esc\s*\(/.test(js)) continue;       // no usa esc()
        let defined = isDefined("esc", js);
        if (!defined) {                                  // buscar en scripts locales
          const re = /<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi; let m;
          while ((m = re.exec(html))) {
            const p = m[1].split("?")[0].replace(/^\.?\//, "");
            if (!/^https?:/i.test(m[1]) && fs.existsSync(p) && isDefined("esc", read(p))) { defined = true; break; }
          }
        }
        if (!defined) offenders.push(f);
      }
      return offenders.length ? "usan esc() sin definirla: " + offenders.join(", ") : null;
    },
  },
  {
    name: "auth-callback liga auth_id en login con Google (Etapa 2 / RLS)",
    bug: "Los que entran con Google deben quedar ligados a Supabase Auth (auth_id) " +
         "para que RLS los reconozca. Si se quita, Google queda sin identidad ligada.",
    check() {
      const s = read("auth-callback.html");
      if (!s) return null;
      return /auth_id:\s*user\.id/.test(s) ? null
        : "auth-callback.html ya no liga auth_id en el login con Google.";
    },
  },
  {
    name: "tipografia unificada en cliente.html (solo Fraunces + Inter)",
    bug: "El portal career cargaba Poppins/Montserrat/Playfair de mas, rompiendo " +
         "la unidad tipografica con el resto de la plataforma (Fraunces + Inter).",
    check() {
      const s = read("cliente.html");
      if (!s) return null;
      const extra = ["Poppins", "Montserrat", "Playfair"].filter((f) => s.indexOf(f) >= 0);
      return extra.length ? "cliente.html volvio a usar fuentes ajenas: " + extra.join(", ") : null;
    },
  },
  {
    name: "el toggle 'Activar perfil publico' persiste al instante",
    bug: "El switch de perfil publico solo cambiaba state.pubActive en memoria y " +
         "llamaba render(): al refrescar volvia a estar apagado (nunca se guardaba " +
         "en la DB). El handler pub-toggle debe llamar a saveCfg() para persistir.",
    check() {
      const s = read("panel-v2.html");
      if (!s) return null;
      const i = s.search(/act===?["']pub-toggle["']/);
      if (i < 0) return "panel-v2.html ya no tiene el handler de pub-toggle.";
      const block = s.slice(i, i + 1200);
      if (!/saveCfg\s*\(/.test(block))
        return "el handler pub-toggle ya no llama a saveCfg() — el toggle no persiste y al refrescar se apaga.";
      return null;
    },
  },
  {
    name: "auth-callback hace merge por persona (no duplica usuarios con 2 emails)",
    bug: "Una misma persona con dos emails (su email de negocio + el Gmail con el " +
         "que entra por Google) creaba un usuario NUEVO por cada email. El login " +
         "con Google debe buscar primero si el email es un ALIAS de un usuario " +
         "existente (configuracion.emails_alias) ANTES de crear uno nuevo.",
    check() {
      const s = read("auth-callback.html");
      if (!s) return null;
      // La busqueda por alias debe correr antes del bloque que crea usuario nuevo.
      const iAlias = s.search(/configuracion=cs\.'\s*\+\s*aliasQ|emails_alias/);
      const iCreate = s.search(/rol:\s*'coach'/);
      if (iAlias < 0)
        return "auth-callback.html ya no busca el email como alias (emails_alias) — vuelve a duplicar usuarios.";
      if (iCreate >= 0 && iAlias > iCreate)
        return "la busqueda por alias quedo despues de crear el usuario — debe correr ANTES.";
      return null;
    },
  },
  {
    name: "la cabra (sendero gamificado) se renderiza en el Resumen del panel",
    bug: "coachPath() dibuja el sendero de la cabra. Si queda definida pero NADIE " +
         "la llama (como le paso a la tarjeta de onboarding vieja), la cabra " +
         "desaparece del panel sin error. Tiene que invocarse en viewResumen y " +
         "usar el fondo ilustrado.",
    check() {
      var p = read("panel-v2.html");
      if (!/pathCard\s*=\s*coachPath\(\)/.test(p))
        return "coachPath() no se invoca en el Resumen (la cabra quedaria huerfana).";
      if (!/assets\/cabra\/fondo\.webp/.test(p))
        return "falta el fondo ilustrado (assets/cabra/fondo.webp) en la escena.";
      return null;
    },
  },
  {
    name: "el logo del sidebar toma el color de marca del coach Pro (white-label)",
    bug: "El coach Pro sin logo propio veia la montañita Pathway con el verde " +
         "hardcodeado (#52B788) en el sidebar: _applyPanelBrand retiñe las vars " +
         "--pw-* pero NO un hex literal, asi que el logo quedaba verde mientras el " +
         "resto del panel cambiaba ('no cambia por completo'). El pico del SVG debe " +
         "usar var(--pw-sendero), igual que el punto del wordmark 'pathway.'.",
    check() {
      const s = read("panel-v2.html");
      if (!s) return null;
      const i = s.search(/cp-side-brand-word/);
      if (i < 0) return null; // si cambia el markup del brand, no bloquear
      const block = s.slice(Math.max(0, i - 600), i);
      if (/<polygon[^>]*fill='#52B788'/i.test(block))
        return "el logo del sidebar volvio a usar #52B788 hardcodeado — no toma el color de marca del coach Pro.";
      return null;
    },
  },
  {
    name: "el color de marca tiñe TODA la familia --rose en los portales de cliente",
    bug: "applyBrand/applyBrandFin solo pisaban --rose y --rose-dark, dejando " +
         "--rose-light y --rose-mid en verde: el portal del cliente cambiaba de " +
         "color pero los fondos claros quedaban verdosos ('no cambia por completo'). " +
         "Ahora derivan toda la familia via _pwBrandVars().",
    check() {
      for (const f of ["pathway-fit-cliente.html", "pathway-fin-cliente.html"]) {
        const s = read(f);
        if (!s) continue;
        if (!/_pwBrandVars\s*\(/.test(s))
          return f + " ya no usa _pwBrandVars() para aplicar el color de marca.";
        if (!/--rose-light/.test(s) || !/--rose-mid/.test(s))
          return f + ": _pwBrandVars() ya no setea --rose-light/--rose-mid (los tonos claros quedan en verde).";
        // El chrome (sidebar/bordes/sombra) también debe derivar de la marca,
        // igual que el panel — si no, el portal queda con verde Pathway mezclado.
        if (!/--sb-bg/.test(s) || !/--border'/.test(s) || !/--shadow'/.test(s))
          return f + ": _pwBrandVars() ya no deriva el chrome (--sb-bg/--border/--shadow) del color de marca.";
      }
      return null;
    },
  },
  {
    name: "el portal del cliente demo refleja el color de marca del coach",
    bug: "El demo (fitness/finanzas) mostraba siempre el verde Pathway porque " +
         "_demoBrandFit/_demoBrandFin solo seteaban nombre y foto. El color del " +
         "coach demo viaja en el overlay (snap.brand) que guarda _demoSnapshot y " +
         "el portal lo aplica con _pwBrandVars.",
    check() {
      const p = read("panel-v2.html");
      if (p && !/snap\.brand\s*=/.test(p))
        return "panel-v2.html: _demoSnapshot ya no guarda snap.brand (el color del coach no llega al demo).";
      for (const f of ["pathway-fit-cliente.html", "pathway-fin-cliente.html"]) {
        const s = read(f);
        if (!s) continue;
        if (!/_ov\.brand[\s\S]{0,40}_pwBrandVars/.test(s))
          return f + ": el demo ya no aplica el color de marca del overlay (_ov.brand).";
      }
      return null;
    },
  },
  {
    name: "Sesiones del cliente: mismo diseño (hero + timeline) + columna de documentos en los 3 nichos",
    bug: "Los 3 portales de cliente (carrera/fitness/finanzas) deben mostrar la " +
         "sección Sesiones con el MISMO diseño del panel del coach: hero con " +
         "degradado (.ses-hero), historial en timeline (.ses-tl) y una columna a la " +
         "derecha con los documentos que sube el coach (.ses-layout + .ses-doc-item). " +
         "Si un nicho pierde la columna o el diseño se desincroniza, deja de ser igual.",
    check() {
      for (const f of ["cliente.html", "pathway-fit-cliente.html", "pathway-fin-cliente.html"]) {
        const s = read(f);
        if (!s) continue;
        if (!/ses-layout/.test(s))
          return f + ": falta el layout de 2 columnas (.ses-layout) en Sesiones.";
        if (!/ses-hero/.test(s) || !/ses-tl/.test(s))
          return f + ": falta el hero con degradado (.ses-hero) o el timeline (.ses-tl) del historial.";
        if (!/ses-doc-item/.test(s) && !/id=["']ses-docs["']/.test(s))
          return f + ": falta la columna de documentos del coach (.ses-doc-item / #ses-docs).";
      }
      // El CSS de fit/fin vive en pathway-portal.css; el de carrera, inline.
      if (!/\.ses-layout\s*\{/.test(read("pathway-portal.css")))
        return "pathway-portal.css perdió el layout .ses-layout de la sección Sesiones.";
      // fit/fin: el cliente marca sus tareas con toggleSesTarea.
      for (const f of ["pathway-fit-cliente.html", "pathway-fin-cliente.html"]) {
        if (read(f) && !/toggleSesTarea/.test(read(f)))
          return f + ": el cliente ya no puede marcar sus tareas (toggleSesTarea).";
      }
      return null;
    },
  },
  {
    name: "el selector 'Demo · tipo de coach' no rompe el bottom-nav en movil",
    bug: "El bloque para cambiar el tipo de coach en el demo estaba con estilos " +
         "inline (texto blanco) dentro del sidebar. En movil el sidebar es la barra " +
         "inferior: ese bloque (a) empujaba los iconos a la derecha y (b) quedaba " +
         "blanco-sobre-blanco (intocable). Debe usar la clase .cp-demo-switch y " +
         "reposicionarse (position:fixed) en el media query movil.",
    check() {
      const s = read("panel-v2.html");
      if (!s) return null;
      if (!/class='cp-demo-switch'/.test(s) && !/class=\"cp-demo-switch\"/.test(s))
        return "panel-v2.html: el selector demo-tipo ya no usa la clase .cp-demo-switch (vuelve a romper el bottom-nav en movil).";
      if (!/\.cp-demo-switch\s*\{[^}]*position:fixed/.test(s.replace(/\n/g, " ")))
        return "panel-v2.html: falta reposicionar .cp-demo-switch (position:fixed) en movil — los iconos del nav se descentran.";
      return null;
    },
  },
  {
    name: "dentro de la app de tienda NO se muestran cobros (Apple/Google billing)",
    bug: "Las tiendas exigen su sistema de cobro para compras digitales en la app. " +
         "pw-app.js detecta 'dentro de la app' (clase .pw-in-app) y oculta los botones " +
         "de Stripe/planes; el panel y el login muestran 'renová en la web' (sin link). " +
         "Si esto se rompe, la app se cae en la revision de Apple/Google.",
    check() {
      const j = read("pw-app.js");
      if (!j) return "falta pw-app.js (detector de app de tienda).";
      if (!/PW_IN_APP/.test(j)) return "pw-app.js ya no expone window.PW_IN_APP.";
      if (!/buy\.stripe\.com/.test(j)) return "pw-app.js ya no oculta los botones que abren Stripe en la app.";
      for (const f of ["login.html", "panel-v2.html", "upgrade.html"]) {
        if (read(f) && !/pw-app\.js/.test(read(f)))
          return f + " ya no incluye pw-app.js.";
      }
      if (!/PW_IN_APP/.test(read("panel-v2.html")))
        return "panel-v2.html ya no contempla PW_IN_APP (la pantalla de prueba vencida volveria a mostrar Stripe en la app).";
      if (!/PW_IN_APP/.test(read("login.html")))
        return "login.html ya no contempla PW_IN_APP (el paywall volveria a mostrar el link de Stripe en la app).";
      return null;
    },
  },
  {
    name: "el detector de humo (pw-observe.js) sigue incluido en las paginas clave",
    bug: "pw-observe.js registra los errores de produccion. Si se quita de una " +
         "pagina, esa pagina vuelve a operar a ciegas.",
    check() {
      var must = ["panel-v2.html", "cliente.html", "pathway-fit-cliente.html",
        "pathway-fin-cliente.html", "login.html", "formulario.html",
        "pathway-fit-form.html", "pathway-fin-form.html", "cv.html", "auth-callback.html"];
      var missing = must.filter(function (f) { return !/pw-observe\.js/.test(read(f)); });
      return missing.length ? "les falta pw-observe.js: " + missing.join(", ") : null;
    },
  },
  {
    name: "pw-auth.js: el interceptor de RLS sigue subiendo el JWT a las tablas sensibles",
    bug: "El cierre del gap de RLS depende de que pw-auth.js intercepte fetch y " +
         "suba el Authorization al JWT del usuario para candidatos/informes/" +
         "cv_publicados. Si se quita, esas paginas volverian a pegar con la anon " +
         "key y, con RLS prendido, el panel/portal se quedarian sin datos (o, con " +
         "RLS apagado, se reabre el gap). Esta regla evita borrarlo sin querer.",
    check() {
      const s = read("pw-auth.js");
      if (!s) return "no existe pw-auth.js";
      const hasTables = /candidatos\|informes\|cv_publicados/.test(s);
      const wrapsFetch = /window\.fetch\s*=\s*function/.test(s);
      return (hasTables && wrapsFetch) ? null
        : "falta el interceptor de fetch para las tablas con RLS estricto";
    },
  },
  {
    name: "pw-auth.js: headers() nunca se cuelga (anti 'Procesando…' infinito)",
    bug: "TODO fetch (lectura y escritura) del panel/portales espera a " +
         "PWAUTH.headers() → token() → ensure(), y ensure() carga el SDK de " +
         "Supabase desde un CDN. Si el CDN no responde o un refresh de sesión se " +
         "stallea, headers() no resolvía nunca y CUALQUIER acción quedaba en " +
         "'Procesando…' para siempre (agregar coach/cliente, enviar chat). Fix: " +
         "headers() corre contra un timeout y cae al token de localStorage/anon; " +
         "y la carga del SDK tiene su propio timeout. No quitar ninguno de los dos.",
    check() {
      const s = read("pw-auth.js");
      if (!s) return "no existe pw-auth.js";
      // headers() debe tener una carrera contra timeout con fallback a tokenSync.
      const seg = s.slice(s.indexOf("headers: function"));
      if (!/setTimeout\([\s\S]{0,120}?finish\(tokenSync\(\)\)/.test(seg))
        return "pw-auth.js: headers() perdió el timeout anti-cuelgue (podría quedar en 'Procesando…' para siempre).";
      // La carga del SDK por CDN también debe tener timeout (no dejar ensure() colgado).
      if (!/onerror[\s\S]{0,60}?resolve\(null\)/.test(s) || !/setTimeout\(function\s*\(\)\s*\{\s*resolve\(null\)/.test(s))
        return "pw-auth.js: la carga del SDK perdió su timeout/fallback (ensure() podría colgarse).";
      return null;
    },
  },
  {
    name: "informes: se guardan varios como archivos por cliente (no se pisan)",
    bug: "El informe con IA se guardaba UNO por cliente (informes, unique email) y " +
         "se pisaba al regenerar. Ahora la ficha (pestaña Documentos) tiene la sección " +
         "'Informes ✨ IA Pathway': guardás VARIOS como archivos en la tabla nueva " +
         "informes_guardados (por email + coach_id, aislado), con lista y visor. La " +
         "carga es resiliente (si falta la migración, muestra vacío, no rompe).",
    check() {
      const p = read("panel-v2.html");
      if (!p) return null;
      if (!/act==="inf-save"/.test(p) || !/act==="inf-open"/.test(p))
        return "panel-v2.html: faltan los handlers de informes guardados (inf-save/inf-open).";
      if (!/function _infFilesLoad/.test(p))
        return "panel-v2.html: falta _infFilesLoad (lista de informes guardados por cliente).";
      if (!/informes_guardados/.test(p))
        return "panel-v2.html: ya no se usa la tabla informes_guardados.";
      // Aislamiento: la consulta de informes guardados filtra por coach (cg()).
      if (!/informes_guardados\?[^"']*"\+encodeURIComponent\([^)]*\)\+cg\(\)/.test(p) && !/informes_guardados[\s\S]{0,120}?cg\(\)/.test(p))
        return "panel-v2.html: la lista de informes guardados perdió el filtro por coach (cg()).";
      if (!read("supabase/migrations/informes_guardados.sql"))
        return "falta la migración informes_guardados.sql.";
      return null;
    },
  },
  {
    name: "reservas: preguntas propias del coach + respuestas visibles (sin defaults)",
    bug: "Cada coach arma sus propias preguntas en su tipo de evento (event_types" +
         "[].questions). NO hay preguntas predefinidas del sistema: reservar.html " +
         "dejó de tener f-msg/f-src hardcodeados y solo muestra lo que el coach " +
         "cargó (qFields). Las respuestas se guardan en citas.respuestas y el coach " +
         "las ve en su lista de reservas (_citaAnswers). El INSERT reintenta sin " +
         "'respuestas' si la columna no existe, y el panel lee con select=* para no " +
         "romper la lista donde falta la migración.",
    check() {
      const p = read("panel-v2.html"), r = read("reservar.html");
      if (!p || !r) return null;
      // Panel: el tipo de evento guarda 'questions' y existe el armador.
      if (!/ag-q-add/.test(p) || !/function _agCollectQuestions/.test(p))
        return "panel-v2.html: se perdió el armador de preguntas del tipo de evento (ag-q-add / _agCollectQuestions).";
      if (!/label:_tv,\s*color:_tc,\s*icon:_tic,\s*people:_tpl,\s*questions:_tq/.test(p))
        return "panel-v2.html: el tipo de evento ya no guarda las preguntas (questions) al guardar.";
      if (!/function _citaAnswers/.test(p))
        return "panel-v2.html: el coach ya no ve las respuestas de las reservas (_citaAnswers).";
      // Reservar: sin defaults del sistema + render dinámico + guardado resiliente.
      if (/id='f-msg'/.test(r) || /id='f-src'/.test(r))
        return "reservar.html: volvieron las preguntas predefinidas del sistema (f-msg/f-src); deben salir SOLO las del coach.";
      if (!/function qFields/.test(r) || !/function collectAnswers/.test(r))
        return "reservar.html: se perdió el render/colecta de las preguntas del coach.";
      if (!/_postCita\(false\)/.test(r))
        return "reservar.html: el guardado de la reserva perdió el reintento sin 'respuestas' (rompe si falta la columna).";
      return null;
    },
  },
  {
    name: "panel: alta de cliente usa INSERT ignore-duplicates (RLS), no merge",
    bug: "El alta inline del panel (alta-invitar) creaba el candidato con " +
         "resolution=merge-duplicates. Bajo RLS estricto eso es un upsert que pide " +
         "policy de UPDATE para anon → 403, y el .catch vacio lo tragaba: el cliente " +
         "NUNCA aparecia en la lista del coach (pero salia '✓ enviado' igual). Debe " +
         "usar ignore-duplicates, igual que formulario.html. Ver rls_strict.sql.",
    check() {
      const s = read("panel-v2.html");
      if (!s) return "no existe panel-v2.html";
      const m = s.match(/resolution=(merge|ignore)-duplicates"\}\)[\s\S]{0,120}rest\/v1\/candidatos/);
      if (!m) return "no se encontro el INSERT de candidatos del alta de cliente";
      return m[1] === "ignore" ? null
        : "el alta de cliente usa merge-duplicates (debe ser ignore-duplicates bajo RLS estricto)";
    },
  },
  {
    name: "helpers de escritura verifican el guardado (no return=minimal mentiroso bajo RLS)",
    bug: "Con RLS activo, un PATCH/POST sin sesión válida no matchea filas y con " +
         "return=minimal devuelve 2xx r.ok=true → los helpers mostraban 'guardado ✓' " +
         "sin escribir (pérdida silenciosa de datos del usuario). Los helpers centrales " +
         "(_sbw, pt, sbPatch) deben pedir return=representation y que r.ok/el resultado " +
         "refleje que volvió ≥1 fila.",
    check() {
      var specs = [
        { f: "panel-v2.html", fn: "_sbw" },
        { f: "cliente.html", fn: "pt" },
        { f: "pathway-fit-cliente.html", fn: "sbPatch" },
        { f: "pathway-fin-cliente.html", fn: "sbPatch" },
      ];
      for (var k = 0; k < specs.length; k++) {
        var sp = specs[k], s = read(sp.f);
        if (!s) return sp.f + ": no existe";
        var i = s.indexOf("function " + sp.fn + "(");
        if (i < 0) return sp.f + ": no se encontró el helper " + sp.fn;
        var body = s.slice(i, i + 1700);
        if (!/return=representation/.test(body))
          return sp.f + ": " + sp.fn + " ya no pide return=representation (volvería a 'mentir' que guardó bajo RLS)";
        if (!/rows|\.length/.test(body))
          return sp.f + ": " + sp.fn + " no verifica cuántas filas escribió (rows/.length)";
      }
      return null;
    },
  },
  {
    name: "panel: saveCfg verifica que realmente guardó (no miente con return=minimal)",
    bug: "Tras activar RLS en `usuarios` (usuarios_hardening.sql), un PATCH sin " +
         "sesión autenticada matchea 0 filas. saveCfg usaba return=minimal → 204 " +
         "r.ok=true y mostraba 'Configuración guardada ✓' SIN escribir nada (foto, " +
         "perfil, recursos del coach de fitness/finanzas se perdían). Debe pedir " +
         "return=representation y confirmar que volvió ≥1 fila antes de dar OK.",
    check() {
      const s = read("panel-v2.html");
      if (!s) return "no existe panel-v2.html";
      const m = s.match(/function saveCfg\([\s\S]*?\n\}/);
      if (!m) return "no se encontró la función saveCfg";
      const body = m[0];
      if (!/return=representation/.test(body))
        return "saveCfg ya no pide return=representation (volvería a 'mentir' que guardó bajo RLS)";
      if (!/rows\s*>=\s*1|\.n\s*>\s*0/.test(body))
        return "saveCfg no verifica que la escritura devolvió filas (rows>=1); un 0-filas por RLS pasaría como éxito";
      return null;
    },
  },
  {
    name: "portal carrera: Agendar NO cae al Calendly de Micaela",
    bug: "El default de CALENDLY en cliente.html era el Calendly de Micaela. Un " +
         "cliente de un coach que no configuró su Calendly agendaba sesión con " +
         "MICAELA, no con su coach. Debe ser '' y el botón cae al chat (abrirAgenda).",
    check() {
      const s = read("cliente.html");
      if (!s) return null;
      return /var\s+CALENDLY\s*=\s*['"]https?:\/\/calendly/.test(s)
        ? "cliente.html: CALENDLY default volvió a un Calendly hardcodeado (debe ser '')"
        : null;
    },
  },
  {
    name: "login liga auth_id vía RPC pw_link_auth_id (coach ve/crea clientes)",
    bug: "Sin auth_id ligado, pw_coach_id() devuelve NULL y el coach no ve ni " +
         "puede crear clientes (queda 'anónimo' para RLS → 409/403 al agregar). " +
         "El PATCH directo lo bloqueaba la RLS (a admins por rol<>'admin', y a " +
         "emails desajustados). login.html y auth-callback.html deben llamar la " +
         "RPC SECURITY DEFINER pw_link_auth_id en cada login. Ver " +
         "repair_auth_id_linking.sql.",
    check() {
      const offenders = [];
      for (const f of ["login.html", "auth-callback.html"]) {
        const s = read(f);
        if (s && !/rpc\/pw_link_auth_id/.test(s)) offenders.push(f);
      }
      return offenders.length ? offenders.join(", ") + " ya no llama(n) pw_link_auth_id" : null;
    },
  },
  {
    name: "login/registro: NO leen password_hash con la anon key (Fase 4 RLS)",
    bug: "El login y el registro viejos leian password_hash con la anon key " +
         "(login filtraba por &password_hash=eq; registro lo pedia en &select). " +
         "Eso obliga a exponer la columna a anon (cualquiera baja los hashes). " +
         "Ahora login verifica via Supabase Auth y registro usa la RPC " +
         "pw_tiene_pass. Esta regla evita volver al patron viejo.",
    check() {
      const offenders = [];
      const login = read("login.html");
      if (login && /password_hash=eq\./.test(login)) offenders.push("login.html (filtra por password_hash)");
      const reg = read("registro.html");
      if (reg && /usuarios\?[^"'`]*select=[^"'`]*password_hash/.test(reg)) offenders.push("registro.html (select password_hash)");
      return offenders.length ? offenders.join("; ") : null;
    },
  },
  {
    name: "alta de usuarios (auth-callback/registro): return=representation acotado, sin leer password_hash — Fase 4/5 RLS",
    bug: "Crear/activar la fila en usuarios con Prefer:return=representation SIN " +
         "acotar select hace que PostgREST devuelva todas las columnas, incluida " +
         "password_hash (lectura revocada en Fase 4) → 42501 'permission denied for " +
         "table usuarios' → la cuenta no se crea ('No pudimos crear tu cuenta' / " +
         "'Error al crear la cuenta'). Paso en login con Google (auth-callback) y en " +
         "el registro de coach (registro.html/registro-en.html). Cada POST/PATCH a " +
         "usuarios con return=representation debe llevar select= sin password_hash.",
    check() {
      const files = ["auth-callback.html", "registro.html", "registro-en.html"];
      const offenders = [];
      for (const f of files) {
        const s = read(f);
        if (!s) continue;
        // Bloques fetch a /rest/v1/usuarios con method POST o PATCH.
        const calls = s.match(/fetch\(\s*[^)]*?\/rest\/v1\/usuarios[\s\S]*?method:\s*'(?:POST|PATCH)'[\s\S]*?\}\)/g) || [];
        for (const c of calls) {
          if (/return=representation/.test(c) && !/select=/.test(c)) {
            offenders.push(f + " (escritura a usuarios con return=representation sin select → lee password_hash)");
          }
        }
      }
      return offenders.length ? offenders.join("; ") : null;
    },
  },
  {
    name: "solicitudes vencidas: sin botón 'Aceptar y cobrar' (no se puede capturar) + fecha de vencimiento visible",
    bug: "El panel dejaba apretar 'Aceptar y cobrar' en una solicitud con la " +
         "ventana de 24 h vencida. Al vencer, Stripe libera la retención y la " +
         "captura falla con un error genérico ('No se pudo procesar la solicitud'), " +
         "que parece un bug cuando en realidad ya no hay nada que cobrar. Además " +
         "'vencida' no decía CUÁNDO venció. Fix: solDetail calcula `venc` desde " +
         "expires_at y, si venció, reemplaza los botones por una explicación clara; " +
         "_fmtDT() muestra la fecha de vencimiento en la etiqueta y en el mensaje.",
    check() {
      const s = read("panel-v2.html");
      if (!s) return null;
      const offenders = [];
      if (!/function\s+_fmtDT\b/.test(s)) offenders.push("falta _fmtDT() (fecha de vencimiento)");
      if (!/var\s+venc\s*=[^;]*expires_at/.test(s)) offenders.push("falta el guard `venc` basado en expires_at en solDetail");
      if (!/ya no se puede cobrar/.test(s)) offenders.push("falta el mensaje claro de ventana vencida");
      return offenders.length ? offenders.join("; ") : null;
    },
  },
  {
    name: "Modo privado: el panel enmascara datos sensibles (email, tel, salud, finanzas)",
    bug: "Por minimización RGPD, el panel del coach difumina datos sensibles para no " +
         "exponerlos al compartir pantalla. El enmascarado está SIEMPRE activo (sin " +
         "toggle): se revela al pasar el mouse o tocar el dato. Si se quita el helper " +
         "sens(), la clase pw-private o los campos enmascarados (frS/ftAS de finanzas " +
         "y salud), los datos vuelven a quedar a la vista.",
    check() {
      const s = read("panel-v2.html");
      if (!s) return null;
      if (!/function sens\s*\(/.test(s)) return "panel-v2.html: falta el helper sens() del Modo privado.";
      if (!/pw-private/.test(s)) return "panel-v2.html: falta el enmascarado (clase pw-private).";
      if (!/classList\.add\('pw-private'\)/.test(s)) return "panel-v2.html: el enmascarado (pw-private) ya no se aplica siempre.";
      if (!/frS\("Ingresos mensuales/.test(s) || !/ftAS\("Lesiones/.test(s))
        return "panel-v2.html: los datos financieros/de salud ya no usan los campos enmascarados (frS/ftAS).";
      return null;
    },
  },
  {
    name: "Consentimiento (RGPD art. 7.1): gate en el primer ingreso de los 3 portales",
    bug: "Al entrar por primera vez, el cliente acepta Términos+Privacidad y queda " +
         "registrada la prueba (consent_at). Si se quita el gate, se pierde la base " +
         "legal y la prueba que exige el RGPD.",
    check() {
      const c = read("cliente.html");
      if (c && (!/needsConsent/.test(c) || !/showConsentGate/.test(c) || !/consent_at/.test(c)))
        return "cliente.html: falta el gate de consentimiento (needsConsent/showConsentGate/consent_at).";
      for (const f of ["pathway-fit-cliente.html", "pathway-fin-cliente.html"]) {
        const s = read(f);
        if (s && (!/pwMaybeConsent/.test(s) || !/consent_at/.test(s)))
          return f + ": falta el gate de consentimiento (pwMaybeConsent/consent_at).";
      }
      return null;
    },
  },
  {
    name: "Consentimiento se pide UNA sola vez (form no duplica el gate del portal)",
    bug: "El cliente aceptaba el consentimiento en el formulario Y otra vez en el " +
         "portal. Fix: en modo portal el form salta el paso de privacidad (PORTAL_MODE " +
         "→ consentGiven=true), y en intake anónimo el form guarda consent_at para que " +
         "el portal no lo vuelva a pedir. Esta regla evita que vuelva el doble pedido.",
    check() {
      for (const f of ["pathway-fit-form.html", "pathway-fin-form.html", "formulario.html"]) {
        const s = read(f);
        if (!s) continue;
        // En modo portal NO se vuelve a pedir consentimiento (se salta el paso).
        if (!/PORTAL_MODE[\s\S]{0,80}consentGiven\s*=\s*true/.test(s))
          return f + ": en modo portal debería saltar el paso de consentimiento (PORTAL_MODE → consentGiven=true).";
        // En intake anónimo se registra consent_at para no re-pedirlo en el portal.
        if (!/!PORTAL_MODE[\s\S]{0,80}consent_at/.test(s))
          return f + ": el intake anónimo debería registrar consent_at (!PORTAL_MODE → d.consent_at).";
      }
      return null;
    },
  },
  {
    name: "Consentimiento al FINAL del form (menos fricción, no es un muro legal al entrar)",
    bug: "El consentimiento abría el formulario como primera pantalla (un 'muro legal' " +
         "que espantaba). Se movió al último paso, antes de guardar: sigue siendo " +
         "obligatorio (gatea el envío) pero deja una primera impresión cálida. Esta " +
         "regla evita que vuelva a colarse al inicio.",
    check() {
      // fit/fin: el consentimiento NO es la primera pantalla y va antes del análisis.
      for (const f of ["pathway-fit-form.html", "pathway-fin-form.html"]) {
        const s = read(f); if (!s) continue;
        const onMatch = s.match(/<div class="step on"[^>]*id="([^"]+)"/);
        if (onMatch && onMatch[1] === "stepConsent")
          return f + ": el consentimiento no debe ser la primera pantalla (debe ir al final).";
        const iC = s.indexOf('id="stepConsent"'), iA = s.indexOf('id="stepAnalisis"');
        if (iC < 0 || iA < 0 || iC > iA)
          return f + ": stepConsent debería ir al final, justo antes del análisis.";
      }
      // career: la casilla vive en el último paso (s7), no en s0; y enviar() la exige.
      const c = read("formulario.html");
      if (c) {
        if (!/id="s7-consent"/.test(c))
          return "formulario.html: el consentimiento debería estar en el último paso (id='s7-consent').";
        const i0 = c.indexOf('id="s0"'), i1 = c.indexOf('id="s1"');
        if (i0 >= 0 && i1 > i0 && /consent-cb/.test(c.slice(i0, i1)))
          return "formulario.html: la casilla de consentimiento volvió a s0 (debe ir al final).";
        if (!/if\s*\(\s*!consentGiven\s*\)/.test(c))
          return "formulario.html: enviar() debería exigir consentGiven antes de guardar.";
      }
      return null;
    },
  },
  {
    name: "Nunca enviar la contraseña en texto plano por email",
    bug: "El form mandaba la contraseña autogenerada en TEXTO PLANO por email " +
         "(variable _autoPass). Se eliminó: ahora se manda un link de un solo uso " +
         "para que el cliente cree su contraseña. Esta regla evita que vuelva.",
    check() {
      const offenders = [];
      for (const f of ["formulario.html", "pathway-fit-form.html", "pathway-fin-form.html"]) {
        const s = read(f);
        if (s && /_autoPass/.test(s)) offenders.push(f);
      }
      return offenders.length ? "vuelve a generar/enviar contraseña en texto plano (_autoPass): " + offenders.join(", ") : null;
    },
  },
  {
    name: "Sin EmailJS en el frontend (key pública expuesta) — emails por send-email (Brevo)",
    bug: "EmailJS exponía su key pública en el navegador (riesgo de abuso/spam con tu " +
         "cuenta). Se retiró: los emails salen por la Edge Function send-email. Esta " +
         "regla evita que vuelva la key o emailjs.send al frontend.",
    check() {
      const offenders = [];
      for (const f of ["formulario.html", "panel-v2.html"]) {
        const s = read(f);
        if (!s) continue;
        if (/rPy7LSI/.test(s)) offenders.push(f + " (key de EmailJS)");
        if (/emailjs\.send\s*\(/.test(s)) offenders.push(f + " (emailjs.send)");
      }
      return offenders.length ? "EmailJS volvió al frontend: " + offenders.join(", ") : null;
    },
  },
  {
    name: "Intake en portal: guarda con PATCH (actualiza la fila existente, no INSERT ignorado)",
    bug: "En modo portal el candidato YA existe (lo crea el alta), así que un INSERT " +
         "ignore-duplicates NO guardaba el intake (se perdía). Debe hacer PATCH por " +
         "email con el JWT del cliente (pw-auth.js) para que la policy RLS lo permita.",
    check() {
      for (const f of ["formulario.html", "pathway-fit-form.html", "pathway-fin-form.html"]) {
        const s = read(f);
        if (!s) continue;
        if (!/PORTAL_MODE/.test(s)) return f + ": perdió el modo portal (PORTAL_MODE).";
        if (!/PATCH/.test(s)) return f + ": el guardado en modo portal ya no usa PATCH (el intake no se guardaría).";
        if (!/pw-auth\.js/.test(s)) return f + ": ya no incluye pw-auth.js (sin JWT, el PATCH del intake falla por RLS).";
      }
      return null;
    },
  },
  {
    name: "Formulario: autoguardado/retomar (red anti-pérdida de datos)",
    bug: "Si fallaba la red, el cliente perdía todo lo que había escrito. El form " +
         "guarda un borrador en localStorage en cada cambio y SOLO lo borra cuando " +
         "el guardado a Supabase salió OK (clearDraft). Esta regla lo blinda.",
    check() {
      for (const f of ["formulario.html", "pathway-fit-form.html"]) {
        const s = read(f);
        if (!s) continue;
        if (!/saveDraft/.test(s) || !/restoreDraft/.test(s) || !/clearDraft/.test(s))
          return f + ": perdió el autoguardado (saveDraft/restoreDraft/clearDraft).";
      }
      return null;
    },
  },
  {
    name: "cliente.html: sin escaper inexistente (escH) — usa hh()",
    bug: "cliente.html llamaba escH() (no definida) en la reseña y el toast de " +
         "logros → ReferenceError que CRASHEABA la preview del coach (coach_view). " +
         "Detectado en client_errors (pw-observe). El escaper real es hh().",
    check() {
      const s = read("cliente.html");
      if (!s) return null;
      if (/escH\s*\(/.test(s)) return "cliente.html volvió a usar escH() (no existe) — usá hh().";
      return null;
    },
  },
  {
    name: "logros: motor de juego unificado (mismos umbrales en los 3 nichos)",
    bug: "El sistema de medallas estaba duplicado y desincronizado por nicho " +
         "(carrera pedía 7 logros para Oro, fitness/finanzas 6). Se unificó en " +
         "pathway-juego.js con PUNTOS (Bronce 200 · Plata 400 · Oro 600) como " +
         "fuente única. Si el motor desaparece, cambian los umbrales, o un portal " +
         "deja de cargarlo, las medallas vuelven a desincronizarse entre nichos.",
    check() {
      const eng = read("pathway-juego.js");
      if (!eng) return "falta pathway-juego.js (motor unificado de medalla/festejo).";
      if (!/min:\s*200[\s\S]*?min:\s*400[\s\S]*?min:\s*600/.test(eng))
        return "pathway-juego.js: los umbrales de medalla dejaron de ser 200/400/600 (fuente única de verdad).";
      for (const f of ["cliente.html", "pathway-fit-cliente.html", "pathway-fin-cliente.html"]) {
        const s = read(f);
        if (!s) continue;
        if (!/pathway-juego\.js/.test(s))
          return f + " ya no carga pathway-juego.js (motor unificado de puntos/medalla).";
      }
      return null;
    },
  },
  {
    name: "portal fitness: cliente real NO ve la plantilla demo (Gonza/Martín + datos inventados)",
    bug: "Un cliente real cuyo alta no dejó ficha (o con el plan aún vacío) veía TODA " +
         "la plantilla demo: coach 'Gonza', cliente 'Martín Ríos', antropometría, foco y " +
         "timeline inventados. Ahora, si el cliente tiene email pero no hay ficha, se limpia " +
         "el demo (_clienteSinFicha) y se muestra el cartel del coach 'preparando tu plan' " +
         "(renderPrepCard) con su foto respirando; el timeline se arma con datos reales " +
         "(renderTimeline). Esta regla blinda que esas funciones y sus llamadas sigan.",
    check() {
      const s = read("pathway-fit-cliente.html");
      if (!s) return null;
      const js = inlineJs(s);
      for (const fn of ["_clienteSinFicha", "renderPrepCard", "renderTimeline", "_limpiarDemo"]) {
        if (!isDefined(fn, js)) return "pathway-fit-cliente.html: falta " + fn + "() (limpieza del demo para el cliente real).";
      }
      // La rama "email sin ficha" debe limpiar el demo, no dejar la plantilla visible.
      if (!/_clienteSinFicha\s*\(\s*\)/.test(js))
        return "pathway-fit-cliente.html: nadie llama a _clienteSinFicha() → el cliente real volvería a ver el demo.";
      if (!/pw-cabra-juego\.js/.test(s))
        return "pathway-fit-cliente.html: ya no carga pw-cabra-juego.js (el botón 'Jugar con la cabra' del cartel no funcionaría).";
      // GARANTÍA: cliente logueado ve SIEMPRE su propio email (mj_user) — nunca el
      // demo ni otro cliente, aunque la URL venga pelada.
      if (!/rol===?['"]cliente['"][\s\S]{0,120}EMAIL=/.test(js))
        return "pathway-fit-cliente.html: perdió el forzado del email propio (mj_user rol=cliente) → podría caer en el demo de María.";
      return null;
    },
  },
  {
    name: "form fitness: al terminar vuelve al portal CON el email (no al demo)",
    bug: "El formulario, al guardar en modo portal, redirigía a pathway-fit-cliente.html " +
         "SIN el ?email → el portal quedaba sin email y mostraba el demo de María; el " +
         "cliente creía que su carga se perdió. El retorno debe llevar el email.",
    check() {
      for (const f of ["pathway-fit-form.html", "pathway-fin-form.html"]) {
        const s = read(f);
        if (!s) continue;
        if (!/PORTAL_RETURN\s*\+\s*['"]\?email=/.test(s) && !/location\.href\s*=\s*_ru/.test(s))
          return f + ": el retorno al portal ya no incluye el email → volvería al demo.";
      }
      return null;
    },
  },
  {
    name: "finanzas: mismo blindaje que fitness (coach real, sin demo de María, autoguardado)",
    bug: "El nicho finanzas arrastraba los MISMOS bugs que fitness: 'Lucía Finanzas' " +
         "hardcodeada, el portal caía al demo de María para un cliente real sin ficha, y " +
         "el form no autoguardaba. Se replicó el arreglo; esta regla evita la regresión.",
    check() {
      const form = read("pathway-fin-form.html");
      if (form) {
        const markup = form.replace(/<script[\s\S]*?<\/script>/gi, "");
        if (/Luc[ií]a/.test(markup)) return "pathway-fin-form.html: volvió 'Lucía' en el contenido (debe adaptarse al coach real).";
        const fjs = inlineJs(form);
        if (!isDefined("_applyCoachBrand", fjs) || !isDefined("saveDraft", fjs))
          return "pathway-fin-form.html: perdió la adaptación al coach o el autoguardado.";
      }
      const port = read("pathway-fin-cliente.html");
      if (port) {
        const pjs = inlineJs(port);
        if (!isDefined("_clienteSinFicha", pjs) || !isDefined("renderPrepCard", pjs))
          return "pathway-fin-cliente.html: perdió _clienteSinFicha()/renderPrepCard() (limpieza del demo del cliente real).";
        if (!/rol===?['"]cliente['"][\s\S]{0,120}EMAIL=/.test(pjs))
          return "pathway-fin-cliente.html: perdió el forzado del email propio (mj_user) → podría caer al demo de María.";
      }
      return null;
    },
  },
  {
    name: "intake se guarda vía edge function (service role) — no lo bloquea RLS",
    bug: "Con RLS estricto, el cliente solo puede escribir su fila si su email de " +
         "Auth == candidatos.email. Si no tiene sesión o el email no coincide, el " +
         "PATCH del formulario se rechaza en silencio → portal en blanco (clientes " +
         "de Charlie). Los forms guardan por guardar-intake (service role, ignora " +
         "RLS), con fallback al PATCH directo. Esta regla evita perder ese camino.",
    check() {
      if (!read("supabase/functions/guardar-intake/index.ts"))
        return "falta la edge function guardar-intake (guarda el intake sin chocar con RLS).";
      for (const f of ["pathway-fit-form.html", "pathway-fin-form.html"]) {
        const s = read(f);
        if (!s) continue;
        if (!/functions\/v1\/guardar-intake/.test(s))
          return f + ": ya no llama a guardar-intake → el intake del cliente puede no guardarse bajo RLS.";
      }
      return null;
    },
  },
  {
    name: "form fitness: se adapta al coach real, sin 'Gonza' hardcodeado",
    bug: "El formulario de evaluación fitness tenía 'Gonza Coach' fijo en el título, " +
         "en '<coach> está revisando tus datos…' y en el cierre → todos los clientes " +
         "veían 'Gonza' aunque su coach fuera otro. Ahora el form lee el coach real " +
         "(?coach=<id> o, en portal, el coach del candidato por email) y pinta su " +
         "nombre; fallback 'tu coach'. Esta regla evita que vuelva un nombre fijo.",
    check() {
      const s = read("pathway-fit-form.html");
      if (!s) return null;
      // Fuera de comentarios JS no debe quedar ningún 'Gonza' visible en el markup.
      const markup = s.replace(/<script[\s\S]*?<\/script>/gi, "");
      if (/Gonza/.test(markup))
        return "pathway-fit-form.html: volvió a aparecer 'Gonza' en el contenido (debe adaptarse al coach real).";
      const js = inlineJs(s);
      if (!isDefined("_applyCoachBrand", js) || !isDefined("_setCoachTexts", js))
        return "pathway-fit-form.html: falta la adaptación al coach (_applyCoachBrand/_setCoachTexts).";
      if (!/id="fCoachSep"|id='fCoachSep'/.test(s) || !/id="doneChip"|id='doneChip'/.test(s))
        return "pathway-fit-form.html: faltan los anclajes del coach (fCoachSep/doneChip) que pinta el nombre real.";
      return null;
    },
  },
  {
    name: "email de bienvenida: la firma del coach sale con su FOTO (no la inicial)",
    bug: "El email de acceso que recibe el cliente nuevo llevaba la firma del coach SIN " +
         "foto (coachSig caía a la inicial) porque el panel/edge function nunca pasaban " +
         "coach_photo. Ahora el alta manda coach_photo (URL http) y password-reset lo " +
         "reenvía en coach.photo a send-email. Esta regla evita que se pierda de nuevo.",
    check() {
      const panel = read("panel-v2.html");
      if (panel && /welcome:\s*true/.test(panel) && !/coach_photo/.test(panel))
        return "panel-v2.html: el alta ya no manda coach_photo → la firma del email de bienvenida vuelve a salir sin foto.";
      const pr = read("supabase/functions/password-reset/index.ts");
      if (pr) {
        if (!/coach_photo/.test(pr)) return "password-reset: dejó de aceptar coach_photo (firma sin foto).";
        if (!/photo:\s*cPhoto/.test(pr)) return "password-reset: ya no pasa la foto en coach.photo a send-email (firma sin foto).";
      }
      return null;
    },
  },
  {
    name: "juego: la cabra tiene piso (no flota arriba del escenario)",
    bug: "En pw-cabra-juego.css la cabra (.pw-juego-cabra) no tenía posición " +
         "vertical por defecto; el JS le pone 'bottom' recién al arrancar el " +
         "juego, así que en la pantalla de inicio quedaba flotando arriba del " +
         "escenario en vez de parada en el suelo. Debe tener 'bottom' en el CSS.",
    check() {
      const s = read("pw-cabra-juego.css");
      if (!s) return null;
      if (!/\.pw-juego-cabra\s*\{[^}]*\bbottom\s*:/.test(s))
        return "pw-cabra-juego.css: .pw-juego-cabra perdió su 'bottom' → la cabra flota arriba del escenario.";
      return null;
    },
  },
  {
    name: "juego coach: el puntaje no se pisa para abajo entre dispositivos",
    bug: "En panel-v2 el mejor puntaje del juego se leía solo de localStorage; " +
         "en un dispositivo/navegador nuevo arrancaba en 0 y el primer juego " +
         "PISABA el game_pts del servidor con un valor menor → el número y el " +
         "ranking BAJABAN. Debe restaurar desde el servidor (máximo entre local " +
         "y servidor) al cargar el panel, vía _gameRestoreOwn() en loadReal.",
    check() {
      const s = read("panel-v2.html");
      if (!s) return null;
      if (!/function\s+_gameRestoreOwn\b/.test(s))
        return "panel-v2.html: falta _gameRestoreOwn() (restaurar el puntaje del juego desde el servidor).";
      if (((s.match(/_gameRestoreOwn/g) || []).length) < 2)
        return "panel-v2.html: _gameRestoreOwn() está definida pero no se llama (loadReal debe invocarla).";
      return null;
    },
  },
  {
    name: "aislamiento: la lista de clientes NO incluye huérfanos (ni para el admin)",
    bug: "El admin cargaba la lista de clientes con 'coach_id.eq.él O coach_id IS " +
         "NULL' → un cliente huérfano (sin coach) de OTRO nicho (ej. fitness) se " +
         "colaba en el panel de otro coach (career). GRAVE: mezcla clientes entre " +
         "coaches. La query de la lista (cf) debe filtrar SIEMPRE por coach_id " +
         "propio, sin la cláusula coach_id.is.null.",
    check() {
      const s = read("panel-v2.html");
      if (!s) return null;
      const i = s.search(/var\s+cf\s*=/);
      if (i < 0) return "panel-v2.html: no se encuentra la query 'cf' de la lista de clientes.";
      const block = s.slice(i, i + 400);
      if (/coach_id\.is\.null/.test(block))
        return "panel-v2.html: la lista de clientes (cf) volvió a incluir coach_id.is.null → se cuelan clientes huérfanos de otros coaches/nichos.";
      return null;
    },
  },
  {
    name: "chat: el nombre del cliente se escapa (anti-XSS)",
    bug: "En la mensajería de cliente.html el nombre propio del cliente se metía " +
         "crudo (sin hh()) mientras el resto sí se escapaba. Un nombre con HTML " +
         "inyecta código — y el coach lo ejecuta al abrir el portal en coach_view.",
    check() {
      const s = read("cliente.html");
      if (!s) return null;
      return /isCoach\?hh\(COACH_FIRST\):nombre\)/.test(s)
        ? "cliente.html: el nombre del cliente en el chat volvió a ir sin hh() (XSS)." : null;
    },
  },
  {
    name: "juego: abrirJuego una sola vez (registra el refresco de medalla)",
    bug: "abrirJuego estaba definida DOS veces en fit/fin; por hoisting ganaba la " +
         "simple, que NO seteaba PW_GAME_ONCLOSE → la medalla no se refrescaba al " +
         "cerrar el juego. Debe quedar UNA sola def, la que registra el callback.",
    check() {
      for (const f of ["pathway-fit-cliente.html", "pathway-fin-cliente.html"]) {
        const s = read(f); if (!s) continue;
        const n = (s.match(/function abrirJuego\s*\(/g) || []).length;
        if (n > 1) return f + ": abrirJuego está definida " + n + " veces (debe ser 1).";
        if (n === 1 && !/PW_GAME_ONCLOSE/.test(s))
          return f + ": abrirJuego ya no registra PW_GAME_ONCLOSE (la medalla no se refresca).";
      }
      return null;
    },
  },
  {
    name: "aislamiento: PATCH/DELETE de candidatos por id lleva cg() (multi-tenant)",
    bug: "El guard cg() (coach_id del coach logueado) estaba definido pero NUNCA " +
         "aplicado a las escrituras de candidatos → un coach podía escribir sobre " +
         "un candidato de otro coach conociendo su UUID. _sbw debe aplicar cg() a " +
         "todo PATCH/DELETE de candidatos?id=eq.",
    check() {
      const s = read("panel-v2.html");
      if (!s) return null;
      const i = s.indexOf("function _sbw(");
      if (i < 0) return "panel-v2.html: no se encuentra _sbw.";
      const block = s.slice(i, i + 1100);
      return /p \+= cg\(\)/.test(block)
        ? null : "panel-v2.html: _sbw ya no aplica cg() a los PATCH/DELETE de candidatos?id= (fuga multi-tenant).";
    },
  },
  {
    name: "finanzas: guardado de objetivos/patrimonio/sesiones es merge-safe",
    bug: "El cliente escribía fin_objetivos/fin_patrimonio/sesiones_registro con " +
         "su snapshot en memoria → pisaba lo que el coach acababa de escribir. " +
         "Debe re-leer la columna fresca antes de guardar (_sbColSave) y fusionar.",
    check() {
      const s = read("pathway-fin-cliente.html");
      if (!s) return null;
      if (!/function _sbColSave\(/.test(s))
        return "pathway-fin-cliente.html: falta _sbColSave (guardado merge-safe).";
      // _objSave y _patSave NO deben hacer un sbPatch directo de su columna.
      if (/function _objSave\([^)]*\)\{[^}]*sbPatch\('candidatos'[^}]*fin_objetivos/.test(s.replace(/\s+/g, " ")))
        return "pathway-fin-cliente.html: _objSave volvió a hacer sbPatch directo (pisa al coach).";
      return null;
    },
  },
  {
    name: "panel: coach fusiona hilos de comentarios al guardar fin_objetivos",
    bug: "El coach guardaba fin_objetivos desde su snapshot → pisaba los " +
         "comentarios (hilo) que el cliente escribió. _finArrSave debe re-leer y " +
         "fusionar los hilos (_hiloMerge) para fin_objetivos.",
    check() {
      const s = read("panel-v2.html");
      if (!s) return null;
      if (!/function _hiloMerge\(/.test(s)) return "panel-v2.html: falta _hiloMerge.";
      const i = s.indexOf("function _finArrSave(");
      if (i < 0) return "panel-v2.html: no se encuentra _finArrSave.";
      return /_hiloMerge/.test(s.slice(i, i + 1600)) ? null
        : "panel-v2.html: _finArrSave ya no fusiona los hilos (pisa comentarios del cliente).";
    },
  },
  {
    name: "registro: el alta abierta (trial gratis) está ABIERTA (coincide con la landing)",
    bug: "El registro se cerró a 'solo invitación' de contrabando dentro de un PR " +
         "sobre otra cosa (jul-2026), contradiciendo la landing que promete trial " +
         "gratis. Reabierto: coach nuevo se auto-registra (POST) y el invitado activa " +
         "(PATCH). El anti-abuso es la verificación de email, NO cerrar el registro.",
    check() {
      const s = read("registro.html");
      if (!s) return null;
      const flat = s.replace(/\s+/g, " ");
      if (/if \( ?!activatingRow ?\) \{[^}]{0,260}(por invitación|showError\()/.test(flat))
        return "registro.html: volvió a cerrar el alta abierta (bloquea a quien no fue invitado). La landing promete trial gratis.";
      if (!/activatingRow[\s\S]{0,400}method: 'PATCH'[\s\S]{0,600}method: 'POST'/.test(s))
        return "registro.html: se perdió el camino POST (crear cuenta nueva para un coach no invitado).";
      return null;
    },
  },
  {
    name: "fitness: el coach VE el diario de nutrición del cliente (fit_nutri_log)",
    bug: "El cliente anotaba lo que comió (fit_nutri_log) pero el panel del coach " +
         "nunca lo leía → era un pozo negro. La pestaña Nutrición debe mostrar el " +
         "diario del cliente (solo lectura).",
    check() {
      const s = read("panel-v2.html");
      if (!s) return null;
      return /fit_nutri_log/.test(s) ? null
        : "panel-v2.html: el coach ya no ve el diario de nutrición del cliente (fit_nutri_log).";
    },
  },
  {
    name: "fitness: marcar ejercicios de la rutina SE GUARDA (y el coach lo ve)",
    bug: "toggleEx solo tachaba en pantalla → al recargar se perdía TODO lo " +
         "marcado y el coach nunca veía qué entrenó el cliente. Debe persistir por " +
         "fecha en fit_ejercicios_done y marcar el día de gym en fit_habitos.",
    check() {
      const s = read("pathway-fit-cliente.html");
      if (!s) return null;
      const i = s.indexOf("function toggleEx(");
      if (i < 0) return "pathway-fit-cliente.html: no se encuentra toggleEx.";
      const block = s.slice(i, i + 900);
      if (!/data-exk|EXDONE/.test(block) || !/_exSave|fit_ejercicios_done/.test(s))
        return "pathway-fit-cliente.html: toggleEx volvió a NO persistir los ejercicios marcados (se pierden al recargar).";
      return null;
    },
  },
  {
    name: "diseño: número de KPI del panel en tamaño INTERMEDIO (ni gigante ni chico)",
    bug: "El número de _tile ('Mi negocio') se fue a los extremos varias veces: 46px " +
         "(gigante) o 26px (muy chico). La coach pidió, por ahora, un TAMAÑO INTERMEDIO " +
         "(~32px, peso 700), igual en panel-v2 y multicoach (.kpi .n). Esta regla lo " +
         "mantiene en el rango intermedio (28–36px): frena que lo inflen a 46 y que lo achiquen a 26.",
    check() {
      const p = read("panel-v2.html");
      if (!p) return null;
      const m = p.match(/function _tile\([^)]*\)\{[\s\S]{0,160}?font-size:(\d+)px/);
      if (!m) return "panel-v2.html: no se encontró el número de _tile (¿cambió la función?).";
      const px = parseInt(m[1], 10);
      if (px > 36) return "panel-v2.html: el número de _tile quedó en " + px + "px (muy grande). Debe ser intermedio (~32px).";
      if (px < 28) return "panel-v2.html: el número de _tile quedó en " + px + "px (muy chico). Debe ser intermedio (~32px), como pidió la coach.";
      // multicoach .kpi .n en el mismo rango intermedio (ni 46 ni 26).
      const mc = read("multicoach.html");
      if (mc) { const km = mc.match(/\.kpi \.n\{[^}]*font-size:(\d+)px/); if (km) { const kp = parseInt(km[1], 10); if (kp > 36) return "multicoach.html: .kpi .n quedó en " + kp + "px (muy grande)."; if (kp < 28) return "multicoach.html: .kpi .n quedó en " + kp + "px (muy chico)."; } }
      return null;
    },
  },
  {
    name: "diseño: white-label llega al token canónico --accent en toda la app",
    bug: "Cada pantalla tenía su motor de marca con su token propio (--brand / " +
         "--rose / --pw-bosque) → algo NUEVO no podía reusar el white-label. Ahora " +
         "los motores además setean el token canónico --accent, y hay una base " +
         "(pathway-base.css + pw-brand.js) para lo nuevo. Si un motor deja de setear " +
         "--accent, lo nuevo (que usa var(--accent)) deja de seguir el color del coach.",
    check() {
      const need = [
        ["pathway-fit-cliente.html", /setProperty\('--accent'/],
        ["pathway-fin-cliente.html", /setProperty\('--accent'/],
        ["cliente.html", /setProperty\('--accent'/],
        ["panel-v2.html", /setProperty\("--accent"/],
      ];
      for (const [f, re] of need) {
        const s = read(f); if (!s) continue;
        if (!re.test(s)) return f + ": el motor de marca ya no setea el token canónico --accent (se rompe el white-label unificado).";
      }
      // La base canónica y el motor único deben existir.
      const base = read("pathway-base.css");
      if (base && !/--accent:/.test(base)) return "pathway-base.css: perdió el token --accent (base de diseño).";
      if (!read("pw-brand.js")) return "falta pw-brand.js (motor único de white-label para lo nuevo).";
      return null;
    },
  },
  {
    name: "carrera: la foto se persiste vía edge function (resiste RLS)",
    bug: "cliente.html guardaba la foto con un PATCH anónimo por email. Con RLS " +
         "estricto ese PATCH haría no-op silencioso → la foto se perdería en el " +
         "próximo dispositivo. Debe ir por guardar-intake (service role) con " +
         "fallback a PATCH, como fit/fin.",
    check() {
      const s = read("cliente.html");
      if (!s) return null;
      return /functions\/v1\/guardar-intake[\s\S]{0,220}foto_perfil/.test(s)
        ? null : "cliente.html: la foto ya no se guarda vía guardar-intake (se romperá al activar RLS).";
    },
  },
  {
    name: "reservas: cada email muestra SU hora (coach y cliente en zonas distintas)",
    bug: "Los emails de confirmación usaban la MISMA fechaTxt (calculada en el " +
         "navegador del que reserva = hora del cliente) para AMBOS: el email del " +
         "coach mostraba la hora del CLIENTE, no la suya. Con coach y cliente en " +
         "zonas distintas → 'el cliente cree que es a las 21 y el coach a las 9'. " +
         "Fix: fechaEnTz(instante, zona) da la hora en cada zona; el cliente ve F.cli " +
         "(su hora) y el coach F.coach (la suya), y si difieren, cada uno ve también " +
         "la hora del otro con la ciudad.",
    check() {
      const s = read("reservar.html"); if (!s) return null;
      if (!/function fechaEnTz\(/.test(s))
        return "reservar.html: falta fechaEnTz() — los emails podrían volver a mostrar una sola zona.";
      // El email del coach usa SU hora (F.coach) y el del cliente la suya (F.cli).
      if (!/esc\(F\.coach\)/.test(s))
        return "reservar.html: el email del coach ya no muestra SU hora (F.coach).";
      if (!/esc\(F\.cli\)/.test(s))
        return "reservar.html: el email del cliente ya no usa su hora local (F.cli).";
      return null;
    },
  },
  {
    name: "reservas: no hay doble-booking (lee citas + re-chequea al confirmar)",
    bug: "reservar.html generaba los horarios solo desde la disponibilidad y NUNCA " +
         "leía la tabla citas → dos personas podían reservar el mismo turno. Debe " +
         "cargar las citas tomadas (loadCitas), marcarlas ocupadas, y re-chequear " +
         "el hueco JUSTO antes de confirmar.",
    check() {
      // Solo reservar.html es la página de reserva (agendar.html redirige a ella).
      for (const f of ["reservar.html"]) {
        const s = read(f); if (!s) continue;
        if (!/function loadCitas\(/.test(s) || !/TAKEN/.test(s))
          return f + ": ya no carga/marca los horarios tomados (riesgo de doble-booking).";
        // Debe re-chequear en confirmar antes del POST.
        if (!/inicio=eq\.[\s\S]{0,80}estado=neq\.cancelada[\s\S]{0,400}_commit/.test(s.replace(/\n/g, " ")))
          return f + ": confirmar ya no re-chequea el hueco contra citas antes de reservar.";
      }
      return null;
    },
  },
  {
    name: "puntos: coach y cliente ven la MISMA medalla (por puntos, no semana)",
    bug: "El cliente calculaba la medalla por PUNTOS y el coach por semana_activa " +
         "→ medallas distintas para la misma persona. Ahora el cliente persiste su " +
         "total (candidatos.puntos) y el coach lo lee con los mismos umbrales.",
    check() {
      const p = read("panel-v2.html");
      if (p && !/c\.puntos/.test(p))
        return "panel-v2.html: el coach ya no lee candidatos.puntos (volvió a la medalla por semana_activa, se desincroniza del cliente).";
      // Los 3 portales deben persistir puntos y el mejor puntaje del juego.
      for (const f of ["cliente.html", "pathway-fit-cliente.html", "pathway-fin-cliente.html"]) {
        const s = read(f); if (!s) continue;
        if (!/PW_GAME_SYNC\s*=\s*function/.test(s))
          return f + ": falta PW_GAME_SYNC (el puntaje del juego no se persiste → la medalla baja entre dispositivos).";
        if (!/\{\s*puntos\s*:/.test(s))
          return f + ": ya no persiste 'puntos' a Supabase (el coach no vería la misma medalla).";
      }
      return null;
    },
  },
  {
    name: "finanzas: pwInit elige la ficha más completa y recupera coach_id",
    bug: "El portal de finanzas tomaba rows[0] sin dedup → un cliente con ficha " +
         "duplicada veía la ficha vacía (sin datos ni coach). Debe ordenar por " +
         "completitud y recuperar coach_id de cualquier duplicado (como fitness).",
    check() {
      const s = read("pathway-fin-cliente.html");
      if (!s) return null;
      const i = s.indexOf("function pwInit(");
      if (i < 0) return "pathway-fin-cliente.html: no se encuentra pwInit.";
      const block = s.slice(i, i + 1200);
      if (!/_score|rows\.sort/.test(block))
        return "pathway-fin-cliente.html: pwInit ya no elige la ficha más completa (perdió el dedup por score).";
      if (!/if\(!CRAW\.coach_id\)/.test(block))
        return "pathway-fin-cliente.html: pwInit ya no recupera coach_id de los duplicados.";
      return null;
    },
  },
  {
    name: "reservas: la agenda del cliente usa el link INTERNO (no un Calendly externo)",
    bug: "El botón «Agendar» del portal del cliente abría el Calendly externo del " +
         "coach (fuga fuera de Pathway). Debe abrir /reservar.html?c=<coach_id> — la " +
         "cita se guarda en `citas` y le llega al coach a Calendario, sin pagar Calendly.",
    check() {
      const targets = [
        { f: "cliente.html", fn: "function abrirAgenda(" },
        { f: "pathway-fit-cliente.html", fn: "function agendar(" },
        { f: "pathway-fin-cliente.html", fn: "function agendar(" },
      ];
      for (const t of targets) {
        const s = read(t.f);
        if (!s) continue;
        const i = s.indexOf(t.fn);
        if (i < 0) return t.f + ": no se encuentra la función de agendar.";
        const body = s.slice(i, i + 500);
        if (!/reservar\.html\?c=/.test(body))
          return t.f + ": agendar ya no abre el link interno /reservar.html?c=<coach_id> (¿volvió el Calendly externo?).";
        if (/window\.open\(\s*COACH_CALENDLY\b/.test(body) || /window\.open\(\s*CALENDLY\b/.test(body))
          return t.f + ": agendar volvió a abrir el Calendly externo del coach (fuga fuera de Pathway).";
      }
      return null;
    },
  },
  {
    name: "config: el panel NO pide link de Calendly; da el link interno de reservas",
    bug: "La config del coach pedía pegar un link de Calendly (externo, de pago). " +
         "Ahora Pathway le DA su link interno (/reservar.html?c=<id>) y solo mantiene " +
         "el iCal para ver sus eventos. No debe volver el campo cfp-cal (Calendly).",
    check() {
      const s = read("panel-v2.html");
      if (!s) return null;
      if (/id='cfp-cal'/.test(s))
        return "panel-v2.html: volvió el campo cfp-cal (pedido de link de Calendly). Debe darse el link interno.";
      // El link de reservas (que le damos nosotros) vive en Calendario, compacto,
      // con botón Copiar — no en el formulario del perfil.
      if (!/copy-book/.test(s) || !/reservar\.html\?c=/.test(s))
        return "panel-v2.html: falta el link interno de reservas (copy-book / reservar.html?c=).";
      if (!/cfp-cal-ical/.test(s))
        return "panel-v2.html: falta el campo de iCal (cfp-cal-ical) para ver los eventos en la agenda.";
      return null;
    },
  },
  {
    name: "reservas: los horarios se convierten a la zona del visitante",
    bug: "La página de reserva interpretaba la disponibilidad del coach en la zona " +
         "horaria de QUIEN MIRA: un visitante de Argentina veía '09:00' que en " +
         "realidad era otra hora del coach. Debe interpretar la disponibilidad en la " +
         "zona del coach (gcal iCal / disponibilidad.tz) y mostrar cada hueco en la " +
         "hora LOCAL del visitante. El instante elegido (sel.ms) es absoluto (UTC).",
    check() {
      const s = read("reservar.html");
      if (!s) return null;
      if (!/_wallToUtc\(/.test(s) || !/_coachInstants\(/.test(s))
        return "reservar.html: faltan los helpers de zona horaria (_wallToUtc/_coachInstants) — ¿se volvió a la hora del visitante?";
      const i = s.indexOf("function confirmar(");
      const sub = i >= 0 ? s.slice(i, i + 900) : s;
      if (!/new Date\(sel\.ms\)/.test(sub))
        return "reservar.html: confirmar ya no usa el instante absoluto sel.ms (¿volvió a construir la fecha en hora local del visitante?).";
      if (/new Date\(d\.getFullYear\(\),\s*d\.getMonth\(\)[^)]*hm\[0\]/.test(s))
        return "reservar.html: volvió a construir el horario en hora local del visitante (bug de zona horaria).";
      return null;
    },
  },
  {
    name: "reservas: una sola página de reserva (agendar.html redirige a reservar.html)",
    bug: "Existían DOS páginas de reserva (agendar.html y reservar.html). Al mejorar " +
         "una (zona horaria, reserva interna) la otra quedaba vieja e incoherente. " +
         "agendar.html debe ser solo un redirect a reservar.html (única fuente).",
    check() {
      const s = read("agendar.html");
      if (!s) return null;
      if (!/location\.replace\(\s*DESTINO/.test(s) || !/\/reservar\.html/.test(s))
        return "agendar.html: dejó de redirigir a reservar.html (¿volvió a ser una página de reserva aparte?).";
      if (/function confirmar\(/.test(s) || /function renderPicker\(/.test(s))
        return "agendar.html: volvió a tener su propia lógica de reserva — debe redirigir a reservar.html, no duplicarla.";
      return null;
    },
  },
  {
    name: "reservas: bloquea los horarios ocupados del calendario real del coach",
    bug: "La reserva solo evitaba pisar OTRAS reservas de Pathway (tabla citas), " +
         "pero NO miraba el Google/iCal del coach → le podían reservar encima de un " +
         "evento real. Debe leer su calendario (edge function `calendar`) y marcar " +
         "esos huecos como ocupados, además de las citas.",
    check() {
      const s = read("reservar.html");
      if (!s) return null;
      if (!/function loadBusy\(/.test(s) || !/functions\/v1\/calendar\?email=/.test(s))
        return "reservar.html: ya no carga los eventos reales del coach (loadBusy) para bloquear ocupados.";
      if (!/_slotBusy\(sl\.ms\)/.test(s))
        return "reservar.html: el render de horarios ya no descarta los huecos ocupados del calendario (_slotBusy).";
      return null;
    },
  },
  {
    name: "recordatorios: la reserva guarda teléfono + zona del cliente",
    bug: "Los recordatorios (email 24h/1h y el botón de WhatsApp) necesitan que al " +
         "reservar se guarde el teléfono (para WhatsApp) y la zona horaria del " +
         "cliente (para mostrar la hora en SU hora en el email). Si el POST a citas " +
         "deja de mandar telefono/cliente_tz, los recordatorios quedan cojos.",
    check() {
      const s = read("reservar.html");
      if (!s) return null;
      const i = s.indexOf("coach_id:_cid");
      if (i < 0) return "reservar.html: no se encuentra el POST a citas.";
      const blk = s.slice(i, i + 200);
      if (!/telefono:/.test(blk) || !/cliente_tz:/.test(blk))
        return "reservar.html: el POST a citas ya no guarda telefono/cliente_tz (los recordatorios quedan sin datos).";
      return null;
    },
  },
  {
    name: "reservas: el cliente puede cancelar/reprogramar (token + página)",
    bug: "El email de reserva lleva un link para cancelar/reprogramar solo. Depende " +
         "de que reservar.html genere un token por cita y lo guarde, y de que exista " +
         "gestionar-cita.html que busca la cita por ese token y la cancela.",
    check() {
      const r = read("reservar.html");
      if (r) {
        const i = r.indexOf("coach_id:_cid");
        const blk = i >= 0 ? r.slice(i, i + 200) : "";
        if (!/token:/.test(blk)) return "reservar.html: el POST a citas ya no guarda el token (sin token no hay link de cancelar/reprogramar).";
      }
      const g = read("gestionar-cita.html");
      if (!g) return "falta gestionar-cita.html (cancelar/reprogramar por el cliente).";
      if (!/token=eq\./.test(g)) return "gestionar-cita.html ya no busca la cita por token.";
      if (!/estado:\s*'cancelada'/.test(g)) return "gestionar-cita.html ya no cancela la cita.";
      return null;
    },
  },
  {
    name: "calendario del panel: rediseño (stats arriba + resumen semana)",
    bug: "El Calendario del panel tiene la fila de stats de arriba (Hoy/Clientes/" +
         "Esta semana/Asistencia) y la card 'Resumen de esta semana' con 5 tarjetas, " +
         "calculadas de datos reales (_calStats). Si se desconecta, se pierde el " +
         "rediseño estilo mockup.",
    check() {
      const p = read("panel-v2.html");
      if (!p) return null;
      if (!/function _calStats/.test(p)) return "panel-v2.html: falta _calStats (números reales del calendario).";
      if (!/cp-cal-topstats/.test(p)) return "panel-v2.html: falta la fila de stats de arriba (cp-cal-topstats).";
      if (!/Resumen de esta semana/.test(p)) return "panel-v2.html: falta la card 'Resumen de esta semana'.";
      return null;
    },
  },
  {
    name: "disponibilidad: slider del horario general (coach + empleado)",
    bug: "El horario general de 'Mi disponibilidad' se ajusta con un slider de rango " +
         "(dos thumbs) además de los inputs de hora, en el panel del coach y en el del " +
         "empleado. El slider sincroniza con los inputs (que son la fuente del guardado). " +
         "Si se desconecta, se pierde el slider del mockup.",
    check() {
      const p = read("panel-v2.html");
      if (p) {
        if (!/_agRngSync/.test(p)) return "panel-v2.html: falta el slider del horario general (_agRngSync).";
        if (!/ag-rng-from/.test(p)) return "panel-v2.html: falta el input range del horario (ag-rng-from).";
      }
      const e = read("empleado.html");
      if (e) {
        if (!/_empRngSync/.test(e)) return "empleado.html: falta el slider del horario general (_empRngSync).";
      }
      return null;
    },
  },
  {
    name: "calendario del panel: card 'Próxima sesión'",
    bug: "En la pestaña Calendario, la columna derecha muestra la 'Próxima sesión' " +
         "(la cita/evento futuro más cercano) con hora, 'En X min' y acceso. Si se " +
         "desconecta, se pierde esa card del mockup.",
    check() {
      const p = read("panel-v2.html");
      if (!p) return null;
      if (!/function _agProxRender/.test(p)) return "panel-v2.html: falta _agProxRender (card Próxima sesión).";
      if (!/cp-agenda-prox/.test(p)) return "panel-v2.html: falta la columna 'Próxima sesión' (cp-agenda-prox).";
      if (!/Próxima sesión/.test(p)) return "panel-v2.html: la card 'Próxima sesión' ya no se muestra.";
      return null;
    },
  },
  {
    name: "ficha del cliente: guía del próximo paso que se mueve sola (Análisis → Documentos)",
    bug: "Dentro de la ficha del cliente, la guía muestra el próximo paso del coach con " +
         "ese cliente (genera el diagnóstico, después arma el CV) con un hint arriba y la " +
         "pestaña destino 'respirando' (cp-guide-here). Avanza sola según reportState/cvState. " +
         "Si se desconecta, el coach vuelve a quedar sin saber qué hacer con el cliente.",
    check() {
      const p = read("panel-v2.html");
      if (!p) return null;
      if (!/function _cliNextStep/.test(p)) return "panel-v2.html: falta _cliNextStep (guía del próximo paso por cliente).";
      if (!/cp-cli-next/.test(p)) return "panel-v2.html: falta el hint 'Próximo paso' (cp-cli-next) en la ficha del cliente.";
      if (!/_beacon\(/.test(p)) return "panel-v2.html: la pestaña destino ya no 'respira' (falta _beacon/cp-guide-here en las pestañas de la ficha).";
      return null;
    },
  },
  {
    name: "ficha del cliente: pestañas en cascada dominó (de a una, en orden) en los 3 nichos",
    bug: "Las pestañas del cliente aparecen DE A UNA a medida que avanza (base siempre + " +
         "cadena por nicho). CANDADO: una pestaña con datos se muestra siempre y el siguiente " +
         "eslabón se abre solo cuando el anterior ya tiene contenido → nunca oculta algo con " +
         "datos y no rompe a los coaches que ya trabajan. Config para carrera/fitness/financiero.",
    check() {
      const p = read("panel-v2.html");
      if (!p) return null;
      if (!/function _cliVisibleTabs/.test(p)) return "panel-v2.html: falta _cliVisibleTabs (cascada de pestañas).";
      if (!/_CLI_CASCADE\s*=/.test(p)) return "panel-v2.html: falta la config _CLI_CASCADE (cadena por nicho).";
      // El candado: una pestaña con datos se muestra (if(open || has)).
      if (!/if\(open \|\| has\)\s*shown\[step\.tab\]=true/.test(p)) return "panel-v2.html: _cliVisibleTabs ya no muestra una pestaña con datos (candado roto).";
      if (!/carrera:.*fitness:.*financiero:/s.test(p)) return "panel-v2.html: la cascada no cubre los 3 nichos (carrera/fitness/financiero).";
      if (!/_cliVisibleTabs\(c,_tipo,_cliTabs\(_tipo\)\)/.test(p)) return "panel-v2.html: la ficha del cliente ya no aplica la cascada _cliVisibleTabs.";
      return null;
    },
  },
  {
    name: "calendario del panel: Agenda del día (solo lo agendado) + asistencia inline + toggle Hoy/Semana",
    bug: "La pestaña Calendario abre en la 'Agenda del día' del día (por defecto hoy), " +
         "mostrando SOLO las sesiones/reservas agendadas (sin llenar de huecos). Cada reserva " +
         "pasada trae botones para marcar asistió/no asistió DESDE la agenda (cal-asis, suma a " +
         "las analíticas) y la cabecera tiene un toggle Hoy | Semana. Si se desconecta, se " +
         "pierde la vista de día del mockup, el marcado inline o el toggle.",
    check() {
      const p = read("panel-v2.html");
      if (!p) return null;
      if (!/function _agRenderDay/.test(p)) return "panel-v2.html: falta _agRenderDay (Agenda del día).";
      if (!/if\(!_AG_SEL_DAY\)\s*_AG_SEL_DAY=_agMoKey\(new Date\(\)\)/.test(p)) return "panel-v2.html: Calendario ya no abre en la Agenda del día (hoy).";
      if (!/id:r\.id/.test(p)) return "panel-v2.html: las reservas de la agenda ya no llevan id (no se puede marcar asistencia inline).";
      if (!/data-act='cal-asis'[^]{0,120}data-val='asistio'/.test(p)) return "panel-v2.html: la agenda del día ya no tiene el botón de marcar asistencia inline (cal-asis).";
      if (!/act==="ag-hoy"/.test(p)) return "panel-v2.html: falta el toggle 'Hoy' de la agenda (ag-hoy).";
      if (!/function _agAfterCalBody/.test(p)) return "panel-v2.html: falta _agAfterCalBody (refrescar la agenda tras marcar asistencia).";
      const e = read("empleado.html");
      if (e) {
        if (!/id:r\.id/.test(e)) return "empleado.html: las reservas de la agenda ya no llevan id (no se puede marcar asistencia inline).";
        if (!/markAsistencia\('"\+ev\.id\+"'/.test(e) && !/onclick=\\"markAsistencia\('"\+ev\.id/.test(e)) return "empleado.html: la agenda ya no tiene el botón de marcar asistencia inline.";
        if (!/window\.emAgView/.test(e)) return "empleado.html: falta el toggle Hoy/Semana de la agenda (emAgView).";
      }
      return null;
    },
  },
  {
    name: "comercial: 'En prueba' se detecta solo (trial del coach), no a mano",
    bug: "El embudo del empleado/admin cuenta 'En prueba' cruzando los leads con " +
         "los coaches que tienen estado_sub='prueba' (el trial de 14 días ya dado), " +
         "y 'Pagaron' con estado_sub='activa'. Si se desconecta la detección de " +
         "prueba, el vendedor tiene que marcar 'alta' a mano y el embudo no refleja " +
         "los accesos reales.",
    check() {
      const e = read("empleado.html");
      if (e) {
        if (!/loadTrialCoaches/.test(e)) return "empleado.html: falta loadTrialCoaches (detección automática de 'En prueba').";
        if (!/estado_sub['"\\]*\)?,\s*['"]prueba['"]|estado_sub'?\s*,\s*'prueba'/.test(e) && !/'prueba'/.test(e)) return "empleado.html: ya no consulta coaches en 'prueba'.";
      }
      const p = read("panel-v2.html");
      if (p) {
        if (!/_trialCoachEmails/.test(p)) return "panel-v2.html: falta _trialCoachEmails (admin: 'En prueba' automático).";
      }
      return null;
    },
  },
  {
    name: "admin: 'Dar acceso a un coach' no se cuelga y confirma el email",
    bug: "El botón coach-access (crear/extender coach) ponía 'Procesando…' y, si el " +
         "POST se colgaba (red/token trabado), quedaba así para siempre sin crear al " +
         "coach ni avisar. Y el email de activación era fire-and-forget: si no salía, " +
         "nadie se enteraba. Fix: watchdog (_caEnd cierra una sola vez + timeout que " +
         "corta el 'Procesando'), errores con código HTTP real, y _sendCoachAccessEmail " +
         "devuelve Promise<boolean> para confirmar/avisar si el email no salió.",
    check() {
      const p = read("panel-v2.html");
      if (!p) return null;
      if (!/act==="coach-access"/.test(p)) return "panel-v2.html: falta el handler coach-access.";
      // El email debe reportar si salió (boolean), no ser fire-and-forget.
      if (!/function _sendCoachAccessEmail/.test(p)) return "panel-v2.html: falta _sendCoachAccessEmail.";
      if (!/send-email[\s\S]{0,400}?\.then\(function\(r\)\{\s*return\s*!!\(r&&r\.ok\)/.test(p))
        return "panel-v2.html: _sendCoachAccessEmail volvió a ser fire-and-forget (no confirma si el email salió).";
      // Watchdog: coach-access no puede quedar 'Procesando…' para siempre.
      const seg = p.slice(p.indexOf('act==="coach-access"'));
      if (!/setTimeout\([\s\S]{0,200}?"Procesando|_caTimer\s*=\s*setTimeout/.test(seg) || !/clearTimeout/.test(seg))
        return "panel-v2.html: coach-access perdió el watchdog anti-cuelgue (puede quedar en 'Procesando…').";
      if (!/\bsent\b/.test(seg)) return "panel-v2.html: coach-access ya no confirma si el email de activación salió.";
      return null;
    },
  },
  {
    name: "admin: 'Dar acceso a un coach' SIEMPRE ofrece el link directo de activación",
    bug: "Al crear un coach, si la escritura al panel fallaba o el email automático no " +
         "salía, la coach quedaba sin forma de dar acceso ('no me llegó la invitación'). " +
         "Fix: se muestra un link directo (registro.html?email=) apenas se intenta crear " +
         "un coach nuevo — se setea ANTES del POST, así se ve aunque la escritura o el " +
         "email fallen (registro.html crea/activa la cuenta al entrar). Además el email " +
         "de coach-access se sanea (sin espacios) para que un pegado con espacio no lo rechace.",
    check() {
      const p = read("panel-v2.html");
      if (!p) return null;
      if (!/act==="coach-access"/.test(p)) return null; // otra regla cubre la ausencia del handler
      const seg = p.slice(p.indexOf('act==="coach-access"'));
      const seg2 = seg.slice(0, 8000);
      // Email saneado sin espacios (evita el "no estaba bien el mail" por pegar con espacio).
      if (!/cac-email[\s\S]{0,80}?replace\(\/\\s\+\/g,\s*""\)/.test(seg2))
        return "panel-v2.html: coach-access dejó de sanear el email (replace de espacios).";
      // El link directo se setea en state.coachLink DENTRO del flujo de coach nuevo.
      if (!/state\.coachLink\s*=\s*caLink/.test(seg2))
        return "panel-v2.html: coach-access ya no setea el link directo de activación (state.coachLink).";
      // Y el render lo muestra con botón de copiar (handler ag-copy-link).
      if (!/state\.coachLink/.test(p) || !/data-act='ag-copy-link'\s+data-link='"\+esc\(cLink\)/.test(p))
        return "panel-v2.html: el link directo de activación ya no se renderiza con botón Copiar.";
      return null;
    },
  },
  {
    name: "admin: crear coach pasa por la edge function crear-coach (RLS no lo bloquea)",
    bug: "El botón 'Dar acceso a un coach' hacía un POST directo a usuarios con rol='coach' " +
         "desde el navegador. Con RLS estricto en usuarios (usuarios_hardening.sql), la anon " +
         "key / un JWT no-admin solo pueden crear rol='cliente' → el INSERT se rechazaba con " +
         "403 y 'no anda agregar coach'. Fix: la creación/extensión va por la edge function " +
         "crear-coach (service role), que verifica que quien llama es admin (JWT → /auth/v1/user) " +
         "y escribe salteando RLS.",
    check() {
      const p = read("panel-v2.html");
      if (!p) return null;
      if (!/act==="coach-access"/.test(p)) return null; // otra regla cubre la ausencia del handler
      const start = p.indexOf('act==="coach-access"');
      const endMarker = p.indexOf('act==="empleado-crear"', start);
      const seg = endMarker > start ? p.slice(start, endMarker) : p.slice(start, start + 6000);
      // El handler debe llamar a la edge function crear-coach...
      if (!/functions\/v1\/crear-coach/.test(seg))
        return "panel-v2.html: coach-access ya no llama a la edge function crear-coach (¿volvió al POST directo que RLS bloquea?).";
      // ...y NO volver a escribir un usuario rol='coach' directo desde el navegador.
      if (/rol:\s*["']coach["']/.test(seg))
        return "panel-v2.html: coach-access volvió a crear un usuario rol='coach' directo (RLS lo bloquea). Debe ir por crear-coach.";
      // La edge function debe existir, usar service role y verificar admin antes de escribir.
      const fn = read("supabase/functions/crear-coach/index.ts");
      if (!fn) return "falta supabase/functions/crear-coach/index.ts (la creación de coach depende de esta función).";
      if (!/SERVICE_ROLE_KEY/.test(fn)) return "crear-coach: ya no usa service role (no podría saltear el RLS de usuarios).";
      if (!/not_admin/.test(fn) || !/auth\/v1\/user/.test(fn))
        return "crear-coach: perdió la verificación de admin (JWT → /auth/v1/user). No debe crear coaches sin verificar admin.";
      // Y debe estar en el workflow de auto-deploy (si no, nunca llega a producción).
      const wf = read(".github/workflows/deploy-functions.yml");
      if (wf && !/functions deploy crear-coach/.test(wf))
        return "deploy-functions.yml: falta el paso para desplegar crear-coach (la fn quedaría sin publicar).";
      return null;
    },
  },
  {
    name: "multicoach: el dueño logueado ve su RED REAL (no la maqueta)",
    bug: "multicoach.html arrancaba SIEMPRE con datos demo (Alex Gómez inventado). " +
         "Ahora, si entra un usuario rol='owner', carga su organización + coaches + " +
         "clientes por org_id desde Supabase (mcBoot→mcLoadReal), y el login rutea al " +
         "owner a multicoach.html. Si algo falla cae a demo (nunca en blanco). Ver " +
         "docs/multicoach-modelo.md.",
    check() {
      const mc = read("multicoach.html");
      if (!mc) return null;
      // Bootstrap por sesión: owner → real; si no → demo.
      if (!/function mcBoot\(/.test(mc)) return "multicoach.html: falta mcBoot() (arranque por sesión).";
      if (!/rol===['"]owner['"]/.test(mc)) return "multicoach.html: mcBoot ya no distingue al owner (rol='owner').";
      if (!/function mcLoadReal\(/.test(mc)) return "multicoach.html: falta mcLoadReal() (carga de la red real).";
      // Debe leer la org y filtrar coaches/clientes por org_id.
      if (!/organizaciones/.test(mc) || !/org_id=eq\./.test(mc))
        return "multicoach.html: mcLoadReal ya no lee organizaciones / filtra por org_id.";
      // Fallback a demo ante error (no dejar el panel en blanco).
      if (!/MC_REAL=false;\s*mcApplyNiche\(\)/.test(mc))
        return "multicoach.html: mcLoadReal perdió el fallback a demo (podría quedar en blanco).";
      // El login debe rutear al owner a su panel de red.
      const lg = read("login.html");
      if (lg && !/rol===['"]owner['"][\s\S]{0,120}multicoach\.html/.test(lg))
        return "login.html: el owner ya no se rutea a multicoach.html.";
      return null;
    },
  },
  {
    name: "admin: 'Dar acceso a un multicoach' crea la empresa vía crear-multicoach",
    bug: "El alta de un multicoach (dueño de red) debe crear la ORGANIZACIÓN con sus " +
         "límites según el plan (Boutique 3/15 · Pro ilimitado) y el owner rol='owner', " +
         "salteando RLS de forma segura. Va por la edge function crear-multicoach (service " +
         "role + gate de admin), NUNCA por un POST directo desde el navegador. Ver " +
         "docs/multicoach-modelo.md.",
    check() {
      const p = read("panel-v2.html");
      if (!p) return null;
      if (!/act==="mc-access"/.test(p)) return "panel-v2.html: falta el handler mc-access (Dar acceso a un multicoach).";
      const start = p.indexOf('act==="mc-access"');
      const endMarker = p.indexOf('act==="empleado-crear"', start);
      const seg = endMarker > start ? p.slice(start, endMarker) : p.slice(start, start + 6000);
      if (!/functions\/v1\/crear-multicoach/.test(seg))
        return "panel-v2.html: mc-access ya no llama a la edge function crear-multicoach.";
      if (/rol:\s*["']owner["']/.test(seg))
        return "panel-v2.html: mc-access crea un usuario rol='owner' directo (RLS lo bloquea). Debe ir por crear-multicoach.";
      // La edge function debe existir, usar service role, verificar admin y crear la org.
      const fn = read("supabase/functions/crear-multicoach/index.ts");
      if (!fn) return "falta supabase/functions/crear-multicoach/index.ts.";
      if (!/SERVICE_ROLE_KEY/.test(fn)) return "crear-multicoach: ya no usa service role (no saltearía RLS).";
      if (!/not_admin/.test(fn) || !/auth\/v1\/user/.test(fn))
        return "crear-multicoach: perdió la verificación de admin (JWT → /auth/v1/user).";
      if (!/organizaciones/.test(fn) || !/rol:\s*["']owner["']/.test(fn))
        return "crear-multicoach: debe crear la fila en organizaciones y el owner rol='owner'.";
      // La migración de la base debe existir (la tabla organizaciones + org_id).
      const mig = read("supabase/migrations/organizaciones.sql");
      if (!mig || !/CREATE TABLE IF NOT EXISTS organizaciones/.test(mig))
        return "falta supabase/migrations/organizaciones.sql (tabla organizaciones + org_id).";
      // Y debe estar en el workflow de auto-deploy.
      const wf = read(".github/workflows/deploy-functions.yml");
      if (wf && !/functions deploy crear-multicoach/.test(wf))
        return "deploy-functions.yml: falta el paso para desplegar crear-multicoach.";
      return null;
    },
  },
  {
    name: "calendario del panel: día clickeable + incluye demos del equipo/pasadas",
    bug: "En el panel, tocar un día del calendario debe mostrar los eventos de ese " +
         "día (ag-mo-day → _agRenderDay). Y los puntitos/el detalle deben leer de " +
         "_agReservas() (prefiere _CAL_DATA: incluye al equipo si es admin + días " +
         "pasados), no solo _RES_DATA (propia y últimas 24h) — si no, no se ven las " +
         "demos de otros coaches ni las de ayer.",
    check() {
      const p = read("panel-v2.html");
      if (!p) return null;
      if (!/ag-mo-day/.test(p)) return "panel-v2.html: el calendario ya no responde al click en un día (falta ag-mo-day).";
      if (!/function _agRenderDay/.test(p)) return "panel-v2.html: falta _agRenderDay (detalle del día).";
      if (!/function _agReservas/.test(p)) return "panel-v2.html: falta _agReservas (fuente de reservas del calendario).";
      if (!/var res\s*=\s*_agReservas\(\)/.test(p)) return "panel-v2.html: el mes ya no usa _agReservas() (no muestra demos del equipo/pasadas).";
      return null;
    },
  },
  {
    name: "reservas: horario por día (jueves distinto sin tocar el resto)",
    bug: "La disponibilidad admite un horario general (from/to) + overrides por " +
         "día en disponibilidad.horarios ({ '<weekday>': {from,to} }). reservar.html " +
         "debe aplicar el override del día si existe (si no, el general), y el panel " +
         "debe poder editar/guardar esos overrides. Si se desconecta, se pierde el " +
         "horario por día.",
    check() {
      const r = read("reservar.html");
      if (r) {
        if (!/horarios/.test(r)) return "reservar.html: normDisp/_coachInstants ya no maneja horarios por día.";
        if (!/hor\[String\(ymd\.wd\)\]/.test(r)) return "reservar.html: _coachInstants ya no aplica el horario por día (override).";
      }
      const p = read("panel-v2.html");
      if (p) {
        if (!/ag-hor-add/.test(p)) return "panel-v2.html: falta el control de horario por día (ag-hor-add).";
        if (!/horarios:\s*_shor/.test(p)) return "panel-v2.html: el guardado de disponibilidad ya no incluye horarios por día.";
      }
      const e = read("empleado.html");
      if (e) {
        if (!/addDispHor/.test(e)) return "empleado.html: falta el control de horario por día (addDispHor).";
        if (!/horarios:\s*_hor/.test(e)) return "empleado.html: el guardado de disponibilidad ya no incluye horarios por día.";
      }
      return null;
    },
  },
  {
    name: "paywall: reactivación por reseña (+15 días) para inactivos hace 15+ días, una sola vez",
    bug: "En el paywall 'Tu prueba terminó', a los coaches inactivos hace 15+ días " +
         "(recuperación) se les ofrece dejar una reseña a cambio de reactivar 15 días. " +
         "El grant pone fecha_fin_prueba=hoy+15 en modo 'prueba' (para que tras vencer " +
         "vuelva el paywall a pedir tarjeta) y marca resena_bonus_usado (una sola vez). " +
         "Los recién vencidos no la ven (que paguen). Si se rompe, se pierde el anzuelo " +
         "de recuperación o se regalan días indebidos.",
    check() {
      const p = read("panel-v2.html");
      if (!p) return null;
      if (!/_diasVenc\s*>=\s*15/.test(p)) return "panel-v2.html: la oferta de reseña ya no filtra por inactivo hace 15+ días.";
      if (!/resena_bonus_usado/.test(p)) return "panel-v2.html: falta el flag resena_bonus_usado (una sola vez) en la reactivación por reseña.";
      if (!/act==="pw-resena-send"/.test(p)) return "panel-v2.html: falta el handler que otorga los 15 días por reseña (pw-resena-send).";
      if (!/estado_sub:"prueba"[\s\S]{0,80}resena_bonus_usado/.test(p) && !/resena_bonus_usado[\s\S]{0,80}estado_sub:"prueba"/.test(p) && !/fecha_fin_prueba:new Date\(Date\.now\(\)\+15/.test(p)) return "panel-v2.html: el grant de reactivación ya no extiende 15 días en modo prueba.";
      return null;
    },
  },
  {
    name: "sesiones: 'Mis temas / dudas' en los TRES portales (guardan notas_progreso)",
    bug: "La sección Preparación con 'Mis temas / dudas' (el cliente anota qué hablar " +
         "en la sesión y se guarda en candidatos.notas_progreso) debe estar en los tres " +
         "portales del cliente: carrera, fitness y financiero. Si falta en alguno, se " +
         "pierde la función y se rompe la unificación.",
    check() {
      for (const f of ["cliente.html", "pathway-fit-cliente.html", "pathway-fin-cliente.html"]) {
        const s = read(f);
        if (!s) continue;
        if (!/Mis temas/.test(s)) return f + ": falta 'Mis temas / dudas' (Preparación de Sesiones).";
        if (!/notas_progreso/.test(s)) return f + ": 'Mis temas / dudas' ya no guarda en notas_progreso.";
      }
      return null;
    },
  },
  {
    name: "fitness/financiero: sin acciones-foco desconectadas (el plan real es otro)",
    bug: "Las 'acciones' (cv_acciones… agrupadas por etapa) NO llegan al cliente en " +
         "fitness ni financiero, así que el panel NO debe embeber _avanceHtml para " +
         "esos nichos y sus portales NO deben mostrar el 'Foco' estático. En fitness " +
         "el plan son las 'Tareas de la semana'; en financiero, las etapas SÍ se ven " +
         "(como 'Plan por meses', leen c.etapas) + objetivos/presupuesto/deudas. Si " +
         "vuelve el embed o el foco, reaparece la parte desconectada.",
    check() {
      const p = read("panel-v2.html");
      if (p && !/_tipo==='carrera'\|\|_tipo==='fitness'\|\|_tipo==='financiero'/.test(p))
        return "panel-v2.html: fitness/financiero volvió a embeber las acciones desconectadas (_avanceHtml).";
      const f = read("pathway-fit-cliente.html");
      if (f) {
        if (/Foco de esta semana/.test(f)) return "pathway-fit-cliente.html: volvió el 'Foco de esta semana' (acciones) — debía quedar solo las Tareas de la semana.";
        if (!/Tus tareas de la semana/.test(f)) return "pathway-fit-cliente.html: falta 'Tus tareas de la semana' (el plan del cliente fitness).";
      }
      const fn = read("pathway-fin-cliente.html");
      if (fn) {
        if (/Foco de este mes/.test(fn)) return "pathway-fin-cliente.html: volvió el 'Foco de este mes' estático (desconectado).";
        if (!/plan-step/.test(fn)) return "pathway-fin-cliente.html: falta el 'Plan por meses' (plan-step) que SÍ lee las etapas del coach.";
      }
      return null;
    },
  },
  {
    name: "reservas: se guarda de dónde llegó (atribución de canal)",
    bug: "El coach sabe por qué canal le llegan las reservas (citas.origen), que el " +
         "panel muestra por reserva y agregado en Métricas ('Por dónde llegan'). " +
         "Ya NO hay una pregunta fija del sistema: la atribución se deriva de una " +
         "pregunta que el coach agrega ('de dónde nos conocés') y su respuesta se " +
         "mapea a origen. Si el POST deja de mandar origen, se pierde el mapeo, o el " +
         "panel deja de leerlo/mostrarlo, se pierde la atribución.",
    check() {
      const r = read("reservar.html");
      if (r) {
        const i = r.indexOf("coach_id:_cid");
        const blk = i >= 0 ? r.slice(i, i + 260) : "";
        if (!/origen:/.test(blk)) return "reservar.html: el POST a citas ya no guarda origen (se pierde la atribución).";
        // La atribución ahora se deriva de una pregunta del coach → origen.
        if (!/origen\s*=\s*x\.a/.test(r)) return "reservar.html: se perdió el mapeo de la pregunta de canal a origen.";
      }
      const p = read("panel-v2.html");
      if (p) {
        // La lista de reservas lee con select=* (trae origen si existe) y las
        // métricas siguen leyendo origen explícito. Basta con que aparezca alguno.
        if (!/select=\*/.test(p) && !/select=[^"']*origen/.test(p)) return "panel-v2.html: la query de citas ya no trae 'origen' (ni select=*).";
        if (!/Por dónde llegan/.test(p)) return "panel-v2.html: falta el desglose 'Por dónde llegan' en Métricas.";
      }
      return null;
    },
  },
  {
    name: "reordenar: pw-sortable incluido y el orden se guarda",
    bug: "pw-sortable.js permite arrastrar-para-ordenar (tipos de evento, tarjetas " +
         "de cliente). El orden DEBE guardarse: tipos → configuracion.event_types, " +
         "clientes → configuracion.cliente_orden. Si se desconecta, el arrastre no " +
         "persiste y se pierde al refrescar.",
    check() {
      const dz = read("pw-sortable.js");
      if (!dz) return "falta pw-sortable.js (helper de arrastrar-para-ordenar).";
      if (!/window\.pwSortable\s*=/.test(dz)) return "pw-sortable.js ya no expone window.pwSortable.";
      const p = read("panel-v2.html");
      if (!p) return null;
      if (!/pw-sortable\.js/.test(p)) return "panel-v2.html ya no incluye pw-sortable.js.";
      if (!/saveCfg\(\{event_types:/.test(p)) return "panel-v2.html: el orden de tipos de evento ya no se guarda (event_types).";
      if (!/saveCfg\(\{cliente_orden:/.test(p)) return "panel-v2.html: el orden de las tarjetas de cliente ya no se guarda (cliente_orden).";
      // Efecto "settle" al soltar (arrastrar ya tiene sombra en begin()).
      if (!/pw-sort-dropped/.test(dz)) return "pw-sortable.js perdio el efecto 'settle' al soltar.";
      // Servicios del coach: reordenables y persisten en configuracion.servicios.
      if (!/id=.cfg-services-list./.test(p)) return "panel-v2.html perdio el contenedor sortable de servicios (cfg-services-list).";
      if (!/saveCfg\(\{\s*servicios:/.test(p)) return "panel-v2.html: el orden de servicios ya no se guarda (servicios).";
      // Metas de ahorro del cliente: reordenables y persisten en fin_objetivos.
      const fin = read("pathway-fin-cliente.html");
      if (fin) {
        if (!/pw-sortable\.js/.test(fin)) return "pathway-fin-cliente.html ya no incluye pw-sortable.js.";
        if (!/function _metaReorder/.test(fin)) return "pathway-fin-cliente.html perdio el reordenar de metas (_metaReorder).";
      }
      return null;
    },
  },
  {
    name: "leads: importar no genera duplicados (dedup antes de insertar)",
    bug: "doImport insertaba _impRows sin re-chequear contra la lista completa; " +
         "una vista desactualizada o una re-importacion creaban leads duplicados. " +
         "Ahora relee todos los leads y deduplica con leadKey justo antes de insertar.",
    check() {
      const e = read("empleado.html");
      if (!e) return null;
      const m = e.match(/async function doImport\(\)\s*\{[\s\S]*?\n  \}/);
      if (!m) return "empleado.html: no se encontro doImport().";
      const body = m[0];
      if (!/loadLeads\(\)/.test(body)) return "empleado.html: doImport ya no relee la lista completa antes de importar.";
      if (!/leadKey\(/.test(body)) return "empleado.html: doImport ya no deduplica con leadKey antes de insertar.";
      return null;
    },
  },
  {
    name: "tracking de anuncios: pw-pixel.js presente, incluido y capturando origen",
    bug: "pw-pixel.js carga el Meta Pixel y captura de qué anuncio/campaña vino cada " +
         "visitante (window.pwAttr, first-touch). Si se borra el archivo, se saca de " +
         "las landings, o el chatbot deja de guardar `origen`, se pierde la trazabilidad " +
         "de qué anuncio trae leads (no se puede optimizar la inversión en ads).",
    check() {
      const px = read("pw-pixel.js");
      if (!px) return "falta pw-pixel.js (Meta Pixel + atribución de origen).";
      if (!/window\.pwAttr\s*=/.test(px)) return "pw-pixel.js ya no expone window.pwAttr() (captura de origen).";
      if (!/PW_META_PIXEL_ID/.test(px)) return "pw-pixel.js perdió la config del Pixel ID de Meta.";
      // Debe estar incluido en las páginas por donde entran los anuncios.
      for (const f of ["index.html", "soy-coach.html", "registro.html", "formulario.html"]) {
        if (read(f) && !/pw-pixel\.js/.test(read(f))) return f + " ya no incluye pw-pixel.js (deja de trackear los anuncios).";
      }
      // El interceptor central debe adjuntar el origen a los POST de contactos_chat
      // (cubre soy-candidato, coaches, etc. de una sola vez).
      if (!/contactos_chat[\s\S]{0,400}o\.origen\s*=\s*a/.test(px))
        return "pw-pixel.js: se perdió el interceptor que adjunta el origen a los leads de contactos_chat.";
      // El registro debe guardar el origen en configuracion.
      const reg = read("registro.html");
      if (reg && !/configuracion\.origen\s*=/.test(reg)) return "registro.html: el alta ya no guarda el origen del anuncio (configuracion.origen).";
      return null;
    },
  },
  {
    name: "móvil: pull-to-refresh (bajar para actualizar) en los 3 portales del cliente",
    bug: "En el panel del coach ya se bajaba para actualizar, pero los portales del " +
         "cliente (carrera/fitness/finanzas) no tenían el gesto: la coach bajaba la " +
         "pantalla y no pasaba nada. Se agregó el mismo pull-to-refresh (indicador " +
         "#cli-ptr + recarga al soltar) para que el móvil se sienta igual en toda la " +
         "app. Si se cae de alguno de los portales, ese portal vuelve a quedar sin " +
         "'actualizar para abajo'.",
    check() {
      const portals = ["cliente.html", "pathway-fit-cliente.html", "pathway-fin-cliente.html"];
      for (const f of portals) {
        const s = read(f);
        if (!s) continue;
        if (!/cli-ptr/.test(s)) return f + ": se perdió el pull-to-refresh móvil (indicador #cli-ptr).";
        // El gesto debe engancharse a touchstart/touchmove/touchend y recargar al soltar.
        if (!/addEventListener\(['"]touchmove['"]/.test(s)) return f + ": el pull-to-refresh ya no escucha touchmove.";
        if (!/location\.reload\(\)/.test(s)) return f + ": el pull-to-refresh ya no recarga (location.reload) al soltar.";
      }
      return null;
    },
  },
  {
    name: "consentimiento de cookies (RGPD): los trackers de terceros cargan SOLO tras aceptar",
    bug: "Meta Pixel y LinkedIn Insight cargaban sin consentimiento → incumple RGPD " +
         "(hay público en España). pw-consent.js muestra el banner y gatea: el pixel " +
         "solo carga si pwConsent()==='granted', y el tag de LinkedIn se envuelve en " +
         "_pwLoadLinkedIn() disparado por consentimiento. Si esto se rompe, los píxeles " +
         "vuelven a cargar sin permiso.",
    check() {
      const c = read("pw-consent.js");
      if (!c) return "falta pw-consent.js (banner de consentimiento RGPD).";
      if (!/window\.pwConsent\s*=/.test(c) || !/window\.pwOnConsent\s*=/.test(c))
        return "pw-consent.js ya no expone pwConsent()/pwOnConsent() (la gate del pixel deja de funcionar).";
      // El pixel debe cargar gateado, no de una.
      const px = read("pw-pixel.js");
      if (px && !/pwConsent|pwOnConsent/.test(px))
        return "pw-pixel.js ya no consulta el consentimiento (el Meta Pixel volvería a cargar sin permiso).";
      // pw-consent.js debe estar incluido donde está el pixel / los trackers.
      for (const f of ["index.html", "soy-coach.html", "registro.html", "formulario.html"]) {
        if (read(f) && !/pw-consent\.js/.test(read(f))) return f + " ya no incluye pw-consent.js (el pixel cargaría sin gate).";
      }
      // Las páginas con LinkedIn Insight deben gatearlo (envuelto en _pwLoadLinkedIn).
      for (const f of ["index.html", "index-en.html", "registro.html", "registro-en.html"]) {
        const s = read(f);
        if (s && /snap\.licdn\.com\/li\.lms-analytics/.test(s) && !/_pwLoadLinkedIn/.test(s))
          return f + ": el LinkedIn Insight Tag ya no está gateado por consentimiento (_pwLoadLinkedIn).";
      }
      return null;
    },
  },
  {
    name: "auth: un 401 al entrar reintenta (no expulsa) si hay sesión válida",
    bug: "Al entrar recién logueada, una lectura podía salir ANTES de que el " +
         "token se adjunte (SDK del CDN booteando) → 401 → y _authExpired " +
         "deslogueaba al toque: 'entro, demora unos segundos y me tira de vuelta " +
         "al login'. Le pasaba al panel del coach Y a los portales del cliente. " +
         "Ahora, ante 401/403, si HAY sesión válida se reintenta UNA vez " +
         "(recargando) en vez de desloguear; solo sin sesión se va al login. El " +
         "presupuesto de reintento (sessionStorage pw_auth_retry) se resetea en " +
         "cada login fresco (login.html + auth-callback).",
    check() {
      // Panel + los 2 portales con _authExpired: debe existir el reintento
      // guardado por sesión y el chequeo de sesión antes de desloguear.
      var guarded = ["panel-v2.html", "pathway-fit-cliente.html", "pathway-fin-cliente.html"];
      for (var i = 0; i < guarded.length; i++) {
        var s = read(guarded[i]);
        if (!s) continue;
        if (!/function _authExpired/.test(s)) return guarded[i] + ": falta _authExpired.";
        if (!/pw_auth_retry/.test(s)) return guarded[i] + ": _authExpired ya no reintenta (pw_auth_retry) — vuelve a expulsar al toque.";
        if (!/hasSession|_tokenNow/.test(s)) return guarded[i] + ": _authExpired ya no verifica si hay sesión antes de desloguear.";
      }
      // El presupuesto de reintento se resetea en cada login fresco.
      var lg = read("login.html");
      if (lg && !/removeItem\(['"]pw_auth_retry/.test(lg)) return "login.html: no resetea pw_auth_retry en el login fresco.";
      var ac = read("auth-callback.html");
      if (ac && !/removeItem\(['"]pw_auth_retry/.test(ac)) return "auth-callback.html: no resetea pw_auth_retry en el login fresco.";
      return null;
    },
  },
];

let failures = 0;
for (const r of RULES) {
  let res;
  try { res = r.check(); } catch (e) { res = "error corriendo la regla: " + e.message; }
  if (res) { console.log("FAIL  " + r.name); console.log("      " + res); failures++; }
  else { console.log("ok    " + r.name); }
}

if (failures) {
  console.error("\n✗ " + failures + " regresion(es) detectada(s) — un bug ya resuelto volvio.");
  process.exit(1);
}
console.log("\n✓ Guardian OK — ningun bug resuelto volvio (" + RULES.length + " reglas)");
