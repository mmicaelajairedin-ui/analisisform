// GET /api/calendar?email=<coach_email>
// Lee el gcal_ical_url del coach desde Supabase, fetchea el iCal de Google
// (no se puede hacer desde el navegador por CORS), parsea los VEVENT y
// devuelve los proximos 14 dias de eventos como JSON.
//
// TODO auth: hoy solo se valida por email. En un proximo paso vamos a
// requerir tambien el password_hash desde mj_user en localStorage para
// que solo el coach logueado pueda leer su propio calendario.

const SUPABASE_URL = 'https://ddxnrsnjdvtqhxunxnwj.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkeG5yc25qZHZ0cWh4dW54bndqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxNDk5MzksImV4cCI6MjA5MDcyNTkzOX0.t82X1x-PDgFDGYhKC7YXoRKhga9I8Hjet60QUYvtZLU';
const DAYS_AHEAD = 14;
const MAX_EVENTS = 30;

export async function onRequestGet({ request }) {
  const url = new URL(request.url);
  const email = (url.searchParams.get('email') || '').trim().toLowerCase();

  if (!email || !email.includes('@')) {
    return json({ error: 'invalid_email' }, 400);
  }

  let cfg;
  try {
    const sbRes = await fetch(
      `${SUPABASE_URL}/rest/v1/usuarios?email=eq.${encodeURIComponent(email)}&select=configuracion&limit=1`,
      { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } }
    );
    if (!sbRes.ok) return json({ error: 'supabase_error', status: sbRes.status }, 502);
    const rows = await sbRes.json();
    if (!rows.length) return json({ error: 'coach_not_found' }, 404);
    cfg = rows[0].configuracion || {};
  } catch (e) {
    return json({ error: 'supabase_unreachable' }, 502);
  }

  const icalUrl = cfg.gcal_ical_url;
  if (!icalUrl) return json({ events: [], unconfigured: true }, 200);
  if (!/^https:\/\/calendar\.google\.com\/calendar\/ical\//.test(icalUrl)) {
    return json({ error: 'invalid_ical_url', events: [] }, 200);
  }

  let icalText;
  try {
    const icalRes = await fetch(icalUrl, { cf: { cacheTtl: 60, cacheEverything: true } });
    if (!icalRes.ok) return json({ error: 'ical_fetch_failed', status: icalRes.status, events: [] }, 200);
    icalText = await icalRes.text();
  } catch (e) {
    return json({ error: 'ical_unreachable', events: [] }, 200);
  }

  let all;
  try {
    all = parseICal(icalText);
  } catch (e) {
    return json({ error: 'parse_failed', events: [] }, 200);
  }
  const now = Date.now();
  const cutoff = now + DAYS_AHEAD * 86400_000;
  const upcoming = all
    .filter(e => e.start >= now && e.start < cutoff && e.status !== 'CANCELLED')
    .sort((a, b) => a.start - b.start)
    .slice(0, MAX_EVENTS);

  return json({ events: upcoming, count: upcoming.length });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'private, max-age=60',
    },
  });
}

function parseICal(text) {
  // Unfold continuation lines (RFC 5545: lines starting with space/tab continue prev)
  const unfolded = text.replace(/\r\n/g, '\n').replace(/\n[ \t]/g, '');
  const lines = unfolded.split('\n');

  const events = [];
  let cur = null;
  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') { cur = {}; continue; }
    if (line === 'END:VEVENT') {
      if (cur && cur.start) events.push(cur);
      cur = null;
      continue;
    }
    if (!cur) continue;

    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;
    const propPart = line.slice(0, colonIdx);
    const value = line.slice(colonIdx + 1);
    const propName = propPart.split(';')[0].toUpperCase();

    if (propName === 'SUMMARY') cur.title = unescapeIcal(value);
    else if (propName === 'DTSTART') cur.start = parseDate(value, propPart);
    else if (propName === 'DTEND') cur.end = parseDate(value, propPart);
    else if (propName === 'LOCATION') cur.location = unescapeIcal(value);
    else if (propName === 'DESCRIPTION') cur.description = unescapeIcal(value);
    else if (propName === 'STATUS') cur.status = value;
    else if (propName === 'UID') cur.uid = value;
  }

  for (const e of events) {
    if (e.description) {
      const m = e.description.match(/https:\/\/meet\.google\.com\/[a-z0-9-]+/i);
      if (m) e.meet = m[0];
    }
  }

  return events.map(e => ({
    title: e.title || '(Sin titulo)',
    start: e.start,
    end: e.end || null,
    location: e.location || null,
    meet: e.meet || null,
    uid: e.uid || null,
  }));
}

function parseDate(value, propPart) {
  const v = value.trim();
  // YYYYMMDD (all-day) or YYYYMMDDTHHMMSS[Z]
  const m = v.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z?))?$/);
  if (!m) return 0;
  const [, y, mo, d, hh, mm, ss] = m;
  return Date.UTC(+y, +mo - 1, +d, +(hh || 0), +(mm || 0), +(ss || 0));
}

function unescapeIcal(s) {
  return s
    .replace(/\\n/gi, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\');
}
