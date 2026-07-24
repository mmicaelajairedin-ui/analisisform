// send-push-apns — envía una notificación push NATIVA a dispositivos iOS (APNs).
// Complemento de send-push (que es push WEB / VAPID). Los tokens nativos viven
// en la tabla native_push_tokens (los registra pw-native.js dentro de la app).
//
// POST body: {
//   emails?: string[],   // a quién mandar (resuelve sus tokens en la tabla)
//   tokens?: string[],   // o directamente tokens de dispositivo
//   title?: string,
//   body?:  string,
//   url?:   string,      // ruta a abrir al tocar la notificación (va en data)
//   data?:  object,      // datos extra opcionales
// }
//
// Secrets requeridos en Supabase (Edge Functions → Secrets):
//   APNS_KEY_P8    — contenido del archivo .p8 de APNs (incluye BEGIN/END).
//   APNS_KEY_ID    — el Key ID de esa clave (10 chars).
//   APNS_TEAM_ID   — tu Apple Team ID (10 chars).
//   APNS_BUNDLE_ID — com.pathwaycareercoach.app
//   APNS_ENV       — 'production' (default) o 'sandbox' (para builds de desarrollo).
//   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY — auto-inyectados (leer/borrar tokens).
//
// ⚠️ Sin verificar en producción todavía: hay que probarla con credenciales APNs
//    reales antes de conectarla a los disparadores (nuevo cliente, chat, etc.).

const APNS_KEY_P8    = Deno.env.get("APNS_KEY_P8") || "";
const APNS_KEY_ID    = Deno.env.get("APNS_KEY_ID") || "";
const APNS_TEAM_ID   = Deno.env.get("APNS_TEAM_ID") || "";
const APNS_BUNDLE_ID = Deno.env.get("APNS_BUNDLE_ID") || "com.pathwaycareercoach.twa";
const APNS_ENV       = (Deno.env.get("APNS_ENV") || "production").toLowerCase();
const APNS_HOST      = APNS_ENV === "sandbox" ? "api.sandbox.push.apple.com" : "api.push.apple.com";

const SB_URL = Deno.env.get("SUPABASE_URL") || "";
const SB_SR  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ---- Utilidades base64url --------------------------------------------------
function b64url(input: ArrayBuffer | Uint8Array | string): string {
  let bytes: Uint8Array;
  if (typeof input === "string") bytes = new TextEncoder().encode(input);
  else bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function pemToDer(pem: string): Uint8Array {
  const b64 = pem
    .replace(/-----BEGIN [^-]+-----/g, "")
    .replace(/-----END [^-]+-----/g, "")
    .replace(/\s+/g, "");
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

// ---- JWT de APNs (ES256), cacheado ~50 min ---------------------------------
let cachedJwt = "";
let cachedAt = 0;

async function apnsJwt(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedJwt && now - cachedAt < 3000) return cachedJwt; // reusar < 50 min

  const header = b64url(JSON.stringify({ alg: "ES256", kid: APNS_KEY_ID }));
  const payload = b64url(JSON.stringify({ iss: APNS_TEAM_ID, iat: now }));
  const signingInput = `${header}.${payload}`;

  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToDer(APNS_KEY_P8),
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
  // Web Crypto devuelve la firma en formato IEEE P1363 (r||s), que es
  // exactamente lo que JWT ES256 necesita — sin re-encoding.
  const sig = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    new TextEncoder().encode(signingInput),
  );

  cachedJwt = `${signingInput}.${b64url(sig)}`;
  cachedAt = now;
  return cachedJwt;
}

// ---- Resolver tokens desde emails ------------------------------------------
async function tokensForEmails(emails: string[]): Promise<string[]> {
  const list = emails.map((e) => ("" + e).toLowerCase().trim()).filter(Boolean);
  if (!list.length) return [];
  const inClause = list.map((e) => `"${e.replace(/"/g, "")}"`).join(",");
  const res = await fetch(
    `${SB_URL}/rest/v1/native_push_tokens?select=token&user_email=in.(${encodeURIComponent(inClause)})`,
    { headers: { apikey: SB_SR, Authorization: `Bearer ${SB_SR}` } },
  );
  if (!res.ok) return [];
  const rows = await res.json().catch(() => []);
  return Array.isArray(rows) ? rows.map((r: any) => r.token).filter(Boolean) : [];
}

async function deleteToken(token: string) {
  try {
    await fetch(
      `${SB_URL}/rest/v1/native_push_tokens?token=eq.${encodeURIComponent(token)}`,
      { method: "DELETE", headers: { apikey: SB_SR, Authorization: `Bearer ${SB_SR}` } },
    );
  } catch (_e) { /* ignore */ }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST")    return new Response("Method not allowed", { status: 405, headers: CORS });

  if (!APNS_KEY_P8 || !APNS_KEY_ID || !APNS_TEAM_ID) {
    return new Response(
      JSON.stringify({ error: "Faltan secrets de APNs (APNS_KEY_P8 / APNS_KEY_ID / APNS_TEAM_ID)." }),
      { status: 500, headers: { "Content-Type": "application/json", ...CORS } },
    );
  }

  let inBody: any = {};
  try { inBody = await req.json(); } catch (_e) { inBody = {}; }

  const title = inBody.title || "Pathway";
  const body  = inBody.body  || "";
  const url   = inBody.url   || "/";
  const extra = inBody.data && typeof inBody.data === "object" ? inBody.data : {};

  let tokens: string[] = Array.isArray(inBody.tokens) ? inBody.tokens.filter(Boolean) : [];
  if (!tokens.length && Array.isArray(inBody.emails) && inBody.emails.length) {
    if (!SB_URL || !SB_SR) {
      return new Response(JSON.stringify({ error: "Faltan credenciales Supabase para resolver emails." }),
        { status: 500, headers: { "Content-Type": "application/json", ...CORS } });
    }
    tokens = await tokensForEmails(inBody.emails);
  }
  tokens = Array.from(new Set(tokens));
  if (!tokens.length) {
    return new Response(JSON.stringify({ sent: 0, note: "Sin tokens para esos destinatarios." }),
      { status: 200, headers: { "Content-Type": "application/json", ...CORS } });
  }

  const jwt = await apnsJwt();
  const apsBody = JSON.stringify({
    aps: { alert: { title, body }, sound: "default", "mutable-content": 1 },
    url,
    ...extra,
  });

  let sent = 0;
  const errors: any[] = [];

  await Promise.all(tokens.map(async (token) => {
    try {
      const res = await fetch(`https://${APNS_HOST}/3/device/${token}`, {
        method: "POST",
        headers: {
          "authorization": `bearer ${jwt}`,
          "apns-topic": APNS_BUNDLE_ID,
          "apns-push-type": "alert",
          "apns-priority": "10",
          "content-type": "application/json",
        },
        body: apsBody,
      });
      if (res.status === 200) { sent++; return; }
      // 410 = token muerto; 400 BadDeviceToken → limpiar.
      const txt = await res.text().catch(() => "");
      if (res.status === 410 || /BadDeviceToken|Unregistered/.test(txt)) {
        await deleteToken(token);
      }
      errors.push({ status: res.status, detail: txt.slice(0, 200) });
    } catch (e) {
      errors.push({ error: String(e) });
    }
  }));

  return new Response(JSON.stringify({ sent, total: tokens.length, errors }), {
    status: 200,
    headers: { "Content-Type": "application/json", ...CORS },
  });
});
