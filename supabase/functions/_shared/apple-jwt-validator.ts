/**
 * Apple JWT Validation & Signature Verification
 *
 * Valida JWTs enviados por Apple (Server Notifications V2 y transactionInfo).
 * Verifica firma contra Apple's public key (auto-descargada y cacheada).
 *
 * Flujo de seguridad:
 * 1. Apple envía webhook con JWT en payload
 * 2. Descargamos Apple's public certificate (si no está en cache)
 * 3. Validamos firma del JWT
 * 4. Validamos claims (iss, aud, exp)
 * 5. Extraemos datos (notificationType, originalTransactionId, etc.)
 *
 * Ref: https://developer.apple.com/documentation/appstoreserverapi/verifying_app_store_notifications
 */

import * as jose from "https://deno.land/x/jose@v4.11.2/index.ts";

// ============================================================================
// Apple Public Certificates & Keys
// ============================================================================

const APPLE_ROOT_CERT_URL =
  "https://www.apple.com/appleca/AppleRootCA.cer";
const APPLE_INTERMEDIATE_CERT_URL =
  "https://www.apple.com/certificateauthority/AppleWWDRCAG6.cer";

// Cache de certificados en memoria (30 min TTL)
const certCache = new Map<
  string,
  { cert: string; expires: number }
>();

const CERT_CACHE_TTL = 30 * 60 * 1000; // 30 minutes

// ============================================================================
// Certificate Download & Caching
// ============================================================================

async function fetchAppleCertificate(url: string): Promise<string> {
  const cached = certCache.get(url);

  if (cached && cached.expires > Date.now()) {
    return cached.cert;
  }

  console.log(`[apple-jwt] Downloading certificate: ${url}`);

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `Failed to download Apple certificate: ${response.statusText}`
    );
  }

  const binary = await response.arrayBuffer();
  const cert = btoa(String.fromCharCode(...new Uint8Array(binary)));

  // Format as PEM
  const pem = formatCertificateAsPEM(cert);

  // Cache
  certCache.set(url, {
    cert: pem,
    expires: Date.now() + CERT_CACHE_TTL,
  });

  return pem;
}

function formatCertificateAsPEM(der: string): string {
  const line_length = 64;
  let pem_string = "-----BEGIN CERTIFICATE-----\n";

  for (let i = 0; i < der.length; i += line_length) {
    pem_string += der.substr(i, line_length) + "\n";
  }

  pem_string += "-----END CERTIFICATE-----";
  return pem_string;
}

// ============================================================================
// JWT Validation
// ============================================================================

export interface ValidateJWTOptions {
  expectedBundleId?: string;
  expectedEnvironment?: "Sandbox" | "Production";
  validateExpiration?: boolean;
}

export interface ValidatedJWTPayload {
  notificationType?: string;
  subtype?: string;
  notificationUUID?: string;
  data: Record<string, unknown>;
  version?: string;
  signedDate?: number;
  iss: string;
  aud: string;
  exp: number;
  iat: number;
}

/**
 * Valida un JWT enviado por Apple (Server Notifications V2 o transactionInfo).
 *
 * Pasos:
 * 1. Parsea el JWT (sin validar firma aún)
 * 2. Descarga el certificado público de Apple
 * 3. Verifica la firma
 * 4. Valida los claims (issuer, audience, expiration)
 * 5. Retorna el payload si todo OK
 *
 * @param token JWT string
 * @param options Opciones de validación
 * @returns Payload validado
 * @throws Error si firma inválida o claims no válidos
 */
export async function validateAppleJWT(
  token: string,
  options: ValidateJWTOptions = {}
): Promise<ValidatedJWTPayload> {
  const {
    expectedBundleId,
    expectedEnvironment,
    validateExpiration = true,
  } = options;

  try {
    // 1. Parsear JWT sin validar firma (solo para obtener header y payload)
    const decoded = jose.decodeProtectedHeader(token);
    const payload = jose.decodeJwt(token);

    console.log(
      `[apple-jwt] Decoded JWT for ${payload.aud} (alg: ${decoded.alg})`
    );

    // 2. Descargar y cachear certificado
    const certificatePEM = await fetchAppleCertificate(
      APPLE_ROOT_CERT_URL
    );

    // 3. Convertir PEM a JWK
    const key = await jose.importSPKI(certificatePEM, "RSA");

    // 4. Verificar firma
    try {
      const verified = await jose.jwtVerify(token, key);
      console.log(`[apple-jwt] Signature verified for ${verified.payload.aud}`);
    } catch (e) {
      console.error(`[apple-jwt] Signature verification failed:`, e);
      throw new Error(`Invalid JWT signature: ${e.message}`);
    }

    // 5. Validar claims
    if (!payload.iss || !payload.aud || !payload.exp || !payload.iat) {
      throw new Error("Missing required JWT claims");
    }

    // Issuer debe ser Apple's App Store
    if (payload.iss !== "https://appstoreconnect.apple.com") {
      throw new Error(`Unexpected issuer: ${payload.iss}`);
    }

    // Audience debe ser el bundleId (si se especifica)
    if (expectedBundleId && payload.aud !== expectedBundleId) {
      throw new Error(
        `Unexpected audience. Expected: ${expectedBundleId}, Got: ${payload.aud}`
      );
    }

    // Validar expiration (por defecto sí)
    if (validateExpiration) {
      const now = Math.floor(Date.now() / 1000);
      if (payload.exp < now) {
        throw new Error(
          `JWT expired at ${new Date(payload.exp * 1000).toISOString()}`
        );
      }
    }

    return payload as ValidatedJWTPayload;
  } catch (e) {
    console.error(`[apple-jwt] Validation failed:`, e);
    throw e;
  }
}

// ============================================================================
// JWT Claims Extraction
// ============================================================================

/**
 * Extrae el appAccountToken de un JWT (si existe).
 *
 * El appAccountToken es un UUID que Apple incluye automáticamente
 * y que vincula la transacción al usuario en Pathway.
 */
export function extractAppAccountToken(
  payload: ValidatedJWTPayload
): string | null {
  const data = payload.data as Record<string, unknown>;
  return data?.appAccountToken as string | null || null;
}

/**
 * Extrae el originalTransactionId (de transactionInfo).
 * Nota: en Server Notifications, viene dentro de lastTransactions[0].
 */
export function extractOriginalTransactionId(
  payload: ValidatedJWTPayload
): string | null {
  const data = payload.data as Record<string, unknown>;

  // Caso 1: Directamente en data (transactionInfo)
  if (data?.originalTransactionId) {
    return data.originalTransactionId as string;
  }

  // Caso 2: En lastTransactions[0] (Server Notifications)
  const lastTransactions = data?.lastTransactions as any[];
  if (Array.isArray(lastTransactions) && lastTransactions.length > 0) {
    return lastTransactions[0].originalTransactionId as string;
  }

  return null;
}

/**
 * Extrae la fecha de expiración (ms epoch).
 */
export function extractExpiresDate(
  payload: ValidatedJWTPayload
): number | null {
  const data = payload.data as Record<string, unknown>;
  return (data?.expiresDate as number) || null;
}

/**
 * Valida que un token sea de un ambiente esperado (Sandbox vs Production).
 */
export function validateEnvironment(
  payload: ValidatedJWTPayload,
  expected: "Sandbox" | "Production" | "both" = "both"
): boolean {
  if (expected === "both") return true;

  const data = payload.data as Record<string, unknown>;
  const env = data?.environment as string;

  return env === expected;
}

// ============================================================================
// Errors
// ============================================================================

export class AppleJWTError extends Error {
  constructor(
    public code:
      | "INVALID_SIGNATURE"
      | "MISSING_CLAIMS"
      | "EXPIRED"
      | "INVALID_ISSUER"
      | "INVALID_AUDIENCE"
      | "CERT_DOWNLOAD_FAILED"
      | "UNKNOWN",
    message: string
  ) {
    super(message);
    this.name = "AppleJWTError";
  }
}

// ============================================================================
// Tipos públicos
// ============================================================================

export type { ValidateJWTOptions, ValidatedJWTPayload };
