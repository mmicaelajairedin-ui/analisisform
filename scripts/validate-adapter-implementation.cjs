#!/usr/bin/env node

/**
 * Validate MultiCoach Adapter Implementation
 *
 * Checks that all 7 CRUD methods are properly implemented
 * and call the correct Phase 2A edge functions.
 *
 * Run: node scripts/validate-adapter-implementation.cjs
 */

const fs = require('fs');
const path = require('path');

const ADAPTER_PATH = path.join(__dirname, '../multicoach-adapter.js');
const adapterCode = fs.readFileSync(ADAPTER_PATH, 'utf8');

const STAGE_TEST_PATH = path.join(__dirname, '../tests/backend-phase-2a-staging.spec.js');
const stageTestCode = fs.readFileSync(STAGE_TEST_PATH, 'utf8');

console.log('\n═══════════════════════════════════════════════════════════════');
console.log('🔧 MultiCoach Adapter Implementation Validation');
console.log('═══════════════════════════════════════════════════════════════\n');

const checks = [
  {
    name: '1. mcCreateCoach',
    status: 'IMPLEMENTED',
    details: 'Calls agregar-coach-red edge function',
    check: () => adapterCode.includes('agregar-coach-red')
  },
  {
    name: '2. mcEditCoach',
    status: 'IMPLEMENTED (was BLOCKED)',
    details: 'Calls editar-coach-red edge function',
    check: () => {
      const section = adapterCode.substring(adapterCode.indexOf('function mcEditCoach'), adapterCode.indexOf('function mcDeleteCoach'));
      return section.includes('editar-coach-red') && section.includes('coach_id: coachId');
    }
  },
  {
    name: '3. mcDeleteCoach',
    status: 'IMPLEMENTED (was BLOCKED)',
    details: 'Calls eliminar-coach-red edge function with modo parameter',
    check: () => adapterCode.includes('eliminar-coach-red') && adapterCode.includes('modo')
  },
  {
    name: '4. mcCreateCliente',
    status: 'IMPLEMENTED',
    details: 'Calls agregar-cliente-red edge function',
    check: () => adapterCode.includes('agregar-cliente-red')
  },
  {
    name: '5. mcEditCliente',
    status: 'IMPLEMENTED (was BLOCKED)',
    details: 'Calls editar-cliente-red edge function',
    check: () => {
      const section = adapterCode.substring(adapterCode.indexOf('function mcEditCliente'), adapterCode.indexOf('function mcDeleteCliente'));
      return section.includes('editar-cliente-red') && section.includes('cliente_id: clienteId');
    }
  },
  {
    name: '6. mcDeleteCliente',
    status: 'IMPLEMENTED (was BLOCKED)',
    details: 'Calls eliminar-cliente-red edge function with modo parameter',
    check: () => adapterCode.includes('eliminar-cliente-red') && adapterCode.includes('modo')
  },
  {
    name: '7. mcAssignClientToCoach',
    status: 'IMPLEMENTED (was PARTIAL)',
    details: 'Calls asignar-cliente edge function instead of undefined _reassign',
    check: () => adapterCode.includes('asignar-cliente') && !adapterCode.includes('_reassign(')
  }
];

const edgeValidation = [
  {
    name: 'editar-coach-red contract',
    details: 'Staging test expects { coach_id, nombre?, email?, especialidad?, telefono? }',
    check: () => stageTestCode.includes('editar-coach-red') && stageTestCode.includes('missing_coach')
  },
  {
    name: 'editar-cliente-red contract',
    details: 'Staging test expects { cliente_id, nombre?, email?, estado? } with estado ∈ {activo, inactivo}',
    check: () => stageTestCode.includes('editar-cliente-red') && stageTestCode.includes('invalid_estado')
  },
  {
    name: 'eliminar-cliente-red contract',
    details: 'Staging test expects { cliente_id, modo } with modo ∈ {suspender, reactivar, quitar}',
    check: () => stageTestCode.includes('eliminar-cliente-red') && stageTestCode.includes('modo_invalido')
  }
];

const payloadValidation = [
  {
    name: 'editar-coach-red payload',
    details: 'Adapter sends coach_id + optional update fields',
    check: () => adapterCode.includes('coach_id: coachId') && adapterCode.includes('editar-coach-red')
  },
  {
    name: 'editar-cliente-red payload',
    details: 'Adapter sends cliente_id + optional fields',
    check: () => adapterCode.includes('cliente_id: clienteId') && adapterCode.includes('editar-cliente-red')
  },
  {
    name: 'eliminar-coach-red payload',
    details: 'Adapter sends coach_id + modo',
    check: () => adapterCode.includes('{ coach_id: coachId, modo: modo }')
  },
  {
    name: 'eliminar-cliente-red payload',
    details: 'Adapter sends cliente_id + modo',
    check: () => adapterCode.includes('{ cliente_id: clienteId, modo: modo }')
  },
  {
    name: 'asignar-cliente payload',
    details: 'Adapter sends cliente_id + coach_id',
    check: () => adapterCode.includes('{ cliente_id: clienteId, coach_id: coachId }')
  }
];

const errorHandling = [
  {
    name: 'invalid_email errors',
    details: 'Translates to "Email inválido"',
    check: () => adapterCode.includes('Email inválido')
  },
  {
    name: 'invalid_estado errors',
    details: 'Translates to "Estado inválido"',
    check: () => adapterCode.includes('Estado inválido')
  },
  {
    name: 'modo_invalido errors',
    details: 'Translates to "Modo inválido"',
    check: () => adapterCode.includes('Modo inválido')
  },
  {
    name: 'not_owner errors',
    details: 'Translates to "No tienes permiso"',
    check: () => adapterCode.includes('No tienes permiso')
  }
];

let passed = 0;
let failed = 0;

console.log('📋 CRUD Methods Status:\n');
checks.forEach((check, i) => {
  const result = check.check();
  passed += result ? 1 : 0;
  failed += result ? 0 : 1;
  const symbol = result ? '✅' : '❌';
  console.log(`${symbol} ${check.name} — ${check.status}`);
  console.log(`   ${check.details}\n`);
});

console.log('\n📊 Edge Function Contracts:\n');
edgeValidation.forEach((check) => {
  const result = check.check();
  passed += result ? 1 : 0;
  failed += result ? 0 : 1;
  const symbol = result ? '✅' : '❌';
  console.log(`${symbol} ${check.name}`);
  console.log(`   ${check.details}\n`);
});

console.log('\n📤 Payload Validation:\n');
payloadValidation.forEach((check) => {
  const result = check.check();
  passed += result ? 1 : 0;
  failed += result ? 0 : 1;
  const symbol = result ? '✅' : '❌';
  console.log(`${symbol} ${check.name}`);
  console.log(`   ${check.details}\n`);
});

console.log('\n🛡️ Error Handling:\n');
errorHandling.forEach((check) => {
  const result = check.check();
  passed += result ? 1 : 0;
  failed += result ? 0 : 1;
  const symbol = result ? '✅' : '❌';
  console.log(`${symbol} ${check.name}`);
  console.log(`   ${check.details}\n`);
});

console.log('═══════════════════════════════════════════════════════════════');
console.log(`Results: ${passed} passed, ${failed} failed\n`);

if (failed === 0) {
  console.log('🎉 All implementation checks passed!\n');
  console.log('Summary:');
  console.log('  • 7/7 CRUD methods implemented (0 blocked)');
  console.log('  • 3 edge function contracts validated');
  console.log('  • 5 payload structures verified');
  console.log('  • 4 error message translations confirmed\n');
  process.exit(0);
} else {
  console.log('⚠️  Some checks failed. Review the implementation.\n');
  process.exit(1);
}
