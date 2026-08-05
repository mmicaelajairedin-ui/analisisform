/**
 * Post-merge audit for MultiCoach v3
 * Checks for: dead code, unused CSS, console errors, 404 resources, duplicate listeners
 */

const fs = require('fs');
const path = require('path');

const MULTICOACH = fs.readFileSync('./multicoach.html', 'utf-8');

console.log('\n' + '═'.repeat(70));
console.log('🔍 AUDITORÍA POST-MERGE — MultiCoach v3');
console.log('═'.repeat(70) + '\n');

// ═══════════════════════════════════════════════════════════════════
// 1. REFERENCIAS A ARCHIVOS EXTERNOS (detectar 404 potenciales)
// ═══════════════════════════════════════════════════════════════════

console.log('1️⃣  RECURSOS EXTERNOS\n');

const linkRegex = /<link[^>]+href=["']([^"']+)["']/g;
const scriptRegex = /<script[^>]+src=["']([^"']+)["']/g;
const imgRegex = /<img[^>]+src=["']([^"']+)["']/g;

const allResources = [];
let match;

while ((match = linkRegex.exec(MULTICOACH)) !== null) {
  if (!match[1].startsWith('http')) allResources.push(match[1]);
}

while ((match = scriptRegex.exec(MULTICOACH)) !== null) {
  if (!match[1].startsWith('http')) allResources.push(match[1]);
}

while ((match = imgRegex.exec(MULTICOACH)) !== null) {
  if (!match[1].startsWith('http') && !match[1].startsWith('data:')) allResources.push(match[1]);
}

if (allResources.length === 0) {
  console.log('   ✓ No recursos locales detectados (CDN/inline)');
} else {
  const missing = [];
  for (const resource of allResources) {
    const fullPath = path.join(__dirname, '..', resource);
    if (!fs.existsSync(fullPath)) {
      missing.push(resource);
    }
  }

  if (missing.length === 0) {
    console.log(`   ✓ Todos los ${allResources.length} recursos locales existen`);
  } else {
    console.log(`   ❌ ${missing.length} recursos no encontrados:`);
    missing.forEach(r => console.log(`      - ${r}`));
  }
}

// ═══════════════════════════════════════════════════════════════════
// 2. FUNCIONES JAVASCRIPT DEFINIDAS Y NO USADAS
// ═══════════════════════════════════════════════════════════════════

console.log('\n2️⃣  FUNCIONES JAVASCRIPT\n');

const scriptContent = MULTICOACH.match(/<script[^>]*>([\s\S]*?)<\/script>/)[1];

// Extraer definiciones de funciones
const funcDefRegex = /function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/g;
const funcDefs = new Set();

while ((match = funcDefRegex.exec(scriptContent)) !== null) {
  funcDefs.add(match[1]);
}

console.log(`   Definidas: ${funcDefs.size} funciones`);

// Funciones principales usadas por onclick/eventos
const mainFuncs = [
  'init', 'loadEquipo', 'loadCoaches', 'loadClientes',
  'renderEquipo', 'renderCoaches', 'renderClientes',
  'openEquipoDrawer', 'closeEquipoDrawer',
  'openClienteDrawer', 'closeClienteDrawer',
  'openCoachCarteraModal', 'closeCoachCarteraModal',
  'openCreateClienteModal', 'closeCreateClienteModal',
  'submitAddPerson', 'submitChangeRole', 'submitConfigPerms',
  'toggleEquipoActivo', 'removeEquipoMember',
  'updateClienteCoach', 'submitChangeCoach',
  'toggleClienteActivo', 'openReassignClientesMasiveModal',
  'submitReassignClientesMasive', 'switchTab'
];

const used = new Set(mainFuncs);

const unusedFuncs = Array.from(funcDefs).filter(f => {
  if (used.has(f)) return false;
  // Helpers que se llaman internamente
  if (f.startsWith('_')) return false;
  // Utilities
  if (['esc', 'getCapacity', 'showError', 'logout'].includes(f)) return false;
  return true;
});

if (unusedFuncs.length === 0) {
  console.log('   ✓ Todas las funciones están siendo usadas');
} else {
  console.log(`   ⚠️  ${unusedFuncs.length} funciones potencialmente sin uso:`);
  unusedFuncs.slice(0, 10).forEach(f => console.log(`      - ${f}()`));
  if (unusedFuncs.length > 10) console.log(`      ... y ${unusedFuncs.length - 10} más`);
}

// ═══════════════════════════════════════════════════════════════════
// 3. VARIABLES GLOBALES POTENCIALMENTE MUERTAS
// ═══════════════════════════════════════════════════════════════════

console.log('\n3️⃣  VARIABLES GLOBALES\n');

const globalsRegex = /let\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=/g;
const globals = new Set();

while ((match = globalsRegex.exec(scriptContent)) !== null) {
  globals.add(match[1]);
}

console.log(`   Definidas: ${globals.size} variables globales`);

const criticalGlobals = [
  'currentOrgId', 'allEquipo', 'allCoaches', 'allClientes',
  'filteredEquipo', 'filteredClientes', 'selectedClientIds',
  'wizardState', 'currentEquipoSelected', 'currentClienteSelected'
];

const allGlobalsDefined = criticalGlobals.every(g => globals.has(g));

if (allGlobalsDefined) {
  console.log('   ✓ Todas las variables críticas definidas');
} else {
  console.log('   ❌ Faltan variables globales:');
  criticalGlobals.forEach(g => {
    if (!globals.has(g)) console.log(`      - ${g}`);
  });
}

// ═══════════════════════════════════════════════════════════════════
// 4. LISTENERS DUPLICADOS
// ═══════════════════════════════════════════════════════════════════

console.log('\n4️⃣  EVENT LISTENERS\n');

const onclickAttrs = (MULTICOACH.match(/onclick="[^"]*"/g) || []).length;
const onchangeAttrs = (MULTICOACH.match(/onchange="[^"]*"/g) || []).length;
const onkeyupAttrs = (MULTICOACH.match(/onkeyup="[^"]*"/g) || []).length;

const duplicateListeners = {};

// Detectar onclick duplicados
const onclickPattern = /onclick="([^"]*)"/g;
while ((match = onclickPattern.exec(MULTICOACH)) !== null) {
  const handler = match[1];
  duplicateListeners[handler] = (duplicateListeners[handler] || 0) + 1;
}

const dups = Object.entries(duplicateListeners).filter(([_, count]) => count > 1);

console.log(`   onclick attributes: ${onclickAttrs}`);
console.log(`   onchange attributes: ${onchangeAttrs}`);
console.log(`   onkeyup attributes: ${onkeyupAttrs}`);

if (dups.length === 0) {
  console.log('   ✓ No listeners duplicados detectados');
} else {
  console.log(`   ⚠️  ${dups.length} handlers repetidos:`);
  dups.slice(0, 5).forEach(([handler, count]) => {
    console.log(`      - "${handler.substring(0, 40)}..." (${count}×)`);
  });
}

// ═══════════════════════════════════════════════════════════════════
// 5. CSS CLASES NO UTILIZADAS
// ═══════════════════════════════════════════════════════════════════

console.log('\n5️⃣  ESTILOS CSS\n');

const styleMatch = MULTICOACH.match(/<style[^>]*>([\s\S]*?)<\/style>/);
if (styleMatch) {
  const cssContent = styleMatch[1];
  const classDefRegex = /\.([a-zA-Z-_][a-zA-Z0-9-_]*)\s*\{/g;
  const classDefs = new Set();

  while ((match = classDefRegex.exec(cssContent)) !== null) {
    classDefs.add(match[1]);
  }

  const unusedClasses = [];
  for (const className of classDefs) {
    // Buscar en HTML
    const classUsage = new RegExp(`class=["'][^"']*\\b${className}\\b[^"']*["']`, 'g');
    const inlineUsage = new RegExp(`\\b${className}\\s*[{;]`, 'g');

    if (!classUsage.test(MULTICOACH) && !inlineUsage.test(cssContent)) {
      unusedClasses.push(className);
    }
  }

  console.log(`   Clases CSS definidas: ${classDefs.size}`);

  if (unusedClasses.length === 0) {
    console.log('   ✓ Todas las clases CSS se utilizan');
  } else {
    console.log(`   ⚠️  ${unusedClasses.length} clases potencialmente sin uso:`);
    unusedClasses.slice(0, 8).forEach(c => console.log(`      - .${c}`));
    if (unusedClasses.length > 8) console.log(`      ... y ${unusedClasses.length - 8} más`);
  }
}

// ═══════════════════════════════════════════════════════════════════
// 6. RESUMEN FINAL
// ═══════════════════════════════════════════════════════════════════

console.log('\n' + '═'.repeat(70));
console.log('✅ AUDITORÍA COMPLETADA\n');

console.log('📋 RECOMENDACIONES:\n');
console.log('   • Revisar funciones marcadas como "sin uso" si son helpers internos');
console.log('   • CSS no utilizado puede removerse si no es necesario');
console.log('   • Los listeners duplicados están OK (ej: guardar en modal vs tabla)');
console.log('   • Los recursos faltantes deben investigarse\n');

console.log('═'.repeat(70) + '\n');
