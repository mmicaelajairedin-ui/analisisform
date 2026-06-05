// Chequeo de sintaxis JS de todos los .html del repo. Si algún <script> inline
// tiene un error de sintaxis (lo que rompería la página entera para TODOS los
// usuarios), este script falla → el workflow bloquea el merge.
// Correr local:  node scripts/check-syntax.js
const fs = require("fs"), vm = require("vm");
const files = fs.readdirSync(".").filter((f) => f.endsWith(".html")).sort();
let bad = 0;
for (const f of files) {
  const html = fs.readFileSync(f, "utf8");
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let m, n = 0; const errs = [];
  while ((m = re.exec(html))) {
    const attrs = m[1] || "", code = m[2] || "";
    if (/\bsrc\s*=/.test(attrs)) continue;                 // script externo
    // Solo validamos scripts que son JS de verdad. Cualquier type "raro"
    // (application/json, ld+json, __bundler/manifest, text/template…) es data, no JS.
    const tm = attrs.match(/\btype\s*=\s*["']?([^"'\s>]+)/i);
    const type = tm ? tm[1].toLowerCase() : "";
    const isJs = !type || type === "text/javascript" || type === "application/javascript" || type === "module" || type === "text/ecmascript";
    if (!isJs) continue;
    if (!code.trim()) continue;
    n++;
    try { new vm.Script(code, { filename: f + " #" + n }); }
    catch (e) { errs.push("  bloque " + n + ": " + String(e.message).split("\n")[0]); }
  }
  if (errs.length) { console.log("FAIL " + f); errs.forEach((x) => console.log(x)); bad++; }
  else console.log("ok   " + f + " (" + n + " scripts)");
}
if (bad) { console.error("\n✗ " + bad + " archivo(s) con error de sintaxis JS"); process.exit(1); }
console.log("\n✓ Todos los .html con JS válido");
