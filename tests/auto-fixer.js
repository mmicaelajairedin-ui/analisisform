/**
 * AUTO-FIXER: Clasificador y reparador automático de fallos
 *
 * 1. Lee los resultados de tests
 * 2. Clasifica cada fallo como SIMPLE o COMPLEJO
 * 3. Para fallos simples: llama a Claude API para generar el fix
 * 4. Aplica los fixes SOLO si están en la lista blanca, y los revalida:
 *    rojo antes → verde después → sin regresiones → un solo fichero.
 *    Ante cualquier duda, revierte y NO crea PR.
 * 5. Genera un reporte de lo que arregló y lo que necesita revisión manual
 *
 * Uso: node tests/auto-fixer.js
 */

const fs = require('fs');
const path = require('path');

const RESULTS_FILE = path.join(__dirname, 'results', 'test-results.json');
const FIXES_FILE = path.join(__dirname, 'results', 'fixes-applied.json');
const PENDING_FILE = path.join(__dirname, 'results', 'pending-issues.json');

// ─── Clasificación de fallos ───────────────────────────────────

const SIMPLE_PATTERNS = [
  { pattern: /toBeVisible/, category: 'ui-visibility', desc: 'Elemento de UI no visible' },
  { pattern: /toHaveText/, category: 'text-content', desc: 'Texto incorrecto o cambiado' },
  { pattern: /toHaveTitle/, category: 'text-content', desc: 'Título de página incorrecto' },
  { pattern: /toHaveClass/, category: 'css-class', desc: 'Clase CSS faltante o incorrecta' },
  { pattern: /toHaveValue/, category: 'form-value', desc: 'Valor de formulario incorrecto' },
  { pattern: /toHaveAttribute/, category: 'html-attr', desc: 'Atributo HTML faltante' },
  { pattern: /toBeDisabled|toBeEnabled/, category: 'form-state', desc: 'Estado de elemento incorrecto' },
  { pattern: /fonts\.googleapis/, category: 'resource-load', desc: 'Error cargando fuente' },
  { pattern: /emailjs/, category: 'resource-load', desc: 'Error cargando EmailJS' },
  { pattern: /style\.width|boundingBox|maxWidth/, category: 'css-layout', desc: 'Problema de layout/CSS' },
];

const COMPLEX_PATTERNS = [
  { pattern: /status\(\).*(?:500|502|503)/, category: 'server-error', desc: 'Error del servidor' },
  { pattern: /net::ERR_CONNECTION_REFUSED/, category: 'connectivity', desc: 'Servicio no disponible' },
  { pattern: /supabase|rest\/v1/, category: 'database', desc: 'Error de base de datos' },
  { pattern: /anthropic|claude|ai\.js/, category: 'ai-service', desc: 'Error del servicio de IA' },
  { pattern: /localStorage|sessionStorage/, category: 'auth', desc: 'Error de autenticación/sesión' },
  { pattern: /hashPassword|login|entrar/, category: 'auth', desc: 'Error en flujo de login' },
  { pattern: /CORS|Access-Control/, category: 'cors', desc: 'Error de CORS' },
  { pattern: /timeout|Timeout|Navigation/, category: 'performance', desc: 'Problema de rendimiento' },
];

function classifyFailure(failure) {
  const errorText = failure.error || '';

  // Primero verificar si es complejo
  for (const { pattern, category, desc } of COMPLEX_PATTERNS) {
    if (pattern.test(errorText)) {
      return { type: 'complex', category, desc };
    }
  }

  // Luego verificar si es simple
  for (const { pattern, category, desc } of SIMPLE_PATTERNS) {
    if (pattern.test(errorText)) {
      return { type: 'simple', category, desc };
    }
  }

  // Si el error es sobre status 200 (página no carga) → puede ser simple o complejo
  if (/status\(\).*200/.test(errorText) || /toBe\(200\)/.test(errorText)) {
    return { type: 'complex', category: 'page-down', desc: 'Página no responde correctamente' };
  }

  // Por defecto, clasificar como complejo (más seguro)
  return { type: 'complex', category: 'unknown', desc: 'Error no clasificado' };
}

// ─── Mapeo de archivos afectados ───────────────────────────────

function getAffectedFile(failure) {
  const testFile = failure.file || '';
  const error = failure.error || '';
  const name = failure.name || '';
  const suite = failure.suite || '';

  // Mapear test suite/name a archivo de la plataforma
  const fileMap = {
    'formulario.html': /formulario|form|index|idioma|lang|progreso|consent/i,
    'login.html': /login|autenticación|auth|credential|password/i,
    'panel-v2.html': /panel|dashboard|sidebar|coach|candidat/i,
    'cliente.html': /cliente|client|portal/i,
    'cv.html': /cv|currículum|resume/i,
    'carta.html': /carta|cover letter/i,
    'hub.html': /hub|conexion/i,
  };

  const context = `${name} ${suite} ${error}`;
  for (const [file, pattern] of Object.entries(fileMap)) {
    if (pattern.test(context)) return file;
  }

  return null;
}

// ─── Generación de fix con Claude API ──────────────────────────

async function generateFix(failure, classification, fileContent) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.log('⚠️  ANTHROPIC_API_KEY no configurada — no se pueden generar fixes automáticos');
    return null;
  }

  const prompt = `Eres un asistente de reparación de código. Analiza este fallo de test E2E en una plataforma web (HTML/CSS/JS vanilla) y genera SOLO el fix mínimo necesario.

FALLO DEL TEST:
- Nombre: ${failure.name}
- Suite: ${failure.suite}
- Categoría: ${classification.category} (${classification.desc})
- Error: ${failure.error}

ARCHIVO AFECTADO:
\`\`\`html
${fileContent.substring(0, 4000)}
\`\`\`

INSTRUCCIONES:
1. Identifica la causa exacta del fallo
2. Genera SOLO el cambio mínimo necesario (no reescribas todo el archivo)
3. Responde en JSON con este formato exacto:

{
  "can_fix": true/false,
  "explanation": "Explicación breve en español de qué estaba mal y qué se corrigió",
  "search": "texto exacto a buscar en el archivo (string literal, no regex)",
  "replace": "texto de reemplazo"
}

Si el problema NO se puede arreglar con un cambio simple en el archivo (ej: es un problema de servidor, API externa, o requiere cambios en múltiples archivos), responde:
{
  "can_fix": false,
  "explanation": "Razón por la que no se puede arreglar automáticamente"
}

IMPORTANTE: El "search" debe ser un string EXACTO que exista en el archivo. No uses regex.`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      console.log(`⚠️  Error API Claude: ${response.status}`);
      return null;
    }

    const data = await response.json();
    const text = data.content?.[0]?.text || '';

    // Extraer JSON de la respuesta
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    return JSON.parse(jsonMatch[0]);
  } catch (err) {
    console.log(`⚠️  Error llamando a Claude API: ${err.message}`);
    return null;
  }
}

// ─── LISTA BLANCA DE REPARACIÓN AUTOMÁTICA ──────────────────────
//
// Un patrón entra aquí SOLO tras demostrar rojo-antes y verde-después, y con
// autorización explícita. Empezó vacía; hoy tiene exactamente uno.
//
// Todo lo que no esté aquí NO se repara: va a pending-issues.json y espera una
// decisión humana. Añadir un patrón es una decisión, no un ajuste.
const WHITELIST = [
  {
    patron: /toHaveTitle/,
    categoria: 'text-content',
    descripcion: 'Título de página incorrecto',
    ficheros: ['formulario.html', 'login.html', 'panel-v2.html', 'cliente.html',
               'cv.html', 'carta.html', 'hub.html'],
  },
];

function enListaBlanca(failure, fichero) {
  const texto = failure.error || '';
  for (const regla of WHITELIST) {
    if (regla.patron.test(texto) && regla.ficheros.includes(fichero)) return regla;
  }
  return null;
}

// El parche tiene que tocar el TÍTULO y nada más. Se comprueba sobre el propio
// search/replace, no sobre la intención que declare el modelo.
const VETADO = /<script|supabase|apikey|api_key|authorization|bearer|fetch\s*\(|import\s|require\s*\(|localStorage|password|token/i;

function soloCambiaElTitulo(fix) {
  const s = String(fix.search || '');
  const r = String(fix.replace || '');
  if (!s || !r) return { ok: false, motivo: 'parche vacío' };
  if (VETADO.test(s) || VETADO.test(r)) return { ok: false, motivo: 'el parche toca zonas vetadas' };
  const esTitulo = (t) => /<title[^>]*>[\s\S]*<\/title>/i.test(t) || /document\.title\s*=/.test(t);
  if (!esTitulo(s) || !esTitulo(r)) return { ok: false, motivo: 'el parche no se limita al título' };
  if (s.split('\n').length > 3 || r.split('\n').length > 3) {
    return { ok: false, motivo: 'el parche abarca demasiadas líneas' };
  }
  return { ok: true };
}

// ─── EJECUCIÓN REAL DE TESTS ────────────────────────────────────
//
// FALLA CERRADA: si un test no se puede ejecutar, cuenta como FALLO y se revierte.
// Sin esta regla, una batería que descubre 0 tests daría "verde" y aprobaría
// cualquier reparación — que es exactamente el estado del agente el 2026-08-21,
// cuando reportó "healthy" con total: 0.
const { spawnSync } = require('child_process');

function contarTests(json) {
  let n = 0;
  const rec = (suites) => {
    for (const s of suites || []) { n += (s.specs || []).length; rec(s.suites); }
  };
  rec(json.suites);
  return n;
}

function correrPlaywright(grep) {
  const args = ['playwright', 'test', '--reporter=json'];
  if (grep) args.push('--grep', grep);
  const r = spawnSync('npx', args, {
    encoding: 'utf-8', maxBuffer: 64 * 1024 * 1024, timeout: 10 * 60 * 1000,
  });
  const salida = r.stdout || '';
  const i = salida.indexOf('{');
  let json = null;
  try { if (i >= 0) json = JSON.parse(salida.slice(i)); } catch (e) { /* se trata abajo */ }

  if (!json) return { estado: 'inejecutable', motivo: 'la salida de Playwright no es JSON legible' };
  const total = contarTests(json);
  if (total === 0) return { estado: 'inejecutable', motivo: '0 tests descubiertos' };

  const fallidos = parseFailures(json).map((f) => f.name);
  return { estado: fallidos.length ? 'rojo' : 'verde', fallidos, total };
}

// --grep interpreta expresión regular: el nombre del test se escapa.
const paraGrep = (nombre) => String(nombre).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// ¿Hay algún fichero modificado que no sea el que se acaba de reparar?
// Cierra el hueco entre lo que el reparador escribe y lo que el workflow commitea.
function otrosFicherosTocados(esperado) {
  const r = spawnSync('git', ['status', '--porcelain'], { encoding: 'utf-8' });
  if (r.status !== 0) return ['<git status falló>'];
  return (r.stdout || '')
    .split('\n')
    .map((l) => l.slice(3).trim())
    .filter(Boolean)
    .filter((f) => f !== esperado && !f.startsWith('tests/results/'));
}

// ─── REVALIDACIÓN OBLIGATORIA ───────────────────────────────────
//
// Ningún parche llega al PR sin haber demostrado, en este orden:
//   rojo antes → verde después → sin regresiones → un solo fichero.
// Si algo no se puede comprobar, se revierte. Que compile no es que funcione (R-18).
function revalidar({ failure, fichero, rutaCompleta, originalEnMemoria, fallidosPrevios }) {
  const revertir = () => fs.writeFileSync(rutaCompleta, originalEnMemoria, 'utf-8');
  const grep = paraGrep(failure.name);

  const despues = correrPlaywright(grep);
  if (despues.estado !== 'verde') {
    revertir();
    return { ok: false, fase: 'verde-despues',
      motivo: despues.motivo || `el test sigue fallando tras el parche (${despues.estado})` };
  }

  const regresion = correrPlaywright(null);
  if (regresion.estado === 'inejecutable') {
    revertir();
    return { ok: false, fase: 'regresion', motivo: `no se pudo verificar la regresión: ${regresion.motivo}` };
  }
  const nuevos = (regresion.fallidos || []).filter((n) => !fallidosPrevios.includes(n));
  if (nuevos.length) {
    revertir();
    return { ok: false, fase: 'regresion', motivo: `regresión nueva: ${nuevos.slice(0, 3).join(' · ')}` };
  }

  const otros = otrosFicherosTocados(fichero);
  if (otros.length) {
    revertir();
    return { ok: false, fase: 'aislamiento', motivo: `hay otros ficheros modificados: ${otros.join(', ')}` };
  }

  return { ok: true, evidencia: { regresion_total: regresion.total, regresion_fallidos: regresion.fallidos.length } };
}

// ─── Aplicar fix al archivo ────────────────────────────────────

function applyFix(filePath, fix) {
  try {
    const fullPath = path.join(process.cwd(), filePath);
    if (!fs.existsSync(fullPath)) {
      return { success: false, reason: `Archivo ${filePath} no encontrado` };
    }

    let content = fs.readFileSync(fullPath, 'utf-8');

    if (!content.includes(fix.search)) {
      return { success: false, reason: 'Texto a buscar no encontrado en el archivo' };
    }

    // Verificar que el reemplazo es diferente
    if (fix.search === fix.replace) {
      return { success: false, reason: 'El fix no cambia nada' };
    }

    content = content.replace(fix.search, fix.replace);
    fs.writeFileSync(fullPath, content, 'utf-8');

    return { success: true };
  } catch (err) {
    return { success: false, reason: err.message };
  }
}

// ─── Parsear resultados de tests ───────────────────────────────

function parseFailures(results) {
  const failures = [];

  function processSpecs(specs, suiteName) {
    for (const spec of specs) {
      for (const test of (spec.tests || [])) {
        const status = test.status || test.expectedStatus;
        if (status === 'unexpected' || status === 'failed') {
          failures.push({
            suite: suiteName,
            name: spec.title,
            error: (test.results?.[0]?.error?.message || 'Error desconocido').substring(0, 500),
            file: spec.file,
          });
        }
      }
    }
  }

  function processSuites(suiteList, parentName = '') {
    for (const suite of suiteList) {
      const suiteName = parentName ? `${parentName} > ${suite.title}` : suite.title;
      if (suite.specs) processSpecs(suite.specs, suiteName);
      if (suite.suites) processSuites(suite.suites, suiteName);
    }
  }

  processSuites(results.suites || []);
  return failures;
}

// ─── Main ──────────────────────────────────────────────────────

async function main() {
  console.log('🔧 Auto-Fixer: Analizando fallos...\n');

  // Leer resultados
  if (!fs.existsSync(RESULTS_FILE)) {
    console.log('No se encontraron resultados de tests.');
    process.exit(0);
  }

  const results = JSON.parse(fs.readFileSync(RESULTS_FILE, 'utf-8'));
  const failures = parseFailures(results);

  if (failures.length === 0) {
    console.log('✅ No hay fallos que reparar.');
    const outputDir = path.join(__dirname, 'results');
    fs.writeFileSync(FIXES_FILE, JSON.stringify([], null, 2));
    fs.writeFileSync(PENDING_FILE, JSON.stringify([], null, 2));
    process.exit(0);
  }

  console.log(`📋 ${failures.length} fallo(s) encontrados. Clasificando...\n`);

  const simpleFailures = [];
  const complexFailures = [];

  // Clasificar cada fallo
  for (const failure of failures) {
    const classification = classifyFailure(failure);
    const affectedFile = getAffectedFile(failure);

    if (classification.type === 'simple') {
      simpleFailures.push({ ...failure, classification, affectedFile });
    } else {
      complexFailures.push({ ...failure, classification, affectedFile });
    }
  }

  console.log(`  🟢 Simples (auto-reparables): ${simpleFailures.length}`);
  console.log(`  🔴 Complejos (necesitan aprobación): ${complexFailures.length}\n`);

  // Intentar reparar fallos simples
  const fixesApplied = [];
  const fixesFailed = [];

  // Lo que ya fallaba ANTES de tocar nada: distingue una regresión nueva de un
  // fallo preexistente.
  const fallidosPrevios = failures.map((f) => f.name);

  for (const failure of simpleFailures) {
    console.log(`\n🔧 Reparando: "${failure.name}"`);
    console.log(`   Categoría: ${failure.classification.desc}`);
    console.log(`   Archivo: ${failure.affectedFile || 'desconocido'}`);

    if (!failure.affectedFile) {
      console.log('   ⚠️  No se pudo determinar el archivo afectado → movido a complejos');
      complexFailures.push(failure);
      continue;
    }

    // PUERTA 1 · lista blanca. Lo que no esté autorizado no se toca.
    const regla = enListaBlanca(failure, failure.affectedFile);
    if (!regla) {
      console.log('   🔒 Fuera de la lista blanca → REQUIERE AUTORIZACIÓN');
      complexFailures.push(failure);
      continue;
    }

    // PUERTA 2 · rojo previo. Si no se puede ejecutar, o si no reproduce, no se repara.
    const antes = correrPlaywright(paraGrep(failure.name));
    if (antes.estado !== 'rojo') {
      console.log(`   🔒 Sin rojo previo demostrable (${antes.estado}${antes.motivo ? ': ' + antes.motivo : ''}) → REQUIERE AUTORIZACIÓN`);
      complexFailures.push(failure);
      continue;
    }

    // Leer el archivo afectado
    const filePath = path.join(process.cwd(), failure.affectedFile);
    if (!fs.existsSync(filePath)) {
      console.log(`   ⚠️  Archivo ${failure.affectedFile} no encontrado → movido a complejos`);
      complexFailures.push(failure);
      continue;
    }

    const fileContent = fs.readFileSync(filePath, 'utf-8');

    // Generar fix con Claude
    const fix = await generateFix(failure, failure.classification, fileContent);

    if (!fix || !fix.can_fix) {
      console.log(`   ⚠️  No se pudo generar fix: ${fix?.explanation || 'sin respuesta'}`);
      complexFailures.push(failure);
      continue;
    }

    // PUERTA 3 · el parche solo puede tocar el título.
    const alcance = soloCambiaElTitulo(fix);
    if (!alcance.ok) {
      console.log(`   🔒 ${alcance.motivo} → REQUIERE AUTORIZACIÓN`);
      complexFailures.push(failure);
      continue;
    }

    // Copia en memoria: revertir no depende de git.
    const originalEnMemoria = fileContent;

    // Aplicar el fix
    const result = applyFix(failure.affectedFile, fix);

    if (result.success) {
      // PUERTA 4 · revalidación obligatoria. Revierte ante cualquier duda.
      const val = revalidar({
        failure,
        fichero: failure.affectedFile,
        rutaCompleta: filePath,
        originalEnMemoria,
        fallidosPrevios,
      });
      if (!val.ok) {
        console.log(`   ↩️  REVERTIDO en ${val.fase}: ${val.motivo}`);
        fixesFailed.push({ ...failure, fixAttempt: fix.explanation, fixError: `revertido (${val.fase}): ${val.motivo}` });
        complexFailures.push(failure);
        continue;
      }

      console.log(`   ✅ Fix aplicado y REVALIDADO: ${fix.explanation}`);
      fixesApplied.push({
        test: failure.name,
        suite: failure.suite,
        file: failure.affectedFile,
        explanation: fix.explanation,
        category: failure.classification.desc,
        revalidacion: {
          rojo_antes: true,
          verde_despues: true,
          regresion_total: val.evidencia.regresion_total,
          regresion_fallidos: val.evidencia.regresion_fallidos,
          patron: String(regla.patron),
        },
      });
    } else {
      console.log(`   ❌ No se pudo aplicar: ${result.reason}`);
      fixesFailed.push({
        ...failure,
        fixAttempt: fix.explanation,
        fixError: result.reason,
      });
      complexFailures.push(failure);
    }
  }

  // Guardar resultados
  const outputDir = path.join(__dirname, 'results');
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  fs.writeFileSync(FIXES_FILE, JSON.stringify(fixesApplied, null, 2));

  // Manifiesto: los ÚNICOS ficheros que el workflow puede commitear. Sustituye al
  // `git add` global, que podía arrastrar cualquier .html/.js/.css del repositorio.
  fs.writeFileSync(
    path.join(outputDir, 'fixed-files.json'),
    JSON.stringify([...new Set(fixesApplied.map((f) => f.file))], null, 2),
  );
  fs.writeFileSync(PENDING_FILE, JSON.stringify(complexFailures.map(f => ({
    test: f.name,
    suite: f.suite,
    error: f.error,
    file: f.affectedFile,
    category: f.classification?.category || 'unknown',
    description: f.classification?.desc || 'Error no clasificado',
  })), null, 2));

  // Resumen final
  console.log('\n═══════════════════════════════════════');
  console.log('  RESUMEN AUTO-FIXER');
  console.log('═══════════════════════════════════════');
  console.log(`  ✅ Fixes aplicados:            ${fixesApplied.length}`);
  console.log(`  🔴 Pendientes (aprobación):    ${complexFailures.length}`);
  console.log(`  ❌ Fixes fallidos:             ${fixesFailed.length}`);
  console.log('═══════════════════════════════════════\n');

  // Código de salida: 0 si todo reparado, 1 si quedan pendientes
  process.exit(complexFailures.length > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('Error en auto-fixer:', err);
  process.exit(1);
});
