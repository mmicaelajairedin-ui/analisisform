// SMOKE TEST — "el tester que no puede mentir".
// No mira si la pantalla "se ve bien": verifica HECHOS sobre cada .html.
//
//   1) Cada handler (onclick, onchange, oninput, onsubmit, onkeyup...) llama a
//      una funcion que EXISTE (definida inline o en un .js local incluido).
//      Atrapa botones que no hacen nada / tiran error de consola.
//   2) Cada archivo local referenciado (assets/..., *.js, *.css, imagenes)
//      EXISTE en el repo. Atrapa imagenes y scripts rotos.
//
// Correr local:  node scripts/check-smoke.js
const fs = require("fs"), path = require("path");

const htmlFiles = fs.readdirSync(".").filter((f) => f.endsWith(".html")).sort();

// Globals del navegador + librerias de terceros que cargamos por CDN.
const GLOBALS = new Set([
  // navegador
  "alert","confirm","prompt","parseInt","parseFloat","isNaN","isFinite","Number","String",
  "Boolean","Array","Object","JSON","Date","Math","RegExp","Map","Set","Promise","Symbol",
  "setTimeout","setInterval","clearTimeout","clearInterval","requestAnimationFrame","fetch",
  "encodeURIComponent","decodeURIComponent","encodeURI","decodeURI","escape","unescape",
  "eval","Function","Error","atob","btoa","structuredClone","queueMicrotask","reportError",
  "print","open","close","blur","focus","scrollTo","scrollBy","matchMedia","getComputedStyle",
  // palabras clave que pueden aparecer antes de un "("
  "if","for","while","switch","return","typeof","void","new","delete","in","instanceof",
  "do","else","catch","function","await","yield","async","this","super",
  // terceros por CDN
  "emailjs","Chart","uploadcare","Calendly","gtag","grecaptcha","supabase","html2pdf",
  "html2canvas","jspdf","jsPDF","confetti","dataLayer","fbq","posthog",
  // funciones/keywords de CSS que aparecen en estilos inline dentro de handlers
  // (ej. onmouseover="this.style.background='rgba(...)'") — no son JS.
  "rgba","rgb","hsl","hsla","var","calc","url","scale","scaleX","scaleY","translate",
  "translateX","translateY","translateZ","translate3d","rotate","rotateX","rotateY",
  "skew","matrix","blur","brightness","contrast","perspective","cubic-bezier","repeat",
  "minmax","linear","radial","attr",
]);

// Extrae el JS inline (concatenado) y los src de scripts locales de un html.
function parseHtml(html) {
  const inline = []; const localScripts = []; let externalGlobals = false;
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html))) {
    const attrs = m[1] || "", code = m[2] || "";
    const srcM = attrs.match(/\bsrc\s*=\s*["']([^"']+)["']/i);
    if (srcM) {
      const src = srcM[1].split("?")[0].split("#")[0];
      if (/^https?:\/\//i.test(src) || src.startsWith("//")) externalGlobals = true;
      else localScripts.push(src);
      continue;
    }
    const tm = attrs.match(/\btype\s*=\s*["']?([^"'\s>]+)/i);
    const type = tm ? tm[1].toLowerCase() : "";
    const isJs = !type || /javascript|ecmascript|module/.test(type);
    if (isJs && code.trim()) inline.push(code);
  }
  return { inline, localScripts, externalGlobals };
}

// Junta los nombres de funciones/vars definidos en un bloque de JS.
function collectDefs(js, set) {
  let m;
  const patterns = [
    /\bfunction\s+([A-Za-z_$][\w$]*)/g,           // function foo(
    /\b(?:var|let|const)\s+([A-Za-z_$][\w$]*)\s*=/g, // var foo =
    /\b([A-Za-z_$][\w$]*)\s*=\s*function\b/g,      // foo = function
    /\b([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?\(/g, // foo = (a) =>  /  foo = async (
    /\bwindow\.([A-Za-z_$][\w$]*)\s*=/g,           // window.foo =
  ];
  for (const re of patterns) while ((m = re.exec(js))) set.add(m[1]);
}

// Extrae los nombres de funciones llamadas dentro de un valor de handler.
// Solo cuenta llamadas a nombres "pelados" (no metodos tipo obj.metodo()).
function calledNames(val) {
  const names = [];
  const re = /(^|[^\w.$])([A-Za-z_$][\w$]*)\s*\(/g;
  let m;
  while ((m = re.exec(val))) names.push(m[2]);
  return names;
}

let failures = 0;
const summary = [];

for (const f of htmlFiles) {
  const html = fs.readFileSync(f, "utf8");
  const { inline, localScripts, externalGlobals } = parseHtml(html);

  // ---- definiciones disponibles para este html ----
  const defs = new Set();
  inline.forEach((code) => collectDefs(code, defs));
  for (const src of localScripts) {
    const p = src.replace(/^\.?\//, "");
    if (fs.existsSync(p)) collectDefs(fs.readFileSync(p, "utf8"), defs);
  }

  const errs = [];

  // ---- 1) handlers -> funcion existe ----
  const hRe = /\bon(?:click|change|input|submit|keyup|keydown|keypress|focus|blur|mouseover|mouseout|load|error)\s*=\s*("([^"]*)"|'([^']*)')/gi;
  let hm;
  const missing = new Set();
  while ((hm = hRe.exec(html))) {
    const val = hm[2] != null ? hm[2] : (hm[3] || "");
    for (const name of calledNames(val)) {
      if (GLOBALS.has(name) || defs.has(name)) continue;
      // si la pagina carga scripts externos por CDN, no podemos ver sus globals:
      // lo dejamos pasar para no marcar falsos positivos.
      if (externalGlobals && !/^[a-z]/.test(name)) continue;
      missing.add(name);
    }
  }
  if (missing.size) errs.push("handlers a funciones inexistentes: " + [...missing].sort().join(", "));

  // ---- 2) assets locales existen ----
  const assetMissing = new Set();
  // a) atributos src/href en el HTML
  const aRe = /\b(?:src|href)\s*=\s*("([^"]*)"|'([^']*)')/gi;
  let am;
  while ((am = aRe.exec(html))) {
    let url = (am[2] != null ? am[2] : am[3] || "").trim();
    checkAsset(url, assetMissing);
  }
  // b) rutas a assets/ dentro de strings JS (imagenes de medallas, iconos, etc.)
  const jsAssetRe = /["'`](assets\/[^"'`)]+\.(?:png|jpe?g|svg|webp|gif|css|js|ico|pdf|mp4|webm))["'`]/gi;
  let jm;
  for (const code of inline) while ((jm = jsAssetRe.exec(code))) checkAsset(jm[1], assetMissing);

  if (assetMissing.size) errs.push("archivos locales que no existen: " + [...assetMissing].sort().join(", "));

  if (errs.length) {
    console.log("FAIL " + f);
    errs.forEach((e) => console.log("  " + e));
    failures++;
  } else {
    console.log("ok   " + f);
  }
}

function checkAsset(url, missingSet) {
  if (!url) return;
  // rutas dinamicas (armadas con concatenacion/template) no se pueden verificar
  // estaticamente: ej.  "assets/medalla-"+name+".png"  o  '+BASE+'/x.html
  if (/[+"'`${}]/.test(url)) return;
  url = url.split("?")[0].split("#")[0];
  if (!url || url.startsWith("#") || url.startsWith("data:") || url.startsWith("mailto:") ||
      url.startsWith("tel:") || url.startsWith("javascript:") || /^https?:\/\//i.test(url) ||
      url.startsWith("//")) return;
  // solo verificamos rutas con extension de archivo (no rutas de SPA ni anclas)
  if (!/\.[a-z0-9]{2,5}$/i.test(url)) return;
  const p = url.replace(/^\.?\//, "");
  if (!fs.existsSync(p)) missingSet.add(url);
}

if (failures) {
  console.error("\n✗ " + failures + " archivo(s) con botones o assets rotos");
  process.exit(1);
}
console.log("\n✓ Smoke test OK — handlers y assets verificados");
