#!/usr/bin/env node

/**
 * Phase 2A Auth Flow Unit Tests
 *
 * Valida que el cableado de autenticación esté correcto:
 * - Inicialización de Supabase
 * - Refresh token flow
 * - Authorization header
 * - Endpoints registrados
 *
 * NO hace llamadas E2E reales.
 */

const fs = require('fs');
const path = require('path');

// ============================================================================
// TEST 1: Validar que el script runner existe y tiene estructura correcta
// ============================================================================

function test1_RunnerScriptExists() {
  const scriptPath = path.join(__dirname, 'phase2a-real-tests-run.cjs');
  if (!fs.existsSync(scriptPath)) {
    return { pass: false, message: 'phase2a-real-tests-run.cjs no existe' };
  }

  const content = fs.readFileSync(scriptPath, 'utf8');
  const checks = [
    { pattern: /createClient.*supabase-js/, desc: 'Importa createClient de @supabase/supabase-js' },
    { pattern: /supabase\.auth\.refreshSession/, desc: 'Implementa refreshSession' },
    { pattern: /Authorization.*Bearer/, desc: 'Usa Bearer token en Authorization header' },
    { pattern: /PATHWAY_TEST_OWNER_A_REFRESH_TOKEN/, desc: 'Soporta PATHWAY_TEST_OWNER_A_REFRESH_TOKEN env var' },
    { pattern: /PATHWAY_SUPABASE_ANON_KEY/, desc: 'Soporta PATHWAY_SUPABASE_ANON_KEY env var' },
    { pattern: /const ENDPOINTS = \{/, desc: 'Define objeto ENDPOINTS con 7 funciones' },
    { pattern: /runUnitTests/, desc: 'Implementa runUnitTests()' },
    { pattern: /runE2ETests/, desc: 'Implementa runE2ETests() para E2E real' },
    { pattern: /validateEnv/, desc: 'Valida variables de ambiente' },
  ];

  const failedChecks = checks.filter(c => !c.pattern.test(content));

  if (failedChecks.length > 0) {
    return {
      pass: false,
      message: `Faltan implementaciones:\n${failedChecks.map(c => `  - ${c.desc}`).join('\n')}`,
    };
  }

  return { pass: true, message: 'Script runner tiene estructura correcta' };
}

// ============================================================================
// TEST 2: Validar endpoints exactos registrados
// ============================================================================

function test2_EndpointsRegistered() {
  const scriptPath = path.join(__dirname, 'phase2a-real-tests-run.cjs');
  const content = fs.readFileSync(scriptPath, 'utf8');

  const expectedEndpoints = [
    'agregar-coach-red',
    'agregar-cliente-red',
    'editar-coach-red',
    'editar-cliente-red-index-ts',
    'eliminar-coach-red',
    'eliminar-cliente-red-index-ts-',
    'asignar-cliente',
  ];

  const missing = expectedEndpoints.filter(ep => !content.includes(`'${ep}'`));

  if (missing.length > 0) {
    return {
      pass: false,
      message: `Endpoints faltando:\n${missing.map(ep => `  - ${ep}`).join('\n')}`,
    };
  }

  return { pass: true, message: `7 endpoints registrados correctamente` };
}

// ============================================================================
// TEST 3: Validar que NO se imprimen secretos en logs
// ============================================================================

function test3_NoSecretLogging() {
  const scriptPath = path.join(__dirname, 'phase2a-real-tests-run.cjs');
  const content = fs.readFileSync(scriptPath, 'utf8');

  // Verificar que el token NUNCA se imprime
  const dangerousPatterns = [
    { pattern: /console\.log\([^)]*REFRESH_TOKEN[^)]*\)/, desc: 'Imprime REFRESH_TOKEN directamente' },
    { pattern: /console\.log\([^)]*access_token[^)]*\)/, desc: 'Imprime access_token directamente' },
    { pattern: /console\.log\([^)]*ANON_KEY[^)]*\)/, desc: 'Imprime ANON_KEY directamente' },
  ];

  const found = dangerousPatterns.filter(p => p.pattern.test(content));

  if (found.length > 0) {
    return {
      pass: false,
      message: `Riesgo de logging de secretos:\n${found.map(p => `  - ${p.desc}`).join('\n')}`,
    };
  }

  // Verificar que sí hay validación de no-logging
  if (!content.includes('oculto en logs')) {
    return {
      pass: false,
      message: 'Falta indicar en logs que tokens están ocultos',
    };
  }

  return { pass: true, message: 'Tokens nunca se imprimen en logs' };
}

// ============================================================================
// TEST 4: Validar flujo de autenticación
// ============================================================================

function test4_AuthenticationFlow() {
  const scriptPath = path.join(__dirname, 'phase2a-real-tests-run.cjs');
  const content = fs.readFileSync(scriptPath, 'utf8');

  const steps = [
    { pattern: /initSupabaseClient/, desc: '1. Inicializa cliente Supabase con anon key' },
    { pattern: /refreshAuthSession/, desc: '2. Renueva sesión con refresh token' },
    { pattern: /access_token.*session/, desc: '3. Extrae access_token de sesión' },
    { pattern: /Bearer.*accessToken/, desc: '4. Usa access_token en Authorization header' },
    { pattern: /httpPost.*accessToken/, desc: '5. Pasa access_token a POST requests' },
  ];

  const missing = steps.filter(s => !s.pattern.test(content));

  if (missing.length > 0) {
    return {
      pass: false,
      message: `Pasos del flujo faltando:\n${missing.map(s => `  - ${s.desc}`).join('\n')}`,
    };
  }

  return { pass: true, message: 'Flujo de autenticación completo (5 pasos)' };
}

// ============================================================================
// TEST 5: Validar que no usa service_role ni hace bypass
// ============================================================================

function test5_NoBypass() {
  const scriptPath = path.join(__dirname, 'phase2a-real-tests-run.cjs');
  const content = fs.readFileSync(scriptPath, 'utf8');

  const bypassPatterns = [
    { pattern: /SERVICE_ROLE/, desc: 'Intenta usar SERVICE_ROLE_KEY' },
    { pattern: /service_role/, desc: 'Intenta usar service role' },
    { pattern: /createClient.*service/, desc: 'Inicializa client con service role' },
    { pattern: /email.*password/, desc: 'Intenta login con email/password' },
    { pattern: /generateToken|jwt\.sign/, desc: 'Genera JWT manualmente' },
  ];

  const found = bypassPatterns.filter(p => p.pattern.test(content));

  if (found.length > 0) {
    return {
      pass: false,
      message: `Detectados bypasses de autenticación:\n${found.map(p => `  - ${p.desc}`).join('\n')}`,
    };
  }

  return { pass: true, message: 'No usa service_role, email/password, ni JWT manual' };
}

// ============================================================================
// TEST 6: Validar workflow de GitHub Actions
// ============================================================================

function test6_WorkflowConfiguration() {
  const workflowPath = path.join(__dirname, '..', '.github', 'workflows', 'phase2a-real-tests.yml');

  if (!fs.existsSync(workflowPath)) {
    return {
      pass: false,
      message: `.github/workflows/phase2a-real-tests.yml no existe`,
    };
  }

  const content = fs.readFileSync(workflowPath, 'utf8');

  const checks = [
    { pattern: /PATHWAY_TEST_OWNER_A_REFRESH_TOKEN/, desc: 'Recibe PATHWAY_TEST_OWNER_A_REFRESH_TOKEN desde secrets' },
    { pattern: /PATHWAY_SUPABASE_ANON_KEY/, desc: 'Recibe PATHWAY_SUPABASE_ANON_KEY desde secrets' },
    { pattern: /phase2a-real-tests-run/, desc: 'Ejecuta el script runner' },
  ];

  const missing = checks.filter(c => !c.pattern.test(content));

  if (missing.length > 0) {
    return {
      pass: false,
      message: `Workflow incompleto:\n${missing.map(c => `  - ${c.desc}`).join('\n')}`,
    };
  }

  return { pass: true, message: 'Workflow está correctamente configurado' };
}

// ============================================================================
// TEST 7: Validar que runUnitTests NO hace E2E
// ============================================================================

function test7_UnitTestsAreStatic() {
  const scriptPath = path.join(__dirname, 'phase2a-real-tests-run.cjs');
  const content = fs.readFileSync(scriptPath, 'utf8');

  // Extraer función runUnitTests
  const unitTestsMatch = content.match(/async function runUnitTests\(\)[\s\S]*?^}/m);

  if (!unitTestsMatch) {
    return {
      pass: false,
      message: 'No se pudo encontrar función runUnitTests',
    };
  }

  const unitTestsCode = unitTestsMatch[0];

  // Verificar que NO hace calls HTTP
  if (/httpPost|https\.request/.test(unitTestsCode)) {
    return {
      pass: false,
      message: 'runUnitTests hace llamadas HTTP — debe ser estático',
    };
  }

  // Verificar que NO toca E2E
  if (/runE2ETests|accessToken|REFRESH_TOKEN/.test(unitTestsCode)) {
    return {
      pass: false,
      message: 'runUnitTests mezcla lógica de E2E — debe ser completamente estático',
    };
  }

  return { pass: true, message: 'runUnitTests es completamente estático (sin E2E)' };
}

// ============================================================================
// RUNNER
// ============================================================================

async function main() {
  console.log('\n' + '='.repeat(70));
  console.log('  Phase 2A Auth Flow — Unit Tests');
  console.log('='.repeat(70) + '\n');

  const tests = [
    { name: 'Script runner existe y tiene estructura', fn: test1_RunnerScriptExists },
    { name: 'Endpoints exactos registrados', fn: test2_EndpointsRegistered },
    { name: 'No imprime secretos en logs', fn: test3_NoSecretLogging },
    { name: 'Flujo de autenticación completo', fn: test4_AuthenticationFlow },
    { name: 'No usa bypass ni service_role', fn: test5_NoBypass },
    { name: 'Workflow GitHub Actions configurado', fn: test6_WorkflowConfiguration },
    { name: 'runUnitTests es completamente estático', fn: test7_UnitTestsAreStatic },
  ];

  let passCount = 0;
  let failCount = 0;

  for (const test of tests) {
    try {
      const result = test.fn();
      if (result.pass) {
        console.log(`✅ ${test.name}`);
        console.log(`   ${result.message}\n`);
        passCount++;
      } else {
        console.log(`❌ ${test.name}`);
        console.log(`   ${result.message}\n`);
        failCount++;
      }
    } catch (err) {
      console.log(`❌ ${test.name}`);
      console.log(`   Error: ${err.message}\n`);
      failCount++;
    }
  }

  console.log('='.repeat(70));
  console.log(`📊 Results: ${passCount}/${tests.length} PASS, ${failCount}/${tests.length} FAIL`);
  console.log('='.repeat(70) + '\n');

  if (failCount > 0) {
    process.exit(1);
  }

  console.log('✅ Todos los tests de infraestructura pasaron\n');
  process.exit(0);
}

main().catch((err) => {
  console.error('\n❌ Error ejecutando tests:', err.message);
  process.exit(1);
});
