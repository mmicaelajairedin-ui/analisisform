// Supabase Edge Function — connect-checkout
//
// Carril marketplace Pathway. Cobro con RETENCIÓN (hold) + split 20%
// vía Stripe Connect, en cargo DIRECTO sobre la cuenta del coach
// (header Stripe-Account): el dinero NUNCA pasa por la cuenta de
// Pathway; Pathway solo cobra el 20% como application fee.
//
// Acciones (POST JSON):
//   { action:"create", coach_id, servicio, candidato:{nombre,email} }
//     → crea Checkout Session (capture_method=manual ⇒ autoriza, no
//       cobra) + fila en `solicitudes` (estado pendiente). Devuelve {url}.
//   { action:"accept", solicitud_id }
//     → captura el PaymentIntent (coach cobra, Pathway 20%). estado=aceptada.
//   { action:"reject", solicitud_id }
//     → cancela el PaymentIntent (hold liberado, sin cargo). estado=rechazada.
//
// Desplegar:  supabase functions deploy connect-checkout --no-verify-jwt
// Requiere:   tabla `solicitudes` (migrations/solicitudes.sql) +
//             STRIPE_SECRET_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//
// El timer de 24 h (expirar pendientes) será un job aparte; por ahora
// accept/reject son acciones manuales desde el panel del coach.

const STRIPE = "https://api.stripe.com/v1";
const SITE = "https://pathwaycareercoach.com";
const FEE_PCT = 0.20;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey",
};
function json(b: unknown, s = 200): Response {
  return new Response(JSON.stringify(b), {
    status: s, headers: { ...cors, "Content-Type": "application/json" },
  });
}
function form(o: Record<string, string>): string {
  return Object.entries(o)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join("&");
}
// header opcional Stripe-Account ⇒ actúa como la cuenta conectada (cargo directo)
async function stripe(
  path: string, method: "GET" | "POST", key: string,
  body?: Record<string, string>, acct?: string,
) {
  const headers: Record<string, string> = { Authorization: `Bearer ${key}` };
  if (body) headers["Content-Type"] = "application/x-www-form-urlencoded";
  if (acct) headers["Stripe-Account"] = acct;
  const res = await fetch(`${STRIPE}${path}`, {
    method, headers, body: body ? form(body) : undefined,
  });
  let data: any = null;
  try { data = await res.json(); } catch { /* noop */ }
  return { ok: res.ok, status: res.status, data };
}
function sbH(srk: string) {
  return { apikey: srk, Authorization: `Bearer ${srk}`, "Content-Type": "application/json" };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method Not Allowed" }, 405);

  const KEY = Deno.env.get("STRIPE_SECRET_KEY");
  const SB = Deno.env.get("SUPABASE_URL");
  const SRK = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!KEY || !SB || !SRK) return json({ error: "Faltan env vars" }, 500);

  let p: any = {};
  try { p = await req.json(); } catch { return json({ error: "JSON inválido" }, 400); }
  const action = p.action;

  // ── CREATE: autoriza (hold) ──
  if (action === "create") {
    const coachId = String(p.coach_id || "").trim();
    const servicio = p.servicio === "sesion" ? "sesion" : "mentoria";
    const cand = p.candidato || {};
    if (!coachId) return json({ error: "coach_id requerido" }, 400);

    const r = await fetch(
      `${SB}/rest/v1/usuarios?id=eq.${encodeURIComponent(coachId)}&select=id,nombre,configuracion`,
      { headers: sbH(SRK) },
    );
    const rows = r.ok ? await r.json() : [];
    const coach = Array.isArray(rows) && rows.length ? rows[0] : null;
    if (!coach) return json({ error: "Coach no encontrado" }, 404);

    const cfg = coach.configuracion || {};
    const acct = cfg.stripe_account_id;
    if (!acct) return json({ error: "El coach todavía no conectó su cuenta de cobro" }, 409);

    const precio = Number(
      servicio === "sesion" ? (cfg.precio_sesion || 120) : (cfg.precio_mentoria || 400),
    );
    const monto = Math.round(precio * 100);          // céntimos
    const fee = Math.round(monto * FEE_PCT);          // 20% para Pathway
    if (monto <= 0) return json({ error: "Precio inválido" }, 400);

    const sess = await stripe("/checkout/sessions", "POST", KEY, {
      mode: "payment",
      "line_items[0][quantity]": "1",
      "line_items[0][price_data][currency]": "eur",
      "line_items[0][price_data][unit_amount]": String(monto),
      "line_items[0][price_data][product_data][name]":
        (servicio === "sesion" ? "Sesión única" : "Mentoría 4 semanas") +
        " con " + (coach.nombre || "tu coach"),
      "payment_intent_data[capture_method]": "manual",
      "payment_intent_data[application_fee_amount]": String(fee),
      ...(cand.email ? { customer_email: String(cand.email) } : {}),
      success_url: `${SITE}/coaches.html?solicitud=ok`,
      cancel_url: `${SITE}/coaches.html?solicitud=cancel`,
    }, acct);
    if (!sess.ok || !sess.data?.id) {
      return json({ error: "No se pudo crear el checkout", detail: sess.data?.error?.message || sess.status }, 502);
    }

    const now = Date.now();
    await fetch(`${SB}/rest/v1/solicitudes`, {
      method: "POST",
      headers: { ...sbH(SRK), Prefer: "return=minimal" },
      body: JSON.stringify({
        coach_id: coachId,
        candidato_nombre: cand.nombre || null,
        candidato_email: cand.email || null,
        servicio, monto: precio, comision: precio * FEE_PCT,
        estado: "pendiente",
        stripe_account_id: acct,
        stripe_session_id: sess.data.id,
        created_at: new Date(now).toISOString(),
        expires_at: new Date(now + 24 * 3600 * 1000).toISOString(),
      }),
    });
    return json({ url: sess.data.url });
  }

  // accept / reject: cargan la solicitud, resuelven el PaymentIntent
  if (action === "accept" || action === "reject") {
    const sid = String(p.solicitud_id || "").trim();
    if (!sid) return json({ error: "solicitud_id requerido" }, 400);
    const r = await fetch(
      `${SB}/rest/v1/solicitudes?id=eq.${encodeURIComponent(sid)}&select=*`,
      { headers: sbH(SRK) },
    );
    const rows = r.ok ? await r.json() : [];
    const sol = Array.isArray(rows) && rows.length ? rows[0] : null;
    if (!sol) return json({ error: "Solicitud no encontrada" }, 404);
    const acct = sol.stripe_account_id;

    // resolver el PaymentIntent desde la sesión
    let pi = sol.stripe_payment_intent;
    if (!pi && sol.stripe_session_id) {
      const s = await stripe(`/checkout/sessions/${sol.stripe_session_id}`, "GET", KEY, undefined, acct);
      pi = s.data?.payment_intent || null;
    }
    if (!pi) return json({ error: "El candidato todavía no autorizó el pago" }, 409);

    const op = action === "accept" ? "capture" : "cancel";
    const res = await stripe(`/payment_intents/${pi}/${op}`, "POST", KEY, {}, acct);
    if (!res.ok) {
      return json({ error: `No se pudo ${op === "capture" ? "capturar" : "cancelar"} el pago`, detail: res.data?.error?.message || res.status }, 502);
    }
    await fetch(`${SB}/rest/v1/solicitudes?id=eq.${encodeURIComponent(sid)}`, {
      method: "PATCH",
      headers: { ...sbH(SRK), Prefer: "return=minimal" },
      body: JSON.stringify({
        estado: action === "accept" ? "aceptada" : "rechazada",
        stripe_payment_intent: pi,
      }),
    });
    return json({ ok: true, estado: action === "accept" ? "aceptada" : "rechazada" });
  }

  return json({ error: "Acción no reconocida" }, 400);
});
