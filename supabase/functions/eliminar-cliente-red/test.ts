// ===================================================================
// eliminar-cliente-red — Tests
// Verifica soft-delete sin hard delete
// ===================================================================

import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";

const ownerJWT = "test-owner-jwt";
const clienteId = "cliente-789";

Deno.test("eliminar-cliente-red: missing_id error", async () => {
  const res = await fetch("http://localhost:54321/functions/v1/eliminar-cliente-red", {
    method: "POST",
    headers: { Authorization: `Bearer ${ownerJWT}`, "Content-Type": "application/json" },
    body: JSON.stringify({ cliente_id: "", modo: "suspender" }),
  });
  const data = await res.json();
  assertEquals(data.error, "missing_id");
});

Deno.test("eliminar-cliente-red: modo_invalido error", async () => {
  const res = await fetch("http://localhost:54321/functions/v1/eliminar-cliente-red", {
    method: "POST",
    headers: { Authorization: `Bearer ${ownerJWT}`, "Content-Type": "application/json" },
    body: JSON.stringify({ cliente_id: clienteId, modo: "invalid" }),
  });
  const data = await res.json();
  assertEquals(data.error, "modo_invalido");
});

Deno.test("eliminar-cliente-red: not_owner error (no auth)", async () => {
  const res = await fetch("http://localhost:54321/functions/v1/eliminar-cliente-red", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cliente_id: clienteId, modo: "suspender" }),
  });
  const data = await res.json();
  assertEquals(data.error, "not_owner");
});

Deno.test("eliminar-cliente-red: bad_json error", async () => {
  const res = await fetch("http://localhost:54321/functions/v1/eliminar-cliente-red", {
    method: "POST",
    headers: { Authorization: `Bearer ${ownerJWT}`, "Content-Type": "application/json" },
    body: "bad-json",
  });
  const data = await res.json();
  assertEquals(data.error, "bad_json");
});

Deno.test("eliminar-cliente-red: post_only (GET not allowed)", async () => {
  const res = await fetch("http://localhost:54321/functions/v1/eliminar-cliente-red", {
    method: "GET",
  });
  const data = await res.json();
  assertEquals(data.error, "post_only");
});

Deno.test("eliminar-cliente-red: OPTIONS allowed", async () => {
  const res = await fetch("http://localhost:54321/functions/v1/eliminar-cliente-red", {
    method: "OPTIONS",
  });
  assertEquals(res.status, 200);
  assertEquals(res.headers.get("Access-Control-Allow-Origin"), "*");
});
