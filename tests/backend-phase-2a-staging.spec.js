/**
 * PHASE 2A BACKEND VALIDATION — Staging Tests
 *
 * Tests the 3 new/expanded edge functions against real Supabase staging:
 * - editar-coach-red (expanded)
 * - editar-cliente-red (new)
 * - eliminar-cliente-red (new)
 *
 * Run after deploying Phase 2A functions to staging.
 * Requires: SUPABASE_URL, SUPABASE_ANON_KEY, TEST_OWNER_JWT env vars
 *
 * Usage:
 *   SUPABASE_URL=https://xxx.supabase.co \
 *   SUPABASE_ANON_KEY=xxx \
 *   TEST_OWNER_JWT=xxx \
 *   npm test -- backend-phase-2a-staging.spec.js
 */

const SB_URL = process.env.SUPABASE_URL || "https://ddxnrsnjdvtqhxunxnwj.supabase.co";
const ANON_KEY = process.env.SUPABASE_ANON_KEY || "";
const OWNER_JWT = process.env.TEST_OWNER_JWT || "";

// Helper to call edge function
async function callEdgeFunction(name, body, jwt) {
  const url = `${SB_URL}/functions/v1/${name}`;
  const headers = {
    "Authorization": `Bearer ${jwt || OWNER_JWT}`,
    "Content-Type": "application/json",
  };

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  return {
    status: res.status,
    data: await res.json(),
  };
}

describe("🚀 PHASE 2A Backend Validation — Staging", () => {

  describe("editar-coach-red (expanded)", () => {

    test("missing_coach error", async () => {
      const res = await callEdgeFunction("editar-coach-red", {
        coach_id: "",
        nombre: "Test"
      });
      expect(res.status).toBe(400);
      expect(res.data.error).toBe("missing_coach");
    });

    test("nothing_to_update error", async () => {
      const res = await callEdgeFunction("editar-coach-red", {
        coach_id: "some-id"
      });
      expect(res.status).toBe(400);
      expect(res.data.error).toBe("nothing_to_update");
    });

    test("not_owner error (no auth)", async () => {
      const res = await callEdgeFunction("editar-coach-red", {
        coach_id: "some-id",
        nombre: "Test"
      }, "invalid-jwt");
      expect(res.status).toBe(403);
      expect(res.data.error).toBe("not_owner");
    });

    test("invalid_email error", async () => {
      const res = await callEdgeFunction("editar-coach-red", {
        coach_id: "some-id",
        email: "not-an-email"
      });
      expect(res.status).toBe(400);
      expect(res.data.error).toBe("invalid_email");
    });

    test("accepts valid email format", async () => {
      // Will fail with coach_ajeno (cross-org), but not with invalid_email
      const res = await callEdgeFunction("editar-coach-red", {
        coach_id: "some-id",
        email: "valid@example.com"
      });
      // Either 403 (cross-org) or 502 (db error) is OK — not invalid_email
      expect([403, 502, 404]).toContain(res.status);
      expect(res.data.error).not.toBe("invalid_email");
    });

    test("POST only (no GET)", async () => {
      const url = `${SB_URL}/functions/v1/editar-coach-red`;
      const res = await fetch(url, { method: "GET" });
      const data = await res.json();
      expect(res.status).toBe(405);
      expect(data.error).toBe("post_only");
    });

    test("OPTIONS allowed (CORS)", async () => {
      const url = `${SB_URL}/functions/v1/editar-coach-red`;
      const res = await fetch(url, { method: "OPTIONS" });
      expect(res.status).toBe(200);
      expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    });
  });

  describe("editar-cliente-red (new)", () => {

    test("missing_cliente error", async () => {
      const res = await callEdgeFunction("editar-cliente-red", {
        cliente_id: "",
        nombre: "Test"
      });
      expect(res.status).toBe(400);
      expect(res.data.error).toBe("missing_cliente");
    });

    test("nothing_to_update error", async () => {
      const res = await callEdgeFunction("editar-cliente-red", {
        cliente_id: "some-id"
      });
      expect(res.status).toBe(400);
      expect(res.data.error).toBe("nothing_to_update");
    });

    test("not_owner error (no auth)", async () => {
      const res = await callEdgeFunction("editar-cliente-red", {
        cliente_id: "some-id",
        nombre: "Test"
      }, "invalid-jwt");
      expect(res.status).toBe(403);
      expect(res.data.error).toBe("not_owner");
    });

    test("invalid_email error", async () => {
      const res = await callEdgeFunction("editar-cliente-red", {
        cliente_id: "some-id",
        email: "bad-email"
      });
      expect(res.status).toBe(400);
      expect(res.data.error).toBe("invalid_email");
    });

    test("invalid_estado error", async () => {
      const res = await callEdgeFunction("editar-cliente-red", {
        cliente_id: "some-id",
        estado: "invalid"
      });
      expect(res.status).toBe(400);
      expect(res.data.error).toBe("invalid_estado");
    });

    test("accepts valid estado (activo)", async () => {
      const res = await callEdgeFunction("editar-cliente-red", {
        cliente_id: "some-id",
        estado: "activo"
      });
      // Will fail with cliente_ajeno (cross-org), but not with invalid_estado
      expect([403, 502, 404]).toContain(res.status);
      expect(res.data.error).not.toBe("invalid_estado");
    });

    test("accepts valid estado (inactivo)", async () => {
      const res = await callEdgeFunction("editar-cliente-red", {
        cliente_id: "some-id",
        estado: "inactivo"
      });
      // Will fail with cliente_ajeno (cross-org), but not with invalid_estado
      expect([403, 502, 404]).toContain(res.status);
      expect(res.data.error).not.toBe("invalid_estado");
    });

    test("POST only (no GET)", async () => {
      const url = `${SB_URL}/functions/v1/editar-cliente-red`;
      const res = await fetch(url, { method: "GET" });
      const data = await res.json();
      expect(res.status).toBe(405);
      expect(data.error).toBe("post_only");
    });

    test("OPTIONS allowed (CORS)", async () => {
      const url = `${SB_URL}/functions/v1/editar-cliente-red`;
      const res = await fetch(url, { method: "OPTIONS" });
      expect(res.status).toBe(200);
      expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    });
  });

  describe("eliminar-cliente-red (new — soft-delete)", () => {

    test("missing_id error", async () => {
      const res = await callEdgeFunction("eliminar-cliente-red", {
        cliente_id: "",
        modo: "suspender"
      });
      expect(res.status).toBe(400);
      expect(res.data.error).toBe("missing_id");
    });

    test("modo_invalido error", async () => {
      const res = await callEdgeFunction("eliminar-cliente-red", {
        cliente_id: "some-id",
        modo: "invalid"
      });
      expect(res.status).toBe(400);
      expect(res.data.error).toBe("modo_invalido");
    });

    test("not_owner error (no auth)", async () => {
      const res = await callEdgeFunction("eliminar-cliente-red", {
        cliente_id: "some-id",
        modo: "suspender"
      }, "invalid-jwt");
      expect(res.status).toBe(403);
      expect(res.data.error).toBe("not_owner");
    });

    test("accepts valid modo (suspender)", async () => {
      const res = await callEdgeFunction("eliminar-cliente-red", {
        cliente_id: "some-id",
        modo: "suspender"
      });
      // Will fail with cliente_ajeno (cross-org), but not with modo_invalido
      expect([403, 502, 404]).toContain(res.status);
      expect(res.data.error).not.toBe("modo_invalido");
    });

    test("accepts valid modo (reactivar)", async () => {
      const res = await callEdgeFunction("eliminar-cliente-red", {
        cliente_id: "some-id",
        modo: "reactivar"
      });
      expect([403, 502, 404]).toContain(res.status);
      expect(res.data.error).not.toBe("modo_invalido");
    });

    test("accepts valid modo (quitar)", async () => {
      const res = await callEdgeFunction("eliminar-cliente-red", {
        cliente_id: "some-id",
        modo: "quitar"
      });
      expect([403, 502, 404]).toContain(res.status);
      expect(res.data.error).not.toBe("modo_invalido");
    });

    test("POST only (no GET)", async () => {
      const url = `${SB_URL}/functions/v1/eliminar-cliente-red`;
      const res = await fetch(url, { method: "GET" });
      const data = await res.json();
      expect(res.status).toBe(405);
      expect(data.error).toBe("post_only");
    });

    test("OPTIONS allowed (CORS)", async () => {
      const url = `${SB_URL}/functions/v1/eliminar-cliente-red`;
      const res = await fetch(url, { method: "OPTIONS" });
      expect(res.status).toBe(200);
      expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    });
  });

  describe("eliminar-coach-red (expanded — soft-delete)", () => {

    test("missing_id error", async () => {
      const res = await callEdgeFunction("eliminar-coach-red", {
        coach_id: "",
        modo: "suspender"
      });
      expect(res.status).toBe(400);
      expect(res.data.error).toBe("missing_id");
    });

    test("modo_invalido error", async () => {
      const res = await callEdgeFunction("eliminar-coach-red", {
        coach_id: "some-id",
        modo: "invalid"
      });
      expect(res.status).toBe(400);
      expect(res.data.error).toBe("modo_invalido");
    });

    test("not_owner error (no auth)", async () => {
      const res = await callEdgeFunction("eliminar-coach-red", {
        coach_id: "some-id",
        modo: "suspender"
      }, "invalid-jwt");
      expect(res.status).toBe(403);
      expect(res.data.error).toBe("not_owner");
    });

    test("accepts valid modo (suspender)", async () => {
      const res = await callEdgeFunction("eliminar-coach-red", {
        coach_id: "some-id",
        modo: "suspender"
      });
      // Will fail with coach_ajeno (cross-org), but not with modo_invalido
      expect([403, 502, 404]).toContain(res.status);
      expect(res.data.error).not.toBe("modo_invalido");
    });

    test("accepts valid modo (reactivar)", async () => {
      const res = await callEdgeFunction("eliminar-coach-red", {
        coach_id: "some-id",
        modo: "reactivar"
      });
      expect([403, 502, 404]).toContain(res.status);
      expect(res.data.error).not.toBe("modo_invalido");
    });

    test("accepts valid modo (quitar)", async () => {
      const res = await callEdgeFunction("eliminar-coach-red", {
        coach_id: "some-id",
        modo: "quitar"
      });
      expect([403, 502, 404]).toContain(res.status);
      expect(res.data.error).not.toBe("modo_invalido");
    });

    test("POST only (no GET)", async () => {
      const url = `${SB_URL}/functions/v1/eliminar-coach-red`;
      const res = await fetch(url, { method: "GET" });
      const data = await res.json();
      expect(res.status).toBe(405);
      expect(data.error).toBe("post_only");
    });

    test("OPTIONS allowed (CORS)", async () => {
      const url = `${SB_URL}/functions/v1/eliminar-coach-red`;
      const res = await fetch(url, { method: "OPTIONS" });
      expect(res.status).toBe(200);
      expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    });
  });

  describe("asignar-cliente (new — assign to coach)", () => {

    test("missing_client error", async () => {
      const res = await callEdgeFunction("asignar-cliente", {
        cliente_id: "",
        coach_id: "some-id"
      });
      expect(res.status).toBe(400);
      expect(res.data.error).toBe("missing_client");
    });

    test("missing_coach error", async () => {
      const res = await callEdgeFunction("asignar-cliente", {
        cliente_id: "some-id",
        coach_id: ""
      });
      expect(res.status).toBe(400);
      expect(res.data.error).toBe("missing_coach");
    });

    test("not_owner error (no auth)", async () => {
      const res = await callEdgeFunction("asignar-cliente", {
        cliente_id: "some-id",
        coach_id: "some-coach"
      }, "invalid-jwt");
      expect(res.status).toBe(403);
      expect(res.data.error).toBe("not_owner");
    });

    test("accepts valid assignment (both ids)", async () => {
      const res = await callEdgeFunction("asignar-cliente", {
        cliente_id: "some-id",
        coach_id: "some-coach"
      });
      // Will fail with client_ajeno or coach_ajeno (cross-org), but not with missing errors
      expect([403, 502, 404]).toContain(res.status);
      expect(res.data.error).not.toBe("missing_client");
      expect(res.data.error).not.toBe("missing_coach");
    });

    test("POST only (no GET)", async () => {
      const url = `${SB_URL}/functions/v1/asignar-cliente`;
      const res = await fetch(url, { method: "GET" });
      const data = await res.json();
      expect(res.status).toBe(405);
      expect(data.error).toBe("post_only");
    });

    test("OPTIONS allowed (CORS)", async () => {
      const url = `${SB_URL}/functions/v1/asignar-cliente`;
      const res = await fetch(url, { method: "OPTIONS" });
      expect(res.status).toBe(200);
      expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    });
  });

  describe("agregar-coach-red (create)", () => {

    test("email_invalid error", async () => {
      const res = await callEdgeFunction("agregar-coach-red", {
        email: "not-an-email",
        nombre: "Test Coach"
      });
      expect(res.status).toBe(400);
      expect(res.data.error).toBe("email_invalid");
    });

    test("nombre_required error", async () => {
      const res = await callEdgeFunction("agregar-coach-red", {
        email: "coach@example.com",
        nombre: ""
      });
      expect(res.status).toBe(400);
      expect(res.data.error).toBe("nombre_required");
    });

    test("not_owner error (no auth)", async () => {
      const res = await callEdgeFunction("agregar-coach-red", {
        email: "coach@example.com",
        nombre: "Test Coach"
      }, "invalid-jwt");
      expect(res.status).toBe(403);
      expect(res.data.error).toBe("not_owner");
    });

    test("accepts valid email format", async () => {
      const res = await callEdgeFunction("agregar-coach-red", {
        email: "valid-coach@example.com",
        nombre: "Test Coach"
      });
      // Will fail with cap_reached (quota) or not_owner, but not invalid_email
      expect([403, 400, 502, 404]).toContain(res.status);
      expect(res.data.error).not.toBe("email_invalid");
    });

    test("POST only (no GET)", async () => {
      const url = `${SB_URL}/functions/v1/agregar-coach-red`;
      const res = await fetch(url, { method: "GET" });
      const data = await res.json();
      expect(res.status).toBe(405);
      expect(data.error).toBe("post_only");
    });

    test("OPTIONS allowed (CORS)", async () => {
      const url = `${SB_URL}/functions/v1/agregar-coach-red`;
      const res = await fetch(url, { method: "OPTIONS" });
      expect(res.status).toBe(200);
      expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    });
  });

  describe("agregar-cliente-red (create)", () => {

    test("nombre_required error", async () => {
      const res = await callEdgeFunction("agregar-cliente-red", {
        nombre: "",
        email: "client@example.com",
        coach_id: "some-id"
      });
      expect(res.status).toBe(400);
      expect(res.data.error).toBe("nombre_required");
    });

    test("email_invalid error", async () => {
      const res = await callEdgeFunction("agregar-cliente-red", {
        nombre: "Test Client",
        email: "not-an-email",
        coach_id: "some-id"
      });
      expect(res.status).toBe(400);
      expect(res.data.error).toBe("email_invalid");
    });

    test("not_owner error (no auth)", async () => {
      const res = await callEdgeFunction("agregar-cliente-red", {
        nombre: "Test Client",
        email: "client@example.com",
        coach_id: "some-id"
      }, "invalid-jwt");
      expect(res.status).toBe(403);
      expect(res.data.error).toBe("not_owner");
    });

    test("accepts valid name and email", async () => {
      const res = await callEdgeFunction("agregar-cliente-red", {
        nombre: "Test Client",
        email: "valid-client@example.com",
        coach_id: "some-id"
      });
      // Will fail with coach_ajeno (not in org) or cap_reached, but not invalid_email
      expect([403, 400, 502, 404]).toContain(res.status);
      expect(res.data.error).not.toBe("email_invalid");
      expect(res.data.error).not.toBe("nombre_required");
    });

    test("POST only (no GET)", async () => {
      const url = `${SB_URL}/functions/v1/agregar-cliente-red`;
      const res = await fetch(url, { method: "GET" });
      const data = await res.json();
      expect(res.status).toBe(405);
      expect(data.error).toBe("post_only");
    });

    test("OPTIONS allowed (CORS)", async () => {
      const url = `${SB_URL}/functions/v1/agregar-cliente-red`;
      const res = await fetch(url, { method: "OPTIONS" });
      expect(res.status).toBe(200);
      expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    });
  });

  describe("📍 Deployment Verification", () => {

    test("all 7 endpoints deployed and respond", async () => {
      const endpoints = [
        { name: "agregar-coach-red", body: { email: "test@test.com", nombre: "test" } },
        { name: "editar-coach-red", body: { coach_id: "test", nombre: "test" } },
        { name: "eliminar-coach-red", body: { coach_id: "test", modo: "suspender" } },
        { name: "agregar-cliente-red", body: { nombre: "test", email: "test@test.com", coach_id: "test" } },
        { name: "editar-cliente-red", body: { cliente_id: "test", nombre: "test" } },
        { name: "eliminar-cliente-red", body: { cliente_id: "test", modo: "suspender" } },
        { name: "asignar-cliente", body: { cliente_id: "test", coach_id: "test" } }
      ];

      for (const ep of endpoints) {
        const res = await callEdgeFunction(ep.name, ep.body);
        expect(res.status).not.toBe(404);
      }
    });

    test("all endpoints have CORS headers", async () => {
      const endpoints = [
        "agregar-coach-red",
        "editar-coach-red",
        "eliminar-coach-red",
        "agregar-cliente-red",
        "editar-cliente-red",
        "eliminar-cliente-red",
        "asignar-cliente"
      ];

      for (const ep of endpoints) {
        const url = `${SB_URL}/functions/v1/${ep}`;
        const res = await fetch(url, { method: "OPTIONS" });
        expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
      }
    });
  });
});
