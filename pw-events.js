/* pw-events.js — EVENT BUS del cliente (Pathway OS Core · Nivel 0 · Foundation).
 *
 * Emite eventos de dominio al Event Store (tabla `eventos` de Supabase). Es la
 * primera pieza del Core: de estos eventos se derivan despues la activacion, el
 * health score, los embudos y el dashboard del CEO.
 *
 * USO (explicito, desde el codigo, uno por uno):
 *   pwEmit("SessionCompleted", { dominio:"Coaching", entidad_tipo:"sesion", entidad_id:"123" });
 *   pwEmit("ClientInvited",    { dominio:"Coaching", entidad_tipo:"cliente", entidad_id:email });
 *
 * IMPORTANTE: incluir este script NO hace nada por si solo — solo define
 * window.pwEmit. Ningun evento se emite hasta que se llama a pwEmit() a mano.
 * Asi la incorporacion es 100% aditiva y no cambia ningun flujo existente.
 *
 * Es best-effort y a prueba de fallos: si algo aca falla, NUNCA rompe la pagina
 * ni bloquea el guardado (mismo patron que pw-observe.js). Incluir con:
 *   <script src="pw-events.js"></script>
 *
 * El contrato de eventos (quien emite cada uno y quien lo escucha) vive en
 * docs/domain-events.md.
 */
(function () {
  "use strict";
  try {
    var SB = "https://api.pathwaycareercoach.com";
    var KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkeG5yc25qZHZ0cWh4dW54bndsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjM5ODAwMDAsImV4cCI6MTg4MTc0NjAwMH0.WyY8_f_mTGJfRJLZ_b4A_rC8_r-9qOqNM8gfDg6xxRk";
    var ENDPOINT = SB + "/rest/v1/eventos";

    var sent = 0;         // tope por sesion (anti-loop)
    var MAX = 300;
    var origFetch = window.fetch ? window.fetch.bind(window) : null;

    // Quien dispara el evento (best-effort, sin romper si no hay sesion).
    function actor() {
      try {
        var u = JSON.parse(localStorage.getItem("mj_user") || "null");
        if (u && u.email) {
          return { email: ("" + u.email).toLowerCase(), rol: u.rol || "coach", id: (u.id != null ? "" + u.id : null) };
        }
      } catch (e) {}
      try {
        var em = (localStorage.getItem("pw_cli_email") || "").toLowerCase();
        if (em) return { email: em, rol: "cliente", id: null };
      } catch (e) {}
      return { email: "anon", rol: "anon", id: null };
    }

    function pwEmit(tipo, opts) {
      try {
        if (!tipo || sent >= MAX || !origFetch) return;
        opts = opts || {};
        var a = actor();
        var row = {
          tipo: ("" + tipo).slice(0, 80),
          dominio: opts.dominio ? ("" + opts.dominio).slice(0, 40) : null,
          actor_email: a.email,
          actor_rol: a.rol,
          actor_id: (opts.actor_id != null ? ("" + opts.actor_id).slice(0, 80) : a.id),
          entidad_tipo: opts.entidad_tipo ? ("" + opts.entidad_tipo).slice(0, 40) : null,
          entidad_id: (opts.entidad_id != null ? ("" + opts.entidad_id).slice(0, 80) : null),
          payload: (opts.payload && typeof opts.payload === "object") ? opts.payload : null,
          page: location.pathname + location.hash,
          source: "client",
          ts: new Date().toISOString()
        };
        sent++;
        // best-effort: si el POST falla, no pasa nada (nunca throw, nunca bloquea).
        origFetch(ENDPOINT, {
          method: "POST",
          headers: {
            "apikey": KEY,
            "Authorization": "Bearer " + KEY,
            "Content-Type": "application/json",
            "Prefer": "return=minimal"
          },
          body: JSON.stringify(row),
          keepalive: true
        }).catch(function () {});
      } catch (e) { /* nunca romper por un evento */ }
    }

    window.pwEmit = pwEmit;
  } catch (e) { /* nunca romper la pagina por el event bus */ }
})();
