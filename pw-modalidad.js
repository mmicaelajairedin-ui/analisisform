/* pw-modalidad.js — QUIÉN decide la modalidad de una sesión. Fuente única.
 *
 * Antes esto vivía repartido en cuatro sitios que decidían por su cuenta:
 * `_videoPlan()` en reservar.html, la cascada implícita del alta desde el panel,
 * el alta de `crear-cita-red`, y `resolverVideo()` en agenda-core. Cuatro
 * respuestas posibles a la misma pregunta — de ahí que el cliente viese
 * "Google Meet" en pantalla y otra cosa en el correo.
 *
 * LA REGLA, y no hay otra:
 *
 *   usuarios.configuracion.video.proveedor  →  citas.video_proveedor
 *
 * La elección del coach es la ÚNICA entrada. Esta función NO consulta
 * `zoom_url`, ni `meet_link`, ni `configuracion.gcal`, ni ninguna integración
 * externa. Mirar una integración para adivinar la modalidad es precisamente lo
 * que hacía que un coach que solo había pegado su enlace de Zoom acabara
 * mandando ese enlace como si lo hubiera elegido.
 *
 * SIN ELECCIÓN → SALA. Deliberado. "No ha elegido" no es "eligió Zoom". La Sala
 * de Pathway es el valor seguro: es nuestra, funciona siempre y no promete nada
 * que dependa de un tercero.
 *
 * RESOLVER LA MODALIDAD NO ES RESOLVER LA URL. Esta función devuelve QUÉ
 * proveedor, no CUÁL enlace. El enlace se construye después, y cada proveedor
 * tiene su fuente: Sala es determinista (`Pathway-<coach_id>-<cita_id>`), Meet
 * lo devuelve Google, Zoom sale de `configuracion.zoom_url`. Separarlo es lo
 * que permite que esta regla sea idéntica en el navegador y en el servidor.
 *
 * GEMELO EN EL SERVIDOR: `supabase/functions/_shared/agenda/modalidad.ts`.
 * Las Edge Functions corren en Deno y no pueden cargar este fichero, así que
 * hay una transliteración literal allí. Que las dos coincidan NO se confía a la
 * buena voluntad: `tests/modalidad-equivalencia.mjs` ejecuta LAS DOS con la
 * misma batería y falla si divergen en un solo caso.
 * Al tocar una, tocar la otra y correr esa prueba.
 */
(function (g) {
  'use strict';

  /** Las cuatro modalidades del contrato. No hay una quinta. */
  var PROVEEDORES = ['sala', 'meet', 'zoom', 'presencial'];

  /** El valor seguro. Ver "SIN ELECCIÓN → SALA" arriba. */
  var POR_DEFECTO = 'sala';

  /**
   * La modalidad que eligió el coach.
   *
   * @param {*} cfgVideo  `usuarios.configuracion.video`, tal cual venga.
   * @returns {'sala'|'meet'|'zoom'|'presencial'}
   *
   * Total: cualquier entrada devuelve un proveedor válido. Ausente, malformada
   * o desconocida caen a `sala` — nunca se lanza y nunca se devuelve null, para
   * que ningún consumidor tenga que inventarse su propio respaldo (que es como
   * nacieron las cuatro cascadas).
   */
  function modalidadElegida(cfgVideo) {
    if (!cfgVideo || typeof cfgVideo !== 'object' || Array.isArray(cfgVideo)) return POR_DEFECTO;
    var p = cfgVideo.proveedor;
    if (typeof p !== 'string') return POR_DEFECTO;
    p = p.trim().toLowerCase();
    return PROVEEDORES.indexOf(p) >= 0 ? p : POR_DEFECTO;
  }

  /**
   * ¿Se puede CUMPLIR lo elegido?
   *
   * Pregunta distinta de "qué eligió", y por eso va aparte: Meet sin Google
   * conectado y Zoom sin URL utilizable no se sostienen, y ofrecerlos seria
   * prometer un enlace que no va a llegar. Cuando no se puede cumplir se
   * atiende en la Sala, que es el valor seguro.
   *
   * Recibe BOOLEANOS, no integraciones: quien llama declara lo que tiene. Asi
   * esta regla sigue sin consultar `zoom_url`, `gcal` ni nada externo — que es
   * justo lo que la mantiene identica en el navegador y en el servidor.
   *
   * @param {string} proveedor      Lo que devolvio `modalidadElegida`.
   * @param {{gcal?:boolean, zoomUrl?:boolean}} capacidades
   */
  function modalidadCumplible(proveedor, capacidades) {
    var c = capacidades || {};
    if (proveedor === 'meet' && !c.gcal) return POR_DEFECTO;
    if (proveedor === 'zoom' && !c.zoomUrl) return POR_DEFECTO;
    return proveedor;
  }

  /**
   * `citas.modalidad` derivada del proveedor. Las dos columnas no pueden
   * contradecirse: una cita presencial con `modalidad='online'` es exactamente
   * el tipo de fila que rompe el correo y el calendario.
   */
  function modalidadDeCita(proveedor) {
    return proveedor === 'presencial' ? 'presencial' : 'online';
  }

  /** El lugar, solo si la sesión es presencial. */
  function lugarElegido(cfgVideo) {
    if (modalidadElegida(cfgVideo) !== 'presencial') return '';
    var l = cfgVideo && cfgVideo.lugar;
    return typeof l === 'string' ? l.trim() : '';
  }

  /**
   * Etiqueta del boton, por proveedor. Presencial no tiene: no es que falte, es
   * que no hay videollamada.
   */
  var ETIQUETA = {
    meet: 'Entrar a Google Meet',
    sala: 'Entrar a la Sala de Pathway',
    zoom: 'Entrar a la videollamada',
  };

  /**
   * El video de UNA CITA YA CREADA: que proveedor, que enlace y como se llama el
   * boton. Todo sale de la fila; nada se vuelve a decidir.
   *
   * Es lo que necesitan las cuatro superficies que mandan correos, y por eso vive
   * aqui y no repetido en cada una: la etiqueta se derivaba del ENLACE en cuatro
   * sitios distintos, y por eso una cita de Sala o de Zoom decia "Entrar a Google
   * Meet". El enlace no dice de quien es; el proveedor si.
   *
   * NO consulta `zoom_url`, ni `gcal`, ni `configuracion.video`: la cita ya tiene
   * su decision tomada y reconstruirla seria inventarse otra.
   *
   * @param {{video_proveedor?:string, meet_link?:string, modalidad?:string}} cita
   * @returns {{proveedor:string|null, url:string, etiqueta:string}}
   */
  function videoDeCita(cita) {
    var prov = String((cita && cita.video_proveedor) || '').trim().toLowerCase();
    // `modalidad` vale de respaldo para las citas anteriores al proveedor.
    if (prov === 'presencial' || (cita && cita.modalidad === 'presencial')) {
      return { proveedor: 'presencial', url: '', etiqueta: '' };
    }
    var url = String((cita && cita.meet_link) || '').trim();
    if (!/^https?:\/\//i.test(url)) return { proveedor: prov || null, url: '', etiqueta: '' };
    // Con enlace pero sin proveedor declarado —citas viejas— hay videollamada y
    // no se sabe de quien: se dice eso, en vez de atribuirsela a Google.
    return { proveedor: prov || null, url: url, etiqueta: ETIQUETA[prov] || 'Entrar a la videollamada' };
  }


  /**
   * ¿Esta URL es una SALA de Zoom a la que se puede entrar?
   *
   * Existe porque `zoom_url` aceptaba casi cualquier cosa —la comprobacion era
   * `if(url.indexOf("zoom.us")<0 && url.indexOf("http")<0) rechazar`, un `&&`,
   * asi que bastaba con UNA de las dos— y por ahi entro un enlace de CHAT
   * (`/launch/chat`) que se envio a clientes como si fuera la videollamada.
   *
   * Se aceptan las tres formas que abren una reunion:
   *   /j/<id>    reunion programada          /w/<id>   webinar
   *   /my/<slug> sala personal (PMI)
   *
   * Y se rechaza `/s/<id>` a proposito aunque sea de Zoom: es el enlace de
   * ANFITRION. Compartirlo deja que cualquiera empiece la reunion en tu nombre.
   */
  function zoomEsSala(url) {
    var u = String(url == null ? '' : url).trim();
    if (!/^https:\/\//i.test(u)) return false;
    var m = u.match(/^https:\/\/([^/?#]+)(\/[^?#]*)?/i);
    if (!m) return false;
    var host = m[1].toLowerCase().replace(/:\d+$/, '');
    if (!/(^|\.)zoom\.us$/.test(host) && !/(^|\.)zoomgov\.com$/.test(host)) return false;
    var ruta = m[2] || '';
    return /^\/(j|w)\/\d{6,}/.test(ruta) || /^\/my\/[A-Za-z0-9._-]+/.test(ruta);
  }

  /** Por que se rechazo, para poder decirselo a la coach. */
  function zoomMotivo(url) {
    var u = String(url == null ? '' : url).trim();
    if (!u) return 'Pega el enlace de tu sala de Zoom.';
    if (zoomEsSala(u)) return '';
    if (/\/launch\/chat|\/chat\//i.test(u)) return 'Ese es tu enlace de CHAT de Zoom, no el de una reunion. El de la sala se copia desde Zoom, en "Reuniones", y contiene /j/ o /my/.';
    if (/\/s\/\d+/i.test(u)) return 'Ese es el enlace de ANFITRION: quien lo tenga puede empezar la reunion en tu nombre. Copia el enlace para participantes, que contiene /j/.';
    if (/zoom\.us|zoomgov\.com/i.test(u)) return 'Ese enlace de Zoom no abre una sala. El de la reunion contiene /j/, /w/ o /my/.';
    return 'Eso no parece un enlace de Zoom.';
  }

  var API = {
    PROVEEDORES: PROVEEDORES,
    POR_DEFECTO: POR_DEFECTO,
    modalidadElegida: modalidadElegida,
    modalidadCumplible: modalidadCumplible,
    modalidadDeCita: modalidadDeCita,
    lugarElegido: lugarElegido,
    ETIQUETA: ETIQUETA,
    videoDeCita: videoDeCita,
    zoomEsSala: zoomEsSala,
    zoomMotivo: zoomMotivo,
  };

  g.PWModalidad = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);
