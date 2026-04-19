// Supabase Edge Function — stripe-webhook
// Maneja dos flujos:
//
// 1. CHECKOUT ONE-OFF (cliente paga mentoría al coach):
//    event: checkout.session.completed (mode='payment')
//    → actualiza candidatos.pago_* por email
//
// 2. SUSCRIPCIÓN DEL COACH A PATHWAY:
//    events: checkout.session.completed (mode='subscription'),
//            customer.subscription.created / updated / deleted
//    → actualiza usuarios.configuracion.estado_sub + plan
//
// Desplegar:
//   supabase functions deploy stripe-webhook --no-verify-jwt
//
// Env vars (Supabase Dashboard → Edge Functions → Secrets):
//   STRIPE_WEBHOOK_SECRET       — del endpoint configurado en Stripe
//
// SQL requerido (ya corrido antes):
//   ALTER TABLE candidatos ADD COLUMN IF NOT EXISTS pago_recibido BOOLEAN DEFAULT FALSE;
//   ALTER TABLE candidatos ADD COLUMN IF NOT EXISTS pago_fecha TIMESTAMPTZ;
//   ALTER TABLE candidatos ADD COLUMN IF NOT EXISTS stripe_session_id TEXT;
//
// En Stripe Dashboard → Webhooks → events que debe recibir:
//   checkout.session.completed
//   customer.subscription.created
//   customer.subscription.updated
//   customer.subscription.deleted

interface StripeSession {
  id: string;
  mode?: "payment" | "subscription" | "setup";
  amount_total?: number;
  customer?: string;
  customer_email?: string;
  customer_details?: { email?: string; name?: string };
  subscription?: string;
}

interface StripeSubscriptionItem {
  price?: {
    id: string;
    recurring?: { interval?: "month" | "year" };
    unit_amount?: number;
  };
}

interface StripeSubscription {
  id: string;
  customer: string;
  status: string; // trialing | active | past_due | canceled | unpaid | incomplete
  current_period_end?: number;
  trial_end?: number | null;
  items?: { data?: StripeSubscriptionItem[] };
}

interface StripeCustomer {
  id: string;
  email?: string;
}

interface StripeEvent {
  type: string;
  data: { object: StripeSession | StripeSubscription | StripeCustomer };
}

// ── Signature helpers ─────────────────────────────────────────
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
  const nowSec = Math.floor(Date.now() / 1000);
  const ts = parseInt(parts.t, 10);
  if (Math.abs(nowSec - ts) > 300) return false;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sigBuffer = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(`${parts.t}.${payload}`),
  );
  return timingSafeEqual(new Uint8Array(sigBuffer), hexToBytes(parts.v1));
}

// ── Supabase helpers ─────────────────────────────────────────
function getSupabaseAuth() {
  const SB_URL = Deno.env.get("SUPABASE_URL") || "";
  const SB_KEY =
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ||
    Deno.env.get("SUPABASE_ANON_KEY") || "";
  return {
    url: SB_URL,
    headers: {
      apikey: SB_KEY,
      Authorization: `Bearer ${SB_KEY}`,
      "Content-Type": "application/json",
    },
  };
}

// ── Handler: pago one-off del candidato (mentoría/sesión) ────
async function handleClientPayment(session: StripeSession) {
  const email = (session.customer_details?.email || session.customer_email || "")
    .toLowerCase();
  if (!email) return { result: "no-email" };

  const amount = (session.amount_total || 0) / 100;
  const { url: SB_URL, headers } = getSupabaseAuth();

  const checkRes = await fetch(
    `${SB_URL}/rest/v1/candidatos?email=eq.${encodeURIComponent(email)}&select=id`,
    { headers: { apikey: headers.apikey, Authorization: headers.Authorization } },
  );
  const rows = checkRes.ok ? await checkRes.json() : [];

  const body = {
    pago_monto: amount,
    pago_recibido: true,
    pago_fecha: new Date().toISOString(),
    stripe_session_id: session.id,
  };

  if (Array.isArray(rows) && rows.length > 0) {
    await fetch(
      `${SB_URL}/rest/v1/candidatos?email=eq.${encodeURIComponent(email)}`,
      {
        method: "PATCH",
        headers: { ...headers, Prefer: "return=minimal" },
        body: JSON.stringify(body),
      },
    );
    return { result: "updated", email, amount };
  } else {
    const name = session.customer_details?.name || email.split("@")[0];
    await fetch(`${SB_URL}/rest/v1/candidatos`, {
      method: "POST",
      headers: { ...headers, Prefer: "return=minimal" },
      body: JSON.stringify({
        ...body,
        email,
        nombre: name,
        activo: true,
      }),
    });
    return { result: "created", email, amount };
  }
}

// ── Handler: suscripción del coach a Pathway ─────────────────
async function handleCoachSubscription(
  sub: StripeSubscription,
  customerEmail?: string,
) {
  if (!customerEmail) return { result: "no-email" };
  const email = customerEmail.toLowerCase();
  const { url: SB_URL, headers } = getSupabaseAuth();

  // Mapear estado Stripe → estado local
  const statusMap: Record<string, string> = {
    trialing: "prueba",
    active: "activa",
    past_due: "activa",
    canceled: "cancelada",
    unpaid: "vencida",
    incomplete: "prueba",
    incomplete_expired: "vencida",
  };
  const estado_sub = statusMap[sub.status] || "prueba";

  // Detectar plan por intervalo de facturación
  const item = sub.items?.data?.[0];
  const interval = item?.price?.recurring?.interval || "month";
  const plan = interval === "year" ? "pro" : "starter";

  // Fecha fin de prueba / próxima renovación
  const trialEndISO = sub.trial_end
    ? new Date(sub.trial_end * 1000).toISOString()
    : null;
  const periodEndISO = sub.current_period_end
    ? new Date(sub.current_period_end * 1000).toISOString()
    : null;

  // Fetch usuario para mergear con configuracion existente
  const userRes = await fetch(
    `${SB_URL}/rest/v1/usuarios?email=eq.${encodeURIComponent(email)}&select=configuracion`,
    { headers: { apikey: headers.apikey, Authorization: headers.Authorization } },
  );
  const users = userRes.ok ? await userRes.json() : [];
  const existingCfg = (users && users[0] && users[0].configuracion) || {};

  const newCfg = {
    ...existingCfg,
    estado_sub,
    plan,
    stripe_customer_id: sub.customer,
    stripe_subscription_id: sub.id,
    fecha_fin_prueba: trialEndISO,
    fecha_fin_periodo: periodEndISO,
  };

  const patchRes = await fetch(
    `${SB_URL}/rest/v1/usuarios?email=eq.${encodeURIComponent(email)}`,
    {
      method: "PATCH",
      headers: { ...headers, Prefer: "return=minimal" },
      body: JSON.stringify({ configuracion: newCfg }),
    },
  );

  return {
    result: patchRes.ok ? "subscription-updated" : "subscription-failed",
    email,
    estado_sub,
    plan,
  };
}

// ── Lookup email de customer si Stripe no lo manda ──────────
async function getCustomerEmail(customerId: string): Promise<string | undefined> {
  const key = Deno.env.get("STRIPE_SECRET_KEY");
  if (!key || !customerId) return undefined;
  try {
    const res = await fetch(
      `https://api.stripe.com/v1/customers/${encodeURIComponent(customerId)}`,
      { headers: { Authorization: `Bearer ${key}` } },
    );
    if (!res.ok) return undefined;
    const data = await res.json();
    return data.email || undefined;
  } catch {
    return undefined;
  }
}

// ── Main handler ────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

  const secret = Deno.env.get("STRIPE_WEBHOOK_SECRET") || "";
  const sigHeader = req.headers.get("stripe-signature");
  const rawBody = await req.text();

  if (!(await verifyStripeSignature(rawBody, sigHeader, secret))) {
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

  let result: unknown = { received: true, type: ev.type, skipped: true };

  // ── Checkout one-off del candidato ──
  if (ev.type === "checkout.session.completed") {
    const session = ev.data.object as StripeSession;
    if (session.mode === "subscription") {
      // Suscripción del coach — esperamos el evento customer.subscription.created
      // que trae todos los detalles. Acá solo registramos.
      result = { received: true, type: ev.type, skipped: "subscription-checkout" };
    } else {
      result = await handleClientPayment(session);
    }
  }

  // ── Suscripciones del coach ──
  if (
    ev.type === "customer.subscription.created" ||
    ev.type === "customer.subscription.updated" ||
    ev.type === "customer.subscription.deleted"
  ) {
    const sub = ev.data.object as StripeSubscription;
    const email = await getCustomerEmail(sub.customer);
    result = await handleCoachSubscription(sub, email);
  }

  return new Response(JSON.stringify({ received: true, ...(result as object) }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
