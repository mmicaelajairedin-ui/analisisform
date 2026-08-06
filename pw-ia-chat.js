/* ═══ IA Pathway — widget de chat unificado ═══
 * Un solo chat para TODOS los paneles (coach + portales de cliente). Se auto-
 * inyecta: estilos + botón lanzador (arriba a la derecha) + panel de chat.
 * Conversa con la Edge Function `ia-pathway` (Claude) usando el contexto que le
 * pasa la página anfitriona. Cuando la IA no resuelve, ofrece WhatsApp (fino).
 *
 * Config (opcional) antes de incluir el script:
 *   window.PW_IA_CFG = {
 *     mode:     "cliente" | "coach",         // tono/prompt del asistente
 *     greeting: "…"  |  function(){return "…"}, // 1er mensaje (HTML permitido)
 *     context:  function(){ return {…}; },   // datos reales para la IA
 *     wa:       "34623816019",               // número de WhatsApp de escape
 *     endpoint: "https://mxkljqhlwiqavbjfjfov.supabase.co", // base Supabase
 *     key:      "<anon key>",                // apikey pública
 *     accent:   "#2D6A4F"                    // color de marca
 *   };
 * Nada es obligatorio: hay defaults sensatos.
 */
(function () {
  "use strict";
  if (window.__pwIaChat) return; // no duplicar si se incluye dos veces
  window.__pwIaChat = true;

  var CFG = window.PW_IA_CFG || {};
  var MODE = CFG.mode === "coach" ? "coach" : "cliente";
  var WA = CFG.wa || "34623816019";
  var SB = (CFG.endpoint || window.PW_SB || "https://mxkljqhlwiqavbjfjfov.supabase.co").replace(/\/+$/, "");
  var KEY = CFG.key || window.PW_KEY ||
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkeG5yc25qZHZ0cWh4dW54bndqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxNDk5MzksImV4cCI6MjA5MDcyNTkzOX0.t82X1x-PDgFDGYhKC7YXoRKhga9I8Hjet60QUYvtZLU";
  var ACCENT = CFG.accent || "#2D6A4F";

  var state = { open: false, msgs: null, draft: "", busy: false };
  var USER_ROLE = MODE === "coach" ? "coach" : "cliente"; // valor de `from` propio (contrato de chat)

  // ── Accesos directos (chips) ──────────────────────────────────────────────
  // La página anfitriona pasa su catálogo por CFG.shortcuts (por nicho) y una
  // función CFG.onNav(section) para navegar. Según lo que la IA mencione en su
  // respuesta, ofrecemos un botón que lleva directo a esa sección + el paso a
  // paso (how). CFG.starters = accesos que van en el saludo.
  var SHORTCUTS = (CFG.shortcuts && CFG.shortcuts.length ? CFG.shortcuts : []).map(function (s) {
    return { re: (s.re instanceof RegExp ? s.re : new RegExp(s.re || "$^", "i")), label: s.label, emoji: s.emoji || "", section: s.section, how: s.how || "" };
  });
  var STARTERS = (CFG.starters && CFG.starters.length ? CFG.starters : []).map(function (s) {
    return { label: s.label, emoji: s.emoji || "", section: s.section, how: s.how || "" };
  });
  function iaSuggest(text) { var t = "" + (text || ""), out = []; for (var i = 0; i < SHORTCUTS.length && out.length < 2; i++) { if (SHORTCUTS[i].re.test(t)) out.push(SHORTCUTS[i]); } return out; }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function ctx() { try { return (typeof CFG.context === "function") ? (CFG.context() || {}) : (CFG.context || {}); } catch (e) { return {}; } }
  function waHref() {
    return "https://wa.me/" + WA + "?text=" +
      encodeURIComponent("Hola, tengo una consulta que el IA Pathway no me resolvió:");
  }
  function seed() {
    var g = (typeof CFG.greeting === "function" ? CFG.greeting() : CFG.greeting) ||
      (MODE === "coach"
        ? "Hola " + HAND_ICO + " Soy tu IA Pathway. Puedo ayudarte con tu agenda de la semana y con el uso de la plataforma. ¿Qué necesitás?"
        : "Hola " + HAND_ICO + " Soy tu IA Pathway. Puedo ayudarte con tu proceso, tus documentos y a moverte por la plataforma. ¿En qué te doy una mano?");
    var txt = g.replace(/<br\s*\/?>/g, " ").replace(/<[^>]+>/g, "");
    return [{ from: "ia", html: g, txt: txt, acts: STARTERS.slice() }];
  }

  // ── estilos (se inyectan una vez) ──
  function injectCss() {
    if (document.getElementById("pw-ia-css")) return;
    var css = document.createElement("style");
    css.id = "pw-ia-css";
    css.textContent =
      ".pw-ia-launch{background:" + ACCENT + ";border:none;border-radius:50%;width:40px;height:40px;padding:0;display:inline-flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(45,106,79,.22);cursor:pointer;color:#fff;}" +
      ".pw-ia-launch--fixed{position:fixed;top:14px;right:14px;z-index:96;}" +
      /* Pestañita en el borde derecho (drawer): discreta, no tapa nada. Igual en todos los paneles. */
      ".pw-ia-tab{position:fixed;top:50%;right:0;transform:translateY(-50%);z-index:96;background:" + ACCENT + ";color:#fff;border:none;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:7px;padding:15px 7px;border-radius:13px 0 0 13px;box-shadow:-3px 0 14px rgba(27,67,50,.24);font-family:Inter,-apple-system,system-ui,sans-serif;font-size:12px;font-weight:600;letter-spacing:.4px;transition:padding-right .15s ease,filter .15s ease;}" +
      ".pw-ia-tab:hover{padding-right:11px;filter:brightness(1.06);}" +
      ".pw-ia-tab .pw-ia-tab-tx{writing-mode:vertical-rl;text-orientation:mixed;}" +
      ".pw-ia-tab svg{flex-shrink:0;}" +
      /* En móvil: icono redondo arriba a la derecha (no una pestaña que flota sobre el contenido) */
      "@media (max-width:900px){.pw-ia-tab{top:9px;bottom:auto;right:10px;transform:none;flex-direction:row;width:40px;height:40px;padding:0;justify-content:center;border-radius:50%;box-shadow:0 4px 12px rgba(45,106,79,.28);}.pw-ia-tab .pw-ia-tab-tx{display:none;}}" +
      ".cp-iac-panel{position:fixed;right:14px;top:62px;z-index:97;width:352px;max-width:calc(100vw - 28px);height:520px;max-height:calc(100vh - 96px);background:#fff;border:1px solid #E5E7EB;border-radius:18px;box-shadow:0 22px 56px rgba(45,106,79,.22),0 4px 12px rgba(0,0,0,.08);display:flex;flex-direction:column;overflow:hidden;font-family:Inter,-apple-system,system-ui,sans-serif;animation:cpIacIn .22s ease;}" +
      "@keyframes cpIacIn{from{opacity:0;transform:translateY(-12px) scale(.97);}to{opacity:1;transform:translateY(0) scale(1);}}" +
      ".cp-iac-head{display:flex;align-items:center;gap:10px;padding:13px 12px 12px 15px;border-bottom:1px solid #E5E7EB;flex-shrink:0;}" +
      ".cp-iac-head-ico{width:34px;height:34px;border-radius:10px;background:#EAF3EE;color:" + ACCENT + ";display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;}" +
      ".cp-iac-head-t{font-size:15px;font-weight:700;color:#2B2B2B;line-height:1.15;}" +
      ".cp-iac-head-s{font-size:11px;color:#6b7280;margin-top:1px;}" +
      ".cp-iac-x{margin-left:auto;width:30px;height:30px;border-radius:8px;display:inline-flex;align-items:center;justify-content:center;color:#9aa0a6;background:transparent;flex-shrink:0;border:none;cursor:pointer;}" +
      ".cp-iac-x:hover{background:#F3F5F4;color:#2B2B2B;}" +
      ".cp-iac-scroll{flex:1;overflow-y:auto;padding:14px 12px 6px;display:flex;flex-direction:column;gap:2px;}" +
      ".cp-iac-row{display:flex;margin-bottom:8px;}.cp-iac-row-me{justify-content:flex-end;}.cp-iac-row-them{justify-content:flex-start;}" +
      ".cp-iac-bubble{max-width:84%;padding:10px 13px;border-radius:15px;font-size:13px;line-height:1.5;}" +
      ".cp-iac-them{background:#F3F5F4;color:#2B2B2B;border-bottom-left-radius:5px;}.cp-iac-them b{font-weight:700;color:" + ACCENT + ";}" +
      ".cp-iac-me{background:" + ACCENT + ";color:#fff;border-bottom-right-radius:5px;}" +
      ".cp-iac-typing{display:inline-flex;gap:4px;align-items:center;}.cp-iac-typing span{width:6px;height:6px;border-radius:50%;background:#9aa0a6;opacity:.5;animation:cpIacDot 1s infinite;}.cp-iac-typing span:nth-child(2){animation-delay:.15s;}.cp-iac-typing span:nth-child(3){animation-delay:.3s;}" +
      "@keyframes cpIacDot{0%,60%,100%{transform:translateY(0);opacity:.4;}30%{transform:translateY(-4px);opacity:.9;}}" +
      ".pw-wa-fine{display:flex;align-items:center;justify-content:space-between;gap:14px;width:100%;max-width:270px;background:#fff;border:1px solid #E5E7EB;border-radius:14px;padding:10px 12px;text-decoration:none;box-shadow:0 1px 2px rgba(0,0,0,.04);transition:border-color .15s,box-shadow .15s,transform .15s;}" +
      ".pw-wa-fine:hover{border-color:#cfd4d1;box-shadow:0 4px 12px rgba(45,106,79,.10);transform:translateY(-1px);}" +
      ".pw-wa-fine-tx{display:flex;flex-direction:column;line-height:1.3;min-width:0;}.pw-wa-fine-tx b{font-size:13px;font-weight:700;color:#2B2B2B;}.pw-wa-fine-tx span{font-size:11.5px;color:#6b7280;}" +
      ".pw-wa-fine-ico{width:34px;height:34px;border-radius:50%;background:#25D366;color:#fff;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;}" +
      ".cp-iac-warow{display:flex;margin:-2px 0 10px 2px;}" +
      /* Accesos directos (chips) + paso a paso: respuesta corta + botón que lleva a la sección. */
      ".pw-ia-acts{display:flex;flex-wrap:wrap;gap:7px;margin:-2px 0 11px 2px;}" +
      ".pw-ia-chip{display:inline-flex;align-items:center;gap:6px;background:#fff;border:1px solid #E5E7EB;border-radius:100px;padding:7px 13px;font-family:inherit;font-size:12.5px;font-weight:600;color:" + ACCENT + ";cursor:pointer;box-shadow:0 1px 2px rgba(0,0,0,.05);transition:border-color .15s,transform .15s;}" +
      ".pw-ia-chip:hover{border-color:" + ACCENT + ";transform:translateY(-1px);}" +
      ".pw-ia-how{font-size:11.5px;line-height:1.5;color:#49524D;background:#F3F5F4;border-radius:10px;padding:8px 11px;margin:0 0 11px 2px;max-width:90%;}" +
      ".pw-ia-how b{font-weight:700;color:#2B2B2B;}" +
      ".cp-iac-compose{display:flex;gap:8px;padding:10px 12px 12px;flex-shrink:0;background:#fff;border-top:1px solid #E5E7EB;}" +
      ".cp-iac-compose input{flex:1;border:1px solid #E5E7EB;border-radius:11px;padding:10px 13px;font-size:14px;font-family:inherit;background:#F7F8F7;outline:none;}" +
      ".cp-iac-compose input:focus{border-color:" + ACCENT + ";background:#fff;}" +
      ".cp-iac-send{width:40px;height:40px;border-radius:11px;background:" + ACCENT + ";color:#fff;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;cursor:pointer;border:none;}" +
      ".cp-iac-send:disabled{opacity:.5;cursor:default;}" +
      "@media (max-width:900px){.cp-iac-panel{right:8px;left:auto;width:calc(100vw - 16px);top:56px;height:auto;max-height:calc(100vh - 150px);}}";
    document.head.appendChild(css);
  }

  /* Iconos del chat = mismo sistema Lucide (outline, stroke 2px). Se dejan
     inline porque el widget se auto-inyecta en páginas sin pw-icons.js, pero
     comparten el set/estilo con pw-icons.js (spark, wa, close, arrowR). */
  var SPARK = "<svg width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M12 3l1.6 4.8L18 9l-4.4 1.2L12 15l-1.6-4.8L6 9l4.4-1.2z'/><path d='M18 14.5l.7 2.1L21 17.5l-2.3.9L18 21l-.7-2.6L15 17.5l2.3-.9z'/></svg>";
  var WA_ICO = "<svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z'/></svg>";
  var CLOSE_ICO = "<svg width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><line x1='18' y1='6' x2='6' y2='18'/><line x1='6' y1='6' x2='18' y2='18'/></svg>";
  var SEND_ICO = "<svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><line x1='5' y1='12' x2='19' y2='12'/><polyline points='12 5 19 12 12 19'/></svg>";
  var HAND_ICO = "<svg width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round' style='vertical-align:-3px'><path d='M18 11V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2M14 10V4a2 2 0 0 0-2-2a2 2 0 0 0-2 2v2M10 10.5V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2v8'/><path d='M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15'/></svg>";
  var HOW_ICO = "<svg width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round' style='vertical-align:-2px'><polyline points='9 18 15 12 9 6'/></svg>";

  function launcher() {
    if (document.getElementById("pw-ia-btn")) return;
    // Pestañita discreta en el borde derecho (igual en todos los paneles); no tapa
    // los botones de arriba como hacía el ícono flotante.
    var btn = document.createElement("button");
    btn.id = "pw-ia-btn"; btn.type = "button";
    btn.setAttribute("aria-label", "Abrir IA Pathway"); btn.title = "IA Pathway";
    btn.className = "pw-ia-tab";
    btn.innerHTML = SPARK + "<span class='pw-ia-tab-tx'>IA Pathway</span>";
    btn.addEventListener("click", open);
    document.body.appendChild(btn);
  }

  function root() {
    var r = document.getElementById("pw-ia-root");
    if (!r) { r = document.createElement("div"); r.id = "pw-ia-root"; document.body.appendChild(r); }
    return r;
  }

  function waRow() {
    return "<div class='cp-iac-warow'><a class='pw-wa-fine' href='" + waHref() + "' target='_blank' rel='noopener'>" +
      "<span class='pw-wa-fine-tx'><b>¿Tienes dudas?</b><span>Escríbenos por WhatsApp</span></span>" +
      "<span class='pw-wa-fine-ico'>" + WA_ICO + "</span></a></div>";
  }

  function render() {
    var r = root();
    if (!state.open) { r.innerHTML = ""; return; }
    if (!state.msgs) state.msgs = seed();
    var body = state.msgs.map(function (m) {
      var mine = (m.from === USER_ROLE);
      var wa = (!mine && m.wa) ? waRow() : "";
      var acts = "";
      if (!mine && m.acts && m.acts.length) {
        var chips = "<div class='pw-ia-acts'>" + m.acts.map(function (a) { return "<button class='pw-ia-chip' data-iago='" + esc(a.section) + "'>" + esc(a.emoji || "") + " " + esc(a.label) + "</button>"; }).join("") + "</div>";
        var howA = null; for (var hi = 0; hi < m.acts.length; hi++) { if (m.acts[hi].how) { howA = m.acts[hi]; break; } }
        acts = chips + (howA ? "<div class='pw-ia-how'>" + HOW_ICO + " " + howA.how + "</div>" : "");
      }
      return "<div class='cp-iac-row cp-iac-row-" + (mine ? "me" : "them") + "'><div class='cp-iac-bubble " +
        (mine ? "cp-iac-me" : "cp-iac-them") + "'>" + m.html + "</div></div>" + acts + wa;
    }).join("");
    if (state.busy) body += "<div class='cp-iac-row cp-iac-row-them'><div class='cp-iac-bubble cp-iac-them cp-iac-typing'><span></span><span></span><span></span></div></div>";
    r.innerHTML =
      "<div class='cp-iac-panel' role='dialog' aria-label='Chat IA Pathway'>" +
        "<div class='cp-iac-head'><span class='cp-iac-head-ico'>" + SPARK + "</span>" +
          "<div><div class='cp-iac-head-t'>IA Pathway</div><div class='cp-iac-head-s'>" +
          "Tu asistente con IA" + "</div></div>" +
          "<button class='cp-iac-x' aria-label='Cerrar'>" + CLOSE_ICO + "</button></div>" +
        "<div class='cp-iac-scroll' id='cp-iac-scroll'>" + body + "</div>" +
        "<div class='cp-iac-compose'>" +
          "<input id='iac-input' type='text' placeholder='Escribe tu consulta…' value='" + esc(state.draft || "") + "' autocomplete='off'" + (state.busy ? " disabled" : "") + ">" +
          "<button class='cp-iac-send' aria-label='Enviar'" + (state.busy ? " disabled" : "") + ">" + SEND_ICO + "</button>" +
        "</div>" +
      "</div>";
    var x = r.querySelector(".cp-iac-x"); if (x) x.onclick = close;
    var send = r.querySelector(".cp-iac-send"); if (send) send.onclick = onSend;
    // Accesos directos: navegar en el portal anfitrión y cerrar el chat.
    Array.prototype.forEach.call(r.querySelectorAll("[data-iago]"), function (b) {
      b.onclick = function () { var s = b.getAttribute("data-iago"); if (!s) return; state.open = false; render(); try { if (typeof CFG.onNav === "function") CFG.onNav(s); } catch (e) {} };
    });
    var inp = r.querySelector("#iac-input");
    if (inp) {
      inp.oninput = function () { state.draft = inp.value; };
      inp.onkeydown = function (e) { if (e.key === "Enter") { e.preventDefault(); onSend(); } };
    }
    scrollDown();
  }

  function scrollDown() {
    try {
      requestAnimationFrame(function () {
        var s = document.getElementById("cp-iac-scroll"); if (s) s.scrollTop = s.scrollHeight;
        var i = document.getElementById("iac-input"); if (i && state.open && !state.busy) i.focus();
      });
    } catch (e) {}
  }

  function open() { state.open = true; if (!state.msgs) state.msgs = seed(); render(); }
  function close() { state.open = false; render(); }

  function onSend() {
    if (state.busy) return;
    var inp = document.getElementById("iac-input");
    var txt = inp ? ("" + inp.value).trim() : "";
    if (!txt) return;
    state.draft = "";
    state.msgs.push({ from: USER_ROLE, html: esc(txt), txt: txt });
    state.busy = true; render();
    ask();
  }

  function ask() {
    var history = state.msgs.filter(function (m) { return m.txt; })
      .map(function (m) { return { role: (m.from === USER_ROLE ? "user" : "assistant"), content: m.txt }; });
    while (history.length && history[0].role !== "user") history.shift();
    var email = "";
    try { email = CFG.email || (window.EMAIL) || ((JSON.parse(localStorage.getItem("mj_user") || "null") || {}).email) || ""; } catch (e) {}
    fetch(SB + "/functions/v1/ia-pathway", {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: KEY, Authorization: "Bearer " + KEY },
      body: JSON.stringify({ mode: MODE, page: location.pathname, email: email, messages: history, context: ctx() }),
    })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        state.busy = false;
        var reply = (j && j.reply) || "No pude responderte ahora.";
        state.msgs.push({ from: "ia", html: esc(reply).replace(/\n/g, "<br>"), txt: reply, wa: !!(j && j.escalate), acts: iaSuggest(reply) });
        render();
      })
      .catch(function () {
        state.busy = false;
        state.msgs.push({ from: "ia", html: "No pude conectarme al asistente ahora mismo.", txt: "", wa: true });
        render();
      });
  }

  // Expone un abridor por si la página quiere su propio botón.
  window.pwIaOpen = open;

  function boot() { injectCss(); launcher(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
