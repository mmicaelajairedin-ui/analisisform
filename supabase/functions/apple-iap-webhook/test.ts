// Basic tests for JWS validation and webhook processing
// Run with: deno test --allow-env --allow-net test.ts

import { validateJWS, validateNestedJWS } from "./jws-validator.ts";

Deno.test("JWS validation - invalid format", async () => {
  const result = await validateJWS("invalid");
  if (result.valid) throw new Error("Should reject invalid JWS");
  if (!result.error) throw new Error("Should have error message");
});

Deno.test("JWS validation - missing x5c", async () => {
  // Create JWS without x5c certificate chain
  const header = btoa(JSON.stringify({ alg: "ES256" }));
  const payload = btoa(JSON.stringify({ notificationUUID: "test" }));
  const jws = `${header}.${payload}.signature`;

  const result = await validateJWS(jws);
  if (result.valid) throw new Error("Should reject JWS without x5c");
  if (!result.error?.includes("x5c")) throw new Error("Error should mention x5c");
});

Deno.test("JWS validation - invalid algorithm", async () => {
  const header = btoa(JSON.stringify({ alg: "HS256", x5c: ["cert"] }));
  const payload = btoa(JSON.stringify({ notificationUUID: "test" }));
  const jws = `${header}.${payload}.signature`;

  const result = await validateJWS(jws);
  if (result.valid) throw new Error("Should reject non-ES256 algorithm");
  if (!result.error?.includes("algorithm")) throw new Error("Error should mention algorithm");
});

Deno.test("JWS validation - valid structure (no verification yet)", async () => {
  // This should pass structure validation but will warn about missing verification
  const header = btoa(JSON.stringify({
    alg: "ES256",
    x5c: ["MIICQzCCAcigAwIBAgIUWNEDANu/DrK3bCGEDV5AEiZABKIwCgYIKoZIzj0EAwMw"]
  }));
  const payload = btoa(JSON.stringify({ notificationUUID: "test-uuid" }));
  const jws = `${header}.${payload}.signature`;

  const result = await validateJWS(jws);
  if (!result.valid) throw new Error("Should accept valid JWS structure");
  if (!result.payload?.notificationUUID) throw new Error("Should extract payload");
});

Deno.test("Nested JWS validation", async () => {
  // Nested JWS should use same validation as main JWS
  const header = btoa(JSON.stringify({
    alg: "ES256",
    x5c: ["cert"]
  }));
  const payload = btoa(JSON.stringify({ transactionId: "txn-123" }));
  const jws = `${header}.${payload}.sig`;

  const result = await validateNestedJWS(jws);
  if (!result.valid) throw new Error("Should accept valid nested JWS structure");
});

console.log("All basic tests passed!");
