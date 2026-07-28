// GUARDIAN DEL ICON SYSTEM — una sola librería de iconos en TODA la plataforma.
//
// Regla de diseño (definida por la coach): Pathway usa EXCLUSIVAMENTE iconos
// Lucide (outline, stroke 2px, 20px / 18px en botones chicos, color #1F4030),
// servidos por pw-icons.js + pw-icons.css. NO se mezclan librerías de iconos y
// NO se usan emojis del sistema como iconos de interfaz.
//
// Este check tiene dos niveles:
//   · enforce (FALLA el build): la fuente única existe y con el spec correcto,
//     nadie metió otra librería de iconos, y las pantallas clave la cargan.
//   · report (NO falla): lista emojis pictográficos que quedan en el chrome de
//     superficies ya convertidas, para ir cerrándolos sin frenar el merge.
//
// Correr local:  node scripts/check-icons.js
const fs = require("fs");
function read(f) { try { return fs.readFileSync(f, "utf8"); } catch (e) { return ""; } }
function exists(f) { try { fs.accessSync(f); return true; } catch (e) { return false; } }

let failures = 0;
function fail(msg) { console.log("FAIL  " + msg); failures++; }
function ok(msg) { console.log("ok    " + msg); }

// ── 1. La fuente única existe y respeta el spec ─────────────────────────────
const css = read("pw-icons.css");
const js = read("pw-icons.js");
if (!css) fail("falta pw-icons.css (la fuente única del estilo de iconos).");
else {
  const spec = [
    ["#1F4030", "color canónico del icono"],
    ["--pw-icon", "token de color del icono"],
    ["stroke-width:2", "grosor 2px"],
    [".pw-ic-sm", "tamaño chico (18px) para botones"],
    ["20px", "tamaño por defecto"],
    ["18px", "tamaño chico"],
  ];
  const missing = spec.filter(([tok]) => !css.includes(tok)).map(([, d]) => d);
  if (missing.length) fail("pw-icons.css perdió parte del spec: " + missing.join(", ") + ".");
  else ok("pw-icons.css conserva el spec (outline · 2px · 20/18px · #1F4030).");
}
if (!js) fail("falta pw-icons.js (window.PWI: mapa Lucide + svg/chip/mount).");
else {
  if (!/window\.PWI\s*=/.test(js)) fail("pw-icons.js ya no expone window.PWI.");
  else if (!/\bIC\s*=\s*\{/.test(js)) fail("pw-icons.js ya no define el mapa de iconos IC.");
  else ok("pw-icons.js expone window.PWI con el mapa de iconos.");
}

// ── 2. Nadie metió otra librería de iconos (no mezclar) ─────────────────────
// Firmas de librerías de iconos de terceros. Si aparecen, se rompió la regla.
// Firmas UNÍVOCAS (evitan falsos positivos con palabras en español o ids como
// "pw-chat-fab" / "selección-icono"). Solo señales reales de cada librería.
const FOREIGN = [
  [/font-?awesome|fa-solid|fa-regular|fa-brands|class=["'](?:fa|fas|far|fal|fab|fad)\s+fa-|use\.fontawesome\.com|cdnjs\.cloudflare\.com\/ajax\/libs\/font-awesome/i, "Font Awesome"],
  [/material-icons|material-symbols|fonts\.googleapis\.com\/icon/i, "Material Icons"],
  [/feathericons|feather\.min\.js|data-feather=/i, "Feather"],
  [/bootstrap-icons|class=["']bi bi-/i, "Bootstrap Icons"],
  [/<ion-icon|ionicons\.com|ionicons@/i, "Ionicons"],
  [/unpkg\.com\/lucide|cdn\.jsdelivr\.net\/npm\/lucide|lucide\.min\.js|lucide@|createIcons\s*\(/i, "Lucide vía CDN (usar pw-icons.js self-hosted)"],
  [/api\.iconify\.design|iconify-icon|@iconify/i, "Iconify"],
  [/remixicon/i, "Remix Icon"],
];
const htmls = fs.readdirSync(".").filter((f) => f.endsWith(".html"));
const jsFiles = fs.readdirSync(".").filter((f) => f.endsWith(".js"));
let foreignHits = [];
for (const f of htmls.concat(jsFiles)) {
  const t = read(f);
  for (const [re, name] of FOREIGN) {
    if (re.test(t)) foreignHits.push(f + " → " + name);
  }
}
if (foreignHits.length) fail("librería de iconos ajena (no mezclar):\n      " + foreignHits.join("\n      "));
else ok("ninguna librería de iconos de terceros (solo Lucide via pw-icons.js).");

// ── 3. Las pantallas clave cargan la fuente única ───────────────────────────
const MUST_LOAD = [
  "index.html", "index-en.html", "panel-v2.html", "multicoach.html",
  "cliente.html", "pathway-fit-cliente.html", "pathway-fin-cliente.html",
];
const notLoading = MUST_LOAD.filter((f) => exists(f) && !/pw-icons\.js/.test(read(f)));
if (notLoading.length) fail("estas pantallas clave no cargan pw-icons.js: " + notLoading.join(", ") + ".");
else ok("las pantallas clave cargan pw-icons.js.");

// panel-v2 NO debe re-declarar su propio mapa: debe apuntar a la fuente única.
const pv = read("panel-v2.html");
if (pv) {
  if (/\bvar\s+IC\s*=\s*\{/.test(pv))
    fail("panel-v2.html volvió a declarar su propio 'var IC = {…}'. Debe usar window.PWI.IC (una sola fuente).");
  else if (!/window\.PWI\.IC/.test(pv))
    fail("panel-v2.html ya no referencia window.PWI.IC.");
  else ok("panel-v2.html usa la fuente única (window.PWI.IC).");
}

// ── 3b. CONSISTENCIA: un concepto = UN icono (tabla canónica _CLI_ICON) ─────
// El mismo concepto no puede tener dos iconos distintos entre pantallas.
// Fuente canónica: el mapa _CLI_ICON de panel-v2. Si alguien cambia el icono de
// un concepto en un solo lado, esto lo frena.
const CANON = {
  perfil: "user", plan: "clipboard", fit_rutina: "dumbbell", fit_antro: "ruler",
  fit_nutri: "apple", sesiones: "calendar", fin_pres: "dollar", gestion: "settings",
  avance: "trendUp", docs: "fileText", mensajes: "chat", // mensajes = globo, NO sobre
};
if (pv) {
  const drift = [];
  for (const key in CANON) {
    // El patrón `key:''+PWI.svg('name'` es propio del mapa _CLI_ICON.
    const re = new RegExp(key + ":''\\+PWI\\.svg\\('([a-zA-Z]+)'");
    const m = pv.match(re);
    if (m && m[1] !== CANON[key]) drift.push(key + " usa '" + m[1] + "' (canónico: '" + CANON[key] + "')");
  }
  if (drift.length) fail("_CLI_ICON rompió la consistencia concepto→icono:\n      " + drift.join("\n      "));
  else ok("consistencia concepto→icono intacta (mensajes=chat, gym=dumbbell, clientes=users, …).");
  // El internal chat ("Mensajes", clidet:mensajes) usa chat (globo), NO mail (sobre).
  if (/clidet:mensajes'[^>]*>\s*<span[^>]*>\s*"\s*\+\s*PWI\.svg\('mail'/.test(pv))
    fail("la pestaña 'Mensajes' (chat interno) usa el sobre (mail); debe usar el globo (chat).");
  // Gym idéntico coach↔cliente: el dumbbell canónico debe ser la barra horizontal
  // del nav del cliente (pathway-fit-cliente).
  const fitNav = read("pathway-fit-cliente.html");
  const dumb = (js.match(/dumbbell:\s*"([^"]*)"/) || [, ""])[1];
  const barPath = "M6 7v10M18 7v10";
  if (js && !dumb.includes(barPath)) fail("el dumbbell canónico ya no es la barra horizontal (gym coach↔cliente dejaría de coincidir).");
  else if (fitNav && !fitNav.includes(barPath)) fail("el nav del cliente (fit) ya no usa el mismo dumbbell que el sistema.");
  else if (js) ok("gym (dumbbell) idéntico entre el coach y el nav del cliente.");
}

// ── 4. REPORT: emojis pictográficos en el chrome de superficies convertidas ─
// No falla el build (la migración es progresiva); marca lo que falta cerrar.
// Emojis de CONTENIDO quedan permitidos (medallas, banderas, mascota, agenda
// fitness): se listan aparte y no cuentan.
const CONTENT_OK = new Set(["🥇","🥈","🥉","🏅","🐐","🐷","💪","🍎","⭐","🇪🇸","🇦🇷","🇲🇽","🇨🇴","🇨🇱","🇵🇪"]);
// Solo emojis "de verdad" (bloque pictográfico + símbolos a color comunes en
// chrome). Los dingbats tipográficos (✓ ✕ → ← ★ ✦ ✎) NO cuentan: son texto.
const PICTO = /[\u{1F300}-\u{1FAFF}]|[\u{2648}-\u{2653}]|[\u{26A0}\u{2705}\u{2708}\u{2709}\u{270A}-\u{270D}\u{2728}\u{274C}\u{2753}\u{2757}\u{2764}\u{2B50}]️?/gu;
const CONVERTED = ["index.html"]; // superficies ya migradas — subir a esta lista al convertir cada una
let reportTotal = 0;
for (const f of CONVERTED) {
  const t = read(f);
  const hits = (t.match(PICTO) || []).filter((e) => !CONTENT_OK.has(e.replace("️", "")));
  if (hits.length) { reportTotal += hits.length; console.log("report " + f + ": " + hits.length + " emoji(s) pictográfico(s) de chrome sin convertir → " + hits.slice(0, 12).join(" ")); }
}
if (reportTotal === 0) ok("superficies convertidas sin emojis de chrome pendientes.");

if (failures) {
  console.error("\n✗ " + failures + " problema(s) en el Icon System — se rompió la regla de una sola librería/estilo.");
  process.exit(1);
}
console.log("\n✓ Icon System OK — una sola librería (Lucide), spec consistente, fuente única cargada.");
