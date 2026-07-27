// pw-call.js — Videollamada DESDE EL CHAT (timbre + aceptar/rechazar + perdida).
//
// No hay servidor de señalización en vivo: se piggybackea sobre el chat que YA
// existe (mensajes en candidatos.notas_coach). Una "llamada" es un mensaje
// especial; el estado (suena / aceptada / rechazada / perdida) son mensajes
// con el mismo callId. Cada punta llama a PWCall.ingest(mensajes) después de
// cada poll del chat, y PWCall decide si mostrar el timbre / cerrar la llamada.
//
// Contrato (una sola config por página):
//   PWCall.config({
//     role:'coach'|'client',
//     me:{name,email},
//     peerName,                       // nombre de la otra persona
//     sendMessage(msgObj) => Promise, // agrega el mensaje al chat (merge-safe)
//     coachLink(room,callId),         // URL de la Sala para el coach (mod=1)
//     clientLink(room,callId),        // URL de la Sala para el cliente (mod=0)
//     room(),                         // room instantáneo (determinístico)
//     openWindow(url),                // abre la Sala (window.open)
//     pushNotify(title,body),         // opcional: push al que recibe
//     logSession(entry),              // opcional: registra en Sesiones
//     setFastPoll(on),                // opcional: baja el intervalo del poll mientras suena
//     toast(msg),                     // opcional
//   });
//   PWCall.startCall();               // coach: inicia
//   PWCall.ingest(mensajesArray);     // ambos: tras cada poll
(function () {
  var CFG = null, RINGING = null, _audio = null, _osc = null, _ringTimer = null, _handled = {};
  var RING_MS = 30000; // 30 s de timbre → si nadie acepta, perdida

  function _hhmm() { var d = new Date(); return d.getDate() + "/" + (1 + d.getMonth()) + " " + d.getHours() + ":" + ("0" + d.getMinutes()).slice(-2); }
  function _id() { return "call_" + Date.now() + "_" + Math.floor((typeof performance !== "undefined" ? performance.now() : Date.now()) % 1e6); }
  function _esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

  // ── Timbre (WebAudio, sin archivo): dos tonos que se repiten ──────────────
  function _ringStart() {
    try {
      _ringStop();
      var AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
      _audio = new AC();
      var beep = function () {
        try {
          if (!_audio) return;
          var o = _audio.createOscillator(), g = _audio.createGain();
          o.type = "sine"; o.frequency.value = 480;
          g.gain.setValueAtTime(0.0001, _audio.currentTime);
          g.gain.exponentialRampToValueAtTime(0.22, _audio.currentTime + 0.05);
          g.gain.exponentialRampToValueAtTime(0.0001, _audio.currentTime + 0.9);
          o.connect(g); g.connect(_audio.destination);
          o.start(); o.stop(_audio.currentTime + 0.95);
        } catch (e) { /* noop */ }
      };
      beep(); _osc = setInterval(beep, 1600);
    } catch (e) { /* noop */ }
  }
  function _ringStop() {
    try { if (_osc) { clearInterval(_osc); _osc = null; } } catch (e) { /* noop */ }
    try { if (_audio) { _audio.close(); _audio = null; } } catch (e) { /* noop */ }
  }

  function config(o) { CFG = o || {}; }

  // ── Coach: iniciar la llamada ─────────────────────────────────────────────
  function startCall() {
    if (!CFG || CFG.role !== "coach") return;
    var callId = _id();
    var room = (CFG.room ? CFG.room() : ("Pathway-call-" + Date.now()));
    var msg = { from: "coach", kind: "call", callId: callId, room: room, status: "ringing", text: "📹 Videollamada", ts: Date.now(), time: _hhmm() };
    _handled[callId] = "started";
    try { if (CFG.sendMessage) CFG.sendMessage(msg); } catch (e) { /* noop */ }
    try { if (CFG.pushNotify) CFG.pushNotify("📹 Te está llamando", ((CFG.me && CFG.me.name) || "Tu coach") + " quiere hacer una videollamada"); } catch (e) { /* noop */ }
    try { if (CFG.toast) CFG.toast("Llamando a " + ((CFG.peerName) || "tu cliente") + "… suena en su portal"); } catch (e) { /* noop */ }
    // El coach entra a la Sala como moderador.
    try { if (CFG.openWindow && CFG.coachLink) CFG.openWindow(CFG.coachLink(room, callId)); } catch (e) { /* noop */ }
    // Watchdog: si en 30 s no hay 'accepted', queda perdida y se registra.
    if (_ringTimer) clearTimeout(_ringTimer);
    _ringTimer = setTimeout(function () {
      if (_handled[callId] === "accepted") return;
      _handled[callId] = "missed";
      try { if (CFG.sendMessage) CFG.sendMessage({ from: "coach", kind: "call-ans", callId: callId, status: "missed", text: "📵 Llamada perdida", ts: Date.now(), time: _hhmm() }); } catch (e) { /* noop */ }
      try { if (CFG.logSession) CFG.logSession({ tipo: "Llamada rápida", estado: "perdida", ts: Date.now() }); } catch (e) { /* noop */ }
      try { if (CFG.toast) CFG.toast("Sin respuesta — quedó como llamada perdida"); } catch (e) { /* noop */ }
    }, RING_MS);
  }

  // ── Estado de cada callId a partir de los mensajes ────────────────────────
  function _statusMap(arr) {
    var m = {};
    (arr || []).forEach(function (x) {
      if (!x) return;
      if (x.kind === "call") { m[x.callId] = m[x.callId] || {}; m[x.callId].invite = x; }
      else if (x.kind === "call-ans") { m[x.callId] = m[x.callId] || {}; var p = m[x.callId]; if (!p.ans || (x.ts || 0) > (p.ans.ts || 0)) p.ans = x; }
    });
    return m;
  }

  // ── Ambos: procesar el chat tras cada poll ────────────────────────────────
  function ingest(arr) {
    if (!CFG) return;
    var map = _statusMap(arr);
    if (CFG.role === "client") {
      for (var id in map) {
        var c = map[id]; if (!c.invite) continue;
        var fresh = (Date.now() - (c.invite.ts || 0)) < (RING_MS + 3000);
        var closed = c.ans && ["accepted", "rejected", "missed"].indexOf(c.ans.status) >= 0;
        if (fresh && !closed && RINGING !== id && !_handled[id]) { _showRing(id, c.invite); }
        // Si el coach cortó (missed) y estábamos sonando esa, cerrar el timbre.
        if (closed && RINGING === id) { _closeRing(); }
      }
    } else { // coach: reaccionar a la respuesta del cliente
      for (var id2 in map) {
        var c2 = map[id2]; if (!c2.ans || _handled[id2] === c2.ans.status) continue;
        if (c2.ans.from === "cliente" && c2.ans.status === "accepted") {
          _handled[id2] = "accepted";
          try { if (CFG.logSession) CFG.logSession({ tipo: "Llamada rápida", estado: "realizada", ts: Date.now() }); } catch (e) { /* noop */ }
          try { if (CFG.toast) CFG.toast((CFG.peerName || "Tu cliente") + " aceptó la llamada ✓"); } catch (e) { /* noop */ }
        } else if (c2.ans.from === "cliente" && c2.ans.status === "rejected") {
          _handled[id2] = "rejected";
          try { if (CFG.toast) CFG.toast((CFG.peerName || "Tu cliente") + " rechazó la llamada"); } catch (e) { /* noop */ }
        }
      }
    }
  }

  // ── Cliente: overlay de timbre entrante ───────────────────────────────────
  function _showRing(callId, invite) {
    if (document.getElementById("pw-call-ring")) return;
    RINGING = callId;
    try { if (CFG.setFastPoll) CFG.setFastPoll(true); } catch (e) { /* noop */ }
    _ringStart();
    var who = _esc((CFG && CFG.peerName) || "Tu coach");
    var av = "<div style='width:84px;height:84px;border-radius:50%;background:linear-gradient(160deg,#2D6A4F,#1B4332);display:flex;align-items:center;justify-content:center;font-size:38px;margin:0 auto 14px'>📹</div>";
    var d = document.createElement("div");
    d.id = "pw-call-ring";
    d.style.cssText = "position:fixed;inset:0;z-index:2147483000;background:rgba(12,24,18,.72);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;padding:22px;font-family:Inter,system-ui,-apple-system,sans-serif";
    d.innerHTML =
      "<div style='background:#fff;max-width:340px;width:100%;border-radius:22px;padding:26px 22px;text-align:center;box-shadow:0 24px 70px rgba(0,0,0,.4);animation:pwCallPulse 1.4s ease-in-out infinite'>" +
        av +
        "<div style='font-size:12px;letter-spacing:1px;text-transform:uppercase;color:#7A8A80;font-weight:700'>Videollamada entrante</div>" +
        "<div style='font-family:Georgia,serif;font-size:21px;color:#1B2E26;margin:5px 0 20px'>" + who + " te llama</div>" +
        "<div style='display:flex;gap:12px;justify-content:center'>" +
          "<button id='pw-call-no' style='flex:1;max-width:130px;height:50px;border:none;border-radius:14px;background:#F3E1DF;color:#B4231F;font-weight:700;font-size:15px;font-family:inherit;cursor:pointer'>Rechazar</button>" +
          "<button id='pw-call-yes' style='flex:1;max-width:130px;height:50px;border:none;border-radius:14px;background:#2D6A4F;color:#fff;font-weight:700;font-size:15px;font-family:inherit;cursor:pointer'>Aceptar</button>" +
        "</div>" +
      "</div>" +
      "<style>@keyframes pwCallPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.02)}}</style>";
    document.body.appendChild(d);
    document.getElementById("pw-call-yes").addEventListener("click", function () { _answer(callId, invite, "accepted"); });
    document.getElementById("pw-call-no").addEventListener("click", function () { _answer(callId, invite, "rejected"); });
    // Auto-perdida si no contesta a tiempo.
    setTimeout(function () { if (RINGING === callId && !_handled[callId]) { _handled[callId] = "missed"; _closeRing(); } }, RING_MS);
  }

  function _closeRing() {
    RINGING = null; _ringStop();
    try { var el = document.getElementById("pw-call-ring"); if (el) el.remove(); } catch (e) { /* noop */ }
    try { if (CFG.setFastPoll) CFG.setFastPoll(false); } catch (e) { /* noop */ }
  }

  function _answer(callId, invite, status) {
    _handled[callId] = status;
    _closeRing();
    try {
      if (CFG.sendMessage) CFG.sendMessage({ from: "cliente", kind: "call-ans", callId: callId, status: status, text: status === "accepted" ? "✅ Aceptó la llamada" : "❌ Rechazó la llamada", ts: Date.now(), time: _hhmm() });
    } catch (e) { /* noop */ }
    if (status === "accepted") {
      try { if (CFG.logSession) CFG.logSession({ tipo: "Llamada rápida", estado: "realizada", ts: Date.now() }); } catch (e) { /* noop */ }
      // El coach ya dejó el link del cliente en el mensaje (invite.link) → lo usamos
      // tal cual para entrar al MISMO room; si faltara, lo reconstruye clientLink().
      var url = (invite && invite.link) ? invite.link : (CFG.clientLink ? CFG.clientLink(invite.room, callId) : "");
      try { if (CFG.openWindow && url) CFG.openWindow(url); } catch (e) { /* noop */ }
    }
  }

  // ── Demo: muestra el timbre tal cual lo ve el cliente (para mostrárselo a un
  //    lead). Aceptar/Rechazar solo cierran — no hay llamada real. ────────────
  function demoRing(coachName) {
    CFG = CFG || {};
    CFG.role = "client"; CFG.peerName = coachName || "Tu coach";
    _handled = {}; RINGING = null;
    _showRing("demo_" + Date.now(), { room: "demo", link: "" });
  }

  window.PWCall = { config: config, startCall: startCall, ingest: ingest, demoRing: demoRing };
})();
