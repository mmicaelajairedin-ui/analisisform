// send-push — envía una notificación push a TODOS los dispositivos suscriptos
// de un usuario (puede tener varios: móvil + escritorio + tablet).
//
// POST body: {
//   user_email: string,     // a quién mandar
//   title?: string,         // título visible
//   body?: string,          // cuerpo
//   url?: string,           // URL a abrir al clickear (default '/')
//   tag?: string,           // mismo tag colapsa con la anterior
//   renotify?: boolean,
// }
//
// Secrets requeridos en Supabase (Edge Functions → Secrets):
//   VAPID_PRIVATE_KEY  — la generamos juntas, vive solo acá.
//   VAPID_SUBJECT      — opcional, default mailto:hi@pathwaycareercoach.com
//   SUPABASE_URL       — auto-injected en runtime
//   SUPABASE_SERVICE_ROLE_KEY — necesario para leer subscripciones (bypass RLS)
//
// Suscripciones muertas (404/410 del push service) se borran automáticamente.

// @ts-ignore — Deno + esm.sh
import webpush from "https://esm.sh/web-push@3.6.7";

// VAPID pública (la misma que en el frontend, pw-push.js).
const VAPID_PUBLIC = "BKzJaV8CJyFmJPgT-RhbMQcfQANm9exHLKfeiTh8NWm5QHl8L7-Iipss-QPHLZNLDmdV9Uq3Wo0VJC2II_uuEVI";
const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE_KEY") || "";
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") || "mailto:hi@pathwaycareercoach.com";

const SB_URL = Deno.env.get("SUPABASE_URL") || "";
const SB_SR  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

if (VAPID_PRIVATE) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
}

async function deleteEndpoint(endpoint: string) {
  try {
    await fetch(
      `${SB_URL}/rest/v1/push_subscriptions?endpoint=eq.${encodeURIComponent(endpoint)}`,
      { method: "DELETE", headers: { apikey: SB_SR, Authorization: `Bearer ${SB_SR}` } }
    );
  } catch (_e) { /* ignore */ }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST")    return new Response("Method not allowed", { status: 405, headers: CORS });

  if (!VAPID_PRIVATE || !SB_URL || !SB_SR) {
    return new Response(JSON.stringify({ error: "Faltan secrets VAPID_PRIVATE_KEY o credenciales Supabase." }),
      { status: 500, headers: { "Content-Type": "application/json", ...CORS } });
  }

  let payloadIn: any = {};
  try { payloadIn = await req.json(); } catch (_e) {}
  const user_email = (""+(payloadIn.user_email||"")).toLowerCase().trim();
  if (!user_email) {
    return new Response(JSON.stringify({ error: "user_email requerido" }),
      { status: 400, headers: { "Content-Type": "application/json", ...CORS } });
  }

  // Buscar todas las suscripciones del usuario.
  const r = await fetch(
    `${SB_URL}/rest/v1/push_subscriptions?user_email=eq.${encodeURIComponent(user_email)}&select=endpoint,p256dh,auth`,
    { headers: { apikey: SB_SR, Authorization: `Bearer ${SB_SR}` } }
  );
  if (!r.ok) {
    return new Response(JSON.stringify({ error: `Error consultando suscripciones (${r.status})` }),
      { status: 500, headers: { "Content-Type": "application/json", ...CORS } });
  }
  const subs: Array<{ endpoint: string; p256dh: string; auth: string }> = await r.json();

  if (!subs.length) {
    return new Response(JSON.stringify({ sent: 0, failed: 0, note: "sin suscripciones" }),
      { headers: { "Content-Type": "application/json", ...CORS } });
  }

  const payload = JSON.stringify({
    title: payloadIn.title || "Pathway",
    body:  payloadIn.body  || "",
    url:   payloadIn.url   || "/",
    tag:   payloadIn.tag   || "pathway",
    renotify: !!payloadIn.renotify,
  });

  let sent = 0, failed = 0;
  await Promise.all(subs.map(async (s) => {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        payload
      );
      sent++;
    } catch (err: any) {
      failed++;
      const code = (err && (err.statusCode || err.status)) || 0;
      // Suscripción muerta → limpiar para no seguir intentando.
      if (code === 404 || code === 410) await deleteEndpoint(s.endpoint);
    }
  }));

  return new Response(JSON.stringify({ sent, failed }),
    { headers: { "Content-Type": "application/json", ...CORS } });
});
