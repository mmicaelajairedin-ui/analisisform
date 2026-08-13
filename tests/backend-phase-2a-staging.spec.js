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

  describe("📍 Deployment Verification", () => {

    test("editar-coach-red endpoint exists and responds", async () => {
      const res = await callEdgeFunction("editar-coach-red", {
        coach_id: "test",
        nombre: "test"
      });
      // Should respond with SOME status, not 404
      expect(res.status).not.toBe(404);
    });

    test("editar-cliente-red endpoint exists and responds", async () => {
      const res = await callEdgeFunction("editar-cliente-red", {
        cliente_id: "test",
        nombre: "test"
      });
      expect(res.status).not.toBe(404);
    });

    test("eliminar-cliente-red endpoint exists and responds", async () => {
      const res = await callEdgeFunction("eliminar-cliente-red", {
        cliente_id: "test",
        modo: "suspender"
      });
      expect(res.status).not.toBe(404);
    });

    test("all endpoints have CORS headers", async () => {
      const endpoints = ["editar-coach-red", "editar-cliente-red", "eliminar-cliente-red"];

      for (const ep of endpoints) {
        const url = `${SB_URL}/functions/v1/${ep}`;
        const res = await fetch(url, { method: "OPTIONS" });
        expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
      }
    });
  });
});
