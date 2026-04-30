// Supabase Edge Function — calendar
//
// Lee el gcal_ical_url del coach desde usuarios.configuracion, fetchea el
// iCal de Google (no se puede desde el navegador por CORS), parsea los
// VEVENT y devuelve los proximos 14 dias de eventos como JSON.
//
// Reemplaza la Pages Function /api/calendar (que dejo de funcionar porque
// Cloudflare Pages no esta detectando el directorio /functions del repo).
//
// Desplegar:
//   supabase functions deploy calendar --no-verify-jwt
//
// Uso desde frontend:
//   fetch(SB+'/functions/v1/calendar?email='+encodeURIComponent(email), {
//     headers: { 'Authorization': 'Bearer '+ANON_KEY }
//   })
//
// TODO auth: hoy solo se valida por email. En un proximo paso requerir
// password_hash desde mj_user en localStorage para que solo el coach
// logueado pueda leer su propio calendario.

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, authorization, apikey, x-client-info",
};

const DAYS_AHEAD = 14;
const MAX_EVENTS = 30;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }
  if (req.method !== "GET") {
    return json({ error: "GET only" }, 405);
  }

  const url = new URL(req.url);
  const email = (url.searchParams.get("email") || "").trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return json({ error: "invalid_email" }, 400);
  }

  const SB_URL = Deno.env.get("SUPABASE_URL") || "";
  const SB_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ||
    Deno.env.get("SUPABASE_ANON_KEY") || "";
  if (!SB_URL || !SB_KEY) {
    return json({ error: "supabase_env_missing" }, 500);
  }

  let cfg: Record<string, unknown> = {};
  try {
    const sbRes = await fetch(
      `${SB_URL}/rest/v1/usuarios?email=eq.${encodeURIComponent(email)}&select=configuracion&limit=1`,
      { headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` } },
    );
    if (!sbRes.ok) return json({ error: "supabase_error", status: sbRes.status }, 502);
    const rows = await sbRes.json();
    if (!rows.length) return json({ error: "coach_not_found" }, 404);
    cfg = rows[0].configuracion || {};
  } catch (_e) {
    return json({ error: "supabase_unreachable" }, 502);
  }

  const icalUrl = (cfg as { gcal_ical_url?: string }).gcal_ical_url;
  if (!icalUrl) return json({ events: [], unconfigured: true }, 200);
  if (!/^https:\/\/calendar\.google\.com\/calendar\/ical\//.test(icalUrl)) {
    return json({ error: "invalid_ical_url", events: [] }, 200);
  }

  let icalText: string;
  try {
    const icalRes = await fetch(icalUrl);
    if (!icalRes.ok) {
      return json({ error: "ical_fetch_failed", status: icalRes.status, events: [] }, 200);
    }
    icalText = await icalRes.text();
  } catch (_e) {
    return json({ error: "ical_unreachable", events: [] }, 200);
  }

  let all: ParsedEvent[];
  try {
    all = parseICal(icalText);
  } catch (_e) {
    return json({ error: "parse_failed", events: [] }, 200);
  }

  const now = Date.now();
  const cutoff = now + DAYS_AHEAD * 86_400_000;
  const upcoming = all
    .filter((e) => e.start >= now && e.start < cutoff && e.status !== "CANCELLED")
    .sort((a, b) => a.start - b.start)
    .slice(0, MAX_EVENTS);

  return json({ events: upcoming, count: upcoming.length });
});

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...CORS_HEADERS,
      "content-type": "application/json; charset=utf-8",
      "cache-control": "private, max-age=60",
    },
  });
}

interface ParsedEvent {
  title: string;
  start: number;
  end: number | null;
  location: string | null;
  meet: string | null;
  uid: string | null;
  status?: string;
  description?: string;
}

function parseICal(text: string): ParsedEvent[] {
  // Unfold continuation lines (RFC 5545)
  const unfolded = text.replace(/\r\n/g, "\n").replace(/\n[ \t]/g, "");
  const lines = unfolded.split("\n");

  type Raw = {
    title?: string;
    start?: number;
    end?: number;
    location?: string;
    description?: string;
    status?: string;
    uid?: string;
    meet?: string;
  };
  const events: Raw[] = [];
  let cur: Raw | null = null;

  for (const line of lines) {
    if (line === "BEGIN:VEVENT") { cur = {}; continue; }
    if (line === "END:VEVENT") {
      if (cur && cur.start) events.push(cur);
      cur = null;
      continue;
    }
    if (!cur) continue;

    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;
    const propPart = line.slice(0, colonIdx);
    const value = line.slice(colonIdx + 1);
    const propName = propPart.split(";")[0].toUpperCase();

    if (propName === "SUMMARY") cur.title = unescapeIcal(value);
    else if (propName === "DTSTART") cur.start = parseDate(value);
    else if (propName === "DTEND") cur.end = parseDate(value);
    else if (propName === "LOCATION") cur.location = unescapeIcal(value);
    else if (propName === "DESCRIPTION") cur.description = unescapeIcal(value);
    else if (propName === "STATUS") cur.status = value;
    else if (propName === "UID") cur.uid = value;
  }

  for (const e of events) {
    if (e.description) {
      const m = e.description.match(/https:\/\/meet\.google\.com\/[a-z0-9-]+/i);
      if (m) e.meet = m[0];
    }
  }

  return events.map((e) => ({
    title: e.title || "(Sin titulo)",
    start: e.start as number,
    end: e.end || null,
    location: e.location || null,
    meet: e.meet || null,
    uid: e.uid || null,
    status: e.status,
  }));
}

function parseDate(value: string): number {
  const v = value.trim();
  const m = v.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})Z?)?$/);
  if (!m) return 0;
  const [, y, mo, d, hh, mm, ss] = m;
  return Date.UTC(+y, +mo - 1, +d, +(hh || 0), +(mm || 0), +(ss || 0));
}

function unescapeIcal(s: string): string {
  return s
    .replace(/\\n/gi, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\");
}
