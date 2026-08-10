// DETECCIÓN DE PATRONES ASYNC/TIMING/RACE CONDITIONS
// Propósito: Identificar patrones sospechosos de async que pueden causar bugs timing
// Nivel: REPORT ONLY (exit code 0 siempre). Nunca bloquea. Información para revisión.
//
// Patrones detectados:
//   1. Fire-and-forget fetch (no await)
//   2. Await resultado ignorado (variable no se usa luego)
//   3. Polling/sleep anti-patrón
//   4. Fetch sin realtime subscription
//   5. Catch vacío (error silenciado)
//   6. Operaciones dependientes sin sincronización
//   7. Async sin timeout
//   8. Retry logic ausente o insuficiente
//
// Ejecución: node scripts/check-async-patterns.js
// Exit code: Always 0 (report only, never a blocker)

const fs = require("fs");

function read(f) { try { return fs.readFileSync(f, "utf8"); } catch (e) { return ""; } }

const PATTERNS = [
  {
    key: "fire-and-forget",
    name: "Fire-and-forget fetch",
    severity: "PATTERN_DETECTED",
    desc: "fetch() sin await. Puede ser intencional (best-effort) o bug (resultado ignora).",
    detect: (content, file) => {
      const matches = [];
      const lines = content.split("\n");
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // Busca: fetch(...) sin await
        if (/\bfetch\s*\([^)]+\)\s*[;]/.test(line) && !/\bawait\s+fetch/.test(line) && !/Promise\.(all|race)/.test(line)) {
          matches.push({ line: i + 1, code: line.trim().substring(0, 80) });
        }
      }
      return matches.length ? matches : null;
    },
  },
  {
    key: "await-ignored",
    name: "Await result ignored",
    severity: "REVIEW_REQUIRED",
    desc: "await sync(); pero el resultado no se usa. Probable race condition.",
    detect: (content, file) => {
      const matches = [];
      // Busca: await fetch/sync/call(); variable=old
      // Pattern: línea con await, siguientes 5 líneas usan variable vieja sin re-leer
      const lines = content.split("\n");
      for (let i = 0; i < lines.length - 5; i++) {
        if (/\bawait\s+(?:fetch|sync|_sb|_sbw|api\s*\()/i.test(lines[i])) {
          // Cheq next 5 lines: ¿se usa variable que debería haberse actualizado?
          const nextLines = lines.slice(i + 1, i + 6).join("\n");
          if (/\bvar\s+\w+\s*=\s*(?:old|cached|prev|\w+\.prev)/i.test(nextLines)) {
            matches.push({ line: i + 1, code: lines[i].trim() });
          }
        }
      }
      return matches.length ? matches : null;
    },
  },
  {
    key: "polling-sync",
    name: "Polling/sync anti-pattern",
    severity: "REVIEW_REQUIRED",
    desc: "while(polling) sleep(). Timing smell, debe usar Promise/callback.",
    detect: (content, file) => {
      const matches = [];
      // Busca: while + sleep/setTimeout en la misma región
      const re = /while\s*\([^)]*(?:poll|loop|timeout|retrying)[^)]*\)\s*\{[\s\S]{0,300}(?:sleep|setTimeout|delay)/;
      const m = content.match(re);
      if (m) {
        const lineNum = content.substring(0, content.indexOf(m[0])).split("\n").length;
        matches.push({ line: lineNum, code: m[0].substring(0, 60) + "..." });
      }
      return matches.length ? matches : null;
    },
  },
  {
    key: "realtime-missing",
    name: "Fetch without realtime subscription",
    severity: "PATTERN_DETECTED",
    desc: "fetch() desde tabla Supabase pero sin .on('postgres_changes'). Datos solo al refresh.",
    detect: (content, file) => {
      // Solo reportar para files que usan realtime o fetch mucho (ignorar layouts/estilos)
      if (!/\.js|cliente\.html|panel-v2\.html|pathway-.*cliente\.html/.test(file)) return null;
      const matches = [];
      const hasFetch = /sbGet|supabase\.from/.test(content);
      const hasRealtime = /\.on\s*\(\s*['"]postgres_changes/.test(content);
      if (hasFetch && !hasRealtime && file.endsWith(".html")) {
        const lineNum = content.split("\n").findIndex(l => /sbGet|supabase\.from/.test(l));
        if (lineNum >= 0) {
          matches.push({
            line: lineNum + 1,
            code: "sbGet/supabase.from sin .on('postgres_changes')",
            risk: "Puede ser aceptable"
          });
        }
      }
      return matches.length ? matches : null;
    },
  },
  {
    key: "catch-swallowed",
    name: "Empty catch block",
    severity: "REVIEW_REQUIRED",
    desc: ".catch(()=>{}) o .catch() {}. El error se silencia, hace debug imposible.",
    detect: (content, file) => {
      const matches = [];
      // Busca: .catch(() => {}) o .catch(() => null) o .catch() {}
      const re = /\.catch\s*\(\s*(?:\(\s*\)\s*)?=>\s*\{\s*\}|\.catch\s*\(\s*\(\s*\)\s*=>\s*null\s*\)|\.catch\s*\(\s*function\s*\(\s*\)\s*\{\s*\}/g;
      let m;
      while ((m = re.exec(content))) {
        const lineNum = content.substring(0, m.index).split("\n").length;
        matches.push({ line: lineNum, code: m[0].trim() });
      }
      return matches.length ? matches : null;
    },
  },
  {
    key: "dependent-ops",
    name: "Dependent operations without sync",
    severity: "REVIEW_REQUIRED",
    desc: "op1(); op2(op1Result) donde op1 es async. Race condition probable.",
    detect: (content, file) => {
      const matches = [];
      // Busca patrón: async op, luego se usa su resultado sin await
      const lines = content.split("\n");
      for (let i = 0; i < lines.length - 2; i++) {
        // Línea con async call sin await
        if (/\b(?:fetch|api|sync|_sb|sbGet|supabase|Promise)\s*\([^)]*\)(?!.*await|then)/.test(lines[i])) {
          // Siguiente línea usa resultado
          if (/var\s+\w+\s*=\s*\w+[\.\[]|\.push|\.forEach|\.map|\.filter/.test(lines[i + 1])) {
            matches.push({ line: i + 1, code: lines[i].trim() + " → " + lines[i + 1].trim() });
          }
        }
      }
      return matches.length ? matches : null;
    },
  },
  {
    key: "timeout-absent",
    name: "Async operation without timeout",
    severity: "PATTERN_DETECTED",
    desc: "fetch/promise sin timeout. Si el servidor cuelga, el navegador espera forever.",
    detect: (content, file) => {
      const matches = [];
      // Busca: fetch sin AbortController/timeout dentro de ~20 líneas
      const lines = content.split("\n");
      for (let i = 0; i < lines.length; i++) {
        if (/\bfetch\s*\(/.test(lines[i])) {
          const nextLines = lines.slice(i, Math.min(i + 20, lines.length)).join("\n");
          if (!/AbortController|timeout|setTimeout|signal:/.test(nextLines)) {
            matches.push({ line: i + 1, code: lines[i].trim() });
          }
        }
      }
      return matches.length ? matches : null;
    },
  },
  {
    key: "retry-logic",
    name: "Retry logic absent or insufficient",
    severity: "PATTERN_DETECTED",
    desc: "Operación que puede fallar (red) sin reintentos. Un hiccup = pérdida de datos.",
    detect: (content, file) => {
      const matches = [];
      // Busca: operaciones críticas sin retry loop
      // Críticas: .patch(), .post(), .delete(), .update() a Supabase
      const re = /(?:\.patch|\.post|\.delete|\.update|_sbw)\s*\([^)]*\)(?![\s\S]{0,200}for\s*\(.*retry|while.*retry|for.*attempt)/;
      const m = content.match(re);
      if (m) {
        const lineNum = content.substring(0, content.indexOf(m[0])).split("\n").length;
        matches.push({ line: lineNum, code: m[0].substring(0, 60) + "..." });
      }
      return matches.length ? matches : null;
    },
  },
];

// ============================================================================
// RUNNER
// ============================================================================

const line = (s) => console.log(s);
let totalPatterns = 0;
let totalMatches = 0;

const htmlFiles = fs.readdirSync(".").filter((x) => x.endsWith(".html") && !/^\.|\.min/.test(x));
const jsFiles = fs.readdirSync("scripts").filter((x) => x.endsWith(".js") && !/^\.|test|\.min/.test(x));
const allFiles = [...htmlFiles, ...jsFiles.map((f) => `scripts/${f}`)];

line("═══ ASYNC/TIMING PATTERNS ═══\n");

for (const pattern of PATTERNS) {
  let any = false;
  for (const file of allFiles) {
    const content = read(file);
    if (!content || content.length < 100) continue; // Skip tiny files
    const matches = pattern.detect(content, file);
    if (matches) {
      if (!any) {
        line(`▸ ${pattern.name} [${pattern.severity}]`);
        line(`  ${pattern.desc}`);
        any = true;
      }
      totalMatches += (Array.isArray(matches) ? matches.length : 1);
      for (const m of (Array.isArray(matches) ? matches : [matches])) {
        line(`  ${pattern.severity === "REVIEW_REQUIRED" ? "⚠" : "·"} ${file}:${m.line}`);
        line(`    ${m.code}`);
        if (m.risk) line(`    ⓘ ${m.risk}`);
      }
    }
  }
  if (any) {
    totalPatterns++;
    line("");
  }
}

if (totalPatterns === 0) {
  line("✓ No async patterns detected (or no obvious timing smells)");
} else {
  line(`✓ Async patterns audit complete (${totalMatches} matches in ${totalPatterns} patterns)`);
  line("  This is a REPORT ONLY scan. No patterns are assumed to be bugs.");
  line("  Review each match and determine if it's intentional or a problem.");
}

line("");
line("ℹ Exit code: 0 (never blocks, always report)");

// Exit code is ALWAYS 0. Never a blocker.
process.exit(0);
