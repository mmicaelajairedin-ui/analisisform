// Supabase Edge Function — conversacion
//
// Conversación in-app lead ↔ coach por LINK MÁGICO (token). Sin cuenta para el
// lead: el token (uuid) es la llave. La página /c/<token> (c.html) la usa.
//
// POST { action: "get", token }                  → { coach, mensajes, estado, servicios }
// POST { action: "responder", token, texto }     → agrega mensaje del lead + avisa al coach
//
// Lee/escribe `solicitudes` con service role (no expone datos a anon).
// Desplegar: supabase functions deploy conversacion --no-verify-jwt

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, authorization, apikey, x-client-info",
};

function json(d: unknown, s = 200): Response {
  return new Response(JSON.stringify(d), {
    status: s,
    headers: { ...CORS, "content-type": "application/json; charset=utf-8" },
  });
}
function esc(s: string): string {
  return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

interface Msg { from: "lead" | "coach"; texto: string; ts: number }

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  let body: { action?: string; token?: string; texto?: string };
  try { body = await req.json(); } catch { return json({ error: "bad_json" }, 400); }

  const action = (body.action || "").trim();
  const token = (body.token || "").trim();
  if (!token || token.length < 12) return json({ error: "token_invalido" }, 400);

  const SB = (Deno.env.get("SUPABASE_URL") || "").replace(/\/+$/, "");
  const KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!SB || !KEY) return json({ error: "env_missing" }, 500);
  const H = { apikey: KEY, Authorization: `Bearer ${KEY}` };

  // Buscar la conversación (solicitud con ese token) + datos del coach.
  const r = await fetch(
    `${SB}/rest/v1/solicitudes?token=eq.${encodeURIComponent(token)}&select=id,coach_id,candidato_nombre,candidato_email,mensajes,estado,servicio_titulo&limit=1`,
    { headers: H },
  );
  if (!r.ok) return json({ error: "db_error" }, 502);
  const rows = await r.json();
  if (!Array.isArray(rows) || !rows.length) return json({ error: "no_encontrada" }, 404);
  const sol = rows[0];
  const mensajes: Msg[] = Array.isArray(sol.mensajes) ? sol.mensajes : [];

  // Datos del coach (nombre, slug, servicios) para mostrar y para "Contratar".
  const cr = await fetch(
    `${SB}/rest/v1/usuarios?id=eq.${encodeURIComponent(sol.coach_id)}&select=nombre,slug,email,configuracion&limit=1`,
    { headers: H },
  );
  const coachRow = cr.ok ? (await cr.json())[0] || {} : {};
  const cfg = coachRow.configuracion || {};
  const slug = coachRow.slug || cfg.slug || "";
  const servicios = Array.isArray(cfg.servicios) ? cfg.servicios : [];
  const coachOut = { nombre: coachRow.nombre || "tu coach", slug, servicios };

  if (action === "get") {
    return json({ ok: true, coach: coachOut, mensajes, estado: sol.estado, lead_nombre: sol.candidato_nombre });
  }

  if (action === "responder") {
    const texto = (body.texto || "").trim().slice(0, 2000);
    if (!texto) return json({ error: "texto_vacio" }, 400);
    const nuevo: Msg[] = [...mensajes, { from: "lead", texto, ts: Date.now() }];
    const up = await fetch(`${SB}/rest/v1/solicitudes?id=eq.${encodeURIComponent(sol.id)}`, {
      method: "PATCH",
      headers: { ...H, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ mensajes: nuevo, lead_ultimo_at: new Date().toISOString() }),
    });
    if (!up.ok) return json({ error: "no_guardado" }, 502);

    // Avisar al coach por mail (best-effort).
    if (coachRow.email) {
      const link = "https://pathwaycareercoach.com/panel-v2.html#mensajes";
      const html =
        `<p style="margin:0 0 12px;color:#3A4A40;">${esc(sol.candidato_nombre || "Un candidato")} te respondió en Pathway.</p>` +
        `<div style="background:#fff;border-left:3px solid #2D6A4F;border-radius:8px;padding:12px 14px;margin:12px 0;color:#3A4A40;white-space:pre-wrap;">${esc(texto)}</div>` +
        `<p style="margin:14px 0 0;"><a href="${link}" style="display:inline-block;padding:11px 22px;background:#2D6A4F;color:#fff;border-radius:10px;text-decoration:none;font-weight:700;">Ver y responder →</a></p>`;
      fetch(`${SB}/functions/v1/send-email`, {
        method: "POST",
        headers: { ...H, "Content-Type": "application/json" },
        body: JSON.stringify({ to: coachRow.email, to_name: coachRow.nombre || "Coach", subject: `💬 ${sol.candidato_nombre || "Un candidato"} te respondió`, html, signature: "pathway" }),
      }).catch(() => {});
    }
    return json({ ok: true, mensajes: nuevo, coach: coachOut, estado: sol.estado });
  }

  return json({ error: "accion_invalida" }, 400);
});
