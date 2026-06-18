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
    // Dos formas de identificar el servicio:
    //   - servicio_idx: número, índice en cfg.servicios (modo nuevo, desde
    //     el perfil público del coach donde se listan todos los servicios)
    //   - servicio: "sesion" | "mentoria" (modo legacy, usaba cfg.precio_*)
    // Si vienen los dos, prevalece servicio_idx.
    const hasIdx = typeof p.servicio_idx === "number" && Number.isFinite(p.servicio_idx) && p.servicio_idx >= 0;
    const servicioLegacy = p.servicio === "sesion" ? "sesion" : "mentoria";
    const cand = p.candidato || {};
    const mensaje = typeof cand.mensaje === "string" ? String(cand.mensaje).trim().slice(0, 1000) : "";
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

    // Resolver precio + nombre del servicio según el modo
    let precio: number;
    let nombreServicio: string;
    let servicioTag: string;       // legacy: 'sesion' | 'mentoria' | 'custom'
    let servicioIdx: number | null = null;
    let servicioTitulo: string;    // cacheado en la solicitud — sobrevive a renombres
    if (hasIdx) {
      const idx = Math.floor(p.servicio_idx);
      const servicios = Array.isArray(cfg.servicios) ? cfg.servicios : [];
      const s = servicios[idx];
      if (!s || typeof s !== "object") return json({ error: "Servicio no encontrado" }, 404);
      const so = s as Record<string, unknown>;
      precio = Number(so.price ?? so.precio ?? 0);
      nombreServicio = String(so.name ?? so.nombre ?? "Servicio") +
        " con " + (coach.nombre || "tu coach");
      servicioTag = "custom";
      servicioIdx = idx;
      servicioTitulo = String(so.name ?? so.nombre ?? "Servicio");
    } else {
      precio = Number(
        servicioLegacy === "sesion" ? (cfg.precio_sesion || 120) : (cfg.precio_mentoria || 400),
      );
      nombreServicio = (servicioLegacy === "sesion" ? "Sesión única" : "Mentoría 4 semanas") +
        " con " + (coach.nombre || "tu coach");
      servicioTag = servicioLegacy;
      servicioTitulo = servicioLegacy === "sesion" ? "Sesión única" : "Mentoría 4 semanas";
    }
    const monto = Math.round(precio * 100);          // céntimos
    const fee = Math.round(monto * FEE_PCT);          // 20% para Pathway
    if (monto <= 0) return json({ error: "Precio inválido" }, 400);

    // success_url devuelve al perfil del coach (slug) cuando es disponible,
    // así el candidato ve un banner de confirmación en la misma página donde
    // compró. Fallback al coaches.html si por algún motivo no hay slug.
    const slug = typeof p.slug === "string" && p.slug ? p.slug : "";
    const successUrl = slug
      ? `${SITE}/coach/${encodeURIComponent(slug)}?solicitud=ok`
      : `${SITE}/coaches.html?solicitud=ok`;
    const cancelUrl = slug
      ? `${SITE}/coach/${encodeURIComponent(slug)}?solicitud=cancel`
      : `${SITE}/coaches.html?solicitud=cancel`;

    const sess = await stripe("/checkout/sessions", "POST", KEY, {
      mode: "payment",
      "line_items[0][quantity]": "1",
      "line_items[0][price_data][currency]": "eur",
      "line_items[0][price_data][unit_amount]": String(monto),
      "line_items[0][price_data][product_data][name]": nombreServicio,
      "payment_intent_data[capture_method]": "manual",
      "payment_intent_data[application_fee_amount]": String(fee),
      // Lo que ve el comprador en el resumen de su banco: "PATHWAY" (no el
      // nombre de la cuenta del coach). Sigue siendo cargo directo sobre la
      // cuenta del coach — solo cambia el texto del extracto, no el modelo.
      "payment_intent_data[statement_descriptor]": "PATHWAY",
      ...(cand.email ? { customer_email: String(cand.email) } : {}),
      success_url: successUrl,
      cancel_url: cancelUrl,
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
        servicio: servicioTag,
        servicio_idx: servicioIdx,
        servicio_titulo: servicioTitulo,
        mensaje: mensaje || null,
        monto: precio,
        comision: precio * FEE_PCT,
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

    // Al aceptar (pago capturado), el comprador pasa a ser CLIENTE del coach:
    // creamos/activamos su fila en candidatos con el pago registrado. Si falta
    // el email en la solicitud, lo sacamos de la sesión de Stripe.
    if (action === "accept") {
      let email = sol.candidato_email || "";
      let nombre = sol.candidato_nombre || "";
      if ((!email || !nombre) && sol.stripe_session_id) {
        const s = await stripe(`/checkout/sessions/${sol.stripe_session_id}`, "GET", KEY, undefined, acct);
        email = email || s.data?.customer_details?.email || "";
        nombre = nombre || s.data?.customer_details?.name || "";
      }
      email = String(email || "").toLowerCase().trim();
      if (email) {
        const chk = await fetch(
          `${SB}/rest/v1/candidatos?email=eq.${encodeURIComponent(email)}&select=id,coach_id`,
          { headers: sbH(SRK) },
        );
        const ex = chk.ok ? await chk.json() : [];
        const body: Record<string, unknown> = {
          pago_recibido: true,
          pago_monto: sol.monto,
          pago_fecha: new Date().toISOString(),
        };
        if (Array.isArray(ex) && ex.length) {
          if (!ex[0].coach_id) body.coach_id = sol.coach_id;
          await fetch(`${SB}/rest/v1/candidatos?email=eq.${encodeURIComponent(email)}`, {
            method: "PATCH", headers: { ...sbH(SRK), Prefer: "return=minimal" }, body: JSON.stringify(body),
          });
        } else {
          await fetch(`${SB}/rest/v1/candidatos`, {
            method: "POST", headers: { ...sbH(SRK), Prefer: "return=minimal" },
            body: JSON.stringify({ ...body, email, nombre: nombre || email.split("@")[0], coach_id: sol.coach_id, activo: true }),
          });
        }
      }
    }
    // Aviso por mail al comprador (Pathway media; los mails no se exponen entre
    // las partes). No rompemos el accept/reject si el mail falla.
    try {
      const buyerEmail = String(sol.candidato_email || "").trim();
      if (buyerEmail) {
        let coachNombre = "tu coach";
        const cr = await fetch(`${SB}/rest/v1/usuarios?id=eq.${encodeURIComponent(sol.coach_id)}&select=nombre`, { headers: sbH(SRK) });
        if (cr.ok) coachNombre = ((await cr.json())[0] || {}).nombre || coachNombre;
        const bn = String(sol.candidato_nombre || "").split(" ")[0] || "";
        const serv = sol.servicio_titulo || "tu servicio";
        const html = action === "accept"
          ? `<p style="margin:0 0 14px;color:#1B2E26;font-size:16px;">¡Hola ${bn}! 🎉</p><p style="margin:0 0 14px;color:#3A4A40;line-height:1.65;"><strong>${coachNombre}</strong> aceptó tu solicitud de <strong>${serv}</strong>. ¡Arrancan! Te va a contactar para coordinar los próximos pasos.</p>`
          : `<p style="margin:0 0 14px;color:#1B2E26;font-size:16px;">Hola ${bn},</p><p style="margin:0 0 14px;color:#3A4A40;line-height:1.65;">Esta vez <strong>${coachNombre}</strong> no pudo tomar tu solicitud de <strong>${serv}</strong>. <strong>No se te cobró</strong> — la retención se liberó. Podés elegir otro coach cuando quieras.</p>`;
        await fetch(`${SB}/functions/v1/send-email`, {
          method: "POST",
          headers: { ...sbH(SRK), "Content-Type": "application/json" },
          body: JSON.stringify({ to: buyerEmail, to_name: bn, subject: action === "accept" ? `¡${coachNombre} aceptó tu solicitud! · Pathway` : "Sobre tu solicitud · Pathway", html, signature: "pathway" }),
        });
      }
    } catch (_e) { /* el mail es best-effort */ }
    return json({ ok: true, estado: action === "accept" ? "aceptada" : "rechazada" });
  }

  // ── SYNC: reconcilia las solicitudes pendientes del coach contra Stripe ──
  // El cargo es directo sobre la cuenta conectada, así que no dependemos del
  // webhook: cuando el coach abre su panel, consultamos cada sesión/PI y
  // movemos pendiente → autorizada (con el PI + datos del comprador) si ya
  // autorizó el pago; o → expirada si pasó la ventana sin pagar.
  if (action === "sync") {
    const coachId = String(p.coach_id || "").trim();
    if (!coachId) return json({ error: "coach_id requerido" }, 400);
    const r = await fetch(
      `${SB}/rest/v1/solicitudes?coach_id=eq.${encodeURIComponent(coachId)}&estado=eq.pendiente&select=*&order=created_at.desc&limit=40`,
      { headers: sbH(SRK) },
    );
    const pend = r.ok ? await r.json() : [];
    const now = Date.now();
    let changed = 0;
    for (const sol of (Array.isArray(pend) ? pend : [])) {
      const acct = sol.stripe_account_id;
      let pi = sol.stripe_payment_intent || null;
      let custEmail = "", custName = "";
      if (sol.stripe_session_id) {
        const s = await stripe(`/checkout/sessions/${sol.stripe_session_id}`, "GET", KEY, undefined, acct);
        pi = pi || s.data?.payment_intent || null;
        custEmail = s.data?.customer_details?.email || "";
        custName = s.data?.customer_details?.name || "";
      }
      if (pi) {
        const pir = await stripe(`/payment_intents/${pi}`, "GET", KEY, undefined, acct);
        const st = pir.data?.status;
        let nuevo = "";
        if (st === "requires_capture") nuevo = "autorizada";
        else if (st === "succeeded") nuevo = "aceptada";
        else if (st === "canceled") nuevo = "rechazada";
        if (nuevo) {
          const patch: Record<string, unknown> = { estado: nuevo, stripe_payment_intent: pi };
          if (custEmail && !sol.candidato_email) patch.candidato_email = custEmail;
          if (custName && !sol.candidato_nombre) patch.candidato_nombre = custName;
          await fetch(`${SB}/rest/v1/solicitudes?id=eq.${encodeURIComponent(sol.id)}`, {
            method: "PATCH", headers: { ...sbH(SRK), Prefer: "return=minimal" }, body: JSON.stringify(patch),
          });
          changed++;
        }
      } else if (sol.expires_at && new Date(sol.expires_at).getTime() < now) {
        await fetch(`${SB}/rest/v1/solicitudes?id=eq.${encodeURIComponent(sol.id)}`, {
          method: "PATCH", headers: { ...sbH(SRK), Prefer: "return=minimal" }, body: JSON.stringify({ estado: "expirada" }),
        });
        changed++;
      }
    }
    return json({ ok: true, changed });
  }

  return json({ error: "Acción no reconocida" }, 400);
});
