#!/usr/bin/env node
/**
 * EPIC 1.5: RLS Validation Script (Automated)
 *
 * Valida que las RLS policies funcionan correctamente:
 * - Owner ve su org, coaches, clientes
 * - Coach ve SOLO clientes asignados
 * - Client ve SOLO su perfil
 * - Multi-tenant aislamiento total
 *
 * Uso:
 *   node EPIC_1_5_RLS_VALIDATION.js \
 *     --supabase-url "https://project.supabase.co" \
 *     --anon-key "eyJhbGc..." \
 *     --test-users test-users.json
 *
 * test-users.json:
 *   {
 *     "owner": { "email": "owner1@test.com", "password": "Test1234!" },
 *     "coach": { "email": "coach1@test.com", "password": "Test1234!" },
 *     "client": { "email": "client1@test.com", "password": "Test1234!" }
 *   }
 */

const fs = require('fs');
const path = require('path');

// ============================================================================
// Configuration & Args Parsing
// ============================================================================

let SUPABASE_URL = '';
let ANON_KEY = '';
let TEST_USERS_FILE = '';

const args = process.argv.slice(2);
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--supabase-url') SUPABASE_URL = args[++i];
  else if (args[i] === '--anon-key') ANON_KEY = args[++i];
  else if (args[i] === '--test-users') TEST_USERS_FILE = args[++i];
}

if (!SUPABASE_URL || !ANON_KEY) {
  console.error('❌ Faltan argumentos requeridos:');
  console.error('  --supabase-url "https://project.supabase.co"');
  console.error('  --anon-key "eyJhbGc..."');
  console.error('  [--test-users test-users.json]  (opcional, usa valores por defecto)');
  process.exit(1);
}

// Default test users (si no se proporciona archivo)
const DEFAULT_TEST_USERS = {
  owner: { email: 'owner1@test.com', password: 'Test1234!', role: 'owner' },
  coach: { email: 'coach1@test.com', password: 'Test1234!', role: 'coach' },
  client: { email: 'client1@test.com', password: 'Test1234!', role: 'client' }
};

let testUsers = DEFAULT_TEST_USERS;
if (TEST_USERS_FILE && fs.existsSync(TEST_USERS_FILE)) {
  try {
    testUsers = JSON.parse(fs.readFileSync(TEST_USERS_FILE, 'utf8'));
  } catch (e) {
    console.warn('⚠️  No se pudo leer test-users.json, usando defaults');
  }
}

// ============================================================================
// Helpers
// ============================================================================

const log = {
  header: (text) => console.log(`\n${'='.repeat(70)}\n${text}\n${'='.repeat(70)}`),
  section: (text) => console.log(`\n### ${text}`),
  ok: (text) => console.log(`✅ ${text}`),
  fail: (text) => console.log(`❌ ${text}`),
  info: (text) => console.log(`ℹ️  ${text}`),
  result: (test, pass, expected, actual) => {
    const symbol = pass ? '✅' : '❌';
    console.log(`  ${symbol} ${test}`);
    console.log(`     Expected: ${expected} | Actual: ${actual}`);
  }
};

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// ============================================================================
// Supabase Auth & API
// ============================================================================

async function getAuthToken(email, password) {
  try {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': ANON_KEY
      },
      body: JSON.stringify({
        email,
        password
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }

    const data = await response.json();
    return data.access_token;
  } catch (error) {
    throw new Error(`Failed to get auth token for ${email}: ${error.message}`);
  }
}

async function queryPostgREST(endpoint, token) {
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1${endpoint}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'apikey': ANON_KEY,
        'Content-Type': 'application/json'
      }
    });

    if (response.status === 403) {
      return { error: 'Forbidden (RLS policy blocked)', status: 403, data: [] };
    }

    if (!response.ok) {
      return { error: `HTTP ${response.status}`, status: response.status, data: [] };
    }

    const data = await response.json();
    return { error: null, status: 200, data };
  } catch (error) {
    return { error: error.message, status: 0, data: [] };
  }
}

// ============================================================================
// Test Suite
// ============================================================================

class ValidationSuite {
  constructor(role, userEmail, token) {
    this.role = role;
    this.userEmail = userEmail;
    this.token = token;
    this.results = [];
    this.passed = 0;
    this.failed = 0;
  }

  async test(name, endpoint, expected) {
    const result = await queryPostgREST(endpoint, this.token);
    const actual = result.data.length;
    const pass = actual === expected;

    if (pass) {
      this.passed++;
      log.result(name, true, expected, actual);
    } else {
      this.failed++;
      log.result(name, false, expected, actual);
      if (result.error) {
        console.log(`     Error: ${result.error}`);
      }
    }

    this.results.push({
      name,
      endpoint,
      expected,
      actual,
      pass,
      error: result.error || null
    });

    return pass;
  }

  summary() {
    const total = this.passed + this.failed;
    const rate = total > 0 ? Math.round((this.passed / total) * 100) : 0;
    return {
      role: this.role,
      email: this.userEmail,
      total,
      passed: this.passed,
      failed: this.failed,
      passRate: rate,
      results: this.results
    };
  }
}

// ============================================================================
// Main Execution
// ============================================================================

async function main() {
  log.header('🔐 EPIC 1.5: RLS Validation (Automated)');

  log.info(`Supabase URL: ${SUPABASE_URL}`);
  log.info(`Test Users: ${Object.keys(testUsers).join(', ')}`);

  const results = {};
  let overallPass = true;

  // Test each role
  for (const [roleKey, userData] of Object.entries(testUsers)) {
    log.section(`Testing Role: ${roleKey.toUpperCase()}`);

    let token;
    try {
      log.info(`Obtaining auth token for ${userData.email}...`);
      token = await getAuthToken(userData.email, userData.password);
      log.ok(`Authenticated as ${userData.email}`);
    } catch (error) {
      log.fail(`Authentication failed: ${error.message}`);
      results[roleKey] = {
        role: roleKey,
        email: userData.email,
        status: 'AUTH_FAILED',
        error: error.message
      };
      overallPass = false;
      continue;
    }

    const suite = new ValidationSuite(roleKey, userData.email, token);

    // Tests per role
    if (roleKey === 'owner') {
      log.info('Testing Owner Access Patterns...');

      // Owner should see their org
      await suite.test(
        'Owner sees their organization',
        `/organizaciones?select=*&limit=1`,
        1
      );

      // Owner should see coaches in their org
      await suite.test(
        'Owner sees coaches in their org',
        `/usuarios?select=*&rol=eq.coach&limit=100`,
        1
      );

      // Owner should see candidates in their org
      await suite.test(
        'Owner sees candidates in their org',
        `/candidatos?select=*&limit=100`,
        1
      );

      // Owner should see assignments
      await suite.test(
        'Owner sees coach_client_assignments',
        `/coach_client_assignments?select=*&estado=eq.activa&limit=100`,
        1
      );

    } else if (roleKey === 'coach') {
      log.info('Testing Coach Access Patterns (Assignment Isolation)...');

      // Coach should see only assigned clients
      await suite.test(
        'Coach sees only assigned clients',
        `/candidatos?select=*&limit=100`,
        1
      );

      // Coach should see their organization (minimal info)
      await suite.test(
        'Coach sees their organization',
        `/organizaciones?select=*&limit=1`,
        1
      );

      // Coach should see their own user record
      await suite.test(
        'Coach sees their own user record',
        `/usuarios?select=*&limit=1`,
        1
      );

      // Coach should see their assignments
      await suite.test(
        'Coach sees their coach_client_assignments',
        `/coach_client_assignments?select=*&estado=eq.activa&limit=100`,
        1
      );

    } else if (roleKey === 'client') {
      log.info('Testing Client Access Patterns (Self-Isolation)...');

      // Client should see ONLY their own profile
      await suite.test(
        'Client sees only their own profile',
        `/candidatos?select=*&limit=100`,
        1
      );

      // Client should NOT see other users
      await suite.test(
        'Client cannot see other users',
        `/usuarios?select=*&rol=eq.coach&limit=100`,
        0
      );
    }

    const summary = suite.summary();
    results[roleKey] = summary;

    if (summary.failed > 0) {
      overallPass = false;
    }

    log.info(`Result: ${summary.passed}/${summary.total} tests passed (${summary.passRate}%)`);
  }

  // Final Report
  log.header('📊 EPIC 1.5: Validation Report');

  const totalTests = Object.values(results).reduce((sum, r) => sum + (r.total || 0), 0);
  const totalPassed = Object.values(results).reduce((sum, r) => sum + (r.passed || 0), 0);
  const totalFailed = Object.values(results).reduce((sum, r) => sum + (r.failed || 0), 0);
  const overallRate = totalTests > 0 ? Math.round((totalPassed / totalTests) * 100) : 0;

  console.log('\n### Summary by Role');
  for (const [roleKey, summary] of Object.entries(results)) {
    if (summary.total) {
      const status = summary.passed === summary.total ? '✅' : '❌';
      console.log(
        `${status} ${roleKey.toUpperCase()}: ${summary.passed}/${summary.total} ` +
        `(${summary.passRate}%)`
      );
    } else {
      console.log(`❌ ${roleKey.toUpperCase()}: AUTH FAILED`);
    }
  }

  console.log('\n### Overall Results');
  console.log(`Total Tests: ${totalTests}`);
  console.log(`Passed: ${totalPassed}`);
  console.log(`Failed: ${totalFailed}`);
  console.log(`Pass Rate: ${overallRate}%`);

  if (overallPass && totalFailed === 0) {
    log.ok('EPIC 1.5 RLS VALIDATION PASSED ✓');
    process.exit(0);
  } else {
    log.fail('EPIC 1.5 RLS VALIDATION FAILED ✗');
    process.exit(1);
  }
}

// Run with error handling
main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
