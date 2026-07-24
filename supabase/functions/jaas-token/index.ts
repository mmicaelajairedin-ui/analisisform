// ===================================================================
// jaas-token — firma un JWT de JaaS (8x8 / Jitsi as a Service) para embeber la
// videollamada de la Sala de sesión DENTRO de Pathway (white-label).
//
// La clave privada NUNCA sale del servidor: se lee de los Secrets de Supabase y
// se usa solo acá para firmar (RS256). El navegador recibe el JWT ya firmado.
//
// Secrets (Supabase → Edge Functions → Secrets):
//   JAAS_APP_ID       = vpaas-magic-cookie-…            (el App ID / magic cookie)
//   JAAS_KID          = el Key ID que da 8x8 al crear la API Key
//   JAAS_PRIVATE_KEY  = la clave privada (.pem): -----BEGIN PRIVATE KEY----- … -----END…
//
// Body (POST): { room, name?, email?, avatar?, moderator? }
//   - room:      nombre de la sala (p.ej. "Pathway-<coach>-<cita>"). Sin el App ID.
//   - moderator: true = el coach (controla la sala) · false/omitido = invitado.
// Respuesta:   { jwt, appId, room }  →  el front hace
//   new JitsiMeetExternalAPI("8x8.vc", { roomName: appId + "/" + room, jwt, parentNode })
//
// Deploy: supabase functions deploy jaas-token --no-verify-jwt
//
// TODO (hardening, follow-up): verificar QUIÉN pide el token (coach vs cliente)
// para que `moderator:true` solo se lo lleve el coach dueño de esa cita. Hoy el
// que llama declara su rol; alcanza para el MVP, se ata a la sesión después.
// ===================================================================

const APP_ID = Deno.env.get("JAAS_APP_ID") || "";
const KID = Deno.env.get("JAAS_KID") || "";
const PRIVATE_KEY = Deno.env.get("JAAS_PRIVATE_KEY") || "";

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

// base64url de un string o de bytes.
function b64url(input: string | ArrayBuffer | Uint8Array): string {
  let bytes: Uint8Array;
  if (typeof input === "string") bytes = new TextEncoder().encode(input);
  else if (input instanceof Uint8Array) bytes = input;
  else bytes = new Uint8Array(input);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// PEM (PKCS8) → ArrayBuffer para importar la clave.
// OJO: Web Crypto SOLO importa PKCS8 ("BEGIN PRIVATE KEY"). ssh-keygen genera
// PKCS1 ("BEGIN RSA PRIVATE KEY") → hay que convertirla antes:
//   openssl pkcs8 -topk8 -inform PEM -outform PEM -nocrypt -in jaasauth.key -out jaas-pkcs8.key
function pemToArrayBuffer(pem: string): ArrayBuffer {
  if (/BEGIN RSA PRIVATE KEY/.test(pem)) {
    // PKCS1: Web Crypto no la puede importar. Error claro con la solución.
    throw new Error(
      "private_key_pkcs1: la clave está en PKCS1 (BEGIN RSA PRIVATE KEY). " +
      "Convertila a PKCS8 con: openssl pkcs8 -topk8 -inform PEM -outform PEM -nocrypt " +
      "-in jaasauth.key -out jaas-pkcs8.key  → y pegá jaas-pkcs8.key en JAAS_PRIVATE_KEY.",
    );
  }
  const b64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s+/g, "");
  const bin = atob(b64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}

async function signRS256(headerB64: string, payloadB64: string, pem: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(pem),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const data = new TextEncoder().encode(headerB64 + "." + payloadB64);
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, data);
  return b64url(sig);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "post_only" }, 405);
  if (!APP_ID || !KID || !PRIVATE_KEY) {
    return json({ error: "jaas_secrets_missing", hint: "Faltan JAAS_APP_ID / JAAS_KID / JAAS_PRIVATE_KEY en los Secrets." }, 500);
  }

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: "bad_json" }, 400); }

  const room = (body.room ? String(body.room) : "").trim() || "*";
  const name = (body.name ? String(body.name) : "").trim() || "Invitado";
  const email = (body.email ? String(body.email) : "").trim();
  const avatar = (body.avatar ? String(body.avatar) : "").trim();
  const moderator = body.moderator === true || body.moderator === "true";

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", kid: KID, typ: "JWT" };
  const payload = {
    aud: "jitsi",
    iss: "chat",
    sub: APP_ID,
    iat: now,
    nbf: now - 5,
    exp: now + 3 * 60 * 60, // 3 horas
    room,
    context: {
      // Premium OFF por defecto (grabar/transcribir se prenden aparte y cuestan).
      features: {
        livestreaming: false,
        "file-upload": false,
        "outbound-call": false,
        "sip-outbound-call": false,
        transcription: false,
        "list-visitors": false,
        recording: false,
        flip: false,
      },
      user: {
        "hidden-from-recorder": false,
        moderator,
        name,
        id: email || ("u-" + now),
        avatar,
        email,
      },
    },
  };

  try {
    const h = b64url(JSON.stringify(header));
    const p = b64url(JSON.stringify(payload));
    const sig = await signRS256(h, p, PRIVATE_KEY);
    return json({ jwt: h + "." + p + "." + sig, appId: APP_ID, room });
  } catch (e) {
    return json({ error: "sign_failed", detail: String((e && (e as Error).message) || e) }, 500);
  }
});
