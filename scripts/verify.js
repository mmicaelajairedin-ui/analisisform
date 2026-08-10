#!/usr/bin/env node

/**
 * VERIFY: Comprehensive pre-commit safety checks
 *
 * Runs in sequence:
 * 1. syntax (check-syntax.js) — validate JS/HTML
 * 2. smoke (check-smoke.js) — verify handlers and assets exist
 * 3. guardrails (check-guardrails.js) — regression prevention
 * 4. parity (check-parity.js) — cross-file consistency
 * 5. icons (check-icons.js) — icon system validation
 * 6. triage (error-triage.js) — classify test failures
 *
 * If ANY check fails, exit 1 and prevent commit.
 * Usage: npm run verify (before git push)
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const checks = [
  {
    name: 'Syntax',
    script: 'node scripts/check-syntax.js',
    description: 'Validate JavaScript and HTML syntax',
  },
  {
    name: 'Smoke',
    script: 'node scripts/check-smoke.js',
    description: 'Verify handlers, assets, and references',
  },
  {
    name: 'Guardrails',
    script: 'node scripts/check-guardrails.js',
    description: 'Check regression prevention rules',
  },
  {
    name: 'Error Scope',
    script: 'node scripts/check-error-scope.js',
    description: 'Classify errors by branch scope (BLOCKER vs OUT_OF_SCOPE)',
  },
  {
    name: 'Parity',
    script: 'node scripts/check-parity.js',
    description: 'Validate cross-file consistency',
  },
  {
    name: 'Icons',
    script: 'node scripts/check-icons.js',
    description: 'Validate icon system (Lucide)',
  },
  {
    name: 'Triage',
    script: 'node scripts/error-triage.js',
    description: 'Classify test failures',
  },
];

async function run() {
  console.log('🛡️  VERIFICATION SUITE');
  console.log('═══════════════════════════════════════\n');

  const results = [];
  let blockerFound = false;

  for (const check of checks) {
    process.stdout.write(`▶ ${check.name}: ${check.description}... `);

    try {
      execSync(check.script, {
        stdio: 'pipe',
        cwd: process.cwd(),
      });
      console.log('✅');
      results.push({ name: check.name, status: 'PASS' });
    } catch (err) {
      console.log('❌');
      results.push({ name: check.name, status: 'FAIL', error: err.message });

      // Determine if this is a blocker
      if (
        check.name === 'Syntax' ||
        check.name === 'Guardrails' ||
        check.name === 'Error Scope' ||
        check.name === 'Triage'
      ) {
        blockerFound = true;
        console.error(`\n  Error output:\n${err.stdout || err.stderr || err.message}\n`);
      }
    }
  }

  // Summary
  console.log('\n═══════════════════════════════════════');
  console.log('  SUMMARY');
  console.log('═══════════════════════════════════════');

  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;

  console.log(`  Passed: ${passed}/${checks.length}`);
  console.log(`  Failed: ${failed}/${checks.length}`);

  if (failed > 0) {
    console.log('\n  ❌ Failures:');
    results.filter(r => r.status === 'FAIL').forEach(r => {
      console.log(`    - ${r.name}`);
    });
  }

  console.log('═══════════════════════════════════════\n');

  if (blockerFound) {
    console.log('🚫 Verification FAILED (blocker found)');
    console.log(
      '   Fix errors before committing. See output above for details.\n'
    );
    process.exit(1);
  }

  if (failed > 0) {
    console.log('⚠️  Verification PASSED with warnings');
    console.log('   (Non-blocking checks failed — review before proceeding)\n');
    process.exit(0);
  }

  console.log('✅ Verification PASSED — safe to commit\n');
  process.exit(0);
}

run().catch(err => {
  console.error('Fatal error during verification:', err.message);
  process.exit(1);
});
