/* pw-pdf-text.js — sacar el TEXTO de un PDF en el navegador (AP4).
 *
 * EL PROBLEMA QUE RESUELVE
 * Para generar cualquier material con IA, el coach tenía que abrir el PDF del
 * CV, seleccionar todo, copiarlo y pegarlo en un textarea. El propio modal lo
 * admitía: "Abre el PDF del cliente, copia todo el texto y pégalo aquí…" y
 * "Subir el PDF directo es algo que podemos sumar más adelante". Medido el
 * 2026-08-27: 3 de 73 fichas con CV cargado, 6 de 49 coaches habían generado
 * un análisis alguna vez. El wow del producto estaba detrás de ese peaje.
 *
 * QUÉ NO ES
 * No es un parser de CV: no interpreta secciones ni campos. Saca texto plano y
 * lo deja donde antes se pegaba a mano. Tampoco hace OCR — un PDF escaneado no
 * tiene capa de texto y se avisa con un mensaje claro (el campo de pegado
 * manual sigue ahí como salida).
 *
 * pdf.js se carga BAJO DEMANDA, solo cuando el coach elige un archivo. Ninguna
 * pantalla paga el coste si no sube un PDF.
 *
 * Uso:
 *   PWPDF.texto(file).then(function(txt){ ... }).catch(function(err){ err.message })
 */
(function () {
  "use strict";
  if (window.PWPDF) return;

  var CDN = "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/legacy/build/";
  var MAX_MB = 20;
  var MAX_PAGINAS = 30;   // un CV no tiene 200 páginas; corta PDFs absurdos
  var cargando = null;

  function cargarPdfJs() {
    if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
    if (cargando) return cargando;
    cargando = new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.src = CDN + "pdf.min.js";
      s.onload = function () {
        try {
          if (!window.pdfjsLib) return reject(new Error("no_cargo"));
          window.pdfjsLib.GlobalWorkerOptions.workerSrc = CDN + "pdf.worker.min.js";
          resolve(window.pdfjsLib);
        } catch (e) { reject(e); }
      };
      s.onerror = function () { cargando = null; reject(new Error("sin_conexion")); };
      document.head.appendChild(s);
    });
    return cargando;
  }

  function leerArrayBuffer(file) {
    return new Promise(function (resolve, reject) {
      var r = new FileReader();
      r.onload = function () { resolve(r.result); };
      r.onerror = function () { reject(new Error("no_se_pudo_leer")); };
      r.readAsArrayBuffer(file);
    });
  }

  // Mensajes pensados para el coach, no para el log: dicen qué pasó y qué hacer.
  var MENSAJES = {
    no_es_pdf: "Ese archivo no es un PDF. Elige el PDF del CV o pega el texto a mano.",
    muy_grande: "El PDF pesa más de " + MAX_MB + " MB. Prueba con una versión más ligera o pega el texto a mano.",
    sin_conexion: "No se pudo cargar el lector de PDF. Revisa tu conexión o pega el texto a mano.",
    sin_texto: "Este PDF no tiene texto seleccionable (suele pasar con los escaneados). Ábrelo, copia el texto y pégalo aquí.",
    roto: "No pudimos leer este PDF. Puede estar dañado o protegido — pega el texto a mano.",
    no_se_pudo_leer: "No pudimos abrir el archivo. Inténtalo otra vez o pega el texto a mano."
  };
  function fallo(clave) {
    var e = new Error(MENSAJES[clave] || MENSAJES.roto);
    e.clave = clave;
    return e;
  }

  function texto(file) {
    try {
      if (!file) return Promise.reject(fallo("no_se_pudo_leer"));
      var esPdf = (file.type === "application/pdf") || /\.pdf$/i.test(file.name || "");
      if (!esPdf) return Promise.reject(fallo("no_es_pdf"));
      if (file.size > MAX_MB * 1024 * 1024) return Promise.reject(fallo("muy_grande"));

      return cargarPdfJs()
        .catch(function () { throw fallo("sin_conexion"); })
        .then(function (lib) {
          return leerArrayBuffer(file).then(function (buf) {
            return lib.getDocument({ data: buf }).promise;
          });
        })
        .catch(function (e) { throw (e && e.clave) ? e : fallo("roto"); })
        .then(function (doc) {
          var n = Math.min(doc.numPages || 0, MAX_PAGINAS);
          var partes = [];
          // Secuencial a propósito: en paralelo, un PDF de 30 páginas dispara 30
          // tareas del worker a la vez y el navegador de un móvil se atraganta.
          function pagina(i) {
            if (i > n) return Promise.resolve();
            return doc.getPage(i)
              .then(function (p) { return p.getTextContent(); })
              .then(function (tc) {
                var linea = (tc.items || []).map(function (it) { return it.str || ""; }).join(" ");
                if (linea.trim()) partes.push(linea);
                return pagina(i + 1);
              });
          }
          return pagina(1).then(function () {
            var out = partes.join("\n")
              .replace(/[ \t]{2,}/g, " ")
              .replace(/\n{3,}/g, "\n\n")
              .trim();
            // Un PDF escaneado devuelve capa de texto vacía o casi.
            if (out.length < 40) throw fallo("sin_texto");
            return out;
          });
        });
    } catch (e) {
      return Promise.reject((e && e.clave) ? e : fallo("roto"));
    }
  }

  window.PWPDF = { texto: texto, MAX_MB: MAX_MB, MAX_PAGINAS: MAX_PAGINAS };
})();
