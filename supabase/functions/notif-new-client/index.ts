// Supabase Edge Function — notif-new-client
//
// La dispara un trigger Postgres `pw_after_candidato_insert` (vía pg_net)
// cada vez que se crea un candidato. Lee al coach asignado y, si tiene
// activado el switch "Cliente nuevo" en Panel → Configuración →
// Notificaciones (configuracion.notifs.newClient === true), le manda un
// email con los datos del cliente y un link al panel.
//
// Si el coach no tiene el switch prendido, no manda nada (skip silencioso).
// Lo mismo si el candidato no tiene coach_id (huérfano).
//
// Body de la request:
//   { candidato_id: "<uuid>" }
//
// Despliegue (auto vía .github/workflows/deploy-functions.yml):
//   supabase functions deploy notif-new-client --no-verify-jwt
//
// Env (auto-inyectadas en Supabase):
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//
// SECURITY: la función se despliega con --no-verify-jwt y la llama un
// trigger Postgres sin autenticación. El abuso máximo posible es que
// alguien pase un candidato_id existente y dispare una notificación
// duplicada al coach correspondiente — no hay leak de datos ni control de
// destinatario por el atacante (el `to` lo decide el coach asignado).

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, authorization, apikey, x-client-info",
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "content-type": "application/json; charset=utf-8" },
  });
}

function escH(s: unknown): string {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

interface Candidato {
  id: string;
  nombre: string | null;
  email: string | null;
  cargo: string | null;
  coach_id: string | null;
  created_at: string | null;
}

interface Coach {
  id: string;
  email: string | null;
  nombre: string | null;
  rol: string | null;
  configuracion: Record<string, unknown> | null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  let body: { candidato_id?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "bad_json" }, 400);
  }
  const cid = (body.candidato_id || "").trim();
  if (!cid) return json({ error: "candidato_id_required" }, 400);

  const SB_URL = Deno.env.get("SUPABASE_URL") || "";
  const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!SB_URL || !SERVICE) return json({ error: "env_missing" }, 500);

  const sbHeaders = {
    apikey: SERVICE,
    Authorization: `Bearer ${SERVICE}`,
    "Content-Type": "application/json",
  };

  // 1) Buscar el candidato
  let cand: Candidato;
  try {
    const r = await fetch(
      `${SB_URL}/rest/v1/candidatos?id=eq.${encodeURIComponent(cid)}&select=id,nombre,email,cargo,coach_id,created_at&limit=1`,
      { headers: sbHeaders },
    );
    if (!r.ok) return json({ error: "candidato_fetch_failed", status: r.status }, 502);
    const rows = await r.json();
    if (!Array.isArray(rows) || rows.length === 0) {
      return json({ ok: true, skipped: "candidato_not_found" });
    }
    cand = rows[0];
  } catch (e) {
    return json({ error: "candidato_exception", detail: String(e).slice(0, 200) }, 502);
  }

  // 2) Si no hay coach_id (huérfano), no hay a quién notificar
  if (!cand.coach_id) {
    return json({ ok: true, skipped: "no_coach_assigned" });
  }

  // 3) Buscar al coach y su preferencia de notificaciones
  let coach: Coach;
  try {
    const r = await fetch(
      `${SB_URL}/rest/v1/usuarios?id=eq.${encodeURIComponent(cand.coach_id)}&select=id,email,nombre,rol,configuracion&limit=1`,
      { headers: sbHeaders },
    );
    if (!r.ok) return json({ error: "coach_fetch_failed", status: r.status }, 502);
    const rows = await r.json();
    if (!Array.isArray(rows) || rows.length === 0) {
      return json({ ok: true, skipped: "coach_not_found" });
    }
    coach = rows[0];
  } catch (e) {
    return json({ error: "coach_exception", detail: String(e).slice(0, 200) }, 502);
  }

  const cfg = coach.configuracion || {};
  const notifs = (cfg.notifs as Record<string, unknown>) || {};
  // Default: enviar (toggle prendido es lo normal en el panel hasta que la
  // coach lo apague a propósito).
  const wants = notifs.newClient !== false;
  if (!wants) {
    return json({ ok: true, skipped: "coach_disabled_newClient" });
  }

  // 4) Componer y mandar el email vía send-email
  const coachFirst = ((coach.nombre || "") + "").split(" ")[0] || "coach";
  const cliNombre = cand.nombre || cand.email || "Cliente";
  const cliCargo = cand.cargo || "";
  const subject = `Nuevo cliente en Pathway: ${cliNombre}`;
  const html = `
<p>Hola ${escH(coachFirst)},</p>
<p>Tenés un <strong>cliente nuevo</strong> en Pathway:</p>
<div style="background:#fff;border:1px solid rgba(45,106,79,.14);border-radius:12px;padding:16px 18px;margin:14px 0;">
  <div style="font-size:16px;font-weight:700;color:#1B4332;">${escH(cliNombre)}</div>
  ${cand.email ? `<div style="font-size:13px;color:#5A6A60;margin-top:2px;">${escH(cand.email)}</div>` : ""}
  ${cliCargo ? `<div style="font-size:13px;color:#5A6A60;margin-top:6px;">${escH(cliCargo)}</div>` : ""}
</div>
<p style="margin-top:18px;">
  <a href="https://pathwaycareercoach.com/panel-v2.html"
     style="display:inline-block;padding:12px 24px;background:#2D6A4F;color:#fff;border-radius:10px;text-decoration:none;font-weight:700;">
    Abrir mi panel →
  </a>
</p>
<p style="font-size:12px;color:#888;margin-top:18px;">¿No querés recibir este email? Apagá el switch "Cliente nuevo" en Panel → Configuración → Notificaciones.</p>
`;

  try {
    const r = await fetch(`${SB_URL}/functions/v1/send-email`, {
      method: "POST",
      headers: {
        apikey: SERVICE,
        Authorization: `Bearer ${SERVICE}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to: coach.email,
        to_name: coach.nombre || coach.email,
        subject,
        html,
        signature: "pathway",
      }),
    });
    if (!r.ok) {
      const t = await r.text();
      return json({ error: "send_failed", status: r.status, detail: t.slice(0, 300) }, 502);
    }
    return json({ ok: true, sent: true, coach: coach.email, candidato: cliNombre });
  } catch (e) {
    return json({ error: "send_exception", detail: String(e).slice(0, 200) }, 502);
  }
});
