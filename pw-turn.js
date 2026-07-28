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
// TURN PROPIO — coturn en VPS Hetzner (pathwayserver, CX23, Falkenstein).
// IP 91.98.155.217 · user pathway · costo fijo ~€5.49/mes sin importar cuántos
// coaches/clientes (chau €90 de JaaS). Config en docs/turn-cloud-init.txt.
// STUN de Google como primer intento (directo, gratis); el TURN propio entra solo
// cuando la red no deja conexión directa (~10-20% de los casos).
window.PW_TURN = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:91.98.155.217:3478" },
  { urls: "turn:91.98.155.217:3478", username: "pathway", credential: "PathwayTurn2026xk9q" },
  { urls: "turn:91.98.155.217:3478?transport=tcp", username: "pathway", credential: "PathwayTurn2026xk9q" }
];
