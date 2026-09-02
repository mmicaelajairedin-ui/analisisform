// pw-express-lang.js — El Pack Express, en los DOS idiomas.
//
// Problema que resuelve: el comprador elegía idioma UNA vez en el formulario y
// se quedaba con esa versión. Muchos necesitan las dos (aplicar en España y
// fuera). Este módulo guarda un pack por idioma, deja cambiar de uno a otro y,
// la primera vez que falta, lo pide traducido a la Edge Function.
//
// Traducimos lo ya generado en vez de re-generar a propósito: si re-generáramos,
// la IA elegiría otros logros y el cliente terminaría con dos CVs que no dicen
// lo mismo.
//
// COMPATIBILIDAD (importante): las claves viejas de localStorage
//   mj_express_cv · mj_express_carta · mj_express_linkedin
// siguen existiendo y siempre reflejan el IDIOMA ACTIVO. Todo el código que ya
// las leía (cv.html, carta.html, linkedin-viewer.html) sigue funcionando sin
// tocar una línea; este módulo solo decide qué hay dentro.
//
// Incluir con:  <script src="/pw-express-lang.js"></script>

(function (w) {
  'use strict';

  var EDGE = 'https://api.pathwaycareercoach.com/functions/v1/generar-informe';
  var KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkeG5yc25qZHZ0cWh4dW54bndqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxNDk5MzksImV4cCI6MjA5MDcyNTkzOX0.t82X1x-PDgFDGYhKC7YXoRKhga9I8Hjet60QUYvtZLU';

  var LANGS = ['es', 'en'];
  var K_ACTIVE = 'mj_express_idioma';
  // Claves legacy = espejo del idioma activo.
  var LEGACY = { cv: 'mj_express_cv', carta: 'mj_express_carta', linkedin: 'mj_express_linkedin' };

  function ls(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lset(k, v) { try { if (v === null || v === undefined) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) {} }
  function norm(l) { l = String(l || '').toLowerCase(); return l.indexOf('en') === 0 ? 'en' : 'es'; }
  function other(l) { return norm(l) === 'en' ? 'es' : 'en'; }
  function key(part, l) { return LEGACY[part] + '_' + norm(l); }

  function parse(raw) { if (!raw) return null; try { return JSON.parse(raw); } catch (e) { return null; } }

  // ── Idioma activo ────────────────────────────────────────────────
  // El idioma de los DOCUMENTOS lo manda el pack, no el navegador: un cliente
  // con Chrome en inglés que pidió su CV en español tiene que ver su CV en
  // español. El navegador es el último recurso, cuando todavía no hay nada.
  //   1) el idioma marcado explícitamente,
  //   2) si solo existe un pack, ese,
  //   3) la preferencia del sitio (mj_lang, la misma de cliente.html),
  //   4) el navegador, 5) español.
  function lang() {
    var l = ls(K_ACTIVE);
    if (l === 'es' || l === 'en') return l;
    var disponibles = LANGS.filter(has);
    if (disponibles.length === 1) return disponibles[0];
    var s = ls('mj_lang');
    if (s === 'es' || s === 'en') return s;
    try { return (navigator.language || navigator.userLanguage || 'es').toLowerCase().indexOf('en') === 0 ? 'en' : 'es'; }
    catch (e) { return 'es'; }
  }

  // ── ¿En qué idioma está este pack? ───────────────────────────────
  // Para packs comprados ANTES de este cambio no hay idioma guardado en
  // ningún lado, así que hay que mirar el contenido. Contamos marcas
  // inequívocas del español (acentos, ñ, ¿¡ y palabras función que en inglés
  // no existen). Es una heurística, pero sobre un CV entero no falla: el
  // castellano deja acentos en cualquier texto de media página.
  function sniff(text) {
    text = String(text || '');
    if (!text) return '';
    var acentos = (text.match(/[áéíóúñÁÉÍÓÚÑ¿¡]/g) || []).length;
    var esWords = (text.match(/\b(de|del|la|los|las|para|con|que|una|por|en|el|y|su)\b/gi) || []).length;
    var enWords = (text.match(/\b(the|of|and|with|for|to|in|a|an|by|from)\b/gi) || []).length;
    if (acentos >= 3) return 'es';
    if (esWords > enWords * 1.3) return 'es';
    if (enWords > esWords * 1.3) return 'en';
    return acentos > 0 ? 'es' : '';
  }

  // ── Lectura / escritura de un pack ───────────────────────────────
  function get(l) {
    l = norm(l);
    return {
      cv: parse(ls(key('cv', l))),
      // La carta es texto plano, no JSON.
      carta: ls(key('carta', l)) || '',
      linkedin: parse(ls(key('linkedin', l)))
    };
  }

  function has(l) {
    var p = get(l);
    return !!(p.cv || p.carta || p.linkedin);
  }

  // Guarda el pack de un idioma. Los campos que llegan undefined NO se tocan
  // (así se puede guardar solo el CV editado sin borrar la carta).
  function put(l, pack) {
    l = norm(l); pack = pack || {};
    if (pack.cv !== undefined) lset(key('cv', l), pack.cv ? JSON.stringify(pack.cv) : null);
    if (pack.carta !== undefined) lset(key('carta', l), pack.carta || null);
    if (pack.linkedin !== undefined) lset(key('linkedin', l), pack.linkedin ? JSON.stringify(pack.linkedin) : null);
    if (l === lang()) mirror(l);
    return get(l);
  }

  // Copia el pack del idioma activo a las claves legacy.
  function mirror(l) {
    var p = get(l);
    lset(LEGACY.cv, p.cv ? JSON.stringify(p.cv) : null);
    lset(LEGACY.carta, p.carta || null);
    lset(LEGACY.linkedin, p.linkedin ? JSON.stringify(p.linkedin) : null);
  }

  // ── Adopción de packs viejos ─────────────────────────────────────
  // Un cliente que compró antes de este cambio tiene solo las claves legacy.
  // Las adoptamos como el pack del idioma activo para que no pierda nada.
  function adopt() {
    var cv = parse(ls(LEGACY.cv));
    var carta = ls(LEGACY.carta) || '';
    var li = parse(ls(LEGACY.linkedin));
    var hay = !!(cv || carta || li);

    // Si ya está archivado por idioma, solo refrescamos el espejo legacy.
    if (LANGS.some(has)) { mirror(lang()); return; }
    if (!hay) return;

    // Pack viejo: lo archivamos bajo el idioma en el que de verdad está,
    // no bajo el que adivine el navegador. Archivarlo mal haría que el
    // cliente viera su CV en español rotulado como la versión inglesa.
    var marcado = ls(K_ACTIVE);
    var l = (marcado === 'es' || marcado === 'en')
      ? marcado
      : (sniff([cv ? JSON.stringify(cv) : '', carta, li ? JSON.stringify(li) : ''].join(' ')) || lang());
    lset(K_ACTIVE, l);
    put(l, { cv: cv, carta: carta, linkedin: li });
  }

  // ── Traer el pack en el otro idioma ──────────────────────────────
  // cb(err, pack). Si ya lo tenemos, responde al instante y NO llama a la red.
  function ensure(l, cb) {
    l = norm(l); cb = cb || function () {};
    if (has(l)) return cb(null, get(l));

    var src = get(other(l));
    if (!src.cv && !src.carta && !src.linkedin) return cb(new Error('sin_origen'));

    var body = { accion: 'traducir_express', idioma: l };
    if (src.cv) body.cv_optimizado = src.cv;
    if (src.carta) body.carta = src.carta;
    if (src.linkedin) body.linkedin_analisis = src.linkedin;

    fetch(EDGE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + KEY },
      body: JSON.stringify(body)
    }).then(function (r) {
      return r.json().then(function (d) {
        if (!r.ok || d.error) throw new Error(d.error || ('Error ' + r.status));
        return d;
      });
    }).then(function (d) {
      // Solo guardamos lo que de verdad volvió: si un campo se perdió en el
      // camino, es mejor que falte a que quede vacío pisando algo bueno.
      var pack = {};
      if (d.cv_optimizado) pack.cv = d.cv_optimizado;
      if (typeof d.carta === 'string' && d.carta) pack.carta = d.carta;
      if (d.linkedin_analisis) pack.linkedin = d.linkedin_analisis;
      // El color, la tipografía y la foto son del cliente, no del idioma:
      // viajan al pack traducido para que el CV se vea igual en los dos.
      if (pack.cv && src.cv) {
        ['_color', '_font', '_photo'].forEach(function (k) {
          if (src.cv[k] !== undefined) pack.cv[k] = src.cv[k];
        });
      }
      if (!pack.cv && !pack.carta && !pack.linkedin) throw new Error('traduccion_vacia');
      put(l, pack);
      cb(null, get(l));
    }).catch(function (e) {
      console.error('[pw-express-lang] traducir', e);
      cb(e);
    });
  }

  // Cambia el idioma activo. Traduce primero si hace falta.
  // cb(err, lang)
  function setLang(l, cb) {
    l = norm(l); cb = cb || function () {};
    ensure(l, function (err) {
      if (err) return cb(err);
      lset(K_ACTIVE, l);
      mirror(l);
      try { document.documentElement.lang = l; } catch (e) {}
      cb(null, l);
    });
  }

  // ── Sincronización con Supabase (sin cambiar el esquema) ─────────
  // La tabla cv_express tiene una fila por email y una sola columna para cada
  // documento. Para que el cliente recupere los DOS idiomas desde otro
  // dispositivo, el pack del idioma no-activo viaja dentro de cv_optimizado,
  // bajo la clave _i18n. cv.html ya ignora las claves con guion bajo
  // (_color, _font, _photo), así que no hay que tocar el render.
  function packForCloud() {
    var l = lang(), o = other(l);
    var act = get(l), alt = get(o);
    var cv = act.cv ? JSON.parse(JSON.stringify(act.cv)) : null;
    if (cv) {
      // El idioma y el pack alternativo viajan DENTRO de cv_optimizado (JSONB).
      // La tabla cv_express no tiene columnas para ellos y PostgREST rechaza
      // con 400 cualquier campo que no exista, así que añadir columnas nuevas
      // habría roto el guardado hasta migrar la base.
      cv._idioma = l;
      if (alt.cv || alt.carta || alt.linkedin) {
        cv._i18n = {};
        cv._i18n[o] = { cv: alt.cv || null, carta: alt.carta || '', linkedin: alt.linkedin || null };
      }
    }
    return { idioma: l, cv_optimizado: cv, carta: act.carta || '', linkedin_analisis: act.linkedin || null };
  }

  // Al revés: una fila de Supabase se reparte en los dos idiomas.
  function fromCloud(row) {
    if (!row) return;
    var cv = row.cv_optimizado || null;
    var l = norm(row.idioma || (cv && cv._idioma) || lang());
    var alt = cv && cv._i18n ? cv._i18n : null;
    if (cv) { cv = JSON.parse(JSON.stringify(cv)); delete cv._i18n; delete cv._idioma; }
    put(l, { cv: cv, carta: row.carta || '', linkedin: row.linkedin_analisis || null });
    if (alt) {
      LANGS.forEach(function (k) {
        if (k !== l && alt[k]) put(k, { cv: alt[k].cv || null, carta: alt[k].carta || '', linkedin: alt[k].linkedin || null });
      });
    }
    lset(K_ACTIVE, l);
    mirror(l);
  }

  // ── Interruptor ES | EN ──────────────────────────────────────────
  // mount(contenedor, onChange, onBefore).
  //   onBefore()      corre ANTES de soltar el idioma actual — es donde el
  //                   llamador guarda lo que el cliente venía editando.
  //   onChange(lang)  corre DESPUÉS de que el pack esté listo — el llamador
  //                   solo tiene que re-renderizar.
  function mount(host, onChange, onBefore) {
    if (!host) return;
    var cur = lang();
    host.innerHTML = '';
    host.setAttribute('role', 'group');
    host.setAttribute('aria-label', 'Idioma del documento / Document language');

    var wrap = document.createElement('div');
    wrap.style.cssText = 'display:inline-flex;border:1.5px solid #E4DEDE;border-radius:999px;overflow:hidden;background:#fff;font-family:Inter,-apple-system,sans-serif;';

    var msg = document.createElement('span');
    msg.style.cssText = 'display:block;font-size:11px;color:#8A8080;margin-top:6px;min-height:14px;font-family:Inter,-apple-system,sans-serif;';

    var btns = {};
    LANGS.forEach(function (l) {
      var b = document.createElement('button');
      b.type = 'button';
      b.textContent = l.toUpperCase();
      b.setAttribute('aria-pressed', String(l === cur));
      b.style.cssText = 'padding:5px 14px;font-size:11px;font-weight:700;letter-spacing:.04em;border:0;cursor:pointer;font-family:inherit;';
      b.onclick = function () { pick(l); };
      btns[l] = b;
      wrap.appendChild(b);
    });

    function paint() {
      var c = lang();
      LANGS.forEach(function (l) {
        var on = l === c;
        btns[l].style.background = on ? '#2D6A4F' : '#fff';
        btns[l].style.color = on ? '#fff' : '#8A8080';
        btns[l].setAttribute('aria-pressed', String(on));
      });
    }

    function busy(on, text) {
      LANGS.forEach(function (l) { btns[l].disabled = on; btns[l].style.opacity = on ? '.55' : '1'; btns[l].style.cursor = on ? 'wait' : 'pointer'; });
      msg.textContent = text || '';
    }

    function pick(l) {
      if (norm(l) === lang()) return;
      if (onBefore) { try { onBefore(); } catch (e) { console.warn('[pw-express-lang] onBefore', e); } }
      var first = !has(l);
      busy(true, first
        ? (l === 'en' ? 'Preparing the English version… (~30s)' : 'Preparando la versión en español… (~30s)')
        : '');
      setLang(l, function (err) {
        busy(false, '');
        if (err) {
          msg.textContent = l === 'en'
            ? "Couldn't build the English version. Try again in a moment."
            : 'No se pudo preparar la versión en español. Probá de nuevo en un momento.';
          paint();
          return;
        }
        paint();
        if (onChange) onChange(lang());
      });
    }

    host.appendChild(wrap);
    host.appendChild(msg);
    paint();
    return { refresh: paint };
  }

  adopt();

  w.PWXL = {
    lang: lang, setLang: setLang, other: other, norm: norm,
    has: has, get: get, put: put, ensure: ensure, mirror: mirror,
    packForCloud: packForCloud, fromCloud: fromCloud, mount: mount
  };
})(window);
