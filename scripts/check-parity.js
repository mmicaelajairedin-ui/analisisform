// PARIDAD DE LA PLATAFORMA — la "base que se replica".
// ---------------------------------------------------------------------------
// Idea: las pantallas del mismo TIPO (familia) deben tener el mismo CABLEADO,
// y las piezas que aparecen en varias familias (chat, guardado, presencia…)
// deben respetar el MISMO CONTRATO en todas. Cuando se clona una pantalla y
// se le "cae" una pieza sin querer, o alguien rompe el contrato del chat, este
// test lo detecta. También sirve de GUÍA: al construir un producto nuevo,
// muestra qué cableado falta para que nazca sobre la base y no como isla.
//
// Dos niveles, para crecer SIN romper nada:
//   enforce → si falta/está mal, el test FALLA (frena el merge).
//   report  → solo se lista como hueco pendiente (no falla). A medida que
//             cerramos un hueco, lo pasamos de "report" a "enforce".
//
// Correr local:  node scripts/check-parity.js
const fs = require("fs");
const read = (f) => { try { return fs.readFileSync(f, "utf8"); } catch (e) { return ""; } };
const has = (s, ...res) => res.some((re) => re.test(s));

// ===========================================================================
// SPEC — la fuente de verdad de la base. Editar esto es "definir el estándar".
// ===========================================================================

const FAMILIAS = {
  // -------- PORTALES DEL CLIENTE (coaching: carrera + nichos) --------
  portales: {
    label: "Portal del cliente (coaching)",
    members: {
      "cliente.html":              { linaje: "base" },   // carrera (async, gen. vieja)
      "pathway-fit-cliente.html":  { linaje: "pathway" },
      "pathway-fin-cliente.html":  { linaje: "pathway" },
    },
    piezas: [
      { key: "chat",      label: "Chat coach↔cliente (notas_coach)",
        level: "enforce", detect: (s) => has(s, /notas_coach/) },
      { key: "subGate",   label: "Gate de suscripción vigente",
        level: "enforce", detect: (s) => has(s, /pwSubGate/) },
      { key: "consent",   label: "Gate de consentimiento",
        level: "report",  linaje: "pathway", detect: (s) => has(s, /pwConsentGate/) },
      { key: "presencia", label: "Presencia (latido + coach en línea)",
        level: "report",  detect: (s) => has(s, /pwBeat|refreshCoachPresence/) },
      { key: "informe",   label: "Carga del informe/diagnóstico de IA",
        level: "report",  detect: (s) => has(s, /sbGet\(\s*['"]informes|applyInforme|rest\/v1\/informes/) },
    ],
  },

  // -------- PANELES DEL COACH (panel-v2 = referencia; empresa = nuevo B2B) --
  paneles: {
    label: "Panel del coach",
    members: {
      "panel-v2.html":       { linaje: "core" },      // carrera + fit + fin (multi-nicho)
      "panel-empresa.html":  { linaje: "empresa" },   // producto B2B nuevo (aún maqueta)
    },
    // Todo en 'report': es la GUÍA de cableado del producto nuevo, no un gate.
    piezas: [
      { key: "datosReales", label: "Conectado a datos reales (no maqueta)",
        level: "report", detect: (s) => has(s, /fetch\(\s*SB|rest\/v1|PWAUTH/) },
      { key: "pwAuth",      label: "Auth por pw-auth.js (fuente única de clave)",
        level: "report", detect: (s) => has(s, /pw-auth\.js/) },
      { key: "aislamiento", label: "Aislamiento multi-tenant (coach/empresa)",
        level: "report", detect: (s) => has(s, /candFilter|coachGuard|empresaGuard|empresa_id=eq|coach_id=eq/) },
      { key: "chat",        label: "Chat contrato notas_coach",
        level: "report", detect: (s) => has(s, /notas_coach/) },
      { key: "presencia",   label: "Presencia (coach/cliente en línea)",
        level: "report", detect: (s) => has(s, /pwBeat|refreshCoachPresence|last_seen/) },
      { key: "medalla",     label: "Medalla + foto + progreso",
        level: "report", detect: (s) => has(s, /cp-client-medal|cp-cli-medalbadge|medalla/) },
    ],
  },

  // -------- FORMULARIOS DE INTAKE --------
  formularios: {
    label: "Formulario de intake",
    members: {
      "formulario.html":        { linaje: "base" },
      "pathway-fit-form.html":  { linaje: "pathway" },
      "pathway-fin-form.html":  { linaje: "pathway" },
    },
    piezas: [
      { key: "stepEngine", label: "Motor de pasos",
        level: "report", detect: (s) => has(s, /data-step|validateStep/) },
      { key: "draft",      label: "Autoguardado/retomar (draft)",
        level: "report", detect: (s) => has(s, /saveDraft|restoreDraft/) },
      { key: "intakeSave", label: "Guardado del intake (candidatos)",
        level: "report", detect: (s) => has(s, /guardar-intake|rest\/v1\/candidatos/) },
      { key: "coachBrand", label: "Branding del coach (link con &coach=)",
        level: "report", detect: (s) => has(s, /_fetchCoach|_applyCoachBrand|applyBrand/) },
    ],
  },

  // -------- EDITORES DE DOCUMENTO (herramientas del cliente) --------
  editores: {
    label: "Editor de documento",
    members: {
      "cv.html":         { linaje: "doc" },
      "carta.html":      { linaje: "doc" },
      "cv-express.html": { linaje: "doc" },
      "cv-ats.html":     { linaje: "doc" },
    },
    piezas: [
      { key: "supaSave",  label: "Guardado a Supabase",
        level: "report", detect: (s) => has(s, /rest\/v1|sbUpsert|fetch\(\s*SB/) },
      { key: "pwAuth",    label: "Auth por pw-auth.js",
        level: "report", detect: (s) => has(s, /pw-auth\.js/) },
      { key: "pwObserve", label: "Observabilidad (pw-observe.js)",
        level: "report", detect: (s) => has(s, /pw-observe\.js/) },
    ],
  },
};

// Pantallas internas / fuera de familias de producto (no se les exige paridad).
const FUERA_DE_PARIDAD = {
  "empleado.html": "Team interno de Pathway (leads/comisión) — no es producto de coaching",
};

// Extrae el cuerpo de una función por nombre (function X(){}, X=function(),
// window.X=function()) por matching de llaves. Para chequear el CÓMO, no solo
// el SI-existe.
function fnBody(src, name) {
  let m = new RegExp("function\\s+" + name + "\\s*\\(").exec(src);
  if (!m) m = new RegExp("(?:window\\.)?" + name + "\\s*=\\s*function\\s*\\(").exec(src);
  if (!m) return null;
  let i = src.indexOf("{", m.index); if (i < 0) return null;
  let depth = 1; i++;
  while (i < src.length && depth > 0) { const c = src[i]; if (c === "{") depth++; else if (c === "}") depth--; i++; }
  return src.slice(m.index, i);
}

// INVARIANTES — el CABLEADO no solo tiene que existir, tiene que estar BIEN.
// Detecta el caso "la pieza está pero implementada mal/insegura", que la matriz
// de presencia no ve. Cada invariante que hoy se cumple queda CONGELADO: si un
// clon futuro lo rompe, el test falla.
const INVARIANTES = [
  {
    key: "chat-merge-safe",
    label: "Chat: re-lee antes de escribir (no pisa a la otra punta)",
    porque: "Si al enviar se escribe notas_coach sin re-leer, se sobreescriben " +
            "los mensajes que puso el coach (o el cliente) desde la otra punta.",
    level: "enforce",
    aplicaA: (s) => /notas_coach\s*:\s*JSON\.stringify|\{\s*notas_coach\s*:/.test(s),
    check: (s) => /select=notas_coach/.test(s) ? null
      : "escribe notas_coach sin re-leer antes (select=notas_coach) → puede pisar mensajes",
  },
  {
    key: "chat-escape",
    label: "Chat: escapa el texto del mensaje al render (anti-XSS)",
    porque: "el texto del mensaje se mete en el DOM; si se concatena crudo (sin " +
            "esc()/hh()) un mensaje con HTML puede inyectar código.",
    level: "enforce",
    // Aplica a cualquier pantalla de chat que renderice el texto del mensaje.
    aplicaA: (s) => /notas_coach/.test(s) && /m\.text/.test(s),
    // Anti-patrón: m.text concatenado directo a un string (…+m.text / m.text+…).
    // Un render escapado usa esc(m.text) o hh(m.text), nunca +m.text crudo.
    check: (s) => (/\+\s*m\.text/.test(s) || /m\.text\s*\+/.test(s))
      ? "renderiza m.text crudo (concatenado sin esc()/hh()) → riesgo XSS" : null,
  },
  {
    key: "auth-expiry",
    label: "Datos: maneja sesión vencida (401/403 → login)",
    porque: "Si sbGet no detecta 401/403, un token vencido muestra el portal " +
            "vacío/roto en vez de mandar a login.",
    level: "enforce",
    aplicaA: (s) => fnBody(s, "sbGet") != null,
    check: (s) => /_authExpired|401|403/.test(fnBody(s, "sbGet") || "") ? null
      : "sbGet no maneja 401/403 (sesión vencida)",
  },
  {
    key: "chat-dedup",
    label: "Chat: clave de deduplicación canónica (from|text|ts)",
    porque: "Los dos lados mergean por _mkey; si la clave cambia, los mensajes " +
            "se duplican o no se emparejan.",
    level: "enforce",
    aplicaA: (s) => fnBody(s, "_mkey") != null,
    check: (s) => { const b = fnBody(s, "_mkey") || ""; return (/from/.test(b) && /text/.test(b) && /ts|time/.test(b)) ? null
      : "_mkey no usa la clave canónica from|text|ts"; },
  },
];

// Contratos transversales: piezas que viven en varias familias y DEBEN verse
// igual en todas para poder interoperar. El chat es el caso testigo.
const CONTRATOS = [
  {
    key: "chat",
    label: "Contrato del chat coach↔cliente",
    aplicaA: (f, s) => has(s, /notas_coach/) && has(s, /from\s*:/),
    check(f, s) {
      const errs = [];
      if (!has(s, /from\s*:\s*['"](coach|cliente)['"]/))
        errs.push("no usa from:'coach'|'cliente' (vocabulario del chat)");
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
  const cols = fam.piezas.map((p) => p.key);
  line("  " + "archivo".padEnd(28) + cols.map((c) => c.padEnd(13)).join(""));
  for (const f of files) {
    const s = read(f);
    const linaje = fam.members[f].linaje;
    const cells = fam.piezas.map((p) => {
      if (p.linaje && p.linaje !== linaje) return "—".padEnd(13);
      const ok = s ? p.detect(s) : false;
      if (!ok && p.level === "enforce") failed = true;
      return (ok ? "✓" : (p.level === "enforce" ? "✗FALTA" : "·falta")).padEnd(13);
    });
    line("  " + f.padEnd(28) + cells.join(""));
  }
  line("");
}

if (Object.keys(FUERA_DE_PARIDAD).length) {
  line("▸ Fuera de paridad (internas / otra naturaleza)");
  for (const [f, why] of Object.entries(FUERA_DE_PARIDAD)) line(`  · ${f} — ${why}`);
  line("");
}

const htmlFiles = fs.readdirSync(".").filter((x) => x.endsWith(".html"));

line("═══ INVARIANTES DE CABLEADO (detección de errores) ═══\n");
for (const inv of INVARIANTES) {
  line(`▸ ${inv.label} (${inv.key})`);
  let any = false;
  for (const f of htmlFiles) {
    const s = read(f);
    if (!inv.aplicaA(s)) continue;
    any = true;
    const err = inv.check(s);
    if (err) { if (inv.level === "enforce") failed = true; line(`  ${inv.level === "enforce" ? "✗" : "·"} ${f}: ${err}`); }
    else line(`  ✓ ${f}`);
  }
  if (!any) line("  (ninguna pantalla usa esta pieza todavía)");
  line("");
}

line("═══ CONTRATOS TRANSVERSALES ═══\n");
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
  line("✓ Paridad OK — cableado presente, invariantes cumplidos, contratos respetados.");
  line("  (los '·falta' son huecos 'report': guía de lo que falta cablear, no rompen el CI)");
}
