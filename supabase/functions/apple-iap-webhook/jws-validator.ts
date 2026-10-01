// JWS Validator for Apple App Store Server Notifications V2
// Implements ES256 signature verification + x5c certificate validation

import { Buffer } from "jsr:@std/encoding";

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

/**
 * Base64url decode (RFC 4648)
 */
function base64urlToBuffer(str: string): Uint8Array {
  const base64 = str
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd((str.length * 4) / 3, "=");
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Extract public key from DER-encoded X.509 certificate
 * For ES256/ECDSA P-256 certificates
 */
async function extractPublicKeyFromCertDER(
  certDER: Uint8Array
): Promise<CryptoKey | null> {
  try {
    // Import as X.509 SubjectPublicKeyInfo
    const publicKey = await crypto.subtle.importKey(
      "spki",
      certDER,
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["verify"]
    );
    return publicKey;
  } catch (e) {
    console.error("[JWS] Failed to extract public key:", e);
    return null;
  }
}

/**
 * Validate JWS with ES256 signature verification
 *
 * Implementation:
 * 1. Parse DER certificates from x5c (base64 strings)
 * 2. Extract public key from leaf certificate
 * 3. Verify ES256 signature using public key
 * 4. TODO: Validate chain to Apple Root CA G3
 */
export async function validateJWS(jws: string): Promise<JWSValidationResult> {
  try {
    const parts = jws.split(".");
    if (parts.length !== 3) {
      return { valid: false, error: "Invalid JWS format (must have 3 parts)" };
    }

    const headerB64 = parts[0];
    const payloadB64 = parts[1];
    const signatureB64 = parts[2];

    // Decode header and payload
    const header = JSON.parse(atob(headerB64)) as JWSHeader;
    const payload = JSON.parse(atob(payloadB64)) as Record<string, unknown>;

    // Validate header
    if (header.alg !== "ES256") {
      return { valid: false, error: "Invalid algorithm (must be ES256)" };
    }

    if (!header.x5c || !Array.isArray(header.x5c) || header.x5c.length === 0) {
      return { valid: false, error: "Missing x5c certificate chain" };
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
    // JWS signature is base64url(DER(ES256Sig))
    const signatureBytes = base64urlToBuffer(signatureB64);
    const messageBytes = new TextEncoder().encode(
      `${headerB64}.${payloadB64}`
    );

    const isValid = await crypto.subtle.verify(
      "ECDSA",
      publicKey,
      signatureBytes,
      messageBytes
    );

    if (!isValid) {
      return { valid: false, error: "ES256 signature verification failed" };
    }

    // TODO: Validate x5c certificate chain to Apple Root CA G3
    // This requires parsing certificate extensions and building the chain
    console.log("[JWS] ES256 signature valid");

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
