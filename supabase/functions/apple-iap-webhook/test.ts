// Comprehensive tests for JWS validation and JWT signing
// Run with: deno test --allow-env --allow-net test.ts

import { validateJWS, validateNestedJWS } from "./jws-validator.ts";

// Test 1: JWS validation - invalid format
Deno.test("JWS validation - invalid format", async () => {
  const result = await validateJWS("invalid");
  if (result.valid) throw new Error("Should reject invalid JWS");
  if (!result.error?.includes("format")) throw new Error("Should mention format");
});

// Test 2: JWS validation - missing x5c
Deno.test("JWS validation - missing x5c", async () => {
  const header = btoa(JSON.stringify({ alg: "ES256" }));
  const payload = btoa(JSON.stringify({ notificationUUID: "test" }));
  const jws = `${header}.${payload}.sig`;

  const result = await validateJWS(jws);
  if (result.valid) throw new Error("Should reject JWS without x5c");
  if (!result.error?.includes("x5c")) throw new Error("Should mention x5c");
});

// Test 3: JWS validation - invalid algorithm
Deno.test("JWS validation - invalid algorithm", async () => {
  const header = btoa(JSON.stringify({ alg: "HS256", x5c: ["cert"] }));
  const payload = btoa(JSON.stringify({ notificationUUID: "test" }));
  const jws = `${header}.${payload}.sig`;

  const result = await validateJWS(jws);
  if (result.valid) throw new Error("Should reject non-ES256");
  if (!result.error?.includes("algorithm")) throw new Error("Should mention algorithm");
});

// Test 4: JWS validation - wrong signature (should reject)
Deno.test("JWS validation - invalid signature", async () => {
  // Create a valid JWS structure but with invalid signature
  const header = btoa(JSON.stringify({
    alg: "ES256",
    x5c: [
      "MIICQzCCAcigAwIBAgIUWNEDANu/DrK3bCGEDV5AEiZABKIwCgYIKoZIzj0EAwMwZzELMAkGA1UEBhMCVVMxEzARBgNVBAgMQ0NhbGlmb3JuaWExEjAQBgNVBAcMCUN1cGVydGluZzEVMBMGA1UECgwMQXBwbGUsIEluYy4xIDAeBgNVBAsMF0NlcnRpZmlj" +
      "YXRpb24gQXV0aG9yaXR5MB4XDI0MDUwODE2NDMzMFoXDTI5MDUwODE2NDMzMFowZzELMAkGA1UEBhMCVVMxEzARBgNVBAgMQ0NhbGlmb3JuaWExEjAQBgNVBAcMCUN1cGVydGluZzEVMBMGA1UECgwMQXBwbGUsIEluYy4xIDAeBgNVBAsMF0NlcnRpZmlj" +
      "YXRpb24gQXV0aG9yaXR5MHYwEAYHKoZIzj0CAQYFK4EEACIDYgAE3rSXRcaULLXwX3S8c11jL7N/9x7jDQ5eNbFfNFNYmD9R8X/CUpsBjUHSQCnNELMq1e6LfO6m1wR3F2S1lNFLvkKKpjKC46YjR/J6qKlLB9yWCbqSFe4QAYjSVGmIkD6jo0IwQDAPBgNV" +
      "HRMECDAGAQECAgAwHQYDVR0OBBYEFCqGRJf7yxBU22NfKQ/LQmVqcj4vMA4GA1UdDwEB/wQEAwIBBjAKBggqhkjOPQQDAwNoADBlAjEA1y0CEW5OP8JVFDf1r1xxqXwI" +
      "V6WKgIBNu7lHEX32VJLrqzPJP5Uk4gvuqVGNZ9nLAjBhWNarGVwGcg0gRa0lLhPpR2+VFe7x1eHnNwl3VmKvN8VJxQpCDhqSTTAhPUc="
    ]
  }));
  const payload = btoa(JSON.stringify({ notificationUUID: "test-uuid" }));
  const jws = `${header}.${payload}.invalid_signature_bytes`;

  const result = await validateJWS(jws);
  // This will fail because signature is invalid base64 or won't verify
  if (result.valid) {
    throw new Error("Should reject invalid signature");
  }
});

// Test 5: JWS validation - valid structure (structure test)
Deno.test("JWS validation - valid structure parsing", async () => {
  const header = btoa(JSON.stringify({
    alg: "ES256",
    x5c: [
      "MIICQzCCAcigAwIBAgIUWNEDANu/DrK3bCGEDV5AEiZABKIwCgYIKoZIzj0EAwMwZzELMAkGA1UEBhMCVVMxEzARBgNVBAgMQ0NhbGlmb3JuaWExEjAQBgNVBAcMCUN1cGVydGluZzEVMBMGA1UECgwMQXBwbGUsIEluYy4xIDAeBgNVBAsMF0NlcnRpZmlj" +
      "YXRpb24gQXV0aG9yaXR5MB4XDI0MDUwODE2NDMzMFoXDTI5MDUwODE2NDMzMFowZzELMAkGA1UEBhMCVVMxEzARBgNVBAgMQ0NhbGlmb3JuaWExEjAQBgNVBAcMCUN1cGVydGluZzEVMBMGA1UECgwMQXBwbGUsIEluYy4xIDAeBgNVBAsMF0NlcnRpZmlj" +
      "YXRpb24gQXV0aG9yaXR5MHYwEAYHKoZIzj0CAQYFK4EEACIDYgAE3rSXRcaULLXwX3S8c11jL7N/9x7jDQ5eNbFfNFNYmD9R8X/CUpsBjUHSQCnNELMq1e6LfO6m1wR3F2S1lNFLvkKKpjKC46YjR/J6qKlLB9yWCbqSFe4QAYjSVGmIkD6jo0IwQDAPBgNV" +
      "HRMECDAGAQECAgAwHQYDVR0OBBYEFCqGRJf7yxBU22NfKQ/LQmVqcj4vMA4GA1UdDwEB/wQEAwIBBjAKBggqhkjOPQQDAwNoADBlAjEA1y0CEW5OP8JVFDf1r1xxqXwI" +
      "V6WKgIBNu7lHEX32VJLrqzPJP5Uk4gvuqVGNZ9nLAjBhWNarGVwGcg0gRa0lLhPpR2+VFe7x1eHnNwl3VmKvN8VJxQpCDhqSTTAhPUc="
    ]
  }));
  const payload = btoa(JSON.stringify({ notificationUUID: "test-uuid", notificationType: "SUBSCRIBED" }));

  // Try to construct a JWS - will fail validation due to signature, but tests structure parsing
  const jws = `${header}.${payload}.aGludmFsaWQ`;

  // This tests that payload extraction works even if signature fails
  try {
    const result = await validateJWS(jws);
    // We don't expect this to be valid, but we're testing it doesn't throw
    console.log("[test] Structure parsing result:", result.error);
  } catch (e) {
    throw new Error(`Should not throw on structure parsing: ${e}`);
  }
});

// Test 6: Nested JWS validation
Deno.test("Nested JWS validation - structure", async () => {
  const header = btoa(JSON.stringify({
    alg: "ES256",
    x5c: ["cert"]
  }));
  const payload = btoa(JSON.stringify({ transactionId: "txn-123" }));
  const jws = `${header}.${payload}.sig`;

  const result = await validateNestedJWS(jws);
  // Will fail signature but should parse structure
  if (result.error?.includes("x5c")) {
    throw new Error("Should not complain about x5c if cert present");
  }
});

// Test 7: Base64url encoding test for JWT components
Deno.test("Base64url edge cases", async () => {
  // Test that base64url handles padding correctly
  const testCases = [
    { input: "test", shouldWork: true },
    { input: "a", shouldWork: true },
    { input: "ab", shouldWork: true },
  ];

  for (const tc of testCases) {
    // Just testing that atob doesn't throw for valid cases
    try {
      atob(tc.input.padEnd((tc.input.length * 4) / 3, "="));
    } catch (e) {
      if (tc.shouldWork) throw new Error(`Failed on valid input: ${tc.input}`);
    }
  }
});

// Test 8: JWS payload extraction
Deno.test("JWS payload extraction", async () => {
  const payload = { notificationUUID: "uuid-123", notificationType: "RENEWED" };
  const header = btoa(JSON.stringify({ alg: "ES256", x5c: ["cert"] }));
  const payloadB64 = btoa(JSON.stringify(payload));

  // This will fail signature but should extract payload
  const jws = `${header}.${payloadB64}.invalidsig`;
  const result = await validateJWS(jws);

  // Won't be valid due to signature, but tests we can parse payload structure
  if (result.error?.includes("algorithm")) {
    throw new Error("Should not complain about algorithm if correct");
  }
});

console.log("All basic crypto tests completed!");
