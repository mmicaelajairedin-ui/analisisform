// PARIDAD DE LA PLATAFORMA — la "base que se replica".
// ---------------------------------------------------------------------------
// Idea: las pantallas del mismo TIPO (familia) deben tener el mismo CABLEADO,
// y las piezas que aparecen en varias familias (chat, guardado, presencia…)
// deben respetar el MISMO CONTRATO en todas. Cuando se clona una pantalla y
// se le "cae" una pieza sin querer, o alguien rompe el contrato del chat, este
// test lo detecta.
//
// Dos niveles, para crecer SIN romper nada:
//   enforce → si falta/está mal, el test FALLA (frena el merge).
//   report  → solo se lista como hueco pendiente (no falla). A medida que
//             cerramos un hueco, lo pasamos de "report" a "enforce".
//
// Al detectar un hueco nuevo trabajando: sumarlo acá (o subir su nivel).
//
// Correr local:  node scripts/check-parity.js
const fs = require("fs");
const read = (f) => { try { return fs.readFileSync(f, "utf8"); } catch (e) { return ""; } };
const has = (s, ...res) => res.some((re) => re.test(s));

// ===========================================================================
// SPEC — la fuente de verdad de la base. Editar esto es "definir el estándar".
// ===========================================================================

// Familias: pantallas del mismo tipo que comparten cableado.
const FAMILIAS = {
  portales: {
    label: "Portal del cliente",
    // cliente.html es de otra generación (async) — se marca aparte para no
    // exigirle patrones del linaje pathway con nombres distintos.
    members: {
      "cliente.html":              { linaje: "base" },
      "pathway-fit-cliente.html":  { linaje: "pathway" },
      "pathway-fin-cliente.html":  { linaje: "pathway" },
    },
    // Cada pieza: cómo se detecta + nivel + a qué linaje aplica (opcional).
    piezas: [
      { key: "chat",       label: "Chat coach↔cliente (notas_coach)",
        level: "enforce", detect: (s) => has(s, /notas_coach/) },
      { key: "subGate",    label: "Gate de suscripción vigente",
        level: "enforce", detect: (s) => has(s, /pwSubGate/) },
      { key: "consent",    label: "Gate de consentimiento",
        level: "report",  linaje: "pathway", detect: (s) => has(s, /pwConsentGate/) },
      { key: "presencia",  label: "Presencia (latido + coach en línea)",
        level: "report",  detect: (s) => has(s, /pwBeat|refreshCoachPresence/) },
      { key: "informe",    label: "Carga del informe/diagnóstico de IA",
        level: "report",  detect: (s) => has(s, /sbGet\(\s*['"]informes|applyInforme|from\s*['"]informes|rest\/v1\/informes/) },
    ],
  },
};

// Contratos transversales: piezas que viven en varias familias y DEBEN verse
// igual en todas para poder interoperar. El chat es el caso testigo.
const CONTRATOS = [
  {
    key: "chat",
    label: "Contrato del chat coach↔cliente",
    // Aplica a toda pantalla que use notas_coach como hilo de mensajes.
    aplicaA: (f, s) => has(s, /notas_coach/) && has(s, /from\s*:/),
    // Reglas que el mensaje debe cumplir (vocabulario compartido).
    check(f, s) {
      const errs = [];
      // 1) el emisor se llama `from` con valores 'coach' | 'cliente'
      if (!has(s, /from\s*:\s*['"](coach|cliente)['"]/))
        errs.push("no usa from:'coach'|'cliente' (vocabulario del chat)");
      // 2) anti-drift: no colar variantes en inglés / otras claves de emisor
      if (has(s, /from\s*:\s*['"](client|user|me)['"]/))
        errs.push("usa un valor de `from` fuera del contrato (client/user/me)");
      if (has(s, /\bsender\s*:\s*['"]/))
        errs.push("usa `sender:` en vez de `from:` para el emisor");
      return errs;
    },
  },
];

// ===========================================================================
// RUNNER
// ===========================================================================
let failed = false;
const line = (s) => console.log(s);

line("═══ PARIDAD DE FAMILIAS ═══\n");
for (const [famKey, fam] of Object.entries(FAMILIAS)) {
  line(`▸ ${fam.label} (${famKey})`);
  const files = Object.keys(fam.members);
  // Cabecera de tabla
  const cols = fam.piezas.map((p) => p.key);
  line("  " + "archivo".padEnd(30) + cols.map((c) => c.padEnd(11)).join(""));
  for (const f of files) {
    const s = read(f);
    const linaje = fam.members[f].linaje;
    const cells = fam.piezas.map((p) => {
      if (p.linaje && p.linaje !== linaje) return "—".padEnd(11); // no aplica
      const ok = s ? p.detect(s) : false;
      if (!ok && p.level === "enforce") failed = true;
      return (ok ? "✓" : (p.level === "enforce" ? "✗FALTA" : "·falta")).padEnd(11);
    });
    line("  " + f.padEnd(30) + cells.join(""));
  }
  // Detalle de huecos "report" (informativo)
  const huecos = [];
  for (const f of files) {
    const s = read(f); const linaje = fam.members[f].linaje;
    for (const p of fam.piezas) {
      if (p.level === "enforce") continue;
      if (p.linaje && p.linaje !== linaje) continue;
      if (s && !p.detect(s)) huecos.push(`${f} → falta ${p.label}`);
    }
  }
  if (huecos.length) { line("  huecos pendientes (report):"); huecos.forEach((h) => line("    · " + h)); }
  line("");
}

line("═══ CONTRATOS TRANSVERSALES ═══\n");
const htmlFiles = fs.readdirSync(".").filter((x) => x.endsWith(".html"));
for (const c of CONTRATOS) {
  line(`▸ ${c.label} (${c.key})`);
  let any = false;
  for (const f of htmlFiles) {
    const s = read(f);
    if (!c.aplicaA(f, s)) continue;
    any = true;
    const errs = c.check(f, s);
    if (errs.length) { failed = true; errs.forEach((e) => line(`  ✗ ${f}: ${e}`)); }
    else line(`  ✓ ${f}`);
  }
  if (!any) line("  (ninguna pantalla usa este contrato todavía)");
  line("");
}

if (failed) {
  line("✗ Paridad: hay piezas 'enforce' faltantes o contratos rotos (ver arriba).");
  process.exit(1);
} else {
  line("✓ Paridad OK — cableado 'enforce' presente y contratos respetados.");
}
