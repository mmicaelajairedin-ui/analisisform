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
         "exponerlos al compartir pantalla. Si se quita el helper sens(), la clase " +
         "pw-private, el interruptor (privacy-toggle) o los campos enmascarados " +
         "(frS/ftAS de finanzas y salud), los datos vuelven a quedar a la vista.",
    check() {
      const s = read("panel-v2.html");
      if (!s) return null;
      if (!/function sens\s*\(/.test(s)) return "panel-v2.html: falta el helper sens() del Modo privado.";
      if (!/pw-private/.test(s)) return "panel-v2.html: falta el enmascarado (clase pw-private).";
      if (!/privacy-toggle/.test(s)) return "panel-v2.html: falta el interruptor del Modo privado (privacy-toggle).";
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
      const s = read("formulario.html");
      if (!s) return null;
      if (!/saveDraft/.test(s) || !/restoreDraft/.test(s) || !/clearDraft/.test(s))
        return "formulario.html: perdió el autoguardado (saveDraft/restoreDraft/clearDraft).";
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
