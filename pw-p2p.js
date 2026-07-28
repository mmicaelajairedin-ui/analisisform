// pw-p2p.js — Motor de video 1:1 PEER-TO-PEER para la Sala de Pathway.
//
// POR QUÉ EXISTE:
// JaaS (8x8) cobra a partir de 25 usuarios activos/mes. Una llamada 1:1 no
// necesita un servidor de video: los dos navegadores se conectan DIRECTO
// (WebRTC). Costo ~€0. Solo hace falta:
//   1) un canal de "signaling" para que los dos se presenten → Supabase Realtime
//      (ya lo tienes; no monta ningún servidor nuevo),
//   2) STUN (gratis, de Google) para descubrir la IP pública,
//   3) TURN (opcional, ~€5/mes) SOLO para el ~15% de redes que bloquean el P2P.
//
// ALCANCE: 1:1 (coach ↔ cliente). Las clases GRUPALES (1 : muchos) NO se pueden
// hacer así — eso necesita un SFU (LiveKit). Este motor es para las 4 salas 1:1.
//
// SEGURIDAD DEL ROLLOUT: es un archivo APARTE. sala.html lo usa solo si el link
// trae ?engine=p2p. El camino JaaS queda intacto → se prueba sin tocar producción.
//
// API pública (window.PWP2P):
//   start(opts) → arranca. opts = {
//     container, room, name, moderator, sbUrl, sbKey,
//     iceServers?,                              // [{urls:'turn:...',username,credential}]
//     onState(txt), onRemoteJoin(), onRemoteLeave(),
//     onChat(from,text), onLocalReady(stream), onError(e) }
//   hangup(), toggleMic()→muted, toggleCam()→off, toggleScreen()→sharing,
//   sendChat(text)
(function () {
  var SDK = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
  var STUN = [{ urls: "stun:stun.l.google.com:19302" }, { urls: "stun:stun1.l.google.com:19302" }];

  var pc = null, chan = null, localStream = null, screenStream = null, remoteEl = null;
  var camTrack = null, opts = null, polite = true, makingOffer = false, ignoreOffer = false;
  var started = false, failed = false, failTimer = null, everConnected = false, negTimer = null, sawPeer = false;

  function _sdk() {
    return new Promise(function (res, rej) {
      if (window.supabase && window.supabase.createClient) return res();
      var s = document.createElement("script"); s.src = SDK;
      var to = setTimeout(function () { rej(new Error("sdk_timeout")); }, 8000);
      s.onload = function () { clearTimeout(to); res(); };
      s.onerror = function () { clearTimeout(to); rej(new Error("sdk_error")); };
      document.head.appendChild(s);
    });
  }
  function _emit(kind, payload) {
    try { chan && chan.send({ type: "broadcast", event: "sig", payload: Object.assign({ kind: kind }, payload) }); } catch (e) {}
  }
  function _state(t) { try { opts.onState && opts.onState(t); } catch (e) {} }

  function _newPc() {
    var ice = STUN.concat((opts.iceServers && opts.iceServers.length) ? opts.iceServers : []);
    var p = new RTCPeerConnection({ iceServers: ice });
    // Perfect negotiation (evita el "glare" cuando los dos ofertan a la vez).
    p.onnegotiationneeded = function () {
      (async function () {
        try { makingOffer = true; await p.setLocalDescription(); _emit("desc", { desc: p.localDescription }); }
        catch (e) {} finally { makingOffer = false; }
      })();
    };
    p.onicecandidate = function (e) { if (e.candidate) _emit("ice", { cand: e.candidate }); };
    p.ontrack = function (e) {
      if (!remoteEl) return;
      if (remoteEl.srcObject !== e.streams[0]) {
        remoteEl.srcObject = e.streams[0];
        // Autoplay: en desktop el navegador BLOQUEA reproducir un video con audio
        // sin gesto → quedaba negro aunque el media llegara. Forzamos play(); si el
        // navegador igual lo bloquea, avisamos para tocar la pantalla.
        var pr = remoteEl.play();
        if (pr && pr.catch) pr.catch(function () {
          // Bloqueado: al PRIMER toque/click en la pantalla, reproducimos (gesto del usuario).
          var go = function () { try { remoteEl.play(); } catch (e) {} document.removeEventListener("click", go); document.removeEventListener("touchstart", go); };
          document.addEventListener("click", go); document.addEventListener("touchstart", go);
          try { opts.onState && opts.onState("Tocá la pantalla para ver el video"); } catch (e) {}
        });
        try { opts.onRemoteJoin && opts.onRemoteJoin(); } catch (_e) {}
      }
    };
    p.onconnectionstatechange = function () {
      var s = p.connectionState;
      if (s === "connected") { everConnected = true; if (negTimer) { clearTimeout(negTimer); negTimer = null; } _state("En llamada"); if (failTimer) { clearTimeout(failTimer); failTimer = null; } failed = false; }
      else if (s === "disconnected" || s === "failed") {
        _state("Reconectando…"); try { p.restartIce && p.restartIce(); } catch (e) {}
        // Solo caemos a JaaS si la llamada NUNCA llegó a conectar (red que bloquea el
        // P2P de entrada, ni el TURN alcanza). Si YA estábamos en llamada y se cortó,
        // es un bache transitorio: dejamos que restartIce reconecte y NO tiramos la
        // llamada a un respaldo (antes un microcorte de 10s mataba la sesión).
        if (!everConnected && !failTimer) failTimer = setTimeout(function () {
          failTimer = null;
          if (pc && pc.connectionState !== "connected" && !failed && !everConnected) { failed = true; try { opts.onFail && opts.onFail(); } catch (e) {} }
        }, 10000);
      }
      else if (s === "closed") { _state("Llamada terminada"); }
    };
    return p;
  }

  async function _onSignal(msg) {
    if (!msg || msg.__self) return;
    sawPeer = true;   // recibimos algo del otro → hay alguien intentando conectar
    try {
      if (msg.kind === "hello") {
        // El otro recién se suscribió. Si YO entré primero, mi oferta inicial
        // pudo perderse (nadie la escuchaba todavía). El peer "impolite" (coach)
        // RE-OFERTA ahora que el otro sí está escuchando → así conectan sí o sí,
        // sin importar quién entró primero. (El polite espera la oferta.)
        if (!polite && pc && pc.signalingState === "stable") {
          (async function () {
            try { makingOffer = true; await pc.setLocalDescription(); _emit("desc", { desc: pc.localDescription }); }
            catch (e) {} finally { makingOffer = false; }
          })();
        }
        return;
      }
      if (msg.kind === "bye") { try { opts.onRemoteLeave && opts.onRemoteLeave(); } catch (e) {} _state("La otra persona salió"); if (remoteEl) remoteEl.srcObject = null; return; }
      if (msg.kind === "chat") { try { opts.onChat && opts.onChat(msg.from || "", msg.text || ""); } catch (e) {} return; }
      if (msg.kind === "desc") {
        var desc = msg.desc;
        var offerCollision = (desc.type === "offer") && (makingOffer || pc.signalingState !== "stable");
        ignoreOffer = !polite && offerCollision;
        if (ignoreOffer) return;
        await pc.setRemoteDescription(desc);
        if (desc.type === "offer") { await pc.setLocalDescription(); _emit("desc", { desc: pc.localDescription }); }
        return;
      }
      if (msg.kind === "ice") { try { await pc.addIceCandidate(msg.cand); } catch (e) { if (!ignoreOffer) throw e; } return; }
    } catch (e) { try { opts.onError && opts.onError(e); } catch (_e) {} }
  }

  var API = {
    start: function (o) {
      if (started) return Promise.resolve();
      started = true; opts = o || {};
      polite = !opts.moderator; // el moderador (coach) es "impolite" → gana en un choque de ofertas
      remoteEl = null;
      return _sdk().then(function () {
        // 1) media local
        return navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      }).then(function (stream) {
        localStream = stream; camTrack = stream.getVideoTracks()[0] || null;
        // Contenedor: <video> remoto a pantalla completa + <video> local chico (PiP).
        var c = (typeof opts.container === "string") ? document.getElementById(opts.container) : opts.container;
        // NO pisar el position del contenedor si ya está posicionado (el #jaas de la
        // Sala es position:absolute;inset:0;bottom:84px). Forzarlo a 'relative' rompía
        // esa geometría y empujaba el PiP local fuera de vista en desktop. Solo lo
        // hacemos posicionado si estaba 'static'.
        try { var _cs = window.getComputedStyle(c); if (!_cs || _cs.position === "static") c.style.position = "relative"; } catch (e) { c.style.position = "relative"; }
        c.style.background = "#14181B";
        var _mob = false; try { _mob = !!(window.matchMedia && window.matchMedia("(max-width:1000px)").matches); } catch (e) {}
        remoteEl = document.createElement("video"); remoteEl.autoplay = true; remoteEl.playsInline = true;
        // Móvil → object-fit:cover (video A PANTALLA COMPLETA tipo WhatsApp, sin
        // franjas). Desktop → contain (se ve el CUADRO COMPLETO del otro, sin el
        // "mucho zoom" del recorte). El fondo #14181B hace de marco cuando hay franjas.
        remoteEl.style.cssText = "width:100%;height:100%;object-fit:" + (_mob ? "cover" : "contain") + ";background:#14181B";
        var localEl = document.createElement("video"); localEl.autoplay = true; localEl.playsInline = true; localEl.muted = true;
        localEl.srcObject = stream; try { var lp = localEl.play(); if (lp && lp.catch) lp.catch(function () {}); } catch (e) {}
        // PiP local: en móvil más chico, vertical (selfie) y levantado para no quedar
        // tapado por los controles flotantes; en desktop apaisado, abajo a la derecha.
        localEl.style.cssText = "position:absolute;right:14px;bottom:" + (_mob ? "124px" : "16px") + ";width:" + (_mob ? "32%" : "30%") + ";max-width:" + (_mob ? "148px" : "220px") + ";min-width:104px;aspect-ratio:" + (_mob ? "3/4" : "4/3") + ";border-radius:14px;object-fit:cover;box-shadow:0 6px 22px rgba(0,0,0,.45);border:2px solid rgba(255,255,255,.7);z-index:5";
        c.appendChild(remoteEl); c.appendChild(localEl);
        try { opts.onLocalReady && opts.onLocalReady(stream); } catch (e) {}
        // 2) peer connection + tracks
        pc = _newPc();
        stream.getTracks().forEach(function (t) { pc.addTrack(t, stream); });
        // 3) signaling por Supabase Realtime (canal = la sala)
        var sb = window.supabase.createClient(opts.sbUrl, opts.sbKey, { realtime: { params: { eventsPerSecond: 20 } } });
        chan = sb.channel("sala:" + opts.room, { config: { broadcast: { self: false } } });
        chan.on("broadcast", { event: "sig" }, function (e) { _onSignal(e && e.payload); });
        chan.subscribe(function (st) { if (st === "SUBSCRIBED") { _state("Esperando a la otra persona…"); _emit("hello", {}); } });
        // Watchdog de negociación: si el OTRO ya apareció (sawPeer) pero a los 25s
        // seguimos sin conectar (ICE atascado, ni P2P ni TURN), caemos al respaldo
        // solos. Si estás sola esperando (nadie llegó), NO cae — es espera legítima.
        if (!negTimer) negTimer = setTimeout(function () {
          negTimer = null;
          if (sawPeer && !everConnected && !failed && (!pc || pc.connectionState !== "connected")) { failed = true; try { opts.onFail && opts.onFail(); } catch (e) {} }
        }, 25000);
      }).catch(function (e) {
        started = false;
        try { opts.onError && opts.onError(e); } catch (_e) {}
        throw e;
      });
    },
    sendChat: function (txt) { _emit("chat", { from: (opts && opts.name) || "", text: "" + (txt || "") }); },
    toggleMic: function () {
      if (!localStream) return false; var t = localStream.getAudioTracks()[0]; if (!t) return false;
      t.enabled = !t.enabled; return !t.enabled; // devuelve "muted"
    },
    toggleCam: function () {
      if (!localStream) return false; var t = localStream.getVideoTracks()[0]; if (!t) return false;
      t.enabled = !t.enabled; return !t.enabled; // devuelve "off"
    },
    toggleScreen: function () {
      var sender = pc && pc.getSenders().filter(function (s) { return s.track && s.track.kind === "video"; })[0];
      if (!sender) return Promise.resolve(false);
      if (screenStream) { // dejar de compartir → volver a la cámara
        try { screenStream.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {}
        screenStream = null;
        return sender.replaceTrack(camTrack).then(function () { return false; }).catch(function () { return false; });
      }
      return navigator.mediaDevices.getDisplayMedia({ video: true }).then(function (ds) {
        screenStream = ds; var st = ds.getVideoTracks()[0];
        st.onended = function () { API.toggleScreen(); };
        return sender.replaceTrack(st).then(function () { return true; });
      }).catch(function () { return false; });
    },
    hangup: function () {
      // Cortar los watchdogs: si el usuario sale, un onFail tardío NO debe disparar
      // el respaldo (arrancaría JaaS sobre una sala ya cerrada).
      failed = true; if (failTimer) { clearTimeout(failTimer); failTimer = null; } if (negTimer) { clearTimeout(negTimer); negTimer = null; }
      try { _emit("bye", {}); } catch (e) {}
      try { chan && chan.unsubscribe(); } catch (e) {}
      try { localStream && localStream.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {}
      try { screenStream && screenStream.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {}
      try { pc && pc.close(); } catch (e) {}
      pc = null; chan = null; localStream = null; screenStream = null; started = false;
      _state("Llamada terminada");
    }
  };
  window.PWP2P = API;
})();
