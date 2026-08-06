#!/usr/bin/env -S deno run --allow-net --allow-env

/**
 * Phase 2 Security Validation Script
 * ===================================
 * Validates RLS + Edge Functions against a Supabase project
 * Usage: deno run validate-phase2.ts
 *
 * Environment variables required:
 * - SUPABASE_URL: https://your-project.supabase.co
 * - SUPABASE_SERVICE_KEY: service role key (for RLS testing)
 * - SUPABASE_ANON_KEY: anon key
 * - TEST_ORG_ID: existing organization ID to test
 * - TEST_OWNER_JWT: JWT of owner user
 * - TEST_COACH_JWT: JWT of coach user
 * - TEST_COACH_ID: UUID of test coach
 * - TEST_CLIENT_ID: UUID of test client
 *
 * Outputs: validation-report.json
 */

interface TestResult {
  test_id: string;
  category: "RLS_READ" | "RLS_WRITE" | "EDGE_FUNCTION" | "CROSS_ORG";
  description: string;
  role: string;
  expected_result: "ALLOW" | "BLOCK";
  actual_result: "ALLOW" | "BLOCK";
  status: "PASS" | "FAIL";
  http_status?: number;
  request: {
    method: string;
    url: string;
    headers_sent: Record<string, string>;
    body?: unknown;
  };
  response: {
    status: number;
    body: unknown;
  };
  block_reason?: string;
  timestamp: string;
}

const SB_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_KEY") || "";
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || "";
const TEST_ORG_ID = Deno.env.get("TEST_ORG_ID") || "";
const TEST_OWNER_JWT = Deno.env.get("TEST_OWNER_JWT") || "";
const TEST_COACH_JWT = Deno.env.get("TEST_COACH_JWT") || "";
const TEST_COACH_ID = Deno.env.get("TEST_COACH_ID") || "";
const TEST_CLIENT_ID = Deno.env.get("TEST_CLIENT_ID") || "";
const TEST_OTHER_COACH_ID = Deno.env.get("TEST_OTHER_COACH_ID") || "";
const TEST_OTHER_ORG_ID = Deno.env.get("TEST_OTHER_ORG_ID") || "";

const results: TestResult[] = [];

console.log("🔒 Phase 2 Security Validation\n");
console.log("Configuration:");
console.log(`  Supabase URL: ${SB_URL}`);
console.log(`  Test Org ID: ${TEST_ORG_ID}`);
console.log(`  Test Coach ID: ${TEST_COACH_ID}`);
console.log(`  Test Client ID: ${TEST_CLIENT_ID}\n`);

async function makeRequest(
  method: string,
  url: string,
  headers: Record<string, string>,
  body?: unknown,
): Promise<{ status: number; body: unknown }> {
  try {
    const response = await fetch(url, {
      method,
      headers: {
        ...headers,
        "Content-Type": "application/json",
      },
      ...(body && { body: JSON.stringify(body) }),
    });

    let body_data: unknown;
    const contentType = response.headers.get("content-type");
    if (contentType?.includes("application/json")) {
      body_data = await response.json();
    } else {
      body_data = await response.text();
    }

    return { status: response.status, body: body_data };
  } catch (error) {
    return { status: 0, body: { error: error.message } };
  }
}

function recordTest(test: TestResult) {
  results.push(test);
  const icon = test.status === "PASS" ? "✅" : "❌";
  console.log(`${icon} ${test.test_id}: ${test.description}`);
  if (test.status === "FAIL") {
    console.log(`   Expected: ${test.expected_result}, Got: ${test.actual_result}`);
    console.log(`   HTTP: ${test.response.status}, Reason: ${test.block_reason}`);
  }
}

// ============================================================================
// RLS Tests
// ============================================================================

async function testRLS_OwnerSeesAll() {
  const url = `${SB_URL}/rest/v1/candidatos?org_id=eq.${encodeURIComponent(TEST_ORG_ID)}&select=id,nombre,coach_id&limit=10`;
  const headers = {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
  };

  const resp = await makeRequest("GET", url, headers);

  recordTest({
    test_id: "RLS_001",
    category: "RLS_READ",
    description: "Owner (service role) can read all candidatos in org",
    role: "owner",
    expected_result: "ALLOW",
    actual_result: resp.status === 200 ? "ALLOW" : "BLOCK",
    status: resp.status === 200 && Array.isArray(resp.body) ? "PASS" : "FAIL",
    request: { method: "GET", url: url.substring(0, 80) + "...", headers_sent: { apikey: "***" } },
    response: { status: resp.status, body: Array.isArray(resp.body) ? { rows: resp.body.length } : resp.body },
    block_reason: resp.status !== 200 ? `http_${resp.status}` : undefined,
    timestamp: new Date().toISOString(),
  });
}

async function testRLS_CoachSeesOwnOnly() {
  // Try to access via coach JWT (should be filtered by RLS to own clients only)
  const url = `${SB_URL}/rest/v1/candidatos?org_id=eq.${encodeURIComponent(TEST_ORG_ID)}&select=id,nombre,coach_id`;
  const headers = {
    apikey: ANON_KEY,
    Authorization: `Bearer ${TEST_COACH_JWT}`,
  };

  const resp = await makeRequest("GET", url, headers);

  // Check if all returned rows have coach_id = TEST_COACH_ID (RLS filtered)
  let allOwnRows = false;
  if (Array.isArray(resp.body)) {
    allOwnRows = resp.body.every((row: any) => row.coach_id === TEST_COACH_ID);
  }

  recordTest({
    test_id: "RLS_002",
    category: "RLS_READ",
    description: "Coach (via JWT) can only read own candidatos (RLS filters)",
    role: "coach",
    expected_result: "ALLOW",
    actual_result: allOwnRows || resp.status === 200 ? "ALLOW" : "BLOCK",
    status: allOwnRows ? "PASS" : "FAIL",
    request: { method: "GET", url: url.substring(0, 80) + "...", headers_sent: { apikey: "***", Authorization: "Bearer ***" } },
    response: {
      status: resp.status,
      body: Array.isArray(resp.body)
        ? { rows: resp.body.length, all_own_coach: allOwnRows }
        : resp.body,
    },
    block_reason: allOwnRows ? undefined : resp.status === 200 ? "rls_not_filtering" : `http_${resp.status}`,
    timestamp: new Date().toISOString(),
  });
}

async function testRLS_CoachCannotSeeOtherCoach() {
  // Coach tries to see clients of another coach (should be blocked by RLS)
  const url = `${SB_URL}/rest/v1/candidatos?org_id=eq.${encodeURIComponent(TEST_ORG_ID)}&coach_id=eq.${encodeURIComponent(TEST_OTHER_COACH_ID)}&select=id`;
  const headers = {
    apikey: ANON_KEY,
    Authorization: `Bearer ${TEST_COACH_JWT}`,
  };

  const resp = await makeRequest("GET", url, headers);
  const isBlocked = resp.status === 200 && Array.isArray(resp.body) && resp.body.length === 0;

  recordTest({
    test_id: "RLS_003",
    category: "RLS_READ",
    description: "Coach cannot see other coach's clients (RLS blocks)",
    role: "coach",
    expected_result: "BLOCK",
    actual_result: isBlocked ? "BLOCK" : "ALLOW",
    status: isBlocked ? "PASS" : "FAIL",
    request: { method: "GET", url: url.substring(0, 80) + "...", headers_sent: { Authorization: "Bearer ***" } },
    response: { status: resp.status, body: Array.isArray(resp.body) ? { rows: resp.body.length } : resp.body },
    block_reason: isBlocked ? "rls_filtered" : "should_have_blocked",
    timestamp: new Date().toISOString(),
  });
}

async function testCrossOrgBlocked() {
  // Try to access other org's data
  if (!TEST_OTHER_ORG_ID) {
    console.log("⊘ RLS_004: Skipped (TEST_OTHER_ORG_ID not set)");
    return;
  }

  const url = `${SB_URL}/rest/v1/candidatos?org_id=eq.${encodeURIComponent(TEST_OTHER_ORG_ID)}&select=id&limit=1`;
  const headers = {
    apikey: ANON_KEY,
    Authorization: `Bearer ${TEST_COACH_JWT}`,
  };

  const resp = await makeRequest("GET", url, headers);
  const isBlocked = resp.status === 200 && Array.isArray(resp.body) && resp.body.length === 0;

  recordTest({
    test_id: "RLS_004",
    category: "CROSS_ORG",
    description: "Coach cannot access data from other organization (cross-org blocked)",
    role: "coach",
    expected_result: "BLOCK",
    actual_result: isBlocked ? "BLOCK" : "ALLOW",
    status: isBlocked ? "PASS" : "FAIL",
    request: { method: "GET", url: url.substring(0, 80) + "...", headers_sent: { Authorization: "Bearer ***" } },
    response: { status: resp.status, body: Array.isArray(resp.body) ? { rows: resp.body.length } : resp.body },
    block_reason: isBlocked ? "cross_org_blocked" : "should_have_blocked",
    timestamp: new Date().toISOString(),
  });
}

// ============================================================================
// Edge Function Tests
// ============================================================================

async function testEdgeFunctionNoJWT() {
  const url = `${SB_URL}/functions/v1/mi-red`;
  const headers = { apikey: ANON_KEY }; // No Authorization header

  const resp = await makeRequest("GET", url, headers);
  const isBlocked = resp.status === 403 || resp.status === 401;

  recordTest({
    test_id: "EF_001",
    category: "EDGE_FUNCTION",
    description: "Edge function rejects request without JWT",
    role: "none",
    expected_result: "BLOCK",
    actual_result: isBlocked ? "BLOCK" : "ALLOW",
    status: isBlocked ? "PASS" : "FAIL",
    request: { method: "GET", url, headers_sent: { apikey: "***" } },
    response: { status: resp.status, body: resp.body },
    block_reason: isBlocked ? "no_jwt" : `http_${resp.status}`,
    timestamp: new Date().toISOString(),
  });
}

async function testEdgeFunctionCoachIdTampering() {
  // Coach tries to create cita for another coach (should be rejected by edge function)
  const url = `${SB_URL}/functions/v1/crear-cita-red`;
  const headers = {
    apikey: ANON_KEY,
    Authorization: `Bearer ${TEST_COACH_JWT}`,
  };
  const body = {
    coach_id: TEST_OTHER_COACH_ID || "tampering-attempt-id",
    nombre: "Tampered Appointment",
    tipo: "Sesión",
    inicio: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // +7 days
  };

  const resp = await makeRequest("POST", url, headers, body);
  const isBlocked = resp.status >= 400 && (resp.body?.error || "").includes("cannot_create_for_other_coach");

  recordTest({
    test_id: "EF_002",
    category: "EDGE_FUNCTION",
    description: "Edge function rejects coach_id tampering (create cita for other coach)",
    role: "coach",
    expected_result: "BLOCK",
    actual_result: isBlocked ? "BLOCK" : "ALLOW",
    status: isBlocked ? "PASS" : "FAIL",
    request: {
      method: "POST",
      url,
      headers_sent: { Authorization: "Bearer ***" },
      body: { coach_id: "***", nombre: body.nombre },
    },
    response: { status: resp.status, body: resp.body },
    block_reason: isBlocked ? "tampering_detected" : `http_${resp.status}`,
    timestamp: new Date().toISOString(),
  });
}

async function testEdgeFunctionInvalidJWT() {
  // Try with completely invalid JWT
  const url = `${SB_URL}/functions/v1/crear-cita-red`;
  const headers = {
    apikey: ANON_KEY,
    Authorization: "Bearer invalid-jwt-token-xyz",
  };
  const body = {
    coach_id: TEST_COACH_ID,
    nombre: "Test",
    tipo: "Sesión",
    inicio: new Date().toISOString(),
  };

  const resp = await makeRequest("POST", url, headers, body);
  const isBlocked = resp.status === 403 || resp.status === 401;

  recordTest({
    test_id: "EF_003",
    category: "EDGE_FUNCTION",
    description: "Edge function rejects invalid JWT",
    role: "none",
    expected_result: "BLOCK",
    actual_result: isBlocked ? "BLOCK" : "ALLOW",
    status: isBlocked ? "PASS" : "FAIL",
    request: {
      method: "POST",
      url,
      headers_sent: { Authorization: "Bearer invalid-jwt-***" },
    },
    response: { status: resp.status, body: resp.body },
    block_reason: isBlocked ? "invalid_jwt" : `http_${resp.status}`,
    timestamp: new Date().toISOString(),
  });
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  console.log("Starting tests...\n");

  // RLS Tests
  await testRLS_OwnerSeesAll();
  await testRLS_CoachSeesOwnOnly();
  await testRLS_CoachCannotSeeOtherCoach();
  await testCrossOrgBlocked();

  console.log();

  // Edge Function Tests
  await testEdgeFunctionNoJWT();
  await testEdgeFunctionCoachIdTampering();
  await testEdgeFunctionInvalidJWT();

  // Summary
  const passed = results.filter((r) => r.status === "PASS").length;
  const failed = results.filter((r) => r.status === "FAIL").length;
  const total = results.length;

  console.log("\n" + "=".repeat(60));
  console.log("📊 Summary");
  console.log("=".repeat(60));
  console.log(`Total Tests: ${total}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`Success Rate: ${Math.round((passed / total) * 100)}%`);

  // Output report
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      total,
      passed,
      failed,
      success_rate: `${Math.round((passed / total) * 100)}%`,
    },
    tests: results,
  };

  const reportJson = JSON.stringify(report, null, 2);
  await Deno.writeTextFile("validation-report.json", reportJson);

  console.log(`\n📄 Report saved to: validation-report.json`);

  // Exit with appropriate code
  Deno.exit(failed > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  Deno.exit(1);
});
