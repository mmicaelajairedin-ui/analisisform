// pw-turn.js — Servidor TURN de respaldo para el video P2P (pw-p2p.js).
//
// ¿QUÉ ES? El TURN es un "puente" que se usa SOLO cuando los dos navegadores no
// pueden conectarse directo (redes con firewall estricto: wifi de oficina, algunas
// redes de datos móviles, VPNs). Es el ~10-20% de los casos.
//   • SIN TURN  → el video anda en la MAYORÍA de las redes (P2P directo + STUN).
//   • CON TURN  → anda en TODAS.
//
// ─────────────────────────────────────────────────────────────────────────────
// CÓMO PONER EL TUYO (para producción) — recomendado: Metered.ca (fácil, barato)
//   1) Creá una cuenta gratis en https://www.metered.ca  (tienen tier gratis).
//   2) En su panel → "TURN Server" → te dan: urls + username + credential.
//   3) Pegá esos datos abajo, reemplazando el bloque de PRUEBA.
// Otras opciones: Twilio TURN, Cloudflare TURN, o coturn en un VPS de ~€5/mes.
//
// ⚠️ NOTA: estas credenciales viajan en el navegador (son públicas). Para bajo
// volumen está OK. Si crece el uso, se pasa a credenciales de vida corta con una
// edge function (como jaas-token) — te lo armo cuando haga falta.
// ─────────────────────────────────────────────────────────────────────────────
//
// Por ahora usamos el TURN PÚBLICO GRATUITO de Metered (Open Relay) para PROBAR
// que el respaldo funciona. Es gratis pero compartido/limitado → reemplazalo por
// el tuyo antes de usarlo en serio con clientes.
window.PW_TURN = [
  { urls: "stun:stun.relay.metered.ca:80" },
  { urls: "turn:openrelay.metered.ca:80", username: "openrelayproject", credential: "openrelayproject" },
  { urls: "turn:openrelay.metered.ca:443", username: "openrelayproject", credential: "openrelayproject" },
  { urls: "turn:openrelay.metered.ca:443?transport=tcp", username: "openrelayproject", credential: "openrelayproject" }
];
