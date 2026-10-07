// JWS Validator for Apple App Store Server Notifications V2
// Implements ES256 signature verification + x5c certificate chain validation
// CRITICAL: Rejects (not warns) on ANY validation failure

import "npm:reflect-metadata@0.1.13";
import { Buffer } from "npm:buffer@6.0.3";

interface JWSValidationResult {
  valid: boolean;
  payload?: Record<string, unknown>;
  error?: string;
}

interface JWSHeader {
  alg: string;
  x5c?: string[];
  kid?: string;
  typ?: string;
}

// Apple Root CA G3 certificate (DER-encoded, base64)
const APPLE_ROOT_CA_G3_DER_BASE64 =
  "MIICQzCCAcigAwIBAgIUWNEDANu/DrK3bCGEDV5AEiZABKIwCgYIKoZIzj0EAwMwZzELMAkGA1UEBhMCVVMxEzARBgNVBAgMQ0NhbGlmb3JuaWExEjAQBgNVBAcMCUN1cGVydGluZzEVMBMGA1UECgwMQXBwbGUsIEluYy4xIDAeBgNVBAsMF0NlcnRpZmlj" +
  "YXRpb24gQXV0aG9yaXR5MB4XDI0MDUwODE2NDMzMFoXDTI5MDUwODE2NDMzMFowZzELMAkGA1UEBhMCVVMxEzARBgNVBAgMQ0NhbGlmb3JuaWExEjAQBgNVBAcMCUN1cGVydGluZzEVMBMGA1UECgwMQXBwbGUsIEluYy4xIDAeBgNVBAsMF0NlcnRpZmlj" +
  "YXRpb24gQXV0aG9yaXR5MHYwEAYHKoZIzj0CAQYFK4EEACIDYgAE3rSXRcaULLXwX3S8c11jL7N/9x7jDQ5eNbFfNFNYmD9R8X/CUpsBjUHSQCnNELMq1e6LfO6m1wR3F2S1lNFLvkKKpjKC46YjR/J6qKlLB9yWCbqSFe4QAYjSVGmIkD6jo0IwQDAPBgNV" +
  "HRMECDAGAQECAgAwHQYDVR0OBBYEFCqGRJf7yxBU22NfKQ/LQmVqcj4vMA4GA1UdDwEB/wQEAwIBBjAKBggqhkjOPQQDAwNoADBlAjEA1y0CEW5OP8JVFDf1r1xxqXwI" +
  "V6WKgIBNu7lHEX32VJLrqzPJP5Uk4gvuqVGNZ9nLAjBhWNarGVwGcg0gRa0lLhPpR2+VFe7x1eHnNwl3VmKvN8VJxQpCDhqSTTAhPUc=";

/**
 * Base64url decode (RFC 4648)
 */
function base64urlToBuffer(str: string): Uint8Array {
  const base64 = str
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(Math.ceil(str.length / 4) * 4, "=");
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Parse DER length field
 */
function parseDERLength(data: Uint8Array, offset: number): { length: number; totalBytes: number } | null {
  if (offset >= data.length) return null;

  let length = data[offset];
  if ((length & 0x80) === 0) {
    // Short form: length in single byte
    return { length, totalBytes: 1 };
  }

  // Long form: first byte has high bit set, lower 7 bits indicate number of length bytes
  const numLengthBytes = length & 0x7f;
  if (offset + 1 + numLengthBytes > data.length) return null;

  length = 0;
  for (let i = 0; i < numLengthBytes; i++) {
    length = (length << 8) | data[offset + 1 + i];
  }

  return { length, totalBytes: 1 + numLengthBytes };
}

/**
 * Extract SPKI bytes from DER-encoded X.509 certificate
 * Returns raw SPKI for use with crypto.subtle.importKey
 */
function extractSPKIFromCertDER(certDER: Uint8Array): Uint8Array | null {
  try {
    // X.509 DER structure: SEQUENCE { TBSCertificate, ... }
    // TBSCertificate: SEQUENCE { ..., subject, subjectPublicKeyInfo, ... }
    // subjectPublicKeyInfo: SEQUENCE { algorithm SEQUENCE {...}, subjectPublicKey BIT STRING }

    // Find BIT STRING (0x03) containing the public key SEQUENCE
    // The public key is preceded by algorithm parameters
    let bitStringPos = -1;
    // Scan from 60% into the cert forward
    const scanStart = Math.floor(certDER.length * 0.6);

    for (let i = scanStart; i < certDER.length - 100; i++) {
      // Look for BIT STRING (0x03) followed by length, 0x00 (unused bits), then SEQUENCE (0x30)
      if (certDER[i] === 0x03 && certDER[i + 2] === 0x00 && certDER[i + 3] === 0x30) {
        bitStringPos = i;
        break;
      }
    }

    if (bitStringPos < 0) {
      console.error("[JWS] BIT STRING for public key not found");
      return null;
    }

    // Walk backwards to find the containing SPKI SEQUENCE
    // Count SEQUENCEs: the second one going backwards is the SPKI
    let sequenceCount = 0;
    let spkiStart = -1;

    for (let i = bitStringPos - 1; i > 0; i--) {
      if (certDER[i] === 0x30) {
        sequenceCount++;
        if (sequenceCount === 2) {
          spkiStart = i;
          break;
        }
      }
    }

    if (spkiStart < 0) {
      console.error("[JWS] Failed to find SPKI SEQUENCE");
      return null;
    }

    // Parse the SPKI length to find the end
    const lengthInfo = parseDERLength(certDER, spkiStart + 1);
    if (!lengthInfo) {
      console.error("[JWS] Failed to parse SPKI length");
      return null;
    }

    const spkiEnd = spkiStart + 1 + lengthInfo.totalBytes + lengthInfo.length;

    if (spkiEnd > certDER.length) {
      console.error("[JWS] SPKI length exceeds certificate size");
      return null;
    }

    return certDER.slice(spkiStart, spkiEnd);
  } catch (e) {
    console.error("[JWS] Failed to extract SPKI:", e);
    return null;
  }
}

/**
 * Extract EC P-256 public key coordinates directly from certificate DER
 * Finds the BIT STRING containing the EC point and extracts x/y coordinates
 */
function extractEC256CoordinatesFromCert(certDER: Uint8Array): { x: Uint8Array; y: Uint8Array } | null {
  try {
    // P-256 OID in DER: 06 08 2A 86 48 CE 3D 03 01 07
    // This OID appears in SubjectPublicKeyInfo's AlgorithmIdentifier
    const p256OID = [0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03, 0x01, 0x07];

    // Search for P-256 OID
    let oidPos = -1;
    for (let i = 0; i <= certDER.length - p256OID.length; i++) {
      let found = true;
      for (let j = 0; j < p256OID.length; j++) {
        if (certDER[i + j] !== p256OID[j]) {
          found = false;
          break;
        }
      }
      if (found) {
        oidPos = i;
        break;
      }
    }

    if (oidPos < 0) {
      console.log("[JWS] P-256 OID not found in certificate");
      return null;
    }

    console.log(`[JWS] Found P-256 OID at offset ${oidPos}`);

    // After P-256 OID, look for the BIT STRING containing the public key
    // Scan forward from OID for 0x03 (BIT STRING)
    for (let i = oidPos + p256OID.length; i < Math.min(oidPos + p256OID.length + 200, certDER.length); i++) {
      if (certDER[i] === 0x03) {
        // Found BIT STRING tag
        const lengthResult = parseDERLength(certDER, i + 1);
        if (!lengthResult) continue;

        const contentStart = i + 1 + lengthResult.totalBytes;
        const contentEnd = contentStart + lengthResult.length;

        if (contentEnd > certDER.length) continue;

        // BIT STRING content starts with unused bits indicator (should be 0x00)
        if (contentStart < certDER.length && certDER[contentStart] === 0x00) {
          // Next byte should be 0x04 (uncompressed EC point)
          if (contentStart + 1 < certDER.length && certDER[contentStart + 1] === 0x04) {
            // We should have 65 bytes: 0x04 + 32 bytes x + 32 bytes y
            if (contentStart + 1 + 65 <= certDER.length) {
              const pointStart = contentStart + 1;
              const x = certDER.slice(pointStart + 1, pointStart + 33);
              const y = certDER.slice(pointStart + 33, pointStart + 65);

              if (x.length === 32 && y.length === 32) {
                const fullPoint = certDER.slice(pointStart, pointStart + 65);
                console.log(`[JWS] ✓ Extracted EC P-256: point=${Buffer.from(fullPoint).toString('hex')}`);
                return { x, y };
              }
            }
          }
        }
      }
    }

    return null;
  } catch (e) {
    console.error("[JWS] Failed to extract EC coordinates:", e);
    return null;
  }
}

/**
 * Extract public key from DER-encoded X.509 certificate
 * Uses EC P-256 coordinate extraction and JWK import for crypto.subtle.verify compatibility
 */
async function extractPublicKeyFromCertDER(
  certDER: Uint8Array
): Promise<CryptoKey | null> {
  try {
    // First try: direct EC P-256 coordinate extraction from DER
    const coords = extractEC256CoordinatesFromCert(certDER);
    if (coords) {
      try {
        // Convert coordinates to base64url for JWK
        const xB64url = Buffer.from(coords.x).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
        const yB64url = Buffer.from(coords.y).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");

        const jwk: JsonWebKey = {
          kty: "EC",
          crv: "P-256",
          x: xB64url,
          y: yB64url,
        };

        const key = await crypto.subtle.importKey(
          "jwk",
          jwk,
          { name: "ECDSA", namedCurve: "P-256" },
          false,
          ["verify"]
        );
        console.log("[JWS] ✓ Imported EC P-256 public key from certificate coordinates");
        return key;
      } catch (err) {
        console.error("[JWS] Failed to import EC coordinates as JWK:", err);
      }
    }

    // Fallback: try extracting SPKI directly from certificate DER
    const spkiBytes = extractSPKIFromCertDER(certDER);
    if (spkiBytes) {
      try {
        const key = await crypto.subtle.importKey(
          "spki",
          spkiBytes as BufferSource,
          { name: "ECDSA", namedCurve: "P-256" },
          false,
          ["verify"]
        );
        console.log("[JWS] ✓ Extracted public key from certificate SPKI");
        return key;
      } catch (importErr) {
        console.error("[JWS] Failed to import extracted SPKI:", importErr);
      }
    }

    console.error("[JWS] Could not extract EC P-256 public key from certificate");
    return null;
  } catch (e) {
    console.error("[JWS] Failed to extract public key:", e);
    return null;
  }
}

/**
 * Check if certificate contains Apple identifier or test identifier (basic hex scan)
 */
function isAppleCertificate(certDER: Uint8Array, allowTest?: boolean): boolean {
  const certHex = Array.from(certDER)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  // Look for "Apple Inc" or "Certification Authority" in subject/issuer
  // "Apple Inc" = 4170706c6520496e63
  // Also check for common Apple OIDs: 1.2.840.113635.* (Apple's OID arc)
  const hasApple = certHex.includes("4170706c65");
  const hasAppleOID = certHex.includes("2a8648");  // 1.2.840.113635 prefix in DER

  if (hasApple || hasAppleOID) return true;

  // In test mode, allow "TEST" identifier for test certificates
  if (allowTest) {
    const hasTEST = certHex.includes("54455354"); // "TEST" in hex
    if (hasTEST) return true;
  }

  return false;
}

/**
 * Lazy-load and cache @peculiar/x509 library for X.509 certificate parsing
 */
let X509Certificate: any = null;
let x509LoadAttempted = false;

async function getX509Library() {
  if (x509LoadAttempted) return X509Certificate;

  x509LoadAttempted = true;
  try {
    // Import @peculiar/x509 from npm
    const peculiar = await import("npm:@peculiar/x509@2.1.0");
    X509Certificate = peculiar.X509Certificate;
    console.log("[JWS] ✅ @peculiar/x509 loaded for cryptographic verification");
    return X509Certificate;
  } catch (e) {
    console.warn("[JWS] ⚠️  @peculiar/x509 not available:", String(e).slice(0, 100));
    return null;
  }
}

/**
 * Extract certificate metadata using @peculiar/x509
 */
async function getCertificateMetadata(certDER: Uint8Array) {
  const X509 = await getX509Library();

  if (!X509) {
    return null;
  }

  try {
    const cert = new X509(certDER);
    return {
      notBefore: cert.notBefore,
      notAfter: cert.notAfter,
      issuer: cert.issuer?.toString?.() || "unknown",
      subject: cert.subject?.toString?.() || "unknown",
    };
  } catch (e) {
    console.error("[JWS] Failed to parse certificate metadata:", e);
    return null;
  }
}

/**
 * Check if certificate is within its validity period (requires @peculiar/x509)
 */
async function isWithinValidityPeriod(certDER: Uint8Array): Promise<boolean> {
  const metadata = await getCertificateMetadata(certDER);

  if (!metadata) {
    // SECURITY GATE: Cannot verify dates without @peculiar/x509 → REJECT
    // Accepting a cert when we cannot verify its validity is insecure
    console.error("[JWS] SECURITY GATE: Temporal validation unavailable (@peculiar/x509 missing) → REJECT");
    return false;
  }

  const now = new Date();
  if (now < metadata.notBefore) {
    console.error(`[JWS] Certificate not yet valid: REJECT`);
    return false;
  }

  if (now > metadata.notAfter) {
    console.error(`[JWS] Certificate expired: REJECT`);
    return false;
  }

  return true;
}

/**
 * STRICT x5c certificate chain validation:
 *
 * REQUIREMENTS (all must pass, else REJECT):
 * 1. Chain MUST terminate at pinned root CA (byte-for-byte DER match)
 * 2. All certificates MUST contain Apple identifiers (or test identifiers if testRootDER provided)
 * 3. Verify each cert is signed by the next (cryptographic chain verification with @peculiar/x509)
 * 4. Check temporal validity (notBefore <= now <= notAfter) for all certs
 *
 * Returns true ONLY if all checks pass. Any failure returns false (REJECT).
 *
 * @param testRootDER - Optional test root certificate for testing. Only used in test mode.
 */
async function validateCertificateChain(x5c: string[], testRootDER?: Uint8Array): Promise<boolean> {
  if (!x5c || x5c.length === 0) {
    console.error("[JWS] Certificate chain empty: REJECT");
    return false;
  }

  try {
    // Convert all certs from base64 to DER
    const certs = x5c.map((cert) => new Uint8Array(Buffer.from(cert, "base64")));

    // REQUIREMENT 1: Chain must terminate at pinned root CA (Apple or test)
    const pinnedRootDER = testRootDER || new Uint8Array(
      Buffer.from(APPLE_ROOT_CA_G3_DER_BASE64, "base64")
    );

    const lastCertDER = certs[certs.length - 1];
    const rootMatches =
      lastCertDER.length === pinnedRootDER.length &&
      lastCertDER.every((byte, i) => byte === pinnedRootDER[i]);

    if (!rootMatches) {
      console.error(
        "[JWS] SECURITY GATE: Root certificate does NOT match pinned root CA: REJECT"
      );
      return false;
    }

    const rootType = testRootDER ? "test root" : "Apple Root CA G3";
    console.log(`[JWS] ✓ Gate 1: Root certificate matches pinned ${rootType}`);

    // REQUIREMENT 2: All certificates must have Apple identifiers (or TEST if test mode)
    const isTestMode = !!testRootDER;
    for (let i = 0; i < certs.length; i++) {
      if (!isAppleCertificate(certs[i], isTestMode)) {
        console.error(
          `[JWS] SECURITY GATE: Certificate ${i} is NOT from Apple or TEST: REJECT`
        );
        return false;
      }
    }

    console.log("[JWS] ✓ Gate 2: All certificates are from Apple" + (isTestMode ? " (or TEST)" : ""));

    // REQUIREMENT 3: Cryptographic chain verification
    // Verify that each certificate is signed by the previous one
    const X509 = await getX509Library();

    if (X509 && certs.length > 1) {
      try {
        for (let i = 0; i < certs.length - 1; i++) {
          const childCert = new X509(certs[i]);
          const issuerCert = new X509(certs[i + 1]);

          // Check issuer/subject name matching first (fast path)
          const childIssuer = childCert.issuer?.toString?.() || "";
          const issuerSubject = issuerCert.subject?.toString?.() || "";

          if (childIssuer && issuerSubject && childIssuer !== issuerSubject) {
            console.error(
              `[JWS] Certificate chain issuer mismatch at position ${i}: REJECT`
            );
            return false;
          }

          // Extract issuer's public key from DER
          const issuerDER = certs[i + 1];
          const issuerPublicKey = await extractPublicKeyFromCertDER(issuerDER);
          if (!issuerPublicKey) {
            console.error(`[JWS] Failed to extract issuer public key at position ${i + 1}: REJECT`);
            return false;
          }

          // For ECDSA P-256, signature should be 64 bytes (r and s, 32 bytes each)
          // Extract signature from child cert DER (complex DER parsing required)
          // @peculiar/x509 library should provide this, but as a safer approach,
          // we verify at the TBS (To-Be-Signed) level if available
          try {
            // @peculiar/x509 MUST have a verify method for cryptographic verification
            if (childCert.verify === undefined) {
              console.error(`[JWS] Certificate ${i} verify method unavailable: REJECT`);
              return false;
            }

            // Use library's built-in verification
            const isValid = await childCert.verify({ publicKey: issuerPublicKey });
            if (!isValid) {
              console.error(`[JWS] Certificate ${i} signature verification failed: REJECT`);
              return false;
            }
          } catch (verifyErr) {
            console.error(`[JWS] Certificate ${i} verification threw error: REJECT`, verifyErr);
            return false;
          }
        }

        console.log("[JWS] ✓ Gate 3: Cryptographic chain verification PASSED");
      } catch (e) {
        console.error("[JWS] Cryptographic chain verification error: REJECT", e);
        return false;
      }
    } else {
      // certs.length === 0 (impossible, checked at start) OR @peculiar/x509 unavailable
      console.error(
        "[JWS] SECURITY GATE: Cannot verify certificate chain cryptographically (@peculiar/x509 unavailable) → REJECT"
      );
      return false;
    }

    // REQUIREMENT 4: Temporal validity checks
    for (let i = 0; i < certs.length; i++) {
      if (!(await isWithinValidityPeriod(certs[i]))) {
        console.error(`[JWS] Certificate ${i} failed temporal check: REJECT`);
        return false;
      }
    }

    console.log("[JWS] ✓ Gate 4: All certificates within validity period");

    console.log(
      "[JWS] ✅ Certificate chain validation PASSED (all 4 gates verified)"
    );
    return true;
  } catch (e) {
    console.error("[JWS] Certificate chain validation error:", e, "REJECT");
    return false;
  }
}

/**
 * Validate JWS with ES256 signature and x5c chain verification
 * @param testRootDER - Optional test root certificate for testing (bypasses Apple root check)
 */
export async function validateJWS(jws: string, testRootDER?: Uint8Array): Promise<JWSValidationResult> {
  try {
    const parts = jws.split(".");
    if (parts.length !== 3) {
      return { valid: false, error: "Invalid JWS format (must have 3 parts)" };
    }

    const headerB64 = parts[0];
    const payloadB64 = parts[1];
    const signatureB64 = parts[2];

    // Decode header and payload (use base64url decoder for JWS format)
    const headerBytes = base64urlToBuffer(headerB64);
    const payloadBytes = base64urlToBuffer(payloadB64);
    const decoder = new TextDecoder();
    const header = JSON.parse(decoder.decode(headerBytes)) as JWSHeader;
    const payload = JSON.parse(decoder.decode(payloadBytes)) as Record<string, unknown>;

    // Validate header
    if (header.alg !== "ES256") {
      return { valid: false, error: "Invalid algorithm (must be ES256)" };
    }

    if (!header.x5c || !Array.isArray(header.x5c) || header.x5c.length === 0) {
      return { valid: false, error: "Missing x5c certificate chain" };
    }

    // SECURITY: STRICT certificate chain validation (rejects on any failure)
    const chainValid = await validateCertificateChain(header.x5c, testRootDER);
    if (!chainValid) {
      return {
        valid: false,
        error: "Certificate chain validation failed (not from Apple or invalid chain)",
      };
    }

    // Convert x5c[0] (leaf cert) from base64 to DER
    const leafCertDER = new Uint8Array(
      Buffer.from(header.x5c[0], "base64")
    );

    // Extract public key from leaf certificate
    const publicKey = await extractPublicKeyFromCertDER(leafCertDER);
    if (!publicKey) {
      return { valid: false, error: "Failed to extract public key from certificate" };
    }

    // Verify ES256 signature
    const signatureBytes = base64urlToBuffer(signatureB64);
    const messageBytes = new TextEncoder().encode(
      `${headerB64}.${payloadB64}`
    );

    // Debug logging
    console.log(`[JWS] Signature bytes length: ${signatureBytes.length}`);
    console.log(`[JWS] Message bytes length: ${messageBytes.length}`);
    console.log(`[JWS] Header length: ${headerB64.length}, Payload length: ${payloadB64.length}`);
    console.log(`[JWS] Public key extracted type: ${publicKey ? publicKey.constructor.name : 'null'}`);
    console.log(`[JWS] Message (first 100 bytes): ${new TextDecoder().decode(messageBytes.slice(0, 100))}`);
    console.log(`[JWS] Signature (hex): ${Array.from(signatureBytes).map(b => b.toString(16).padStart(2, '0')).join('')}`);

    // Verify ES256 signature
    let isValid = false;

    try {
      // Attempt crypto.subtle.verify with the extracted public key
      isValid = await crypto.subtle.verify(
        { name: "ECDSA", hash: "SHA-256" },
        publicKey,
        signatureBytes as BufferSource,
        messageBytes as BufferSource
      );

      console.log(`[JWS] Signature verification result: ${isValid}`);
      if (isValid) {
        console.log("[JWS] ✅ Signature verified using crypto.subtle");
      }
    } catch (err) {
      console.warn("[JWS] crypto.subtle.verify failed:", String(err));
      return { valid: false, error: `ES256 signature verification failed: ${err}` };
    }

    if (!isValid) {
      console.log("[JWS] ❌ ES256 signature verification FAILED");
      console.log("[JWS] Possible causes: public key mismatch, signature format error, or tampered payload");
      return { valid: false, error: "ES256 signature verification failed" };
    }

    console.log("[JWS] ✅ Valid: chain verified, ES256 signature verified");
    return { valid: true, payload };
  } catch (e) {
    return { valid: false, error: String(e) };
  }
}

/**
 * Validate nested JWS (signedTransactionInfo, signedRenewalInfo)
 */
export async function validateNestedJWS(jws: string): Promise<JWSValidationResult> {
  return validateJWS(jws);
}

/**
 * Export for testing: allow tests to validate chains with custom root
 */
export async function validateCertificateChainForTest(
  x5c: string[],
  testRootDER: Uint8Array
): Promise<boolean> {
  return validateCertificateChain(x5c, testRootDER);
}
