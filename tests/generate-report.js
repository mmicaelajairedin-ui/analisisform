/**
 * GENERADOR DE REPORTE DIARIO
 *
 * Lee los resultados de Playwright en JSON y genera un reporte
 * legible que se envía por email vía GitHub Actions.
 *
 * Uso: npx playwright test --reporter=json | node tests/generate-report.js
 *   o: node tests/generate-report.js (lee de tests/results/test-results.json)
 */

const fs = require('fs');
const path = require('path');

const RESULTS_FILE = path.join(__dirname, 'results', 'test-results.json');

function readResults() {
  // Intentar leer del stdin (pipe) o del archivo
  let rawData;

  if (!process.stdin.isTTY) {
    // Leer del pipe
    rawData = '';
    const chunks = [];
    return new Promise((resolve) => {
      process.stdin.on('data', chunk => chunks.push(chunk));
      process.stdin.on('end', () => {
        rawData = Buffer.concat(chunks).toString();
        try {
          resolve(JSON.parse(rawData));
        } catch (e) {
          // Si el pipe no tiene JSON válido, leer archivo
          resolve(readFromFile());
        }
      });
    });
  }

  return Promise.resolve(readFromFile());
}

function readFromFile() {
  try {
    const raw = fs.readFileSync(RESULTS_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (e) {
    console.error('No se encontraron resultados de tests.');
    process.exit(1);
  }
}

function generateReport(results) {
  const now = new Date();
  const dateStr = now.toLocaleDateString('es-ES', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const timeStr = now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

  const suites = results.suites || [];
  let totalTests = 0;
  let passed = 0;
  let failed = 0;
  let skipped = 0;
  const failures = [];
  const warnings = [];
  const passedTests = [];

  function processSpecs(specs, suiteName) {
    for (const spec of specs) {
      for (const test of (spec.tests || [])) {
        totalTests++;
        const status = test.status || test.expectedStatus;

        if (status === 'expected' || status === 'passed') {
          passed++;
          passedTests.push({
            suite: suiteName,
            name: spec.title,
            duration: test.results?.[0]?.duration || 0,
          });
        } else if (status === 'unexpected' || status === 'failed') {
          failed++;
          const errorMsg = test.results?.[0]?.error?.message || 'Error desconocido';
          failures.push({
            suite: suiteName,
            name: spec.title,
            error: errorMsg.substring(0, 300),
            file: spec.file,
          });
        } else if (status === 'skipped' || status === 'flaky') {
          skipped++;
          if (status === 'flaky') {
            warnings.push({
              suite: suiteName,
              name: spec.title,
              reason: 'Test inestable (flaky) - pasó después de reintentar',
            });
          }
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

  processSuites(suites);

  // Determinar estado general
  const healthStatus = failed === 0 ? '✅ SALUDABLE' : failed <= 3 ? '⚠️ ATENCIÓN NECESARIA' : '🔴 PROBLEMAS CRÍTICOS';
  const healthEmoji = failed === 0 ? '✅' : failed <= 3 ? '⚠️' : '🔴';

  // Generar reporte en texto
  let report = '';
  report += `═══════════════════════════════════════════════════\n`;
  report += `  REPORTE DIARIO DE TESTING - PLATAFORMA MJ\n`;
  report += `  ${dateStr} — ${timeStr}\n`;
  report += `═══════════════════════════════════════════════════\n\n`;

  report += `ESTADO GENERAL: ${healthStatus}\n\n`;

  report += `📊 RESUMEN\n`;
  report += `─────────────────────────────────────────\n`;
  report += `  Total de tests:    ${totalTests}\n`;
  report += `  ✅ Pasaron:        ${passed}\n`;
  report += `  ❌ Fallaron:       ${failed}\n`;
  report += `  ⏭️  Omitidos:      ${skipped}\n`;
  report += `  Tasa de éxito:     ${totalTests > 0 ? Math.round((passed / totalTests) * 100) : 0}%\n\n`;

  if (failures.length > 0) {
    report += `🔴 PROBLEMAS ENCONTRADOS (${failures.length})\n`;
    report += `─────────────────────────────────────────\n`;
    for (let i = 0; i < failures.length; i++) {
      const f = failures[i];
      report += `\n  ${i + 1}. ${f.name}\n`;
      report += `     Suite: ${f.suite}\n`;
      report += `     Error: ${f.error}\n`;
      report += `     Archivo: ${f.file || 'N/A'}\n`;
    }
    report += '\n';
  }

  if (warnings.length > 0) {
    report += `⚠️ ADVERTENCIAS (${warnings.length})\n`;
    report += `─────────────────────────────────────────\n`;
    for (const w of warnings) {
      report += `  - ${w.name}: ${w.reason}\n`;
    }
    report += '\n';
  }

  if (failures.length > 0) {
    report += `🔧 CAMBIOS RECOMENDADOS\n`;
    report += `─────────────────────────────────────────\n`;
    for (const f of failures) {
      report += `  → Revisar: "${f.name}"\n`;
      if (f.error.includes('status()')) {
        report += `    Acción: Verificar que la página/endpoint está desplegado correctamente\n`;
      } else if (f.error.includes('toBeVisible')) {
        report += `    Acción: Un elemento de la UI no se muestra - revisar HTML/CSS\n`;
      } else if (f.error.includes('timeout') || f.error.includes('Timeout')) {
        report += `    Acción: La página tarda demasiado en cargar - revisar performance\n`;
      } else if (f.error.includes('toHaveText')) {
        report += `    Acción: El texto del elemento cambió - verificar si fue intencional\n`;
      } else if (f.error.includes('net::') || f.error.includes('ERR_')) {
        report += `    Acción: Error de red - verificar conectividad y URLs del servicio\n`;
      } else {
        report += `    Acción: Investigar el error y corregir el componente afectado\n`;
      }
    }
    report += '\n';
  }

  // Sección de tests exitosos (resumido)
  report += `✅ FUNCIONALIDADES VERIFICADAS (${passed})\n`;
  report += `─────────────────────────────────────────\n`;
  const suiteGroups = {};
  for (const t of passedTests) {
    if (!suiteGroups[t.suite]) suiteGroups[t.suite] = [];
    suiteGroups[t.suite].push(t);
  }
  for (const [suite, tests] of Object.entries(suiteGroups)) {
    report += `  ${suite}: ${tests.length} tests OK\n`;
  }
  report += '\n';

  report += `═══════════════════════════════════════════════════\n`;
  report += `  Generado automáticamente por el Testing Agent\n`;
  report += `  Plataforma: Micaela Jairedin - Career Coach\n`;
  report += `═══════════════════════════════════════════════════\n`;

  // Generar HTML para email
  const htmlReport = generateHTMLReport({
    dateStr,
    timeStr,
    healthStatus,
    healthEmoji,
    totalTests,
    passed,
    failed,
    skipped,
    failures,
    warnings,
    passedTests,
    suiteGroups,
  });

  // Generar body para GitHub Issue (cuando hay fallos)
  let issueBody = '';
  if (failures.length > 0) {
    issueBody += `## Resumen\n\n`;
    issueBody += `El testing diario del **${dateStr}** detectó **${failed} problema(s)** de ${totalTests} tests ejecutados.\n\n`;
    issueBody += `| Métrica | Valor |\n|---------|-------|\n`;
    issueBody += `| Total tests | ${totalTests} |\n`;
    issueBody += `| Pasaron | ${passed} |\n`;
    issueBody += `| Fallaron | ${failed} |\n`;
    issueBody += `| Tasa de éxito | ${totalTests > 0 ? Math.round((passed / totalTests) * 100) : 0}% |\n\n`;

    issueBody += `## Problemas detectados\n\n`;
    for (let i = 0; i < failures.length; i++) {
      const f = failures[i];
      issueBody += `### ${i + 1}. ${f.name}\n\n`;
      issueBody += `- **Suite:** ${f.suite}\n`;
      issueBody += `- **Archivo:** \`${f.file || 'N/A'}\`\n`;
      issueBody += `- **Error:**\n\`\`\`\n${f.error}\n\`\`\`\n\n`;

      // Acción recomendada
      issueBody += `**Acción recomendada:** `;
      if (f.error.includes('status()')) {
        issueBody += `Verificar que la página/endpoint está desplegado correctamente.\n\n`;
      } else if (f.error.includes('toBeVisible')) {
        issueBody += `Un elemento de la UI no se muestra — revisar HTML/CSS del componente.\n\n`;
      } else if (f.error.includes('timeout') || f.error.includes('Timeout')) {
        issueBody += `La página tarda demasiado en cargar — revisar performance.\n\n`;
      } else if (f.error.includes('toHaveText')) {
        issueBody += `El texto del elemento cambió — verificar si fue intencional.\n\n`;
      } else if (f.error.includes('net::') || f.error.includes('ERR_')) {
        issueBody += `Error de red — verificar conectividad y URLs del servicio.\n\n`;
      } else {
        issueBody += `Investigar el error y corregir el componente afectado.\n\n`;
      }
    }

    issueBody += `---\n`;
    issueBody += `> Para reparar, abre Claude Code y escribe: **"Repara el issue #(número de este issue)"**\n\n`;
    issueBody += `_Generado automáticamente por el Testing Agent_`;
  }

  // Generar título del issue
  const issueTitle = failures.length > 0
    ? `🔴 Testing diario: ${failed} test(s) fallaron — ${dateStr}`
    : '';

  return { text: report, html: htmlReport, failed, passed, totalTests, issueBody, issueTitle };
}

function generateHTMLReport(data) {
  const {
    dateStr, timeStr, healthEmoji, totalTests, passed, failed,
    skipped, failures, warnings, suiteGroups,
  } = data;

  const successRate = totalTests > 0 ? Math.round((passed / totalTests) * 100) : 0;
  const statusColor = failed === 0 ? '#4a7c5f' : failed <= 3 ? '#b45309' : '#c0756e';
  const statusText = failed === 0 ? 'Saludable' : failed <= 3 ? 'Atención necesaria' : 'Problemas críticos';

  let failuresHTML = '';
  if (failures.length > 0) {
    failuresHTML = `
      <div style="margin-top:20px;">
        <h3 style="color:#c0756e;font-size:14px;margin-bottom:10px;">🔴 Problemas encontrados (${failures.length})</h3>
        ${failures.map((f, i) => `
          <div style="background:#fdf6f6;border-left:3px solid #c0756e;padding:10px 14px;margin-bottom:8px;border-radius:0 6px 6px 0;">
            <strong style="font-size:13px;">${i + 1}. ${f.name}</strong><br>
            <span style="font-size:12px;color:#666;">Suite: ${f.suite}</span><br>
            <span style="font-size:11px;color:#c0756e;font-family:monospace;">${f.error.substring(0, 200)}</span>
          </div>
        `).join('')}
      </div>`;
  }

  let warningsHTML = '';
  if (warnings.length > 0) {
    warningsHTML = `
      <div style="margin-top:20px;">
        <h3 style="color:#b45309;font-size:14px;margin-bottom:10px;">⚠️ Advertencias (${warnings.length})</h3>
        ${warnings.map(w => `
          <div style="background:#fef3e2;border-left:3px solid #b45309;padding:8px 14px;margin-bottom:6px;border-radius:0 6px 6px 0;">
            <strong style="font-size:12px;">${w.name}</strong>: ${w.reason}
          </div>
        `).join('')}
      </div>`;
  }

  let passedHTML = Object.entries(suiteGroups).map(([suite, tests]) => `
    <div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid #f0f0f0;font-size:12px;">
      <span>${suite}</span>
      <span style="color:#4a7c5f;font-weight:600;">${tests.length} ✓</span>
    </div>
  `).join('');

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:'Montserrat',Helvetica,Arial,sans-serif;background:#f5f5f3;padding:20px;">
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;">

    <!-- Header -->
    <div style="background:linear-gradient(135deg,#8C7B80,#6B5A5F);padding:24px;text-align:center;">
      <div style="width:42px;height:42px;border-radius:50%;background:rgba(255,255,255,.2);display:inline-flex;align-items:center;justify-content:center;margin-bottom:8px;">
        <span style="font-size:16px;font-weight:700;color:#fff;">MJ</span>
      </div>
      <h1 style="color:#fff;font-size:18px;margin:0;">Reporte Diario de Testing</h1>
      <p style="color:rgba(255,255,255,.7);font-size:12px;margin:4px 0 0;">${dateStr} — ${timeStr}</p>
    </div>

    <div style="padding:24px;">

      <!-- Status Badge -->
      <div style="text-align:center;margin-bottom:20px;">
        <span style="display:inline-block;background:${statusColor}15;color:${statusColor};font-size:13px;font-weight:700;padding:6px 20px;border-radius:20px;border:1.5px solid ${statusColor};">
          ${healthEmoji} ${statusText}
        </span>
      </div>

      <!-- Stats Grid -->
      <div style="display:flex;gap:8px;margin-bottom:20px;">
        <div style="flex:1;background:#f9f8f8;border-radius:8px;padding:12px;text-align:center;">
          <div style="font-size:22px;font-weight:700;color:#1a1a1a;">${totalTests}</div>
          <div style="font-size:10px;color:#999;font-weight:600;text-transform:uppercase;">Total</div>
        </div>
        <div style="flex:1;background:#E1F5EE;border-radius:8px;padding:12px;text-align:center;">
          <div style="font-size:22px;font-weight:700;color:#4a7c5f;">${passed}</div>
          <div style="font-size:10px;color:#4a7c5f;font-weight:600;text-transform:uppercase;">Pasaron</div>
        </div>
        <div style="flex:1;background:${failed > 0 ? '#fdf6f6' : '#f9f8f8'};border-radius:8px;padding:12px;text-align:center;">
          <div style="font-size:22px;font-weight:700;color:${failed > 0 ? '#c0756e' : '#999'};">${failed}</div>
          <div style="font-size:10px;color:${failed > 0 ? '#c0756e' : '#999'};font-weight:600;text-transform:uppercase;">Fallaron</div>
        </div>
        <div style="flex:1;background:#f9f8f8;border-radius:8px;padding:12px;text-align:center;">
          <div style="font-size:22px;font-weight:700;color:#1a1a1a;">${successRate}%</div>
          <div style="font-size:10px;color:#999;font-weight:600;text-transform:uppercase;">Éxito</div>
        </div>
      </div>

      <!-- Progress Bar -->
      <div style="background:#f0f0ee;border-radius:4px;height:6px;margin-bottom:20px;">
        <div style="background:${statusColor};height:6px;border-radius:4px;width:${successRate}%;"></div>
      </div>

      ${failuresHTML}
      ${warningsHTML}

      <!-- Passed Tests -->
      <div style="margin-top:20px;">
        <h3 style="color:#4a7c5f;font-size:14px;margin-bottom:10px;">✅ Funcionalidades verificadas</h3>
        ${passedHTML}
      </div>

    </div>

    <!-- Footer -->
    <div style="background:#f9f8f8;padding:16px;text-align:center;border-top:1px solid #eee;">
      <p style="font-size:11px;color:#999;margin:0;">Testing Agent Automático — Plataforma Micaela Jairedin</p>
    </div>
  </div>
</body>
</html>`;
}

// Main
async function main() {
  const results = await readResults();
  const { text, html, failed, totalTests, issueBody, issueTitle } = generateReport(results);

  // Imprimir reporte en consola
  console.log(text);

  // Guardar archivos
  const outputDir = path.join(__dirname, 'results');
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  fs.writeFileSync(path.join(outputDir, 'report.txt'), text);
  fs.writeFileSync(path.join(outputDir, 'report.html'), html);

  // Generar resumen para GitHub Actions
  const summary = {
    date: new Date().toISOString(),
    totalTests,
    passed: totalTests - failed,
    failed,
    successRate: totalTests > 0 ? Math.round(((totalTests - failed) / totalTests) * 100) : 0,
    status: failed === 0 ? 'healthy' : failed <= 3 ? 'warning' : 'critical',
  };

  fs.writeFileSync(path.join(outputDir, 'summary.json'), JSON.stringify(summary, null, 2));

  // Guardar datos del issue (si hay fallos)
  if (issueBody && issueTitle) {
    fs.writeFileSync(path.join(outputDir, 'issue-title.txt'), issueTitle);
    fs.writeFileSync(path.join(outputDir, 'issue-body.md'), issueBody);
    console.log(`   - issue-title.txt`);
    console.log(`   - issue-body.md`);
  }

  console.log('\n📁 Reportes guardados en tests/results/');
  console.log(`   - report.txt`);
  console.log(`   - report.html`);
  console.log(`   - summary.json`);

  // Exit code basado en fallos
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('Error generando reporte:', err);
  process.exit(1);
});
