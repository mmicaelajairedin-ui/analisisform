// BACKUP AUTOMATICO — exporta las tablas importantes de Supabase a JSON.
// Pensado para correr en GitHub Actions (.github/workflows/backup.yml) porque
// el plan Free de Supabase NO tiene backups automaticos. El resultado se sube
// como "artifact" privado del repo (no se publica en ningun lado).
//
// Necesita las variables de entorno:
//   SUPABASE_URL          (ej. https://ddxnrsnjdvtqhxunxnwj.supabase.co)
//   SUPABASE_SERVICE_KEY  (la service_role key — secreto, NUNCA en el codigo)
//
// Correr local:  SUPABASE_URL=... SUPABASE_SERVICE_KEY=... node scripts/backup-export.js
const fs = require("fs");

const SB = process.env.SUPABASE_URL || "https://ddxnrsnjdvtqhxunxnwj.supabase.co";
const KEY = process.env.SUPABASE_SERVICE_KEY || "";

// Las tablas con la data irremplazable del negocio.
const TABLES = [
  "candidatos", "usuarios", "informes", "cv_publicados", "cv_express",
  "contactos_chat", "leads_pricing", "solicitudes",
  "push_subscriptions",
];

// El NUCLEO: si una de estas vuelve VACIA, no hay backup, por muy verde que
// salga el job. Las demas pueden estar legitimamente a cero —push_subscriptions
// lleva 0 filas desde siempre— y por eso no todas cuentan. Esto distingue
// "no hay datos que guardar" de "no he podido leer los datos".
const NUCLEO = ["candidatos", "usuarios"];

if (!KEY) { console.error("✗ Falta SUPABASE_SERVICE_KEY"); process.exit(1); }

// La credencial se comprueba ANTES de pedir nada. El backup nocturno de al lado
// —ya borrado— llevaba 14 noches devolviendo 401 en sus cuatro tablas y subiendo
// igualmente un artifact de 1 KB con nombre de backup valido, porque su clave
// tenia el project-ref FALSIFICADO (terminado en nwl en vez de nwj). Un
// validador que compara cadenas no lo habria visto: el ref viaja en base64
// DENTRO del JWT. Aqui se decodifica, y la clave no se imprime nunca.
(function comprobarCredencial() {
  const esperado = (SB.match(/^https:\/\/([^.]+)\./) || [])[1] || "";
  const partes = KEY.split(".");
  if (partes.length !== 3) {
    // Las claves nuevas de Supabase (sb_secret_...) no son JWT y no llevan el
    // ref dentro: no se puede comprobar asi, y no es un error.
    console.log("i    la credencial no es un JWT: no se puede comprobar el ref. Esperado: " + esperado);
    return;
  }
  let payload;
  try {
    const b64 = partes[1].replace(/-/g, "+").replace(/_/g, "/");
    payload = JSON.parse(Buffer.from(b64 + "=".repeat((4 - b64.length % 4) % 4), "base64").toString("utf-8"));
  } catch (e) {
    console.error("✗ no se pudo decodificar el payload del JWT: " + e.message);
    process.exit(1);
  }
  if (payload.ref !== esperado) {
    console.error("✗ la credencial apunta al proyecto '" + payload.ref + "' y no a '" + esperado + "'");
    process.exit(1);
  }
  if (payload.role !== "service_role") {
    console.error("✗ la credencial tiene rol '" + payload.role + "'. Un backup necesita service_role: " +
      "con anon la RLS deja tablas como 'usuarios' en CERO filas y el backup saldria vacio sin avisar");
    process.exit(1);
  }
  console.log("ok   credencial: service_role de " + payload.ref);
})();

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

  // Se sigue sin fallar por una tabla que no existe todavia —esa tolerancia es
  // deliberada y no se toca—, pero el NUCLEO se comprueba aparte: un backup en
  // el que 'candidatos' o 'usuarios' vuelven vacias o con error no es un backup,
  // y hasta ahora salia en verde porque `ok` era mayor que cero.
  const rotas = NUCLEO.filter((t) => typeof manifest.tablas[t] !== "number");
  const vacias = NUCLEO.filter((t) => manifest.tablas[t] === 0);
  if (rotas.length || vacias.length) {
    if (rotas.length) console.error("✗ tabla(s) del nucleo con error: " + rotas.join(", "));
    if (vacias.length) console.error("✗ tabla(s) del nucleo VACIAS: " + vacias.join(", ") +
      " — un backup sin filas no es un backup");
    process.exit(1);
  }

  // No fallamos por una tabla que no existe todavia; solo si fallan TODAS.
  if (ok === 0) process.exit(1);
})();
