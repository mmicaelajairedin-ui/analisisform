#!/usr/bin/env node
/**
 * VALIDACIÓN DE CONFIGURACIÓN DE SUPABASE
 * Previene que un cambio de Project Ref rompa producción
 */
const fs = require('fs');

const CORRECT_PROJECT_REF = 'ddxnrsnjdvtqhxunxbwj';
const WRONG_PROJECT_REF = 'mxkljqhlwiqavbjfjfov';
const PROXY_URL = 'api.pathwaycareercoach.com';

let errors = [];

// Validar que NO hay referencias al proyecto incorrecto
['panel-v2.html', 'cliente.html', 'pw-native.js', 'pw-auth.js', 'pw-ia-chat.js', 'supabase/functions/obtener-perfil-coach/index.ts'].forEach(file => {
  try {
    const content = fs.readFileSync(file, 'utf8');
    
    // CRÍTICO: No debe tener el proyecto incorrecto
    if (content.includes(WRONG_PROJECT_REF)) {
      errors.push(`❌ ${file}: CONTIENE proyecto INCORRECTO (${WRONG_PROJECT_REF})`);
    }
    
    // Debe tener el proyecto correcto (al menos en JWT o comentarios)
    if (!content.includes(CORRECT_PROJECT_REF) && !content.includes(PROXY_URL)) {
      console.log(`⚠️ ${file}: No contiene ref explícita (verificar manualmente)`);
    }
  } catch (e) {
    console.log(`⚠️ ${file}: No encontrado (skip)`);
  }
});

if (errors.length > 0) {
  console.error('\n❌ VALIDACIÓN FALLÓ:\n');
  errors.forEach(e => console.error(e));
  process.exit(1);
} else {
  console.log('\n✅ Validación OK:');
  console.log(`   • No hay referencias a ${WRONG_PROJECT_REF}`);
  console.log(`   • Proyecto correcto: ${CORRECT_PROJECT_REF}`);
  console.log(`   • Proxy: ${PROXY_URL}`);
  process.exit(0);
}
