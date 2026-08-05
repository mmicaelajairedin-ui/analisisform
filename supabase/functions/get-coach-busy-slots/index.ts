// ===================================================================
// get-coach-busy-slots — Lee Google Calendar del coach y retorna horarios ocupados
//
// Obtiene eventos del coach en Google Calendar para un rango de fechas
// y los almacena en coach_busy_slots para cacheo local. Esto evita golpear
// constantemente la API de Google.
//
// POST body:
//   { coach_id (UUID), start_date (YYYY-MM-DD), end_date (YYYY-MM-DD) }
//   → { ok: true, busy_slots: [{fecha, horario_inicio, horario_fin}, ...] }
//   → { ok: false, reason: "..." }
//
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
// Deploy: supabase functions deploy get-coach-busy-slots --no-verify-jwt
// ===================================================================

const SB_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const G_ID = Deno.env.get("GOOGLE_CLIENT_ID") || "";
const G_SEC = Deno.env.get("GOOGLE_CLIENT_SECRET") || "";
const svc = { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` };

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

const isUuid = (s: string) => /^[0-9a-f-]{32,36}$/i.test(s);

async function accessToken(refresh_token: string): Promise<string | null> {
  try {
    const r = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: G_ID, client_secret: G_SEC, refresh_token, grant_type: "refresh_token" }),
    });
    const d = await r.json();
    return (r.ok && d.access_token) ? String(d.access_token) : null;
  } catch { return null; }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "post_only" }, 405);
  if (!SB_URL || !SERVICE || !G_ID || !G_SEC) return json({ error: "env_missing" }, 500);

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: "bad_json" }, 400); }

  const coachId = String(body.coach_id || "").trim();
  const startDate = String(body.start_date || "").trim();
  const endDate = String(body.end_date || "").trim();

  if (!isUuid(coachId)) return json({ error: "coach_id_invalid" }, 400);
  if (!startDate || !endDate) return json({ error: "dates_required" }, 400);

  try {
    // 1) Obtener refresh token del coach
    let refresh = "";
    const tr = await fetch(`${SB_URL}/rest/v1/gcal_tokens?coach_id=eq.${encodeURIComponent(coachId)}&select=token&limit=1`, { headers: svc });
    if (tr.ok) {
      const trows = await tr.json();
      const g = (Array.isArray(trows) && trows[0] && trows[0].token) || {};
      refresh = String((g && g.refresh_token) || "");
    }
    if (!refresh) {
      const r = await fetch(`${SB_URL}/rest/v1/usuarios?id=eq.${encodeURIComponent(coachId)}&select=configuracion&limit=1`, { headers: svc });
      if (r.ok) {
        const rows = await r.json();
        const cfg = (Array.isArray(rows) && rows[0] && rows[0].configuracion) || {};
        const g = (cfg && cfg.gcal) || {};
        refresh = String(g.refresh_token || "");
      }
    }

    // Sin conexión Google: retornar lista vacía (no es error fatal)
    if (!refresh) return json({ ok: true, busy_slots: [], reason: "no_gcal_connection" });

    // 2) Obtener access token
    const at = await accessToken(refresh);
    if (!at) return json({ ok: true, busy_slots: [], reason: "token_failed" });

    // 3) Leer eventos de Google Calendar en el rango
    const auth = { Authorization: `Bearer ${at}`, "Content-Type": "application/json" };
    const startISO = `${startDate}T00:00:00Z`;
    const endISO = `${endDate}T23:59:59Z`;

    const r = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?` +
      `timeMin=${encodeURIComponent(startISO)}&` +
      `timeMax=${encodeURIComponent(endISO)}&` +
      `singleEvents=true&` +
      `showDeleted=false`,
      { headers: auth }
    );

    if (!r.ok) return json({ ok: true, busy_slots: [] });

    const d = await r.json().catch(() => ({ items: [] }));
    const events = Array.isArray(d.items) ? d.items : [];

    // 4) Extraer horarios ocupados (ignorar eventos all-day)
    const busySlots: Array<{ fecha: string; horario_inicio: string; horario_fin: string }> = [];
    for (const ev of events) {
      if (ev.start?.dateTime && ev.end?.dateTime) {
        const start = new Date(ev.start.dateTime);
        const end = new Date(ev.end.dateTime);
        const fecha = start.toISOString().split("T")[0];
        const horaInicio = start.toISOString().split("T")[1].slice(0, 5); // HH:MM
        const horaFin = end.toISOString().split("T")[1].slice(0, 5);
        busySlots.push({ fecha, horario_inicio: horaInicio, horario_fin: horaFin });
      }
    }

    // 5) Guardar en BD para cacheo (best-effort)
    for (const slot of busySlots) {
      try {
        await fetch(`${SB_URL}/rest/v1/coach_busy_slots`, {
          method: "POST",
          headers: { ...svc, "Content-Type": "application/json", Prefer: "return=minimal,resolution=ignore-duplicates" },
          body: JSON.stringify({ coach_id: coachId, fecha: slot.fecha, horario_inicio: slot.horario_inicio, horario_fin: slot.horario_fin }),
        });
      } catch { /* ignore cacheo errors */ }
    }

    return json({ ok: true, busy_slots: busySlots });
  } catch (e) {
    console.error("get-coach-busy-slots error:", e);
    return json({ error: "internal_error", detail: String(e) }, 500);
  }
});
