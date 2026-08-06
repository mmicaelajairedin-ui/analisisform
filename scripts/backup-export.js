// BACKUP AUTOMATICO — exporta las tablas importantes de Supabase a JSON.
// Pensado para correr en GitHub Actions (.github/workflows/backup.yml) porque
// el plan Free de Supabase NO tiene backups automaticos. El resultado se sube
// como "artifact" privado del repo (no se publica en ningun lado).
//
// Necesita las variables de entorno:
//   SUPABASE_URL          (ej. https://mxkljqhlwiqavbjfjfov.supabase.co)
//   SUPABASE_SERVICE_KEY  (la service_role key — secreto, NUNCA en el codigo)
//
// Correr local:  SUPABASE_URL=... SUPABASE_SERVICE_KEY=... node scripts/backup-export.js
const fs = require("fs");

const SB = process.env.SUPABASE_URL || "https://mxkljqhlwiqavbjfjfov.supabase.co";
const KEY = process.env.SUPABASE_SERVICE_KEY || "";

// Las tablas con la data irremplazable del negocio.
const TABLES = [
  "candidatos", "usuarios", "informes", "cv_publicados", "cv_express",
  "contactos_chat", "leads_pricing", "solicitudes",
  "push_subscriptions",
];

if (!KEY) { console.error("✗ Falta SUPABASE_SERVICE_KEY"); process.exit(1); }

const OUT = "backup";
fs.mkdirSync(OUT, { recursive: true });

async function fetchAll(table) {
  const headers = { apikey: KEY, Authorization: "Bearer " + KEY };
  const PAGE = 1000;
  let offset = 0, rows = [];
  for (;;) {
    const url = SB + "/rest/v1/" + table + "?select=*&order=id.asc&limit=" + PAGE + "&offset=" + offset;
    let res = await fetch(url, { headers });
    if (!res.ok && res.status === 400) {
      // tabla sin columna id -> traer sin ordenar (una sola pagina)
      res = await fetch(SB + "/rest/v1/" + table + "?select=*", { headers });
      if (!res.ok) throw new Error(table + " HTTP " + res.status + " " + (await res.text()).slice(0, 120));
      return await res.json();
    }
    if (!res.ok) throw new Error(table + " HTTP " + res.status + " " + (await res.text()).slice(0, 120));
    const page = await res.json();
    rows = rows.concat(page);
    if (page.length < PAGE) break;
    offset += PAGE;
  }
  return rows;
}

(async function () {
  const stamp = new Date().toISOString().slice(0, 10);
  let ok = 0, fail = 0; const manifest = { fecha: new Date().toISOString(), tablas: {} };
  for (const t of TABLES) {
    try {
      const rows = await fetchAll(t);
      fs.writeFileSync(OUT + "/" + t + ".json", JSON.stringify(rows, null, 2));
      manifest.tablas[t] = rows.length;
      console.log("ok   " + t + " (" + rows.length + " filas)");
      ok++;
    } catch (e) {
      manifest.tablas[t] = "ERROR: " + e.message;
      console.error("FAIL " + t + " — " + e.message);
      fail++;
    }
  }
  fs.writeFileSync(OUT + "/_manifest_" + stamp + ".json", JSON.stringify(manifest, null, 2));
  console.log("\n" + ok + " tablas OK, " + fail + " con error. Backup en ./" + OUT);
  // No fallamos por una tabla que no existe todavia; solo si fallan TODAS.
  if (ok === 0) process.exit(1);
})();
