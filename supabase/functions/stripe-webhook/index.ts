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
  // Coach asignado: en este orden de prioridad:
  // 1. metadata.coach_id (configurable en cada Payment Link de Stripe)
  // 2. client_reference_id (URL ?client_reference_id=<uuid>)
  metadata?: { coach_id?: string; [k: string]: string | undefined };
  client_reference_id?: string;
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
  id: string;
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

// ── Lookup: ¿quién es el coach por defecto? ─────────────────
// Usamos al admin (owner Pathway) como fallback cuando no viene
// coach_id en metadata. Garantiza que ningún candidato quede huérfano.
async function getDefaultCoachId(): Promise<string | undefined> {
  const { url: SB_URL, headers } = getSupabaseAuth();
  try {
    const res = await fetch(
      `${SB_URL}/rest/v1/usuarios?rol=in.(admin,coach)&select=id&order=created_at.asc&limit=1`,
      { headers: { apikey: headers.apikey, Authorization: headers.Authorization } },
    );
    if (!res.ok) return undefined;
    const rows = await res.json();
    return rows?.[0]?.id;
  } catch {
    return undefined;
  }
}

// ── Handler: Pack Express (€40 inicial o €10 supplement) ──────
// Registra en cv_express que este email pagó. Sin esto, cualquiera con
// el URL `?paid=1&email=X` podría acceder al form sin pagar. La validación
// ocurre en cv-express.html: si el email no tiene paid_at en cv_express,
// se redirige a la página de pago.
async function handlePackExpressPayment(session: StripeSession) {
  const email = (session.customer_details?.email || session.customer_email || "")
    .toLowerCase();
  if (!email) return { result: "no-email", type: "pack_express" };

  const amount = (session.amount_total || 0) / 100;
  const { url: SB_URL, headers } = getSupabaseAuth();

  // Upsert: si ya hay un row para ese email (ej: regen), solo actualizamos
  // paid_at y stripe_session_id. Si no, creamos uno con paid_at.
  const checkRes = await fetch(
    `${SB_URL}/rest/v1/cv_express?email=eq.${encodeURIComponent(email)}&select=email`,
    { headers: { apikey: headers.apikey, Authorization: headers.Authorization } },
  );
  const exists = checkRes.ok && (await checkRes.json()).length > 0;

  const body: Record<string, unknown> = {
    email,
    paid_at: new Date().toISOString(),
    stripe_session_id: session.id,
    pago_monto: amount,
  };

  if (exists) {
    await fetch(
      `${SB_URL}/rest/v1/cv_express?email=eq.${encodeURIComponent(email)}`,
      {
        method: "PATCH",
        headers: { ...headers, Prefer: "return=minimal" },
        body: JSON.stringify(body),
      },
    );
    return { result: "pack_express_updated", email, amount };
  } else {
    await fetch(`${SB_URL}/rest/v1/cv_express`, {
      method: "POST",
      headers: { ...headers, Prefer: "return=minimal" },
      body: JSON.stringify(body),
    });
    return { result: "pack_express_created", email, amount };
  }
}

// ── Handler: pago one-off del candidato (mentoría/sesión) ────
async function handleClientPayment(session: StripeSession) {
  const email = (session.customer_details?.email || session.customer_email || "")
    .toLowerCase();
  if (!email) return { result: "no-email" };

  const amount = (session.amount_total || 0) / 100;
  const { url: SB_URL, headers } = getSupabaseAuth();

  // Resolver coach_id en este orden:
  //   1. session.metadata.coach_id (configurable en cada Payment Link)
  //   2. session.client_reference_id (URL pasa ?client_reference_id=)
  //   3. Fallback: primer coach/admin de la plataforma
  let coachId: string | undefined =
    session.metadata?.coach_id || session.client_reference_id || undefined;
  if (!coachId) coachId = await getDefaultCoachId();

  const checkRes = await fetch(
    `${SB_URL}/rest/v1/candidatos?email=eq.${encodeURIComponent(email)}&select=id,coach_id`,
    { headers: { apikey: headers.apikey, Authorization: headers.Authorization } },
  );
  const rows = checkRes.ok ? await checkRes.json() : [];

  const body: Record<string, unknown> = {
    pago_monto: amount,
    pago_recibido: true,
    pago_fecha: new Date().toISOString(),
    stripe_session_id: session.id,
  };
  // Solo seteamos coach_id si el candidato existente NO tenía uno
  // (evita reescribir asignaciones manuales del coach).

  if (Array.isArray(rows) && rows.length > 0) {
    if (!rows[0].coach_id && coachId) body.coach_id = coachId;
    await fetch(
      `${SB_URL}/rest/v1/candidatos?email=eq.${encodeURIComponent(email)}`,
      {
        method: "PATCH",
        headers: { ...headers, Prefer: "return=minimal" },
        body: JSON.stringify(body),
      },
    );
    return { result: "updated", email, amount, coach_id: coachId };
  } else {
    const name = session.customer_details?.name || email.split("@")[0];
    if (coachId) body.coach_id = coachId;
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
    return { result: "created", email, amount, coach_id: coachId };
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

  // Detectar plan por monto del Payment Link:
  //   €58/mes (5800 cents) → "basic"
  //   €89/mes (8900 cents) → "pro"
  // Fallback legacy (Payment Links viejos sin precios estandar): mes=basic, año=pro.
  const item = sub.items?.data?.[0];
  const unitAmount = item?.price?.unit_amount || 0;
  let plan: "basic" | "pro";
  if (unitAmount === 8900) plan = "pro";
  else if (unitAmount === 5800) plan = "basic";
  else {
    const interval = item?.price?.recurring?.interval || "month";
    plan = interval === "year" ? "pro" : "basic";
  }

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

  // Si el coach tiene es_pro_vitalicio=true (admin / demo coach whitelisteado),
  // NO sobreescribimos plan/activo/estado_sub aunque Stripe mande un cancel.
  // Solo guardamos los IDs de Stripe por si los necesitamos.
  const isVitalicio = existingCfg.es_pro_vitalicio === true;

  const newCfg = {
    ...existingCfg,
    estado_sub: isVitalicio ? "activa" : estado_sub,
    plan: isVitalicio ? "pro" : plan,
    stripe_customer_id: sub.customer,
    stripe_subscription_id: sub.id,
    fecha_fin_prueba: isVitalicio ? null : trialEndISO,
    fecha_fin_periodo: isVitalicio ? null : periodEndISO,
  };

  // Paywall: flipear `activo` segun el status de la suscripcion. Esto controla
  // si el usuario puede acceder al panel.html.
  // - trialing/active/past_due → activo=true (puede usar el panel)
  // - canceled/unpaid/incomplete_expired → activo=false (bloqueado en panel)
  // - incomplete (estado intermedio cuando recien se crea) → activo=true
  //   (le damos acceso optimista ya que estan en proceso de pagar)
  // - es_pro_vitalicio=true → siempre activo, ignora el status de Stripe
  const activeStatuses = ["trialing", "active", "past_due", "incomplete"];
  const shouldBeActive = isVitalicio ? true : activeStatuses.includes(sub.status);

  const patchBody: Record<string, unknown> = {
    configuracion: newCfg,
    activo: shouldBeActive,
  };

  const patchRes = await fetch(
    `${SB_URL}/rest/v1/usuarios?email=eq.${encodeURIComponent(email)}`,
    {
      method: "PATCH",
      headers: { ...headers, Prefer: "return=minimal" },
      body: JSON.stringify(patchBody),
    },
  );

  // ── REFERRAL CREDIT: si el nuevo coach paga por primera vez y
  // tiene `referred_by` guardado, dar 1 mes gratis al coach que lo refirió
  const paidTransition =
    (estado_sub === "activa") &&
    (existingCfg.estado_sub !== "activa") &&
    existingCfg.referred_by &&
    !existingCfg.referral_credited;

  if (paidTransition) {
    await creditReferrer(
      existingCfg.referred_by,
      email,
      existingCfg,
    );
    // Marcar al nuevo coach como 'referral_credited' para no pagar 2 veces
    await fetch(
      `${SB_URL}/rest/v1/usuarios?email=eq.${encodeURIComponent(email)}`,
      {
        method: "PATCH",
        headers: { ...headers, Prefer: "return=minimal" },
        body: JSON.stringify({
          configuracion: { ...newCfg, referral_credited: true, referral_credited_at: new Date().toISOString() },
        }),
      },
    );
  }

  // Marcar conversión en leads_pricing si este email salió del popup
  // de pricing en alguna landing. Best-effort — no rompe el flujo si falla.
  await markLeadConversion(email, estado_sub);

  return {
    result: patchRes.ok ? "subscription-updated" : "subscription-failed",
    email,
    estado_sub,
    plan,
  };
}

// ── LEAD TRACKING (popup de pricing) ────────────────────────
// Cuando un email que dejó email en el popup llega a trial/pago, marcamos
// el evento en leads_pricing. Sirve para ver el embudo en el panel admin.
// Match por email — no requiere modificar Stripe ni metadata.
async function markLeadConversion(email: string, estadoSub: string): Promise<void> {
  if (!email) return;
  const { url: SB_URL, headers } = getSupabaseAuth();
  const patch: Record<string, string> = {};
  if (estadoSub === "prueba") {
    patch.trial_iniciado_at = new Date().toISOString();
  } else if (estadoSub === "activa") {
    patch.pago_at = new Date().toISOString();
  } else {
    return; // otros estados no nos interesan acá
  }
  try {
    await fetch(
      `${SB_URL}/rest/v1/leads_pricing?email=eq.${encodeURIComponent(email)}&${Object.keys(patch)[0]}=is.null`,
      {
        method: "PATCH",
        headers: { ...headers, Prefer: "return=minimal" },
        body: JSON.stringify(patch),
      },
    );
  } catch (_e) {
    // best-effort, no bloquear el flow
  }
}

// ── REFERRAL CREDIT ─────────────────────────────────────────
// Extiende la fecha de fin de período del coach que refirió por +30 días
// y le manda un email de confirmación.
async function creditReferrer(
  referrerId: string,
  referredEmail: string,
  _referredCfg: Record<string, unknown>,
): Promise<void> {
  const { url: SB_URL, headers } = getSupabaseAuth();
  try {
    // Fetch referrer
    const refRes = await fetch(
      `${SB_URL}/rest/v1/usuarios?id=eq.${encodeURIComponent(referrerId)}&select=email,nombre,configuracion`,
      { headers: { apikey: headers.apikey, Authorization: headers.Authorization } },
    );
    const refs = refRes.ok ? await refRes.json() : [];
    if (!refs || !refs.length) return;
    const referrer = refs[0];
    const refCfg = referrer.configuracion || {};

    // Extender fecha_fin_periodo por 30 días. Si no tiene, usamos hoy+30
    const base = refCfg.fecha_fin_periodo ? new Date(refCfg.fecha_fin_periodo) : new Date();
    base.setDate(base.getDate() + 30);
    const newEnd = base.toISOString();

    // Crear/actualizar array de referrals ganados
    const earned = Array.isArray(refCfg.referrals_earned) ? refCfg.referrals_earned : [];
    earned.push({
      referred_email: referredEmail,
      credited_at: new Date().toISOString(),
      months_granted: 1,
    });

    const newRefCfg = {
      ...refCfg,
      fecha_fin_periodo: newEnd,
      referrals_earned: earned,
      last_referral_credit_at: new Date().toISOString(),
    };

    await fetch(
      `${SB_URL}/rest/v1/usuarios?id=eq.${encodeURIComponent(referrerId)}`,
      {
        method: "PATCH",
        headers: { ...headers, Prefer: "return=minimal" },
        body: JSON.stringify({ configuracion: newRefCfg }),
      },
    );

    // Enviar email al referrer: '¡Ganaste tu mes gratis!'
    await sendReferralEmail(referrer.email, referrer.nombre || "", referredEmail, earned.length);
  } catch (e) {
    console.error("creditReferrer error:", e);
  }
}

async function sendReferralEmail(
  to: string,
  toName: string,
  referredEmail: string,
  totalReferrals: number,
): Promise<void> {
  const SB_URL = Deno.env.get("SUPABASE_URL") || "";
  try {
    await fetch(`${SB_URL}/functions/v1/send-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: to,
        to_name: toName,
        subject: "🎁 Ganaste tu mes gratis",
        html:
          `<h2 style="font-family:Fraunces,Georgia,serif;color:#1B4332;">¡El coach que referiste pagó!</h2>` +
          `<p><strong>${referredEmail}</strong> acaba de completar su primer pago en Pathway.</p>` +
          `<div style="background:rgba(82,183,136,.08);border-left:3px solid #2D6A4F;border-radius:6px;padding:14px 16px;margin:18px 0;">` +
          `<div style="font-size:13px;color:#2D6A4F;font-weight:800;">✓ Tu próxima renovación se extendió 30 días</div>` +
          `<div style="font-size:12px;color:#444;margin-top:4px;">Total de referrals exitosos: <strong>${totalReferrals}</strong></div>` +
          `</div>` +
          `<p>Seguí compartiendo tu link desde el panel → Inicio. Por cada coach que paga, 1 mes gratis más.</p>` +
          `<p style="margin-top:20px;"><a href="https://pathwaycareercoach.com/panel.html" style="display:inline-block;padding:12px 24px;background:#2D6A4F;color:#fff;border-radius:10px;text-decoration:none;font-weight:700;">Ir a mi panel</a></p>`,
      }),
    });
  } catch (e) {
    console.error("sendReferralEmail error:", e);
  }
}

// ── Idempotencia: registrar evento procesado ────────────────
// Stripe puede reintentar un mismo evento si tarda en responder. Sin
// idempotencia, podriamos duplicar un cobro o reactivar una cuenta
// cancelada. Verificamos por event_id contra stripe_events_processed.
//
// Tabla:
//   CREATE TABLE stripe_events_processed (
//     event_id TEXT PRIMARY KEY,
//     event_type TEXT,
//     processed_at TIMESTAMPTZ DEFAULT now()
//   );
async function isEventProcessed(eventId: string): Promise<boolean> {
  if (!eventId) return false;
  const { url: SB_URL, headers } = getSupabaseAuth();
  try {
    const res = await fetch(
      `${SB_URL}/rest/v1/stripe_events_processed?event_id=eq.${encodeURIComponent(eventId)}&select=event_id`,
      { headers: { apikey: headers.apikey, Authorization: headers.Authorization } },
    );
    if (!res.ok) return false;
    const rows = await res.json();
    return Array.isArray(rows) && rows.length > 0;
  } catch {
    return false;
  }
}

async function markEventProcessed(eventId: string, eventType: string): Promise<void> {
  if (!eventId) return;
  const { url: SB_URL, headers } = getSupabaseAuth();
  try {
    await fetch(`${SB_URL}/rest/v1/stripe_events_processed`, {
      method: "POST",
      headers: { ...headers, Prefer: "return=minimal,resolution=ignore-duplicates" },
      body: JSON.stringify({ event_id: eventId, event_type: eventType }),
    });
  } catch {
    // best-effort: si falla el insert, el peor caso es procesar 2x el evento
    // (lo cual sigue siendo aceptable por la UNIQUE constraint en candidatos
    // y porque las suscripciones updates son idempotentes por naturaleza).
  }
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

  // Idempotencia: si Stripe reintenta el mismo evento, no lo reprocesamos.
  // La firma ya fue validada, asi que devolvemos 200 OK para que Stripe no
  // siga reintentando.
  if (await isEventProcessed(ev.id)) {
    return new Response(
      JSON.stringify({ received: true, type: ev.type, skipped: "already-processed", event_id: ev.id }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }

  let result: unknown = { received: true, type: ev.type, skipped: true };

  // ── Checkout one-off ──
  if (ev.type === "checkout.session.completed") {
    const session = ev.data.object as StripeSession;
    if (session.mode === "subscription") {
      // Suscripción del coach — esperamos el evento customer.subscription.created
      // que trae todos los detalles. Acá solo registramos.
      result = { received: true, type: ev.type, skipped: "subscription-checkout" };
    } else {
      // Pack Express: pagos de €40 (4000) o €10 supplement (1000) van al
      // handler que registra el acceso en la tabla cv_express. Otros
      // amounts son pagos de mentoría/sesión al coach (handleClientPayment).
      const amountCents = session.amount_total || 0;
      if (amountCents === 4000 || amountCents === 1000) {
        result = await handlePackExpressPayment(session);
      } else {
        result = await handleClientPayment(session);
      }
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

  // Marcar evento como procesado para que reintentos de Stripe no
  // dupliquen el procesamiento. Best-effort: si el insert falla, el
  // siguiente reintento volvera a procesar (aceptable porque las
  // operaciones son idempotentes por UNIQUE en candidatos/usuarios).
  await markEventProcessed(ev.id, ev.type);

  return new Response(JSON.stringify({ received: true, ...(result as object) }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
