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
  payment_intent?: string;
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
  metadata?: { pathway?: string; coach_id?: string; candidato_email?: string; candidato_nombre?: string; [k: string]: string | undefined };
}

interface StripeCustomer {
  id: string;
  email?: string;
}

interface StripeEvent {
  id: string;
  type: string;
  // Eventos de CUENTAS CONECTADAS (cargo directo) traen `account` con el id de
  // la cuenta del coach. Los eventos de la plataforma (suscripción del coach a
  // Pathway) NO lo traen. Así distinguimos suscripción de CLIENTE vs de COACH.
  account?: string;
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
  secret: string | string[],
): Promise<boolean> {
  if (!header) return false;
  // Aceptamos MÚLTIPLES secretos: uno por cada destino de webhook en Stripe.
  // Hoy hay dos destinos a la MISMA URL — "Tu cuenta" (pagos a Pathway +
  // suscripción del coach) y "Cuentas conectadas" (pagos/suscripciones del
  // cliente al coach, cargo directo). Cada destino firma con su propio secreto.
  const secrets = (Array.isArray(secret) ? secret : [secret]).filter(Boolean);
  if (!secrets.length) return false;
  const parts = parseSigHeader(header);
  if (!parts.t || !parts.v1) return false;
  const nowSec = Math.floor(Date.now() / 1000);
  const ts = parseInt(parts.t, 10);
  if (Math.abs(nowSec - ts) > 300) return false;
  const encoder = new TextEncoder();
  for (const sec of secrets) {
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(sec),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const sigBuffer = await crypto.subtle.sign(
      "HMAC",
      key,
      encoder.encode(`${parts.t}.${payload}`),
    );
    if (timingSafeEqual(new Uint8Array(sigBuffer), hexToBytes(parts.v1))) return true;
  }
  return false;
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

// ── Event Store (Pathway OS) — emite un evento server-side (best-effort). ──
// Espejo server de pw-events.js. NUNCA rompe el flujo del webhook: si el insert
// falla, Stripe igual recibe 200 y el pago se procesa. Ref: eventos.sql.
async function emitEvento(ev: Record<string, unknown>): Promise<void> {
  try {
    const { url, headers } = getSupabaseAuth();
    await fetch(`${url}/rest/v1/eventos`, {
      method: "POST",
      headers: { ...headers, Prefer: "return=minimal" },
      body: JSON.stringify({ source: "server", ...ev }),
    });
  } catch { /* best-effort, jamás bloquea el webhook */ }
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
// Aviso a la admin de que ENTRÓ una venta del Pack Express.
// Hasta ahora el webhook solo avisaba de los pagos ROTOS (el de "Pago de coach
// sin cuenta que coincida"), así que se sabía cuando algo fallaba y nunca
// cuando se vendía. Y el Pack tiene 48 h de acceso: si el comprador escribe
// con una duda, conviene ya saber que existe.
//
// Best-effort a propósito: si el email falla NO se toca el resultado del pago.
// Cobrar y dar acceso es lo importante; avisar es un extra.
async function avisarVentaExpress(
  email: string,
  amount: number,
  sessionId: string,
  esSuplemento: boolean,
) {
  // Mismo patrón que sendUnmatchedPaymentAlert, que ya funciona en producción:
  // send-email va desplegada con --no-verify-jwt, así que no lleva cabeceras
  // de auth. Copiar lo que ya funciona en vez de inventar una variante.
  const SB_URL = Deno.env.get("SUPABASE_URL") || "";
  const que = esSuplemento ? "Suplemento (otro CV)" : "Pack Express";
  try {
    await fetch(`${SB_URL}/functions/v1/send-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: "hi@pathwaycareercoach.com",
        to_name: "Micaela",
        subject: `💸 Venta: ${que} · €${amount} · ${email}`,
        reply_to: email,
        html:
          `<p style="font-size:16px;"><strong>${que}</strong> — €${amount}</p>` +
          `<p>Comprador: <a href="mailto:${email}">${email}</a></p>` +
          `<p style="color:#666;font-size:13px;">Tiene <strong>48 h</strong> desde ahora para entrar, editar y descargar sus documentos.</p>` +
          `<p style="color:#999;font-size:12px;">Sesión de Stripe: ${sessionId}</p>`,
      }),
    });
  } catch (e) {
    console.error("[pack_express] no se pudo avisar de la venta", e);
  }
}

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
    await avisarVentaExpress(email, amount, session.id, amount === 10);
    return { result: "pack_express_updated", email, amount };
  } else {
    await fetch(`${SB_URL}/rest/v1/cv_express`, {
      method: "POST",
      headers: { ...headers, Prefer: "return=minimal" },
      body: JSON.stringify(body),
    });
    await avisarVentaExpress(email, amount, session.id, amount === 10);
    return { result: "pack_express_created", email, amount };
  }
}

// ── Handler: compra de un servicio a un coach (marketplace / solicitudes) ────
// connect-checkout creó la solicitud con estado='pendiente' + stripe_session_id.
// Al completarse el pago la pasamos a 'autorizada' → le aparece al coach para
// Aceptar/Rechazar (ventana 24 h).
async function handleSolicitudPayment(
  session: StripeSession,
): Promise<{ matched: boolean; result?: unknown }> {
  const { url: SB_URL, headers } = getSupabaseAuth();
  const sid = session.id;
  if (!sid) return { matched: false };
  const r = await fetch(
    `${SB_URL}/rest/v1/solicitudes?stripe_session_id=eq.${encodeURIComponent(sid)}&select=id,estado,coach_id,candidato_nombre,candidato_email,servicio_titulo,monto,notificada`,
    { headers: { apikey: headers.apikey, Authorization: headers.Authorization } },
  );
  const rows = r.ok ? await r.json() : [];
  if (!Array.isArray(rows) || !rows.length) return { matched: false };
  const sol = rows[0];
  // Si la fila ya fue notificada (p.ej. el camino `sync` de connect-checkout se
  // adelantó), no reenviamos los mails — solo aseguramos estado + payment_intent.
  const yaNotificada = sol.notificada === true;
  await fetch(
    `${SB_URL}/rest/v1/solicitudes?stripe_session_id=eq.${encodeURIComponent(sid)}`,
    {
      method: "PATCH",
      headers: { ...headers, Prefer: "return=minimal" },
      body: JSON.stringify({
        estado: "autorizada",
        stripe_payment_intent: session.payment_intent || null,
        notificada: true,
      }),
    },
  );
  if (yaNotificada) {
    return { matched: true, result: { result: "solicitud_autorizada", id: sol.id, session: sid, skipped_emails: true } };
  }

  // Datos del coach (para los mails). El comprador no ve el mail del coach ni
  // viceversa: Pathway media las notificaciones.
  let coachNombre = "tu coach", coachEmail = "";
  try {
    const cr = await fetch(
      `${SB_URL}/rest/v1/usuarios?id=eq.${encodeURIComponent(sol.coach_id)}&select=nombre,email`,
      { headers: { apikey: headers.apikey, Authorization: headers.Authorization } },
    );
    if (cr.ok) { const u = (await cr.json())[0] || {}; coachNombre = u.nombre || coachNombre; coachEmail = u.email || ""; }
  } catch (_e) { /* opcional */ }

  const buyerEmail = sol.candidato_email || session.customer_details?.email || "";
  const buyerName = (sol.candidato_nombre || session.customer_details?.name || "").split(" ")[0] || "";
  const servicio = sol.servicio_titulo || "el servicio";

  // Mail al comprador: confirmación.
  if (buyerEmail) {
    const html =
      `<p style="margin:0 0 14px;color:#1B2E26;font-size:16px;">¡Hola ${buyerName}! 🎉</p>` +
      `<p style="margin:0 0 14px;color:#3A4A40;line-height:1.65;">Tu pago de <strong>${servicio}</strong> con <strong>${coachNombre}</strong> quedó confirmado. El pago está <strong>retenido</strong>: ${coachNombre} tiene <strong>24 h</strong> para aceptar y arrancar. Si no acepta, se te reembolsa automáticamente y no se te cobra.</p>` +
      `<p style="margin:14px 0 0;color:#3A4A40;">Te avisamos por acá apenas tengas novedades.</p>`;
    fetch(`${SB_URL}/functions/v1/send-email`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ to: buyerEmail, to_name: buyerName, subject: `Pago confirmado · ${servicio} con ${coachNombre}`, html, signature: "pathway" }),
    }).catch(() => {});
  }
  // Mail al coach: aviso (sin exponer el mail del comprador).
  if (coachEmail) {
    const html =
      `<p style="margin:0 0 12px;color:#3A4A40;line-height:1.6;"><strong>${sol.candidato_nombre || "Un candidato"}</strong> compró <strong>${servicio}</strong> y está esperando que lo aceptes (tenés 24 h).</p>` +
      `<p style="margin:14px 0;"><a href="https://pathwaycareercoach.com/panel-v2.html" style="display:inline-block;padding:12px 24px;background:#2D6A4F;color:#fff;border-radius:10px;text-decoration:none;font-weight:700;">Ver en mi panel →</a></p>`;
    fetch(`${SB_URL}/functions/v1/send-email`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ to: coachEmail, to_name: coachNombre, subject: `💳 Nueva compra · ${servicio}`, html, signature: "pathway" }),
    }).catch(() => {});
  }

  return { matched: true, result: { result: "solicitud_autorizada", id: sol.id, session: sid } };
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
    // Cliente NUEVO del marketplace (pagó por Connect) → origen='pathway' (cuenta
    // para el tramo y paga comisión). Best-effort: si la columna no existe, no rompe.
    try {
      await fetch(`${SB_URL}/rest/v1/candidatos?email=eq.${encodeURIComponent(email)}`, {
        method: "PATCH", headers: { ...headers, Prefer: "return=minimal" }, body: JSON.stringify({ origen: "pathway" }),
      });
    } catch (_e) { /* la columna origen quizá no existe aún */ }
    return { result: "created", email, amount, coach_id: coachId };
  }
}

// ── Suscripción del CLIENTE al coach (marketplace, cargo directo) ─────
// Llega por webhook de CUENTA CONECTADA (ev.account presente). Identificamos
// al candidato por metadata.candidato_email (seteada en connect-checkout).
// Guardamos estado + "pagado hasta" para que el portal gatee el acceso.
function subEstadoAccess(status: string): string {
  if (status === "active" || status === "trialing") return "active";
  if (status === "past_due") return "past_due";
  return "canceled"; // canceled | unpaid | incomplete | incomplete_expired
}
async function upsertClientSub(email: string, fields: Record<string, unknown>) {
  const { url: SB_URL, headers } = getSupabaseAuth();
  const em = String(email || "").toLowerCase().trim();
  if (!em) return { ok: false };
  const chk = await fetch(
    `${SB_URL}/rest/v1/candidatos?email=eq.${encodeURIComponent(em)}&select=id,coach_id`,
    { headers },
  );
  const ex = chk.ok ? await chk.json() : [];
  if (Array.isArray(ex) && ex.length) {
    const body = { ...fields } as Record<string, unknown>;
    if (ex[0].coach_id && "coach_id" in body) delete body.coach_id;
    const r = await fetch(`${SB_URL}/rest/v1/candidatos?email=eq.${encodeURIComponent(em)}`, {
      method: "PATCH", headers: { ...headers, Prefer: "return=minimal" }, body: JSON.stringify(body),
    });
    return { ok: r.ok };
  }
  const r = await fetch(`${SB_URL}/rest/v1/candidatos`, {
    method: "POST", headers: { ...headers, Prefer: "return=minimal" },
    body: JSON.stringify({ email: em, activo: true, ...fields, nombre: (fields.nombre as string) || em.split("@")[0] }),
  });
  // Cliente NUEVO de suscripción del marketplace → origen='pathway' (best-effort).
  try {
    await fetch(`${SB_URL}/rest/v1/candidatos?email=eq.${encodeURIComponent(em)}`, {
      method: "PATCH", headers: { ...headers, Prefer: "return=minimal" }, body: JSON.stringify({ origen: "pathway" }),
    });
  } catch (_e) { /* la columna origen quizá no existe aún */ }
  return { ok: r.ok };
}
// Da acceso al portal a un cliente que pagó (crea/reactiva su login + email de
// bienvenida). El pago ÚNICO ya lo resuelve el panel al aceptar la solicitud
// (_pwGrantAccess); las SUSCRIPCIONES no pasan por "aceptar" (arrancan directo),
// así que sin esto el cliente que se suscribe paga y NO puede entrar al portal.
// Best-effort: nunca rompe la respuesta 200 al webhook de Stripe.
async function grantClientPortalAccess(email: string, name: string, coachId: string) {
  try {
    const { url: SB_URL, headers } = getSupabaseAuth();
    const em = String(email || "").toLowerCase().trim();
    if (!em) return;
    const nm = String(name || "").trim() || em.split("@")[0];
    // 1) Asegurar/reactivar la cuenta de login (usuarios.activo bloquea el login;
    //    un cliente que renueva una suscripción vencida debe volver a activo=true).
    const chk = await fetch(
      `${SB_URL}/rest/v1/usuarios?email=eq.${encodeURIComponent(em)}&select=id`,
      { headers },
    );
    const ex = chk.ok ? await chk.json() : [];
    if (Array.isArray(ex) && ex.length) {
      await fetch(`${SB_URL}/rest/v1/usuarios?email=eq.${encodeURIComponent(em)}&rol=eq.cliente`, {
        method: "PATCH", headers: { ...headers, Prefer: "return=minimal" }, body: JSON.stringify({ activo: true }),
      });
    } else {
      await fetch(`${SB_URL}/rest/v1/usuarios`, {
        method: "POST", headers: { ...headers, Prefer: "return=minimal,resolution=ignore-duplicates" },
        body: JSON.stringify({ email: em, rol: "cliente", nombre: nm, activo: true }),
      });
    }
    // 2) Email de bienvenida ("crea tu contraseña y entra") con la firma del coach.
    let cn = "tu coach", cemail = "", cfoto = "", cslug = "";
    if (coachId) {
      const cr = await fetch(
        `${SB_URL}/rest/v1/usuarios?id=eq.${encodeURIComponent(coachId)}&select=nombre,email,configuracion,slug`,
        { headers },
      );
      if (cr.ok) {
        const u = (await cr.json())[0] || {};
        cn = u.nombre || cn; cemail = u.email || "";
        const cfg = u.configuracion || {};
        const foto = String(cfg.foto_url || cfg.foto_perfil || "");
        if (/^https?:\/\//i.test(foto)) cfoto = foto;
        cslug = String(u.slug || cfg.slug || "");
      }
    }
    await fetch(`${SB_URL}/functions/v1/password-reset`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: headers.apikey, Authorization: headers.Authorization },
      body: JSON.stringify({ action: "request", email: em, name: nm, welcome: true, coach_name: cn, coach_email: cemail, coach_photo: cfoto, coach_slug: cslug }),
    });
  } catch (_e) { /* best-effort: nunca rompe el webhook */ }
}
async function handleClientSubCheckout(session: StripeSession) {
  const md = session.metadata || {};
  const email = String(md.candidato_email || session.customer_details?.email || session.customer_email || "");
  const nombre = String(md.candidato_nombre || session.customer_details?.name || "");
  if (!email) return { received: true, type: "client_sub_checkout", skipped: "sin email" };
  const res = await upsertClientSub(email, {
    pago_recibido: true,
    pago_fecha: new Date().toISOString(),
    coach_id: md.coach_id || undefined,
    nombre: nombre || undefined,
    sub_id: session.subscription || undefined,
    sub_customer: session.customer || undefined,
    sub_estado: "active",
    sub_intervalo: "4w",
  });
  // Acceso al portal (login + bienvenida): las suscripciones no pasan por el
  // "aceptar" del panel, así que el acceso se da acá, al confirmarse el 1er cobro.
  await grantClientPortalAccess(email, nombre, String(md.coach_id || ""));
  return { received: true, type: "client_sub_checkout", ok: res.ok, email };
}
async function handleClientSubEvent(sub: StripeSubscription) {
  const md = sub.metadata || {};
  const email = String(md.candidato_email || "");
  const estado = subEstadoAccess(sub.status);
  const fields: Record<string, unknown> = {
    sub_id: sub.id,
    sub_customer: sub.customer,
    sub_estado: estado,
    sub_intervalo: "4w",
  };
  if (sub.current_period_end) fields.sub_vigente_hasta = new Date(sub.current_period_end * 1000).toISOString();
  if (estado === "active") fields.pago_recibido = true;
  if (md.coach_id) fields.coach_id = md.coach_id;
  if (email) {
    const res = await upsertClientSub(email, fields);
    return { received: true, type: "client_sub_event", status: sub.status, ok: res.ok };
  }
  const { url: SB_URL, headers } = getSupabaseAuth();
  const r = await fetch(`${SB_URL}/rest/v1/candidatos?sub_id=eq.${encodeURIComponent(sub.id)}`, {
    method: "PATCH", headers: { ...headers, Prefer: "return=minimal" }, body: JSON.stringify(fields),
  });
  return { received: true, type: "client_sub_event", status: sub.status, ok: r.ok };
}

// ── Handler: suscripción del coach a Pathway ─────────────────
// ── PLANES DE RED (multicoach) ────────────────────────────────────────────
// Se detectan por el monto del Payment Link (en centavos USD). Mensual:
//   $149 → boutique · $249 → studio · $399 → pro
// Anual (33% off = 4 meses gratis, = 8 meses pagos):
//   $1192 → boutique · $1992 → studio · $3192 → pro
// Sin colisión con los montos del coach individual (2900/5900/26100/53100).
const RED_PLAN_BY_AMOUNT: Record<number, "boutique" | "studio" | "pro"> = {
  14900: "boutique", 119200: "boutique",
  24900: "studio",   199200: "studio",
  39900: "pro",      319200: "pro",
};
const RED_LIMITS: Record<string, { max_coaches: number | null; max_clientes: number | null }> = {
  boutique: { max_coaches: 3, max_clientes: 45 },
  studio:   { max_coaches: 8, max_clientes: 120 },
  pro:      { max_coaches: null, max_clientes: null },
};

// Suscripción de una RED: activa la organización del dueño (no su ficha como
// coach individual). Match por el email del dueño; setea plan + límites + estado
// en `organizaciones` y espeja el estado en la fila `usuarios` del dueño.
async function handleRedSubscription(
  sub: StripeSubscription,
  customerEmail: string,
  redPlan: "boutique" | "studio" | "pro",
) {
  const email = customerEmail.trim().toLowerCase();
  const { url: SB_URL, headers } = getSupabaseAuth();

  const statusMap: Record<string, string> = {
    trialing: "prueba", active: "activa", past_due: "activa", canceled: "cancelada",
    unpaid: "vencida", incomplete: "prueba", incomplete_expired: "vencida",
  };
  const estado_sub = statusMap[sub.status] || "prueba";
  const item = sub.items?.data?.[0];
  const unitAmount = item?.price?.unit_amount || 0;
  const trialEndISO = sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null;
  const periodEndISO = sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null;
  const limits = RED_LIMITS[redPlan];
  const activeStatuses = ["trialing", "active", "past_due", "incomplete"];
  const shouldBeActive = activeStatuses.includes(sub.status);

  // Buscar al DUEÑO por email (necesitamos su org_id para activar la red).
  const userRes = await fetch(
    `${SB_URL}/rest/v1/usuarios?email=eq.${encodeURIComponent(email)}&select=id,nombre,rol,org_id,configuracion`,
    { headers: { apikey: headers.apikey, Authorization: headers.Authorization } },
  );
  const users = userRes.ok ? await userRes.json() : null;

  // Pago sin dueño registrado con ese email → avisar a la admin (no crear red a ciegas).
  if (userRes.ok && Array.isArray(users) && users.length === 0) {
    await sendUnmatchedPaymentAlert(email, "red:" + redPlan, String(sub.customer || ""));
    return { result: "red-owner-not-found-alerted", email };
  }
  const u = (users && users[0]) || {};
  const existingCfg = u.configuracion || {};
  const orgId = u.org_id || null;
  const primer = String(u.nombre || "").split(" ")[0] || "";

  // 1) Activar/actualizar la ORGANIZACIÓN (solo columnas reales de la tabla).
  let orgOk = true;
  if (orgId) {
    const orgPatch: Record<string, unknown> = {
      plan: redPlan,
      max_coaches: limits.max_coaches,
      max_clientes: limits.max_clientes,
      estado_sub,
      fecha_fin_prueba: trialEndISO ? trialEndISO.slice(0, 10) : null, // columna DATE
      activo: shouldBeActive,
    };
    const orgRes = await fetch(
      `${SB_URL}/rest/v1/organizaciones?id=eq.${encodeURIComponent(orgId)}`,
      { method: "PATCH", headers: { ...headers, Prefer: "return=minimal" }, body: JSON.stringify(orgPatch) },
    );
    orgOk = orgRes.ok;
  }

  // 2) Espejar el estado en la fila del DUEÑO (usuarios). configuracion es JSONB:
  //    ahí sí guardamos fecha_fin_periodo (no existe como columna en organizaciones).
  const newCfg = {
    ...existingCfg,
    plan: redPlan,
    estado_sub,
    es_multicoach: true,
    stripe_customer_id: sub.customer,
    stripe_subscription_id: sub.id,
    fecha_fin_prueba: trialEndISO,
    fecha_fin_periodo: periodEndISO,
  };
  const patchRes = await fetch(
    `${SB_URL}/rest/v1/usuarios?email=eq.${encodeURIComponent(email)}`,
    { method: "PATCH", headers: { ...headers, Prefer: "return=minimal" }, body: JSON.stringify({ configuracion: newCfg, activo: shouldBeActive }) },
  );

  // Confirmación al PASAR a activa (primer pago o reactivación), una sola vez.
  const becameActive = (estado_sub === "activa") && (existingCfg.estado_sub !== "activa");
  if (becameActive) {
    await sendCoachActivatedEmail(email, primer, redPlan);
    await emitEvento({ tipo: "PaymentSucceeded", dominio: "Billing", actor_email: email, actor_rol: "owner", entidad_tipo: "red", entidad_id: orgId || email, page: "stripe-webhook", payload: { plan: "red:" + redPlan, monto: unitAmount, moneda: (item?.price?.currency || "usd") } });
  }
  await markLeadConversion(email, estado_sub);

  return { result: (patchRes.ok && orgOk) ? "red-subscription-updated" : "red-subscription-failed", email, plan: redPlan, estado_sub };
}

async function handleCoachSubscription(
  sub: StripeSubscription,
  customerEmail?: string,
) {
  if (!customerEmail) return { result: "no-email" };
  const email = customerEmail.trim().toLowerCase();
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

  // Detectar plan por monto del Payment Link (USD desde jun-2026; EUR = legacy):
  //   Mensual: $29 (2900) o €58 (5800) → basic · $59 (5900) o €89 (8900) → pro
  //   Anual (25% off = 3 meses gratis): $261 (26100) → basic · $531 (53100) → pro
  // Fallback legacy (Payment Links viejos sin precios estandar): mes=basic, año=pro.
  const item = sub.items?.data?.[0];
  const unitAmount = item?.price?.unit_amount || 0;

  // ¿Es una suscripción de RED (multicoach)? Se detecta por monto. Si lo es, se
  // maneja aparte: activa la ORGANIZACIÓN del dueño, no su ficha de coach individual.
  const redPlan = RED_PLAN_BY_AMOUNT[unitAmount];
  if (redPlan) return await handleRedSubscription(sub, email, redPlan);

  let plan: "basic" | "pro";
  if (unitAmount === 5900 || unitAmount === 8900 || unitAmount === 53100) plan = "pro";
  else if (unitAmount === 2900 || unitAmount === 5800 || unitAmount === 26100) plan = "basic";
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
  // PRIMERO: búsqueda exacta con email normalizado (case-sensitive, más rápido con índice)
  let userRes = await fetch(
    `${SB_URL}/rest/v1/usuarios?email=eq.${encodeURIComponent(email)}&select=configuracion,nombre`,
    { headers: { apikey: headers.apikey, Authorization: headers.Authorization } },
  );
  let users = userRes.ok ? await userRes.json() : null;

  // FALLBACK: si no encuentra, intenta case-insensitive con ILIKE (para emails viejos sin normalizar)
  if ((userRes.ok && Array.isArray(users) && users.length === 0) || !userRes.ok) {
    userRes = await fetch(
      `${SB_URL}/rest/v1/usuarios?email=ilike.${encodeURIComponent(email)}&select=configuracion,nombre`,
      { headers: { apikey: headers.apikey, Authorization: headers.Authorization } },
    );
    users = userRes.ok ? await userRes.json() : null;
  }

  // RED DE SEGURIDAD: si el pago NO coincide con ningún coach registrado (pagó
  // con un email distinto al del registro, o pagó sin registrarse antes), el
  // PATCH de abajo actualizaría 0 filas y con `return=minimal` esto pasaba como
  // "ok" → el coach pagaba y NUNCA se activaba, en silencio. Ahora avisamos a la
  // admin para reconciliar a mano. (Si el fetch falló -users null-, no alertamos:
  // es transitorio y el evento se reintenta.)
  if (userRes.ok && Array.isArray(users) && users.length === 0) {
    await sendUnmatchedPaymentAlert(email, plan, String(sub.customer || ""));
    return { result: "coach-not-found-alerted", email };
  }

  const existingCfg = (users && users[0] && users[0].configuracion) || {};
  const coachPrimer = String((users && users[0] && users[0].nombre) || "").split(" ")[0] || "";

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
  // si el usuario puede acceder al panel-v2.html.
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

  // ── CONFIRMACIÓN AL COACH: al PASAR a activa (primer pago o reactivación tras
  // prueba vencida) Pathway manda su propia confirmación branded. NO se manda en
  // cada cobro mensual (subscription.updated con estado ya activo → becameActive
  // es false), así no spammea: el recibo fiscal de cada mes lo manda Stripe.
  const becameActive =
    (estado_sub === "activa") && (existingCfg.estado_sub !== "activa") && !isVitalicio;
  if (becameActive) {
    await sendCoachActivatedEmail(email, coachPrimer, plan);
    // Embudo: el coach pagó por primera vez (o reactivó tras prueba vencida).
    // Guardado por becameActive → una sola vez por transición, no en cada cobro.
    await emitEvento({ tipo: "PaymentSucceeded", dominio: "Billing", actor_email: email, actor_rol: "coach", entidad_tipo: "coach", entidad_id: email, page: "stripe-webhook", payload: { plan, monto: unitAmount, moneda: (item?.price?.currency || "usd") } });
  }

  // ── REFERRAL CREDIT (DESACTIVADO) ──────────────────────────────
  // Antes: al pagar un referido, se le daban 15 días gratis al que lo refirió
  // (creditReferrer). Decisión de negocio (jul-2026): regalar días a coaches que
  // YA pagan sale caro; la recompensa por referir pasó a ser el badge **Comunidad**
  // (se otorga solo cuando alguien se registra con tu link — panel-v2 · pwCheckAutoBadges).
  // El crédito en días se conserva SOLO para reactivar (reseña), no para referidos.
  // Para reactivar el crédito de referidos, poner el flag en true.
  const REFERRAL_DAYS_CREDIT_ENABLED = false;
  const paidTransition =
    REFERRAL_DAYS_CREDIT_ENABLED &&
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
// Extiende la fecha de fin de período del coach que refirió por +15 días
// y le manda un email de confirmación. (Programa "Entre coaches": +15 días
// por cada recomendado que se suscribe.)
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

    // Extender fecha_fin_periodo por 15 días. Si no tiene, usamos hoy+15
    const base = refCfg.fecha_fin_periodo ? new Date(refCfg.fecha_fin_periodo) : new Date();
    base.setDate(base.getDate() + 15);
    const newEnd = base.toISOString();

    // Crear/actualizar array de referrals ganados
    const earned = Array.isArray(refCfg.referrals_earned) ? refCfg.referrals_earned : [];
    earned.push({
      referred_email: referredEmail,
      credited_at: new Date().toISOString(),
      days_granted: 15,
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

// ── CONFIRMACIÓN DE ACTIVACIÓN (branded, Pathway) ────────────
// Se manda al coach cuando su cuenta pasa a activa (primer pago o reactivación).
// Es la bienvenida/confirmación de Pathway; el recibo fiscal lo manda Stripe
// aparte (Dashboard → Settings → Customer emails → Successful payments).
async function sendCoachActivatedEmail(
  to: string,
  primer: string,
  plan: "basic" | "pro",
): Promise<void> {
  const SB_URL = Deno.env.get("SUPABASE_URL") || "";
  const planLbl = plan === "pro" ? "Pro" : "Basic";
  const precio = plan === "pro" ? "USD $59/mes" : "USD $29/mes";
  const hola = primer ? `¡Hola ${primer}!` : "¡Hola!";
  try {
    await fetch(`${SB_URL}/functions/v1/send-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to,
        to_name: primer || "",
        subject: "Tu cuenta de Pathway está activa",
        reply_to: "hi@pathwaycareercoach.com",
        html:
          `<h2 style="font-family:Fraunces,Georgia,serif;color:#1B4332;margin:0 0 10px;">${hola} Tu cuenta está activa</h2>` +
          `<p style="color:#3A4A40;line-height:1.65;margin:0 0 14px;">Tu suscripción <strong>${planLbl}</strong> (${precio}) quedó activa. ` +
          `Retomás justo donde lo dejaste: <strong>tus clientes, informes y toda tu configuración siguen intactos</strong> — no empezás de cero.</p>` +
          `<p style="margin:18px 0;"><a href="https://pathwaycareercoach.com/panel-v2.html" style="display:inline-block;padding:12px 26px;background:#2D6A4F;color:#fff;border-radius:10px;text-decoration:none;font-weight:700;">Entrar a mi panel →</a></p>` +
          `<p style="color:#5A6A60;font-size:13px;line-height:1.6;margin:0 0 6px;">El comprobante de pago te llega por separado desde Stripe. ` +
          `Podés cancelar cuando quieras, sin permanencia.</p>` +
          `<p style="color:#5A6A60;font-size:13px;margin:0;">¿Alguna duda? Respondé este correo y te ayudamos.</p>`,
      }),
    });
  } catch (e) {
    console.error("sendCoachActivatedEmail error:", e);
  }
}

// Aviso a la admin cuando entra un pago que no coincide con ningún coach
// registrado, para que lo reconcilie a mano (evita la pérdida silenciosa).
async function sendUnmatchedPaymentAlert(
  email: string,
  plan: string,
  customerId: string,
): Promise<void> {
  const SB_URL = Deno.env.get("SUPABASE_URL") || "";
  try {
    await fetch(`${SB_URL}/functions/v1/send-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: "hi@pathwaycareercoach.com",
        to_name: "Micaela",
        subject: "⚠️ Pago de coach sin cuenta que coincida — revisar",
        reply_to: "hi@pathwaycareercoach.com",
        html:
          `<h2 style="font-family:Fraunces,Georgia,serif;color:#B0413A;margin:0 0 10px;">Pago recibido sin cuenta que coincida</h2>` +
          `<p style="color:#3A4A40;line-height:1.65;margin:0 0 14px;">Entró un pago de suscripción <strong>${plan}</strong>, pero ningún coach registrado tiene el email <strong>${email}</strong>. ` +
          `El cobro se hizo en Stripe, pero la cuenta <strong>no se activó automáticamente</strong>.</p>` +
          `<p style="color:#3A4A40;line-height:1.65;margin:0 0 14px;">Qué hacer: buscá al coach (quizá se registró con otro email) y activá/vinculá su cuenta desde el panel de Coaches, o pedile que se registre con este email exacto.</p>` +
          `<p style="color:#5A6A60;font-size:13px;margin:0;">Stripe customer: ${customerId}</p>`,
      }),
    });
  } catch (e) {
    console.error("sendUnmatchedPaymentAlert error:", e);
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
        subject: "🎁 Ganaste 15 días gratis",
        html:
          `<h2 style="font-family:Fraunces,Georgia,serif;color:#1B4332;">¡El coach que referiste pagó!</h2>` +
          `<p><strong>${referredEmail}</strong> acaba de completar su primer pago en Pathway.</p>` +
          `<div style="background:rgba(82,183,136,.08);border-left:3px solid #2D6A4F;border-radius:6px;padding:14px 16px;margin:18px 0;">` +
          `<div style="font-size:13px;color:#2D6A4F;font-weight:800;">✓ Tu próxima renovación se extendió 15 días</div>` +
          `<div style="font-size:12px;color:#444;margin-top:4px;">Total de referrals exitosos: <strong>${totalReferrals}</strong></div>` +
          `</div>` +
          `<p>Seguí compartiendo tu link desde el panel → Inicio. Por cada coach que paga, 15 días gratis más.</p>` +
          `<p style="margin-top:20px;"><a href="https://pathwaycareercoach.com/panel-v2.html" style="display:inline-block;padding:12px 24px;background:#2D6A4F;color:#fff;border-radius:10px;text-decoration:none;font-weight:700;">Ir a mi panel</a></p>`,
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

  // Dos destinos de webhook (misma URL) → dos secretos. Probamos ambos.
  //   STRIPE_WEBHOOK_SECRET         → destino "Tu cuenta"
  //   STRIPE_WEBHOOK_SECRET_CONNECT → destino "Cuentas conectadas"
  const secrets = [
    Deno.env.get("STRIPE_WEBHOOK_SECRET") || "",
    Deno.env.get("STRIPE_WEBHOOK_SECRET_CONNECT") || "",
  ];
  const sigHeader = req.headers.get("stripe-signature");
  const rawBody = await req.text();

  if (!(await verifyStripeSignature(rawBody, sigHeader, secrets))) {
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
      // Suscripción del CLIENTE al coach (cuenta conectada → ev.account) vs
      // suscripción del COACH a Pathway (plataforma → sin account).
      if (ev.account || session.metadata?.pathway === "client_sub") {
        result = await handleClientSubCheckout(session);
      } else {
        // Suscripción del COACH a Pathway. Normalmente `customer.subscription.created`
        // trae todos los detalles y activa la cuenta. PERO si ese evento no está
        // habilitado en Stripe (o falta STRIPE_SECRET_KEY para resolver el email),
        // el coach pagaría y NO se activaría en silencio. RED DE SEGURIDAD: activamos
        // también desde acá con los datos de la propia sesión (email + monto directos,
        // sin depender de la API de Stripe). Es idempotente con subscription.created
        // (setea el mismo estado; el email de "cuenta activa" sale una sola vez).
        const email = session.customer_details?.email || session.customer_email || "";
        const miniSub = {
          id: session.subscription || "",
          customer: session.customer || "",
          status: "active",
          items: { data: [{ price: { id: "", unit_amount: session.amount_total || 0 } }] },
        } as StripeSubscription;
        result = await handleCoachSubscription(miniSub, email);
      }
    } else {
      // Pack Express: pagos de €40 (4000) o €10 supplement (1000) van al
      // handler que registra el acceso en la tabla cv_express. Otros
      // amounts son pagos de mentoría/sesión al coach (handleClientPayment).
      const amountCents = session.amount_total || 0;
      if (amountCents === 4000 || amountCents === 1000) {
        result = await handlePackExpressPayment(session);
      } else {
        // Marketplace: ¿esta sesión corresponde a una SOLICITUD (compra de un
        // servicio a un coach vía connect-checkout)? Si sí, la pasamos a
        // 'autorizada' para que le aparezca al coach para Aceptar/Rechazar.
        const sol = await handleSolicitudPayment(session);
        result = sol.matched ? sol.result : await handleClientPayment(session);
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
    if (ev.account || sub.metadata?.pathway === "client_sub") {
      // Suscripción del CLIENTE al coach (cuenta conectada) → gatea acceso al portal.
      result = await handleClientSubEvent(sub);
    } else {
      // Suscripción del COACH a Pathway (plataforma).
      const email = await getCustomerEmail(sub.customer);
      result = await handleCoachSubscription(sub, email);
    }
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
