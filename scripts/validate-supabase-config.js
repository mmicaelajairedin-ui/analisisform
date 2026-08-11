#!/usr/bin/env node
/**
 * VALIDACIÓN DE CONFIGURACIÓN DE SUPABASE — BLINDAJE CRÍTICO
 * Previene que un cambio de Project Ref rompa producción.
 * Corre en: pre-commit (Husky), CI/CD, y npm run verify
 */
const fs = require('fs');

const CORRECT_PROJECT_REF = 'ddxnrsnjdvtqhxunxnwj';
const WRONG_REFS = [
  'mxkljqhlwiqavbjfjfov',  // legacy incorrecto
  'ddxnrsnjdvtqhxunxbwj',  // typo 'bwj' en lugar de 'nwj' (Bloque 1)
  'ddxnrsnjdvtqhxunxbnwj', // typo 'bnwj' en lugar de 'nwj' (Bloque 1)
  'mzxgxkkgxvunpsiqbzxd',  // otro legacy
];
const PROXY_URL = 'api.pathwaycareercoach.com';
const DIRECT_SUPABASE_PATTERN = /https?:\/\/[a-z0-9-]+\.supabase\.co/i;

let errors = [];
let warnings = [];

const criticalFiles = [
  'login.html',
  'auth-callback.html',
  'panel-v2.html',
  'cliente.html',
  'pw-auth.js',
  'pw-observe.js',
  'pw-native.js',
  'pw-ia-chat.js',
  'pw-push.js',
  'pw-events.js',
  'pw-apple-signin.js',
];

// Archivos donde detectar project refs incorrectos (incluyendo scripts/docs)
const allFilesToCheck = [
  ...criticalFiles,
  'scripts/backup-export.js',
  'scripts/apply-migration-0103.js',
  'scripts/apply-migration-0103.sh',
  'APPLY_MIGRATION_0103.md',
  'EPIC_1_5_RLS_VALIDATION_PLAN.md',
];

console.log('🔍 Escaneando archivos críticos...\n');

// Validar project refs en todos los archivos
allFilesToCheck.forEach(file => {
  try {
    const content = fs.readFileSync(file, 'utf8');

    // Chequeo: No debe contener NINGÚN project ref incorrecto
    WRONG_REFS.forEach(wrongRef => {
      if (content.includes(wrongRef)) {
        errors.push(`❌ ${file}: CONTIENE project ref INCORRECTO (${wrongRef})`);
      }
    });
  } catch (e) {
    if (e.code !== 'ENOENT') {
      console.error(`⚠️  ${file}: error — ${e.message}`);
    }
  }
});

// Validar URLs de proxy solo en código frontend (no en scripts/documentación)
criticalFiles.forEach(file => {
  try {
    const content = fs.readFileSync(file, 'utf8');

    // Chequeo: No debe tener URLs directas a Supabase (excepto en comentarios)
    const lines = content.split('\n');
    lines.forEach((line, i) => {
      const trimmed = line.trim();
      if (trimmed.startsWith('//') || trimmed.startsWith('*')) return;
      if (DIRECT_SUPABASE_PATTERN.test(line) && !line.includes('api.pathwaycareercoach.com')) {
        errors.push(`❌ ${file}:${i+1}: URL directa a Supabase — usar ${PROXY_URL}`);
      }
    });

    // Chequeo: El project ref correcto debe estar presente
    if (!content.includes(CORRECT_PROJECT_REF) && !content.includes(PROXY_URL)) {
      warnings.push(`⚠️  ${file}: No contiene ref ni proxy`);
    }
  } catch (e) {
    if (e.code !== 'ENOENT') {
      console.error(`⚠️  ${file}: error — ${e.message}`);
    }
  }
});

// Verificar documentación
try {
  const envConfig = fs.readFileSync('docs/ENVIRONMENT_CONFIG.md', 'utf8');
  if (!envConfig.includes(CORRECT_PROJECT_REF)) {
    errors.push(`❌ docs/ENVIRONMENT_CONFIG.md: Falta project ref correcto`);
  }
  if (envConfig.includes('ddxnrsnjdvtqhxunxbwj')) {
    errors.push(`❌ docs/ENVIRONMENT_CONFIG.md: Contiene typo 'bwj'`);
  }
} catch (e) {}

console.log('');
if (errors.length > 0) {
  console.error('❌ VALIDACIÓN FALLÓ\n');
  errors.forEach(e => console.error('  ' + e));
  if (warnings.length > 0) {
    console.log('\n⚠️  ADVERTENCIAS:\n');
    warnings.forEach(w => console.log('  ' + w));
  }
  console.log('\n📖 Revisa CLAUDE.md sección "🔐 CONFIGURACIÓN DE SUPABASE"\n');
  process.exit(1);
} else {
  console.log('✅ VALIDACIÓN OK\n');
  console.log(`  ✓ No hay project refs incorrectos`);
  console.log(`  ✓ URLs usan proxy: ${PROXY_URL}`);
  console.log(`  ✓ Project ref correcto: ${CORRECT_PROJECT_REF}`);
  if (warnings.length > 0) {
    console.log('\n⚠️  ADVERTENCIAS:\n');
    warnings.forEach(w => console.log('  ' + w));
  }
  console.log('');
  process.exit(0);
}
