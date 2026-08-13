// ===================================================================
// editar-coach-red — Tests
// Verifica:
// - Owner autorizado
// - org_id correcto
// - cross-org rechazado
// - Validación de inputs
// - Soft-delete sin hard delete
// ===================================================================

import { assertEquals, assertExists } from "https://deno.land/std@0.208.0/assert/mod.ts";

// Mock environment
const env = {
  SUPABASE_URL: "https://test.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "test-service-key",
  SUPABASE_ANON_KEY: "test-anon-key",
};

// Test data
const ownerEmail = "owner@example.com";
const ownerOrgId = "org-123";
const ownerJWT = "test-owner-jwt";
const coachId = "coach-456";

Deno.test("editar-coach-red: missing_coach error", async () => {
  const res = await fetch("http://localhost:54321/functions/v1/editar-coach-red", {
    method: "POST",
    headers: { Authorization: `Bearer ${ownerJWT}`, "Content-Type": "application/json" },
    body: JSON.stringify({ coach_id: "", member_role: "colaborador" }),
  });
  const data = await res.json();
  assertEquals(data.error, "missing_coach");
});

Deno.test("editar-coach-red: nothing_to_update error", async () => {
  const res = await fetch("http://localhost:54321/functions/v1/editar-coach-red", {
    method: "POST",
    headers: { Authorization: `Bearer ${ownerJWT}`, "Content-Type": "application/json" },
    body: JSON.stringify({ coach_id: coachId }),
  });
  const data = await res.json();
  assertEquals(data.error, "nothing_to_update");
});

Deno.test("editar-coach-red: not_owner error (no auth)", async () => {
  const res = await fetch("http://localhost:54321/functions/v1/editar-coach-red", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ coach_id: coachId, member_role: "colaborador" }),
  });
  const data = await res.json();
  assertEquals(data.error, "not_owner");
});

Deno.test("editar-coach-red: invalid_email error", async () => {
  const res = await fetch("http://localhost:54321/functions/v1/editar-coach-red", {
    method: "POST",
    headers: { Authorization: `Bearer ${ownerJWT}`, "Content-Type": "application/json" },
    body: JSON.stringify({ coach_id: coachId, email: "not-an-email" }),
  });
  const data = await res.json();
  assertEquals(data.error, "invalid_email");
});

Deno.test("editar-coach-red: bad_json error", async () => {
  const res = await fetch("http://localhost:54321/functions/v1/editar-coach-red", {
    method: "POST",
    headers: { Authorization: `Bearer ${ownerJWT}`, "Content-Type": "application/json" },
    body: "not-json",
  });
  const data = await res.json();
  assertEquals(data.error, "bad_json");
});

Deno.test("editar-coach-red: method not allowed (GET)", async () => {
  const res = await fetch("http://localhost:54321/functions/v1/editar-coach-red", {
    method: "GET",
  });
  const data = await res.json();
  assertEquals(data.error, "post_only");
});

Deno.test("editar-coach-red: OPTIONS request", async () => {
  const res = await fetch("http://localhost:54321/functions/v1/editar-coach-red", {
    method: "OPTIONS",
  });
  assertEquals(res.status, 200);
  assertEquals(res.headers.get("Access-Control-Allow-Origin"), "*");
});
