// ===================================================================
// editar-cliente-red — Tests
// ===================================================================

import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";

const ownerJWT = "test-owner-jwt";
const clienteId = "cliente-789";

Deno.test("editar-cliente-red: missing_cliente error", async () => {
  const res = await fetch("http://localhost:54321/functions/v1/editar-cliente-red", {
    method: "POST",
    headers: { Authorization: `Bearer ${ownerJWT}`, "Content-Type": "application/json" },
    body: JSON.stringify({ cliente_id: "", nombre: "Test" }),
  });
  const data = await res.json();
  assertEquals(data.error, "missing_cliente");
});

Deno.test("editar-cliente-red: nothing_to_update error", async () => {
  const res = await fetch("http://localhost:54321/functions/v1/editar-cliente-red", {
    method: "POST",
    headers: { Authorization: `Bearer ${ownerJWT}`, "Content-Type": "application/json" },
    body: JSON.stringify({ cliente_id: clienteId }),
  });
  const data = await res.json();
  assertEquals(data.error, "nothing_to_update");
});

Deno.test("editar-cliente-red: not_owner error (no auth)", async () => {
  const res = await fetch("http://localhost:54321/functions/v1/editar-cliente-red", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cliente_id: clienteId, nombre: "Test" }),
  });
  const data = await res.json();
  assertEquals(data.error, "not_owner");
});

Deno.test("editar-cliente-red: invalid_email error", async () => {
  const res = await fetch("http://localhost:54321/functions/v1/editar-cliente-red", {
    method: "POST",
    headers: { Authorization: `Bearer ${ownerJWT}`, "Content-Type": "application/json" },
    body: JSON.stringify({ cliente_id: clienteId, email: "bad-email" }),
  });
  const data = await res.json();
  assertEquals(data.error, "invalid_email");
});

Deno.test("editar-cliente-red: invalid_estado error", async () => {
  const res = await fetch("http://localhost:54321/functions/v1/editar-cliente-red", {
    method: "POST",
    headers: { Authorization: `Bearer ${ownerJWT}`, "Content-Type": "application/json" },
    body: JSON.stringify({ cliente_id: clienteId, estado: "invalid" }),
  });
  const data = await res.json();
  assertEquals(data.error, "invalid_estado");
});

Deno.test("editar-cliente-red: bad_json error", async () => {
  const res = await fetch("http://localhost:54321/functions/v1/editar-cliente-red", {
    method: "POST",
    headers: { Authorization: `Bearer ${ownerJWT}`, "Content-Type": "application/json" },
    body: "bad-json",
  });
  const data = await res.json();
  assertEquals(data.error, "bad_json");
});

Deno.test("editar-cliente-red: method not allowed (GET)", async () => {
  const res = await fetch("http://localhost:54321/functions/v1/editar-cliente-red", {
    method: "GET",
  });
  const data = await res.json();
  assertEquals(data.error, "post_only");
});
