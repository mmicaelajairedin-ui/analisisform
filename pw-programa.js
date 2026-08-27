/* pw-programa.js — EL RELOJ DEL PROGRAMA (AP1).
 *
 * Una sola fuente de verdad para "¿en qué semana va este cliente?", compartida
 * por el panel del coach (panel-v2.html) y el portal del cliente (cliente.html
 * y los portales de nicho). Si el cálculo viviera duplicado, coach y cliente
 * acabarían viendo semanas distintas de la misma persona — que es justo el bug
 * que ya paso con las medallas.
 *
 * EL PROBLEMA QUE RESUELVE
 * `semana_activa` solo cambiaba con un PATCH manual del coach. Nadie lo hacia:
 * 58 de 73 clientes llevaban meses en la semana 1, y con ellos los recursos por
 * semana, el roadmap y los avisos de "nueva semana" que ya estaban construidos.
 *
 * EL MODELO
 *   programa_inicio    date    · el ancla. La semana se deriva de aqui.
 *   programa_semanas   int     · duracion (null = 4, el valor historico)
 *   programa_pausado   bool    · congela la semana donde este
 *   semana_activa      int     · CACHE del valor derivado + fallback
 *
 * `semana_activa` deja de mandar pero se mantiene escrita y al dia: lo leen
 * emails, consultas y MultiCoach. Nada de eso tiene que cambiar por AP1.
 *
 * COMPATIBILIDAD: un cliente sin `programa_inicio` (fila nueva antes del
 * backfill, o creada por un flujo que aun no lo setea) se comporta EXACTAMENTE
 * como antes — cae a `semana_activa`. El reloj es aditivo, nunca rompe.
 *
 * Incluir con: <script src="pw-programa.js"></script>
 */
(function () {
  "use strict";
  if (window.PWPROG) return;

  var SEMANAS_POR_DEFECTO = 4;   // el programa historico de Pathway
  var MS_DIA = 86400000;

  // 'YYYY-MM-DD' → Date en UTC a medianoche. Se evita `new Date(str)` a secas
  // porque un cliente en UTC-5 podia ver la semana cambiar un dia antes.
  function aFecha(v) {
    try {
      if (!v) return null;
      if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
      var s = ("" + v).slice(0, 10);
      var p = s.split("-");
      if (p.length !== 3) return null;
      var d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2]));
      return isNaN(d.getTime()) ? null : d;
    } catch (e) { return null; }
  }

  function hoyUTC() {
    var n = new Date();
    return new Date(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate()));
  }

  function entero(v, fallback) {
    var n = parseInt(v, 10);
    return (isFinite(n) && n > 0) ? n : fallback;
  }

  // Cuantas semanas dura el programa. Sin valor → las 4 de siempre.
  function total(raw) {
    return entero(raw && raw.programa_semanas, SEMANAS_POR_DEFECTO);
  }

  // Semanas transcurridas desde el ancla, SIN recortar (1, 2, ... 26).
  // Sirve para distinguir "semana 4 de 4" (en curso) de "hace meses que acabo".
  function transcurridas(raw) {
    var ini = aFecha(raw && raw.programa_inicio);
    if (!ini) return null;
    var dias = Math.floor((hoyUTC().getTime() - ini.getTime()) / MS_DIA);
    return Math.floor(dias / 7) + 1;
  }

  // LA funcion. Semana que se muestra, siempre dentro de [1, total].
  function semana(raw) {
    raw = raw || {};
    var manual = entero(raw.semana_activa, 1);
    // Pausado: se queda donde estaba, pase el tiempo que pase.
    if (raw.programa_pausado === true || raw.programa_pausado === "true") return manual;
    var t = transcurridas(raw);
    // Sin ancla → comportamiento historico exacto.
    if (t === null) return manual;
    var max = total(raw);
    return Math.min(Math.max(t, 1), max);
  }

  // El programa ya paso su ultima semana. `semana()` sigue devolviendo la
  // ultima, para que ninguna pantalla se quede sin contenido que pintar.
  function terminado(raw) {
    raw = raw || {};
    if (raw.programa_pausado === true || raw.programa_pausado === "true") return false;
    var t = transcurridas(raw);
    return (t !== null) && (t > total(raw));
  }

  // Correccion manual (AP1-C): en vez de romper el reloj, se RE-ANCLA. El coach
  // dice "va por la semana 3" y la fecha de inicio se mueve para que la semana
  // derivada sea 3 y siga corriendo desde ahi.
  //   → 'YYYY-MM-DD' para guardar en programa_inicio
  function anclaPara(sem) {
    var s = entero(sem, 1);
    var d = new Date(hoyUTC().getTime() - ((s - 1) * 7 * MS_DIA));
    return d.toISOString().slice(0, 10);
  }

  // Etiqueta lista para pintar: "Semana 2/4" o "Programa terminado".
  function etiqueta(raw, corta) {
    if (terminado(raw)) return corta ? "Terminado" : "Programa terminado";
    var s = semana(raw), t = total(raw);
    return (corta ? "Sem " : "Semana ") + s + "/" + t;
  }

  window.PWPROG = {
    semana: semana,
    total: total,
    terminado: terminado,
    anclaPara: anclaPara,
    etiqueta: etiqueta,
    SEMANAS_POR_DEFECTO: SEMANAS_POR_DEFECTO
  };
})();
