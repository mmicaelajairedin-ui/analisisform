/**
 * AUTO-FIXER: Clasificador y reparador automático de fallos
 *
 * 1. Lee los resultados de tests
 * 2. Clasifica cada fallo como SIMPLE o COMPLEJO
 * 3. Para fallos simples: llama a Claude API para generar el fix
 * 4. Aplica los fixes automáticamente
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
    'index.html': /formulario|form|index|idioma|lang|progreso|consent/i,
    'login.html': /login|autenticación|auth|credential|password/i,
    'panel.html': /panel|dashboard|sidebar|coach|candidat/i,
    'cliente.html': /cliente|client|portal/i,
    'cv.html': /cv|currículum|resume/i,
    'carta.html': /carta|cover letter/i,
    'links.html': /links|enlace/i,
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

  for (const failure of simpleFailures) {
    console.log(`\n🔧 Reparando: "${failure.name}"`);
    console.log(`   Categoría: ${failure.classification.desc}`);
    console.log(`   Archivo: ${failure.affectedFile || 'desconocido'}`);

    if (!failure.affectedFile) {
      console.log('   ⚠️  No se pudo determinar el archivo afectado → movido a complejos');
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

    // Aplicar el fix
    const result = applyFix(failure.affectedFile, fix);

    if (result.success) {
      console.log(`   ✅ Fix aplicado: ${fix.explanation}`);
      fixesApplied.push({
        test: failure.name,
        suite: failure.suite,
        file: failure.affectedFile,
        explanation: fix.explanation,
        category: failure.classification.desc,
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
