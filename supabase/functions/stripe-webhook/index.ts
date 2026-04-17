// Supabase Edge Function — stripe-webhook
// Recibe webhooks de Stripe y auto-marca pagos en la tabla `candidatos`.
//
// Desplegar con Supabase CLI:
//   supabase functions deploy stripe-webhook --no-verify-jwt
//
// Env vars (configurar en Supabase Dashboard → Edge Functions → Secrets):
//   STRIPE_WEBHOOK_SECRET  — del endpoint configurado en Stripe
//   SUPABASE_URL           — ya existe por default (no hace falta setearla)
//   SUPABASE_SERVICE_ROLE_KEY — ya existe por default
//
// SQL requerido (correr una vez en Supabase):
//   ALTER TABLE candidatos ADD COLUMN IF NOT EXISTS pago_recibido BOOLEAN DEFAULT FALSE;
//   ALTER TABLE candidatos ADD COLUMN IF NOT EXISTS pago_fecha TIMESTAMPTZ;
//   ALTER TABLE candidatos ADD COLUMN IF NOT EXISTS stripe_session_id TEXT;
//
// URL del endpoint (para configurar en Stripe Dashboard → Webhooks):
//   https://ddxnrsnjdvtqhxunxnwj.supabase.co/functions/v1/stripe-webhook

interface StripeSessionCompleted {
  id: string;
  amount_total: number;
  customer_email?: string;
  customer_details?: {
    email?: string;
    name?: string;
  };
}

interface StripeEvent {
  type: string;
  data: {
    object: StripeSessionCompleted;
  };
}

// Parsea el header Stripe-Signature: "t=TIMESTAMP,v1=SIGNATURE,..."
function parseSigHeader(header: string): { t?: string; v1?: string } {
  const parts: { t?: string; v1?: string } = {};
  for (const seg of header.split(",")) {
    const idx = seg.indexOf("=");
    if (idx < 0) continue;
    const k = seg.slice(0, idx).trim();
    const v = seg.slice(idx + 1).trim();
    if (k === "t") parts.t = v;
    else if (k === "v1") parts.v1 = v;
  }
  return parts;
}

function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) return new Uint8Array(0);
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a[i] ^ b[i];
  return result === 0;
}

async function verifyStripeSignature(
  payload: string,
  header: string | null,
  secret: string,
): Promise<boolean> {
  if (!header || !secret) return false;
  const parts = parseSigHeader(header);
  if (!parts.t || !parts.v1) return false;

  // Anti-replay: rechaza eventos más viejos de 5 minutos
  const nowSec = Math.floor(Date.now() / 1000);
  const ts = parseInt(parts.t, 10);
  if (Math.abs(nowSec - ts) > 300) return false;

  const signed = `${parts.t}.${payload}`;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sigBuffer = await crypto.subtle.sign("HMAC", key, encoder.encode(signed));
  const expected = new Uint8Array(sigBuffer);
  const received = hexToBytes(parts.v1);

  return timingSafeEqual(expected, received);
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const secret = Deno.env.get("STRIPE_WEBHOOK_SECRET") || "";
  const sigHeader = req.headers.get("stripe-signature");
  const rawBody = await req.text();

  const ok = await verifyStripeSignature(rawBody, sigHeader, secret);
  if (!ok) {
    return new Response(JSON.stringify({ error: "Invalid signature" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  let ev: StripeEvent;
  try {
    ev = JSON.parse(rawBody);
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  // Solo procesamos checkout completado
  if (ev.type !== "checkout.session.completed") {
    return new Response(
      JSON.stringify({ received: true, type: ev.type, skipped: true }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }

  const session = ev.data?.object;
  if (!session) {
    return new Response(JSON.stringify({ received: true, error: "no session" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  const email =
    (session.customer_details?.email || session.customer_email || "").toLowerCase();
  const amount = (session.amount_total || 0) / 100;
  const sessionId = session.id;
  const nowISO = new Date().toISOString();

  if (!email) {
    return new Response(
      JSON.stringify({ received: true, skipped: "no email in session" }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }

  const SB_URL = Deno.env.get("SUPABASE_URL") || "";
  const SB_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ||
    Deno.env.get("SUPABASE_ANON_KEY") || "";
  if (!SB_URL || !SB_KEY) {
    return new Response("Supabase env vars missing", { status: 500 });
  }

  const authHeaders = {
    apikey: SB_KEY,
    Authorization: `Bearer ${SB_KEY}`,
    "Content-Type": "application/json",
  };

  // ¿Existe el candidato por email?
  const checkRes = await fetch(
    `${SB_URL}/rest/v1/candidatos?email=eq.${encodeURIComponent(email)}&select=id`,
    { headers: authHeaders },
  );
  const rows = checkRes.ok ? await checkRes.json() : [];

  const patchBody = {
    pago_monto: amount,
    pago_recibido: true,
    pago_fecha: nowISO,
    stripe_session_id: sessionId,
  };

  let result = "updated";
  if (Array.isArray(rows) && rows.length > 0) {
    const patchRes = await fetch(
      `${SB_URL}/rest/v1/candidatos?email=eq.${encodeURIComponent(email)}`,
      {
        method: "PATCH",
        headers: { ...authHeaders, Prefer: "return=minimal" },
        body: JSON.stringify(patchBody),
      },
    );
    if (!patchRes.ok) result = `update-failed (${patchRes.status})`;
  } else {
    // Crear nuevo candidato mínimo — el form lo completará después
    const name = session.customer_details?.name || email.split("@")[0];
    const createBody = {
      ...patchBody,
      email,
      nombre: name,
      activo: true,
    };
    const createRes = await fetch(`${SB_URL}/rest/v1/candidatos`, {
      method: "POST",
      headers: { ...authHeaders, Prefer: "return=minimal" },
      body: JSON.stringify(createBody),
    });
    result = createRes.ok ? "created" : `create-failed (${createRes.status})`;
  }

  return new Response(
    JSON.stringify({ received: true, email, amount, result }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
});
