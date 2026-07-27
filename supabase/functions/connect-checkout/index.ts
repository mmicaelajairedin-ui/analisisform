// Supabase Edge Function — connect-checkout
//
// Carril marketplace Pathway. Cobro con RETENCIÓN (hold) + split escalonado
// (comisión por tramos según clientes pagos del coach; ver tierRate)
// vía Stripe Connect, en cargo DIRECTO sobre la cuenta del coach
// (header Stripe-Account): el dinero NUNCA pasa por la cuenta de
// Pathway; Pathway solo cobra la comisión como application fee.
//
// Acciones (POST JSON):
//   { action:"create", coach_id, servicio, candidato:{nombre,email} }
//     → crea Checkout Session (capture_method=manual ⇒ autoriza, no
//       cobra) + fila en `solicitudes` (estado pendiente). Devuelve {url}.
//   { action:"accept", solicitud_id }
//     → captura el PaymentIntent (coach cobra, Pathway su comisión). estado=aceptada.
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
// Comisión ESCALONADA de Pathway, según cuántos clientes pagos ya tiene el
// coach vía Pathway (cada cliente cobra el % de su tramo). Baja la barrera de
// entrada: los primeros casi gratis. Antes era 20% plano (const FEE_PCT=0.20).
//   1–5 → 5% · 6–15 → 10% · 16–30 → 15% · 31+ → 18%
function tierRate(n: number): number {
  if (n <= 5) return 0.05;
  if (n <= 15) return 0.10;
  if (n <= 30) return 0.15;
  return 0.18;
}

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

// ── Notificación: solicitud recién autorizada (pago retenido) ──────────
// Mail al comprador (confirmación) + mail al coach (aviso). Pathway media:
// los mails NO se exponen entre las partes. Best-effort — nunca rompe el flujo.
// Se dispara desde el camino `sync` (el webhook hace lo mismo); la columna
// `notificada` en la fila evita que se envíe dos veces.
async function sendEmail(SB: string, SRK: string, to: string, toName: string, subject: string, html: string) {
  try {
    await fetch(`${SB}/functions/v1/send-email`, {
      method: "POST",
      headers: { ...sbH(SRK), "Content-Type": "application/json" },
      body: JSON.stringify({ to, to_name: toName, subject, html, signature: "pathway" }),
    });
  } catch (_e) { /* best-effort */ }
}
async function notifyAutorizada(SB: string, SRK: string, sol: Record<string, any>) {
  let coachNombre = "tu coach", coachEmail = "";
  try {
    const cr = await fetch(`${SB}/rest/v1/usuarios?id=eq.${encodeURIComponent(sol.coach_id)}&select=nombre,email`, { headers: sbH(SRK) });
    if (cr.ok) { const u = (await cr.json())[0] || {}; coachNombre = u.nombre || coachNombre; coachEmail = u.email || ""; }
  } catch (_e) { /* opcional */ }
  const buyerEmail = String(sol.candidato_email || "").trim();
  const buyerName = String(sol.candidato_nombre || "").split(" ")[0] || "";
  const servicio = sol.servicio_titulo || "el servicio";
  if (buyerEmail) {
    const html =
      `<p style="margin:0 0 14px;color:#1B2E26;font-size:16px;">¡Hola ${buyerName}! 🎉</p>` +
      `<p style="margin:0 0 14px;color:#3A4A40;line-height:1.65;">Tu pago de <strong>${servicio}</strong> con <strong>${coachNombre}</strong> quedó confirmado. El pago está <strong>retenido</strong>: ${coachNombre} tiene <strong>24 h</strong> para aceptar y arrancar. Si no acepta, se te reembolsa automáticamente y no se te cobra.</p>` +
      `<p style="margin:14px 0 0;color:#3A4A40;">Te avisamos por aquí apenas tengas novedades.</p>`;
    await sendEmail(SB, SRK, buyerEmail, buyerName, `Pago confirmado · ${servicio} con ${coachNombre}`, html);
  }
  if (coachEmail) {
    const html =
      `<p style="margin:0 0 12px;color:#3A4A40;line-height:1.6;"><strong>${sol.candidato_nombre || "Un candidato"}</strong> compró <strong>${servicio}</strong> y está esperando que lo aceptes (tienes 24 h).</p>` +
      `<p style="margin:14px 0;"><a href="https://pathwaycareercoach.com/panel-v2.html" style="display:inline-block;padding:12px 24px;background:#2D6A4F;color:#fff;border-radius:10px;text-decoration:none;font-weight:700;">Ver en mi panel →</a></p>`;
    await sendEmail(SB, SRK, coachEmail, coachNombre, `💳 Nueva compra · ${servicio}`, html);
  }
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
    let recurrente = false;        // servicio de suscripción → cobro cada 4 semanas
    // Moneda del coach (los coaches son de todo el mundo → no todo es en euros).
    // Se toma del servicio (s.moneda) o de la config del coach (cfg.moneda), se
    // valida contra una lista soportada por Stripe, y por defecto es 'eur'.
    const MONEDAS_OK = new Set(["eur","usd","gbp","mxn","ars","cop","clp","pen","brl","uyu","cad","chf"]);
    let moneda = "eur";
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
      recurrente = so.recurrente === true || so.suscripcion === true;
      const rawMon = String(so.moneda ?? cfg.moneda ?? "eur").toLowerCase();
      if (MONEDAS_OK.has(rawMon)) moneda = rawMon;
    } else {
      precio = Number(
        servicioLegacy === "sesion" ? (cfg.precio_sesion || 120) : (cfg.precio_mentoria || 400),
      );
      nombreServicio = (servicioLegacy === "sesion" ? "Sesión única" : "Mentoría 4 semanas") +
        " con " + (coach.nombre || "tu coach");
      servicioTag = servicioLegacy;
      servicioTitulo = servicioLegacy === "sesion" ? "Sesión única" : "Mentoría 4 semanas";
      const rawMon = String(cfg.moneda ?? "eur").toLowerCase();
      if (MONEDAS_OK.has(rawMon)) moneda = rawMon;
    }
    // Stripe "zero-decimal": el importe NO se multiplica por 100 (p.ej. CLP). Si
    // no lo tratamos, 50.000 CLP saldría 100× más caro. Solo CLP está en nuestra
    // lista, pero dejamos el set completo por si sumamos otra.
    const ZERO_DECIMAL = new Set(["bif","clp","djf","gnf","jpy","kmf","krw","mga","pyg","rwf","ugx","vnd","vuv","xaf","xof","xpf"]);
    const monto = ZERO_DECIMAL.has(moneda) ? Math.round(precio) : Math.round(precio * 100);
    // ¿Es cliente PROPIO del coach? (candidatos.origen='propio'). Si lo es, la
    // comisión es 0% — lo trajo el coach, no el marketplace. Solo los 'pathway'
    // (traídos por el marketplace) pagan comisión. Si el candidato no existe o la
    // columna origen todavía no está (migración sin aplicar) → cobra como HOY.
    const _em = String(cand.email || "").toLowerCase().trim();
    let isPropio = false;
    if (_em) {
      try {
        const orq = await fetch(
          `${SB}/rest/v1/candidatos?coach_id=eq.${encodeURIComponent(coachId)}&email=eq.${encodeURIComponent(_em)}&select=origen&limit=1`,
          { headers: sbH(SRK) },
        );
        if (orq.ok) { const orows = await orq.json(); isPropio = Array.isArray(orows) && orows.length > 0 && orows[0].origen === "propio"; }
      } catch (_e) { isPropio = false; }
    }
    // Comisión ESCALONADA: contamos los clientes pagos previos del coach vía
    // Pathway (candidatos pago_recibido Y origen='pathway'). Este pago es el
    // cliente #(nPrev+1) y cobra el % de SU tramo (1–5 → 5% … 31+ → 18%).
    // Si la columna origen no existe todavía, contamos como antes (todos).
    let nPrev = 0;
    try {
      const cr = await fetch(
        `${SB}/rest/v1/candidatos?coach_id=eq.${encodeURIComponent(coachId)}&pago_recibido=eq.true&origen=eq.pathway&select=id`,
        { headers: { ...sbH(SRK), Prefer: "count=exact", Range: "0-0" } },
      );
      if (cr.ok) {
        nPrev = parseInt((cr.headers.get("content-range") || "0/0").split("/")[1] || "0", 10) || 0;
      } else if (cr.status === 400) {
        // Solo si la columna origen todavía no existe (400) contamos como antes (todos).
        const cr2 = await fetch(
          `${SB}/rest/v1/candidatos?coach_id=eq.${encodeURIComponent(coachId)}&pago_recibido=eq.true&select=id`,
          { headers: { ...sbH(SRK), Prefer: "count=exact", Range: "0-0" } },
        );
        nPrev = parseInt((cr2.headers.get("content-range") || "0/0").split("/")[1] || "0", 10) || 0;
      } else {
        // Error transitorio (5xx/red): NO inflamos el tramo → nPrev=0 (tramo más bajo,
        // dirección segura para el coach, nunca cobra de más).
        nPrev = 0;
      }
    } catch (_e) { nPrev = 0; }
    // Propio → 0%. Marketplace → tramo por nPrev.
    const rate = isPropio ? 0 : tierRate(nPrev + 1);
    const fee = Math.round(monto * rate);            // 0 si es propio
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

    // Parámetros comunes de la Checkout Session
    const baseParams: Record<string, string> = {
      "line_items[0][quantity]": "1",
      "line_items[0][price_data][currency]": moneda,
      "line_items[0][price_data][unit_amount]": String(monto),
      "line_items[0][price_data][product_data][name]": nombreServicio,
      ...(cand.email ? { customer_email: String(cand.email) } : {}),
      success_url: successUrl,
      cancel_url: cancelUrl,
    };
    // Suscripción (cada 4 semanas): cargo directo al coach + comisión de Pathway
    // como application_fee_percent en CADA ciclo. NO retiene plata. Arranca
    // directo (sin el paso de "aceptar en 24 h" del pago único). La metadata
    // viaja al webhook para crear/activar al candidato y gatear su acceso.
    // Pago único: se mantiene EXACTAMENTE igual que antes (hold + accept).
    const feePct = Math.round(rate * 1000) / 10; // p.ej. 0.05 → 5 (%)
    const email = String(cand.email || "");
    const params: Record<string, string> = recurrente
      ? {
        ...baseParams,
        mode: "subscription",
        "line_items[0][price_data][recurring][interval]": "week",
        "line_items[0][price_data][recurring][interval_count]": "4",
        // Cliente propio (rate=0) → NO mandamos application_fee (0% de forma
        // garantizada, sin depender de que Stripe acepte "0").
        ...(fee > 0 ? { "subscription_data[application_fee_percent]": String(feePct) } : {}),
        "subscription_data[metadata][pathway]": "client_sub",
        "subscription_data[metadata][coach_id]": coachId,
        "subscription_data[metadata][candidato_email]": email,
        "subscription_data[metadata][candidato_nombre]": String(cand.nombre || ""),
        "metadata[pathway]": "client_sub",
        "metadata[coach_id]": coachId,
        "metadata[candidato_email]": email,
      }
      : {
        ...baseParams,
        mode: "payment",
        "payment_intent_data[capture_method]": "manual",
        // Propio (fee=0) → sin application_fee_amount (comisión 0 garantizada).
        ...(fee > 0 ? { "payment_intent_data[application_fee_amount]": String(fee) } : {}),
        // Lo que ve el comprador en el resumen de su banco: "PATHWAY".
        "payment_intent_data[statement_descriptor]": "PATHWAY",
      };
    const sess = await stripe("/checkout/sessions", "POST", KEY, params, acct);
    if (!sess.ok || !sess.data?.id) {
      return json({ error: "No se pudo crear el checkout", detail: sess.data?.error?.message || sess.status }, 502);
    }

    // Pago único → creamos la SOLICITUD (flujo aceptar/rechazar del coach).
    // Suscripción → NO hay solicitud: arranca directo y el webhook activa al
    // candidato al confirmarse el primer cobro.
    if (!recurrente) {
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
          comision: precio * rate,
          estado: "pendiente",
          stripe_account_id: acct,
          stripe_session_id: sess.data.id,
          created_at: new Date(now).toISOString(),
          expires_at: new Date(now + 24 * 3600 * 1000).toISOString(),
        }),
      });
    }
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
          // Cliente NUEVO que pagó por el marketplace → origen='pathway' (así cuenta
          // para el tramo y paga comisión). Best-effort: si la columna origen no
          // existe todavía, no rompe el alta (queda para cuando se aplique la migración).
          try {
            await fetch(`${SB}/rest/v1/candidatos?email=eq.${encodeURIComponent(email)}`, {
              method: "PATCH", headers: { ...sbH(SRK), Prefer: "return=minimal" }, body: JSON.stringify({ origen: "pathway" }),
            });
          } catch (_e) { /* la columna origen quizá no existe aún */ }
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
          // Notificar (mail al comprador + al coach) al pasar a 'autorizada',
          // una sola vez. Así la notificación llega aunque el webhook no dispare.
          if (nuevo === "autorizada" && !sol.notificada) {
            await notifyAutorizada(SB, SRK, {
              ...sol,
              candidato_email: sol.candidato_email || custEmail,
              candidato_nombre: sol.candidato_nombre || custName,
            });
            patch.notificada = true;
          }
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
