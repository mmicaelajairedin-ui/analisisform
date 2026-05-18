// Supabase Edge Function — connect-onboard
//
// Onboarding de Stripe Connect para coaches del directorio Pathway.
// El coach se conecta una vez; Stripe le pide banco/identidad y le paga
// directo. Pathway nunca toca su dinero (cobra solo el 20% como
// application fee en el checkout, que se construye en otra función).
//
// Acciones (POST JSON):
//   { action: "onboard", coach_id, email?, country? }
//     → crea (si no existe) la cuenta Connect del coach, la guarda en
//       usuarios.configuracion.stripe_account_id (read-merge, no pisa
//       otras keys) y devuelve { url } = link de onboarding de Stripe.
//   { action: "status", coach_id }
//     → { connected: bool, details_submitted: bool }
//
// Desplegar:
//   supabase functions deploy connect-onboard --no-verify-jwt
//
// Env (ya configuradas en el proyecto):
//   STRIPE_SECRET_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//
// Nota seguridad: toma coach_id del request (mismo modelo de auth débil
// que el resto del panel; endurecer en Sprint B junto con RLS). El daño
// posible es bajo: solo crea/devuelve un link de onboarding de Stripe.

const STRIPE = "https://api.stripe.com/v1";
const RETURN_URL = "https://pathwaycareercoach.com/panel-v2.html?connect=done#config";
const REFRESH_URL = "https://pathwaycareercoach.com/panel-v2.html?connect=refresh#config";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

// Stripe espera application/x-www-form-urlencoded, con claves anidadas
// tipo capabilities[transfers][requested].
function form(obj: Record<string, string>): string {
  return Object.entries(obj)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");
}

async function stripe(
  path: string,
  method: "GET" | "POST",
  key: string,
  body?: Record<string, string>,
): Promise<{ ok: boolean; status: number; data: any }> {
  const res = await fetch(`${STRIPE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${key}`,
      ...(body ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
    },
    body: body ? form(body) : undefined,
  });
  let data: any = null;
  try { data = await res.json(); } catch { /* noop */ }
  return { ok: res.ok, status: res.status, data };
}

// ── Supabase (service role) helpers ─────────────────────────
function sbHeaders(srk: string) {
  return { apikey: srk, Authorization: `Bearer ${srk}`, "Content-Type": "application/json" };
}

async function getCoach(sbUrl: string, srk: string, coachId: string) {
  const r = await fetch(
    `${sbUrl}/rest/v1/usuarios?id=eq.${encodeURIComponent(coachId)}&select=id,email,configuracion`,
    { headers: sbHeaders(srk) },
  );
  if (!r.ok) return null;
  const rows = await r.json();
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

// read-merge: no pisa otras keys de configuracion
async function saveAccountId(
  sbUrl: string, srk: string, coachId: string, cfg: any, accountId: string,
) {
  const merged = { ...(cfg || {}), stripe_account_id: accountId };
  await fetch(`${sbUrl}/rest/v1/usuarios?id=eq.${encodeURIComponent(coachId)}`, {
    method: "PATCH",
    headers: { ...sbHeaders(srk), Prefer: "return=minimal" },
    body: JSON.stringify({ configuracion: merged }),
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method Not Allowed" }, 405);

  const STRIPE_KEY = Deno.env.get("STRIPE_SECRET_KEY");
  const SB_URL = Deno.env.get("SUPABASE_URL");
  const SRK = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!STRIPE_KEY || !SB_URL || !SRK) {
    return json({ error: "Faltan variables de entorno" }, 500);
  }

  let payload: any = {};
  try { payload = await req.json(); } catch { return json({ error: "JSON inválido" }, 400); }

  const action = payload.action;
  const coachId = String(payload.coach_id || "").trim();
  if (!coachId) return json({ error: "coach_id requerido" }, 400);

  const coach = await getCoach(SB_URL, SRK, coachId);
  if (!coach) return json({ error: "Coach no encontrado" }, 404);

  const cfg = coach.configuracion || {};
  let accountId: string = cfg.stripe_account_id || "";

  // ── STATUS ──
  if (action === "status") {
    if (!accountId) return json({ connected: false, details_submitted: false });
    const r = await stripe(`/accounts/${accountId}`, "GET", STRIPE_KEY);
    if (!r.ok) return json({ connected: false, details_submitted: false });
    const a = r.data || {};
    return json({
      connected: !!(a.charges_enabled && a.payouts_enabled),
      details_submitted: !!a.details_submitted,
    });
  }

  // ── ONBOARD ──
  if (action === "onboard") {
    // 1) crear cuenta Connect si no existe
    if (!accountId) {
      const country = String(payload.country || "ES").toUpperCase();
      const email = String(payload.email || coach.email || "").trim();
      const create = await stripe("/accounts", "POST", STRIPE_KEY, {
        type: "express",
        country,
        ...(email ? { email } : {}),
        "capabilities[card_payments][requested]": "true",
        "capabilities[transfers][requested]": "true",
        "business_profile[name]": "Coach Pathway",
        "metadata[pathway_coach_id]": coachId,
      });
      if (!create.ok || !create.data?.id) {
        return json({
          error: "No se pudo crear la cuenta de Stripe",
          detail: create.data?.error?.message || create.status,
        }, 502);
      }
      accountId = create.data.id;
      await saveAccountId(SB_URL, SRK, coachId, cfg, accountId);
    }

    // 2) link de onboarding (fresco, caduca rápido — por eso se genera
    //    on-demand desde el panel, nunca se manda crudo por mail)
    const link = await stripe("/account_links", "POST", STRIPE_KEY, {
      account: accountId,
      refresh_url: REFRESH_URL,
      return_url: RETURN_URL,
      type: "account_onboarding",
    });
    if (!link.ok || !link.data?.url) {
      return json({
        error: "No se pudo crear el link de onboarding",
        detail: link.data?.error?.message || link.status,
      }, 502);
    }
    return json({ url: link.data.url, account_id: accountId });
  }

  return json({ error: "Acción no reconocida" }, 400);
});
