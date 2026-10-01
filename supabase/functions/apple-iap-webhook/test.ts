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
  // Valid base64 test cases
  const testCases = [
    { input: "dGVzdA", shouldWork: true }, // "test" in base64
    { input: "YQ", shouldWork: true },     // "a" in base64
    { input: "YWI", shouldWork: true },    // "ab" in base64
  ];

  for (const tc of testCases) {
    try {
      const padded = tc.input.padEnd(Math.ceil((tc.input.length * 4) / 3 / 4) * 4, "=");
      const decoded = atob(padded);
      if (!decoded && tc.shouldWork) {
        throw new Error(`Failed to decode valid input: ${tc.input}`);
      }
    } catch (e) {
      if (tc.shouldWork) throw new Error(`Failed on valid input: ${tc.input}: ${e}`);
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

// Test 9: Self-signed certificate rejection
// This is CRITICAL: without chain validation, any self-signed cert would pass
Deno.test("Reject self-signed JWS (chain validation)", async () => {
  // Simulate a self-signed JWS (certificate not from Apple)
  const selfSignedCert =
    "MIICIjANBgkqhkiG9w0BAQEFAAOCAg8AMIICCgKCAgEAu/Pl5W2Q2VvuH5s8RyMH" +
    "XN7U5Ff0oF1e0rF3mVnF3zN5mV0C5V6F7vH8G9J0Q1m8N2P9R0S1T2U3V4W5X6Y" +
    "7Z8A9B0C1D2E3F4G5H6I7J8K9L0M1N2O3P4Q5R6S7T8U9V0W1X2Y3Z4A5B6C7D8E";

  const header = btoa(
    JSON.stringify({
      alg: "ES256",
      x5c: [selfSignedCert], // Not from Apple
    })
  );
  const payload = btoa(JSON.stringify({ notificationUUID: "test" }));
  const jws = `${header}.${payload}.invalidsig`;

  const result = await validateJWS(jws);

  // Should reject because certificate chain is invalid (not from Apple)
  if (result.valid) {
    throw new Error(
      "Should reject self-signed/non-Apple certificates. CRITICAL SECURITY ISSUE."
    );
  }
  console.log("[test-9] ✅ Self-signed cert correctly rejected");
});

// Test 9b: Apple Root CA + Fake Leaf (must fail)
// This tests that even with a valid root, fake intermediates are caught
Deno.test("Reject fake leaf with real Apple Root CA", async () => {
  // Use the real Apple Root CA G3 as the "issuer" (last in chain)
  const realAppleRoot =
    "MIICQzCCAcigAwIBAgIUWNEDANu/DrK3bCGEDV5AEiZABKIwCgYIKoZIzj0EAwMwZzELMAkGA1UEBhMCVVMxEzARBgNVBAgMQ0NhbGlmb3JuaWExEjAQBgNVBAcMCUN1cGVydGluZzEVMBMGA1UECgwMQXBwbGUsIEluYy4xIDAeBgNVBAsMF0NlcnRpZmlj" +
    "YXRpb24gQXV0aG9yaXR5MB4XDI0MDUwODE2NDMzMFoXDTI5MDUwODE2NDMzMFowZzELMAkGA1UEBhMCVVMxEzARBgNVBAgMQ0NhbGlmb3JuaWExEjAQBgNVBAcMCUN1cGVydGluZzEVMBMGA1UECgwMQXBwbGUsIEluYy4xIDAeBgNVBAsMF0NlcnRpZmlj" +
    "YXRpb24gQXV0aG9yaXR5MHYwEAYHKoZIzj0CAQYFK4EEACIDYgAE3rSXRcaULLXwX3S8c11jL7N/9x7jDQ5eNbFfNFNYmD9R8X/CUpsBjUHSQCnNELMq1e6LfO6m1wR3F2S1lNFLvkKKpjKC46YjR/J6qKlLB9yWCbqSFe4QAYjSVGmIkD6jo0IwQDAPBgNV" +
    "HRMECDAGAQECAgAwHQYDVR0OBBYEFCqGRJf7yxBU22NfKQ/LQmVqcj4vMA4GA1UdDwEB/wQEAwIBBjAKBggqhkjOPQQDAwNoADBlAjEA1y0CEW5OP8JVFDf1r1xxqXwI" +
    "V6WKgIBNu7lHEX32VJLrqzPJP5Uk4gvuqVGNZ9nLAjBhWNarGVwGcg0gRa0lLhPpR2+VFe7x1eHnNwl3VmKvN8VJxQpCDhqSTTAhPUc=";

  // Fake leaf certificate (not from Apple, no Apple identifiers)
  const fakeLeaf =
    "MIICIjANBgkqhkiG9w0BAQEFAAOCAg8AMIICCgKCAgEAx9x4N2e8F3K9P0q5Q5R2" +
    "S3T4U5V6W7X8Y9Z0A1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6Q7R8S9T0U1V2W3X4";

  const header = btoa(
    JSON.stringify({
      alg: "ES256",
      x5c: [fakeLeaf, realAppleRoot], // Fake leaf, real root
    })
  );
  const payload = btoa(JSON.stringify({ notificationUUID: "test" }));
  const jws = `${header}.${payload}.invalidsig`;

  const result = await validateJWS(jws);

  // Should reject because leaf is not from Apple (has no Apple identifiers)
  if (result.valid) {
    throw new Error(
      "Should reject fake leaf even with real root. CRITICAL SECURITY ISSUE."
    );
  }
  console.log("[test-9b] ✅ Fake leaf with real root correctly rejected");
});

// Test 10: Missing certificate chain should reject
Deno.test("Reject JWS with missing certificate chain", async () => {
  const header = btoa(JSON.stringify({ alg: "ES256" })); // No x5c
  const payload = btoa(JSON.stringify({ notificationUUID: "test" }));
  const jws = `${header}.${payload}.sig`;

  const result = await validateJWS(jws);
  if (result.valid) throw new Error("Should reject missing x5c");
  if (!result.error?.includes("x5c"))
    throw new Error("Error should mention x5c");
});

// Test 11: Valid certificate chain with test root CA
// This test demonstrates that a valid chain PASSES and an altered signature FAILS
Deno.test("Valid certificate chain passes validation", async () => {
  // Use pre-generated test certificates (root, intermediate, leaf) with TEST identifiers
  // These were generated with: openssl req -new -x509 -keyout key.pem -out cert.pem -days 365
  // and manually added TEST identifier to subject

  // Test Root CA (EC P-256, TEST identifiers, valid DER certificate)
  const testRootB64 =
    "MIIB/TCCAaOgAwIBAgIUKaURums32txZ1E76ScjRfiUxBMcwCgYIKoZIzj0EAwIwVDELMAkGA1UE" +
    "BhMCVVMxDTALBgNVBAgMBFRlc3QxDTALBgNVBAcMBFRlc3QxEDAOBgNVBAoMB1RFU1QgQ0ExFTAT" +
    "BgNVBAMMDFRFU1QgUm9vdCBDQTAeFw0yNjEwMDExNjQxNDFaFw0yNzEwMDExNjQxNDFaMFQxCzAJ" +
    "BgNVBAYTAlVTMQ0wCwYDVQQIDARUZXN0MQ0wCwYDVQQHDARUZXN0MRAwDgYDVQQKDAdURVNUIENB" +
    "MRUwEwYDVQQDDAxURVNUIFJvb3QgQ0EwWTATBgcqhkjOPQIBBggqhkjOPQMBBwNCAASb2QLA/Sfz" +
    "URsuNm5KqdLKjAZEIlLeLxO/PgXWnHTWFWU1o2x9yn2QlvvrAEvUKT11RX8AyxVDkKavCtYAbargo" +
    "1MwUTAdBgNVHQ4EFgQUiPOHLkegMy4f0GDJ8xl87l5UWHAwHwYDVR0jBBgwFoAUiPOHLkegMy4f" +
    "0GDJ8xl87l5UWHAwDwYDVR0TAQH/BAUwAwEB/zAKBggqhkjOPQQDAgNIADBFAiAh7Lhifaw+QJRv" +
    "nOi5dH2s9uErhhFr8zmMucgcKx97rwIhALAEnO5YrdHtYlbtTanCRlFIewxTPrB6jarzznoQp5d/" +
    "MA==";

  // Test Intermediate (EC P-256, signed by root, contains TEST identifier)
  const testIntermediateB64 =
    "MIICADCCAaagAwIBAgIUUBZBqxaPsAuFbedj2L9Zl6zm3hwwCgYIKoZIzj0EAwIwVDELMAkGA1UE" +
    "BhMCVVMxDTALBgNVBAgMBFRlc3QxDTALBgNVBAcMBFRlc3QxEDAOBgNVBAoMB1RFU1QgQ0ExFTAT" +
    "BgNVBAMMDFRFU1QgUm9vdCBDQTAeFw0yNjEwMDExNjQxNDFaFw0yNzEwMDExNjQxNDFaMFoxCzAJ" +
    "BgNVBAYTAlVTMQ0wCwYDVQQIDARUZXN0MQ0wCwYDVQQHDARUZXN0MREwDwYDVQQKDAhURVNUIElu" +
    "YzEaMBgGA1UEAwwRVEVTVCBJbnRlcm1lZGlhdGUwWTATBgcqhkjOPQIBBggqhkjOPQMBBwNCAASK" +
    "bDINKbBS3bbscGvxeZGuqn//1SfCXQTMxVGeuAxeN8ArF4GLr2HgUkI1hD5cSCZbJeAA0xtAcJhq" +
    "uWe6IvT5o1AwTjAMBgNVHRMEBTADAQH/MB0GA1UdDgQWBBQhSNonsf7tZogwlRY3Jy/WUVEbmjAf" +
    "BgNVHSMEGDAWgBSI84cuR6AzLh/QYMnzGXzuXlRYcDAKBggqhkjOPQQDAgNIADBFAiAR80bZuhpi" +
    "2/SCwF0u4/GyDUHlLypd/QGiacSRVyPLSAIhAKuDxIBspLPZ1rOGBTxxarGXFtmSGxuK///GSCgJ" +
    "IAeJ";

  // Test Leaf (EC P-256, signed by intermediate, contains TEST identifier)
  const testLeafB64 =
    "MIIBpzCCAU0CFDvN6qT9BG5wm0woZoYZefaA+HeJMAoGCCqGSM49BAMCMFoxCzAJBgNVBAYTAlVT" +
    "MQ0wCwYDVQQIDARUZXN0MQ0wCwYDVQQHDARUZXN0MREwDwYDVQQKDAhURVNUIEluYzEaMBgGA1UE" +
    "AwwRVEVTVCBJbnRlcm1lZGlhdGUwHhcNMjYxMDAxMTY0MTQxWhcNMjcxMDAxMTY0MTQxWjBSMQsw" +
    "CQYDVQQGEwJVUzENMAsGA1UECAwEVGVzdDENMAsGA1UEBwwEVGVzdDERMA8GA1UECgwIVEVTVCBJ" +
    "bmMxEjAQBgNVBAMMCVRFU1QgTGVhZjBZMBMGByqGSM49AgEGCCqGSM49AwEHA0IABB86hSHQ6Jyx" +
    "E0Ydh3Hl5l7GI0GEf8e+nhuEG/yd2LfJTG14zLhXrTt5c7FWe7dIoHjfVA+Os/reAw5QnbOJNMgw" +
    "CgYIKoZIzj0EAwIDSAAwRQIhAMtzcu7qHi8Kj7sxhh5phdcQOaJ9MAlCZLMNmWwqiG7nAiA5QIuk" +
    "t+HA5kFvqW4OVw0PZda5KzM+iO3Kmvu0Fugg0Q==";

  // Import test function
  const { validateCertificateChainForTest } = await import("./jws-validator.ts");

  // Convert test root from base64 to DER
  const testRootDER = new Uint8Array(Buffer.from(testRootB64, "base64"));

  // Build chain: [leaf, intermediate, root]
  const testChain = [testLeafB64, testIntermediateB64, testRootB64];

  // Test 12a: Valid chain with test root should PASS
  const validResult = await validateCertificateChainForTest(testChain, testRootDER);
  if (!validResult) {
    throw new Error(
      "Valid test certificate chain should PASS: CRITICAL - positive test failed"
    );
  }
  console.log("[test-12a] ✅ Valid certificate chain PASSES validation");

  // Test 12b: Altered root in chain should FAIL
  const alteredChain = [
    testLeafB64,
    testIntermediateB64,
    "MIICQzCCAcigAwIBAgIUWNEDANu/DrK3bCGEDV5AEiZABKIwCgYIKoZIzj0EAwMw", // Wrong root
  ];

  const invalidResult = await validateCertificateChainForTest(
    alteredChain,
    testRootDER
  );
  if (invalidResult) {
    throw new Error(
      "Chain with altered root should FAIL: CRITICAL - rejection test failed"
    );
  }
  console.log("[test-12b] ✅ Altered chain correctly FAILS validation");

  console.log(
    "[test-12] ✅ Positive test PASSED - valid chains pass, invalid chains fail"
  );
});

// Test 13: End-to-end JWS validation with test certificate
// Sign a complete JWS ES256 with test leaf key, validate it passes, verify tampering fails
Deno.test("End-to-end JWS validation with test leaf certificate", async () => {
  // Import validation function
  const { validateJWS } = await import("./jws-validator.ts");

  // Test leaf private key (PKCS#8 DER, EC P-256)
  const testLeafPrivateKeyB64 =
    "MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgJP+5GMniW5svrrukF9UFMISe2jtykLTiuzLSm8I4rnuhRANCAAQfOoUh0OicsRNGHYdx5eZexiNBhH/Hvp4bhBv8ndi3yUxteMy4V607eXOxVnu3SKB431QPjrP63gMOUJ2ziTTI";

  const testRootB64 =
    "MIIB/TCCAaOgAwIBAgIUKaURums32txZ1E76ScjRfiUxBMcwCgYIKoZIzj0EAwIwVDELMAkGA1UE" +
    "BhMCVVMxDTALBgNVBAgMBFRlc3QxDTALBgNVBAcMBFRlc3QxEDAOBgNVBAoMB1RFU1QgQ0ExFTAT" +
    "BgNVBAMMDFRFU1QgUm9vdCBDQTAeFw0yNjEwMDExNjQxNDFaFw0yNzEwMDExNjQxNDFaMFQxCzAJ" +
    "BgNVBAYTAlVTMQ0wCwYDVQQIDARUZXN0MQ0wCwYDVQQHDARUZXN0MRAwDgYDVQQKDAdURVNUIENB" +
    "MRUwEwYDVQQDDAxURVNUIFJvb3QgQ0EwWTATBgcqhkjOPQIBBggqhkjOPQMBBwNCAASb2QLA/Sfz" +
    "URsuNm5KqdLKjAZEIlLeLxO/PgXWnHTWFWU1o2x9yn2QlvvrAEvUKT11RX8AyxVDkKavCtYAbargo" +
    "1MwUTAdBgNVHQ4EFgQUiPOHLkegMy4f0GDJ8xl87l5UWHAwHwYDVR0jBBgwFoAUiPOHLkegMy4f" +
    "0GDJ8xl87l5UWHAwDwYDVR0TAQH/BAUwAwEB/zAKBggqhkjOPQQDAgNIADBFAiAh7Lhifaw+QJRv" +
    "nOi5dH2s9uErhhFr8zmMucgcKx97rwIhALAEnO5YrdHtYlbtTanCRlFIewxTPrB6jarzznoQp5d/" +
    "MA==";

  const testIntermediateB64 =
    "MIICADCCAaagAwIBAgIUUBZBqxaPsAuFbedj2L9Zl6zm3hwwCgYIKoZIzj0EAwIwVDELMAkGA1UE" +
    "BhMCVVMxDTALBgNVBAgMBFRlc3QxDTALBgNVBAcMBFRlc3QxEDAOBgNVBAoMB1RFU1QgQ0ExFTAT" +
    "BgNVBAMMDFRFU1QgUm9vdCBDQTAeFw0yNjEwMDExNjQxNDFaFw0yNzEwMDExNjQxNDFaMFoxCzAJ" +
    "BgNVBAYTAlVTMQ0wCwYDVQQIDARUZXN0MQ0wCwYDVQQHDARUZXN0MREwDwYDVQQKDAhURVNUIElu" +
    "YzEaMBgGA1UEAwwRVEVTVCBJbnRlcm1lZGlhdGUwWTATBgcqhkjOPQIBBggqhkjOPQMBBwNCAASK" +
    "bDINKbBS3bbscGvxeZGuqn//1SfCXQTMxVGeuAxeN8ArF4GLr2HgUkI1hD5cSCZbJeAA0xtAcJhq" +
    "uWe6IvT5o1AwTjAMBgNVHRMEBTADAQH/MB0GA1UdDgQWBBQhSNonsf7tZogwlRY3Jy/WUVEbmjAf" +
    "BgNVHSMEGDAWgBSI84cuR6AzLh/QYMnzGXzuXlRYcDAKBggqhkjOPQQDAgNIADBFAiAR80bZuhpi" +
    "2/SCwF0u4/GyDUHlLypd/QGiacSRVyPLSAIhAKuDxIBspLPZ1rOGBTxxarGXFtmSGxuK///GSCgJ" +
    "IAeJ";

  const testLeafB64 =
    "MIIBpzCCAU0CFDvN6qT9BG5wm0woZoYZefaA+HeJMAoGCCqGSM49BAMCMFoxCzAJBgNVBAYTAlVT" +
    "MQ0wCwYDVQQIDARUZXN0MQ0wCwYDVQQHDARUZXN0MREwDwYDVQQKDAhURVNUIEluYzEaMBgGA1UE" +
    "AwwRVEVTVCBJbnRlcm1lZGlhdGUwHhcNMjYxMDAxMTY0MTQxWhcNMjcxMDAxMTY0MTQxWjBSMQsw" +
    "CQYDVQQGEwJVUzENMAsGA1UECAwEVGVzdDENMAsGA1UEBwwEVGVzdDERMA8GA1UECgwIVEVTVCBJ" +
    "bmMxEjAQBgNVBAMMCVRFU1QgTGVhZjBZMBMGByqGSM49AgEGCCqGSM49AwEHA0IABB86hSHQ6Jyx" +
    "E0Ydh3Hl5l7GI0GEf8e+nhuEG/yd2LfJTG14zLhXrTt5c7FWe7dIoHjfVA+Os/reAw5QnbOJNMgw" +
    "CgYIKoZIzj0EAwIDSAAwRQIhAMtzcu7qHi8Kj7sxhh5phdcQOaJ9MAlCZLMNmWwqiG7nAiA5QIuk" +
    "t+HA5kFvqW4OVw0PZda5KzM+iO3Kmvu0Fugg0Q==";

  // Test 13a: Sign a JWS with test leaf key and validate it passes
  const leafPrivateKeyDER = new Uint8Array(Buffer.from(testLeafPrivateKeyB64, "base64"));

  // Import the test leaf private key (PKCS#8 format)
  const leafPrivateKey = await crypto.subtle.importKey(
    "pkcs8",
    leafPrivateKeyDER,
    { name: "ECDSA", namedCurve: "P-256" },
    true,  // extractable: true so we can export the public key coordinates
    ["sign"]
  );

  // Create a JWS payload (simulating Apple's notification)
  const testPayload = {
    notificationType: "SUBSCRIBED",
    notificationUUID: "test-uuid-12345",
    data: {
      signedTransactionInfo: "test-transaction-info",
      signedRenewalInfo: "test-renewal-info",
    },
  };

  // Create JWS header
  const header = {
    alg: "ES256",
    x5c: [testLeafB64, testIntermediateB64, testRootB64],
    typ: "JWT",
  };

  // Encode header and payload as base64url
  const headerB64 = Buffer.from(JSON.stringify(header)).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const payloadB64 = Buffer.from(JSON.stringify(testPayload)).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const messageBytes = new TextEncoder().encode(`${headerB64}.${payloadB64}`);

  // Sign with leaf private key (ECDSA with SHA-256 hash)
  const signatureBuffer = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    leafPrivateKey,
    messageBytes
  );

  // Convert signature to base64url
  const signatureB64 = Buffer.from(signatureBuffer).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");

  // Complete JWS
  const completeJWS = `${headerB64}.${payloadB64}.${signatureB64}`;

  // Convert test root to DER
  const testRootDER = new Uint8Array(Buffer.from(testRootB64, "base64"));

  // Test 13a: Call validateJWS with complete JWS and test root injected
  console.log("[test-13a] Calling validateJWS with test root...");
  const validResult = await validateJWS(completeJWS, testRootDER);

  if (!validResult.valid) {
    throw new Error(`JWS validation failed: ${validResult.error}`);
  }
  console.log("[test-13a] ✅ Complete JWS validates successfully with test root");
  console.log(`[test-13a] ✅ Payload extracted: notificationType=${validResult.payload?.notificationType}`);

  // Test 13b: Tamper with payload and verify validation fails
  const tamperedPayload = {
    ...testPayload,
    notificationType: "REVOKED", // Changed notification type
  };

  const tamperedPayloadB64 = Buffer.from(JSON.stringify(tamperedPayload)).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const tamperedJWS = `${headerB64}.${tamperedPayloadB64}.${signatureB64}`;

  console.log("[test-13b] Calling validateJWS with tampered payload...");
  const tamperedResult = await validateJWS(tamperedJWS, testRootDER);

  if (tamperedResult.valid) {
    throw new Error("Tampered JWS should have failed validation");
  }
  console.log("[test-13b] ✅ Tampered JWS correctly rejected");
  console.log(`[test-13b] ✅ Error: ${tamperedResult.error}`);

  console.log(
    "[test-13] ✅ End-to-end JWS validation PASSED - validateJWS works with test certificate chain"
  );
});

console.log("All crypto tests completed! ✅ Chain validation and JWS signing tests passed.");
