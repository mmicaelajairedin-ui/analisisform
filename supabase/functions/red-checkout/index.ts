// Supabase Edge Function — red-checkout
//
// Carril de pagos de la RED (multicoach). A diferencia de connect-checkout
// (coach individual, hold + comisión escalonada 5-18%), acá:
//   • El dinero entra a UNA sola cuenta: la del DUEÑO de la red (Stripe-Account,
//     cargo directo — la plata nunca pasa por Pathway).
//   • Pathway retiene un 2% FIJO como application fee.
//   • Sin hold: el pago se captura al instante (el cliente eligió coach y pagó).
//   • El dueño le paga a sus coaches por fuera.
//
// Acciones (POST JSON):
//   { action:"info", slug }
//     → datos PÚBLICOS de la red para /red/<slug>: nombre, marca y coaches con
//       sus servicios (sin emails). Para pintar la página pública.
//   { action:"create", slug, coach_id, servicio_idx, cliente:{nombre,email} }
//     → Checkout Session (captura directa) sobre la cuenta del dueño + fila en
//       `cobros_red` (estado pendiente). Devuelve {url}.
//   { action:"sync", org_id }
//     → concilia los cobros pendientes contra Stripe (pagado/expirado), da de
//       alta al cliente en candidatos (asignado al coach + org) y devuelve la
//       lista + totales para la vista Cobros del panel.
//
// Desplegar:  supabase functions deploy red-checkout --no-verify-jwt
// Requiere:   tabla cobros_red (migrations/cobros_red.sql) + STRIPE_SECRET_KEY,
//             SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.

const STRIPE = "https://api.stripe.com/v1";
const SITE = "https://pathwaycareercoach.com";
const FEE_PCT = 0.02; // 2% fijo de Pathway sobre los pagos de la red.

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

const MONEDAS_OK = new Set(["eur","usd","gbp","mxn","ars","cop","clp","pen","brl","uyu","cad","chf"]);
const ZERO_DECIMAL = new Set(["bif","clp","djf","gnf","jpy","kmf","krw","mga","pyg","rwf","ugx","vnd","vuv","xaf","xof","xpf"]);

async function getOrg(SB: string, SRK: string, slug: string, orgId?: string) {
  const q = orgId
    ? `id=eq.${encodeURIComponent(orgId)}`
    : `slug=eq.${encodeURIComponent(slug)}`;
  const r = await fetch(`${SB}/rest/v1/organizaciones?${q}&select=*&limit=1`, { headers: sbH(SRK) });
  const rows = r.ok ? await r.json() : [];
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}
// Miembros de la red (coaches + dueño), con su config (servicios).
async function getMembers(SB: string, SRK: string, org: Record<string, any>) {
  const byOrg = await fetch(
    `${SB}/rest/v1/usuarios?org_id=eq.${encodeURIComponent(org.id)}&select=id,nombre,email,foto_url,activo,configuracion`,
    { headers: sbH(SRK) },
  );
  let members: any[] = byOrg.ok ? await byOrg.json() : [];
  // El dueño puede no tener org_id seteado: lo sumamos por owner_email.
  const oem = String(org.owner_email || "").toLowerCase();
  if (oem && !members.some((m) => String(m.email || "").toLowerCase() === oem)) {
    const or = await fetch(
      `${SB}/rest/v1/usuarios?email=eq.${encodeURIComponent(oem)}&select=id,nombre,email,foto_url,activo,configuracion&limit=1`,
      { headers: sbH(SRK) },
    );
    const orows = or.ok ? await or.json() : [];
    if (Array.isArray(orows) && orows.length) members = members.concat(orows);
  }
  return members;
}
function pubServicios(cfg: Record<string, any>) {
  const arr = Array.isArray(cfg?.servicios) ? cfg.servicios : [];
  return arr.map((s: any, idx: number) => ({
    idx,
    name: String(s?.name ?? s?.nombre ?? "Servicio"),
    desc: String(s?.desc ?? s?.descripcion ?? ""),
    price: Number(s?.price ?? s?.precio ?? 0),
    moneda: (MONEDAS_OK.has(String(s?.moneda ?? cfg?.moneda ?? "eur").toLowerCase())
      ? String(s?.moneda ?? cfg?.moneda ?? "eur").toLowerCase() : "eur"),
    recurrente: s?.recurrente === true || s?.suscripcion === true,
  })).filter((s: any) => s.price > 0);
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

  // ── INFO: datos públicos de la red para /red/<slug> ──
  if (action === "info") {
    const slug = String(p.slug || "").trim();
    if (!slug) return json({ error: "slug requerido" }, 400);
    // Por slug; si no existe, se trata el parámetro como org_id (URL /red/<id>).
    let org = await getOrg(SB, SRK, slug);
    if (!org) org = await getOrg(SB, SRK, "", slug);
    if (!org || org.activo === false) return json({ error: "Red no encontrada" }, 404);
    const members = await getMembers(SB, SRK, org);
    const coaches = members
      .filter((m) => m.activo !== false)
      .map((m) => ({
        id: m.id,
        nombre: m.nombre || "Coach",
        foto: m.foto_url || (m.configuracion && m.configuracion.foto) || "",
        titulo: (m.configuracion && (m.configuracion.titulo_profesional || m.configuracion.titulo)) || "",
        servicios: pubServicios(m.configuracion || {}),
      }))
      .filter((c) => c.servicios.length > 0);
    // ¿La red puede cobrar? (el dueño conectó Stripe)
    let cobrosOn = false;
    const oem = String(org.owner_email || "").toLowerCase();
    const owner = members.find((m) => String(m.email || "").toLowerCase() === oem);
    if (owner && owner.configuracion && owner.configuracion.stripe_account_id) cobrosOn = true;
    return json({
      ok: true,
      org: { id: org.id, nombre: org.nombre || "Red", marca: org.marca || {}, slug: org.slug || slug },
      coaches,
      cobros_on: cobrosOn,
    });
  }

  // ── CREATE: checkout a la cuenta del DUEÑO, captura directa, 2% fee ──
  if (action === "create") {
    const slug = String(p.slug || "").trim();
    const coachId = String(p.coach_id || "").trim();
    const idx = (typeof p.servicio_idx === "number" && p.servicio_idx >= 0) ? Math.floor(p.servicio_idx) : -1;
    const cli = p.cliente || {};
    // Modo A (página pública): servicio del coach por idx.
    // Modo B (cobro desde el panel): monto puntual + concepto, coach opcional.
    const customMonto = Number(p.monto);
    const hasCustom = Number.isFinite(customMonto) && customMonto > 0;
    if (!slug) return json({ error: "Falta la red" }, 400);
    if (idx < 0 && !hasCustom) return json({ error: "Falta el servicio o el monto" }, 400);

    let org = await getOrg(SB, SRK, slug);
    if (!org) org = await getOrg(SB, SRK, "", slug);
    if (!org) return json({ error: "Red no encontrada" }, 404);

    // Cuenta de cobro = la del DUEÑO.
    const oem = String(org.owner_email || "").toLowerCase();
    const or = await fetch(
      `${SB}/rest/v1/usuarios?email=eq.${encodeURIComponent(oem)}&select=configuracion&limit=1`,
      { headers: sbH(SRK) },
    );
    const orows = or.ok ? await or.json() : [];
    const acct = orows[0]?.configuracion?.stripe_account_id;
    if (!acct) return json({ error: "La red todavía no conectó su cuenta de cobro" }, 409);

    // Coach (opcional en modo B, obligatorio en modo A).
    let coach: any = null, coachNombre = "";
    if (coachId) {
      const cr = await fetch(
        `${SB}/rest/v1/usuarios?id=eq.${encodeURIComponent(coachId)}&select=id,nombre,org_id,configuracion`,
        { headers: sbH(SRK) },
      );
      const crows = cr.ok ? await cr.json() : [];
      coach = crows[0] || null;
      coachNombre = (coach && coach.nombre) || "";
    }

    let svc: { idx: number | null; name: string; price: number; moneda: string; recurrente: boolean };
    if (idx >= 0) {
      if (!coach) return json({ error: "Coach no encontrado" }, 404);
      const servicios = pubServicios(coach.configuracion || {});
      const found = servicios.find((s) => s.idx === idx);
      if (!found) return json({ error: "Servicio no encontrado" }, 404);
      svc = found;
    } else {
      const rawMon = String(p.moneda || "eur").toLowerCase();
      svc = {
        idx: null,
        name: String(p.concepto || "Servicio").trim().slice(0, 120) || "Servicio",
        price: customMonto,
        moneda: MONEDAS_OK.has(rawMon) ? rawMon : "eur",
        recurrente: false,
      };
    }

    const moneda = svc.moneda;
    const monto = ZERO_DECIMAL.has(moneda) ? Math.round(svc.price) : Math.round(svc.price * 100);
    if (monto <= 0) return json({ error: "Precio inválido" }, 400);
    const fee = Math.round(monto * FEE_PCT);
    const nombreServicio = svc.name + (coachNombre ? " · " + coachNombre : "") + " (" + (org.nombre || "red") + ")";

    const successUrl = `${SITE}/red/${encodeURIComponent(slug)}?pago=ok`;
    const cancelUrl = `${SITE}/red/${encodeURIComponent(slug)}?pago=cancel`;

    // Suscripción (recurrente cada 4 semanas) o pago único — ambos con 2%.
    const feePct = Math.round(FEE_PCT * 1000) / 10; // 2
    const email = String(cli.email || "");
    const base: Record<string, string> = {
      "line_items[0][quantity]": "1",
      "line_items[0][price_data][currency]": moneda,
      "line_items[0][price_data][unit_amount]": String(monto),
      "line_items[0][price_data][product_data][name]": nombreServicio,
      ...(email ? { customer_email: email } : {}),
      success_url: successUrl,
      cancel_url: cancelUrl,
    };
    const params: Record<string, string> = svc.recurrente
      ? {
        ...base,
        mode: "subscription",
        "line_items[0][price_data][recurring][interval]": "week",
        "line_items[0][price_data][recurring][interval_count]": "4",
        "subscription_data[application_fee_percent]": String(feePct),
        "subscription_data[metadata][pathway]": "red_sub",
        "subscription_data[metadata][org_id]": String(org.id),
        "subscription_data[metadata][coach_id]": coachId,
        "metadata[pathway]": "red_sub",
        "metadata[org_id]": String(org.id),
      }
      : {
        ...base,
        mode: "payment",
        // Captura directa (sin hold): el cliente eligió y pagó.
        "payment_intent_data[application_fee_amount]": String(fee),
        "payment_intent_data[statement_descriptor]": "PATHWAY",
      };
    const sess = await stripe("/checkout/sessions", "POST", KEY, params, acct);
    if (!sess.ok || !sess.data?.id) {
      return json({ error: "No se pudo crear el checkout", detail: sess.data?.error?.message || sess.status }, 502);
    }
    await fetch(`${SB}/rest/v1/cobros_red`, {
      method: "POST",
      headers: { ...sbH(SRK), Prefer: "return=minimal" },
      body: JSON.stringify({
        org_id: org.id,
        coach_id: coachId || null,
        coach_nombre: coachNombre || null,
        servicio_titulo: svc.name,
        servicio_idx: svc.idx,
        monto: svc.price,
        moneda,
        comision: Math.round(svc.price * FEE_PCT * 100) / 100,
        cliente_nombre: cli.nombre || null,
        cliente_email: cli.email || null,
        estado: "pendiente",
        stripe_account_id: acct,
        stripe_session_id: sess.data.id,
        created_at: new Date().toISOString(),
      }),
    });
    return json({ url: sess.data.url });
  }

  // ── SYNC: concilia los cobros pendientes de la red contra Stripe ──
  if (action === "sync") {
    const orgId = String(p.org_id || "").trim();
    if (!orgId) return json({ error: "org_id requerido" }, 400);
    const r = await fetch(
      `${SB}/rest/v1/cobros_red?org_id=eq.${encodeURIComponent(orgId)}&select=*&order=created_at.desc&limit=200`,
      { headers: sbH(SRK) },
    );
    const all = r.ok ? await r.json() : [];
    const now = Date.now();
    for (const c of (Array.isArray(all) ? all : [])) {
      if (c.estado !== "pendiente") continue;
      const acct = c.stripe_account_id;
      let pi = c.stripe_payment_intent || null, custEmail = "", custName = "", paid = false;
      if (c.stripe_session_id) {
        const s = await stripe(`/checkout/sessions/${c.stripe_session_id}`, "GET", KEY, undefined, acct);
        pi = pi || s.data?.payment_intent || null;
        custEmail = s.data?.customer_details?.email || "";
        custName = s.data?.customer_details?.name || "";
        if (s.data?.payment_status === "paid") paid = true;
      }
      let nuevo = "";
      if (paid) nuevo = "pagado";
      else if (pi) {
        const pir = await stripe(`/payment_intents/${pi}`, "GET", KEY, undefined, acct);
        if (pir.data?.status === "succeeded") nuevo = "pagado";
        else if (pir.data?.status === "canceled") nuevo = "expirado";
      }
      // Sin PI y viejo (>24h) sin pagar → expirado (abandonó el checkout).
      if (!nuevo && !pi && c.created_at && (now - new Date(c.created_at).getTime()) > 24 * 3600 * 1000) nuevo = "expirado";
      if (!nuevo) continue;
      const patch: Record<string, unknown> = { estado: nuevo };
      if (pi) patch.stripe_payment_intent = pi;
      if (custEmail && !c.cliente_email) patch.cliente_email = custEmail;
      if (custName && !c.cliente_nombre) patch.cliente_nombre = custName;
      await fetch(`${SB}/rest/v1/cobros_red?id=eq.${encodeURIComponent(c.id)}`, {
        method: "PATCH", headers: { ...sbH(SRK), Prefer: "return=minimal" }, body: JSON.stringify(patch),
      });
      c.estado = nuevo; c.stripe_payment_intent = pi; c.cliente_email = c.cliente_email || custEmail; c.cliente_nombre = c.cliente_nombre || custName;
      // Al pagarse, el cliente entra a la red: candidato asignado al coach + org.
      if (nuevo === "pagado") {
        const email = String(c.cliente_email || "").toLowerCase().trim();
        if (email) {
          const chk = await fetch(`${SB}/rest/v1/candidatos?email=eq.${encodeURIComponent(email)}&select=id,coach_id,org_id`, { headers: sbH(SRK) });
          const ex = chk.ok ? await chk.json() : [];
          const body: Record<string, unknown> = { pago_recibido: true, pago_monto: c.monto, pago_fecha: new Date().toISOString() };
          if (Array.isArray(ex) && ex.length) {
            if (!ex[0].coach_id) body.coach_id = c.coach_id;
            if (!ex[0].org_id) body.org_id = c.org_id;
            await fetch(`${SB}/rest/v1/candidatos?email=eq.${encodeURIComponent(email)}`, { method: "PATCH", headers: { ...sbH(SRK), Prefer: "return=minimal" }, body: JSON.stringify(body) });
          } else {
            await fetch(`${SB}/rest/v1/candidatos`, {
              method: "POST", headers: { ...sbH(SRK), Prefer: "return=minimal" },
              body: JSON.stringify({ ...body, email, nombre: c.cliente_nombre || email.split("@")[0], coach_id: c.coach_id, org_id: c.org_id, activo: true }),
            });
          }
        }
      }
    }
    // Totales + lista para la vista Cobros del panel.
    const pagados = all.filter((c: any) => c.estado === "pagado");
    const bruto = pagados.reduce((a: number, c: any) => a + (Number(c.monto) || 0), 0);
    const comision = pagados.reduce((a: number, c: any) => a + (Number(c.comision) || 0), 0);
    return json({
      ok: true,
      cobros: all,
      totales: { bruto, comision, neto: Math.max(0, bruto - comision), n: pagados.length },
    });
  }

  return json({ error: "Acción no reconocida" }, 400);
});
