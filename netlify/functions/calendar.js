// Netlify Function: calendar.js
// Reads a coach's gcal_ical_url from Supabase and returns parsed events.
// Multi-coach: pass ?coach=<uuid> in the query string.
//
// Usage: GET /.netlify/functions/calendar?coach=<uuid>
// Returns: { events: [...], source: 'gcal' | 'no_url' | 'error', error?: string }

const SB_URL = 'https://ddxnrsnjdvtqhxunxnwj.supabase.co';
const SB_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkeG5yc25qZHZ0cWh4dW54bndqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxNDk5MzksImV4cCI6MjA5MDcyNTkzOX0.t82X1x-PDgFDGYhKC7YXoRKhga9I8Hjet60QUYvtZLU';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS'
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: CORS, body: '' };
  }
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers: CORS, body: 'Method Not Allowed' };
  }

  const coachId = (event.queryStringParameters || {}).coach;
  if (!coachId || !/^[0-9a-f-]{32,40}$/i.test(coachId)) {
    return {
      statusCode: 400,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'invalid_coach_id' })
    };
  }

  try {
    // 1. Read coach config from Supabase
    const userResp = await fetch(
      `${SB_URL}/rest/v1/usuarios?id=eq.${encodeURIComponent(coachId)}&select=configuracion`,
      { headers: { apikey: SB_ANON, Authorization: 'Bearer ' + SB_ANON } }
    );
    if (!userResp.ok) {
      return jsonError(502, 'supabase_error', `Supabase ${userResp.status}`);
    }
    const rows = await userResp.json();
    const cfg = (rows[0] && rows[0].configuracion) || {};
    const icalUrl = cfg.gcal_ical_url;

    if (!icalUrl) {
      return jsonOk({ events: [], source: 'no_url' });
    }

    // 2. Fetch iCal feed
    const icalResp = await fetch(icalUrl, {
      headers: { 'User-Agent': 'Pathway-Calendar-Sync/1.0' }
    });
    if (!icalResp.ok) {
      return jsonError(502, 'ical_fetch_failed', `iCal returned ${icalResp.status}`);
    }
    const icalText = await icalResp.text();

    // 3. Parse iCal
    const allEvents = parseIcal(icalText);

    // 4. Filter to next 14 days, sort by start
    const now = Date.now();
    const horizon = now + 14 * 24 * 60 * 60 * 1000;
    const events = allEvents
      .filter(e => {
        if (!e.start) return false;
        const t = new Date(e.start).getTime();
        return t >= now - 60 * 60 * 1000 && t <= horizon; // include events that started in the last hour
      })
      .sort((a, b) => new Date(a.start) - new Date(b.start));

    return jsonOk({ events, source: 'gcal', count: events.length, fetched: new Date().toISOString() });
  } catch (err) {
    return jsonError(500, 'internal_error', err.message);
  }
};

// ── helpers ─────────────────────────────────────────────────

function jsonOk(payload) {
  return {
    statusCode: 200,
    headers: { ...CORS, 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=600' }, // 10 min CDN cache
    body: JSON.stringify(payload)
  };
}

function jsonError(code, key, detail) {
  return {
    statusCode: code,
    headers: { ...CORS, 'Content-Type': 'application/json' },
    body: JSON.stringify({ error: key, detail })
  };
}

// Inline iCal parser — handles VEVENT blocks and basic fields.
// Supports DTSTART formats:
//   YYYYMMDD                     (all-day)
//   YYYYMMDDTHHMMSSZ             (UTC)
//   YYYYMMDDTHHMMSS (with TZID)  (timezone — interpreted naively as local-of-event)
function parseIcal(text) {
  // Unfold continuation lines (RFC 5545: lines starting with space/tab continue previous)
  const unfolded = text.replace(/\r?\n[ \t]/g, '');
  const lines = unfolded.split(/\r?\n/);

  const events = [];
  let current = null;

  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') {
      current = {};
      continue;
    }
    if (line === 'END:VEVENT') {
      if (current && current.start && current.title) events.push(current);
      current = null;
      continue;
    }
    if (!current) continue;

    const colon = line.indexOf(':');
    if (colon < 0) continue;
    const head = line.slice(0, colon);
    const value = line.slice(colon + 1);
    const key = head.split(';')[0].toUpperCase();

    switch (key) {
      case 'SUMMARY':       current.title = unescape(value); break;
      case 'DESCRIPTION':   current.description = unescape(value); break;
      case 'LOCATION':      current.location = unescape(value); break;
      case 'URL':           current.url = value; break;
      case 'DTSTART':       current.start = parseIcalDate(value, head); current.allDay = head.includes('VALUE=DATE'); break;
      case 'DTEND':         current.end = parseIcalDate(value, head); break;
      case 'STATUS':        current.status = value; break;
      case 'UID':           current.uid = value; break;
      case 'ORGANIZER':     current.organizer = extractParam(head, 'CN') || value.replace(/^mailto:/i, ''); break;
    }
  }

  return events;
}

function parseIcalDate(val, head) {
  // YYYYMMDD (all-day)
  if (/^\d{8}$/.test(val)) {
    return `${val.slice(0,4)}-${val.slice(4,6)}-${val.slice(6,8)}T00:00:00.000Z`;
  }
  // YYYYMMDDTHHMMSSZ (UTC) or YYYYMMDDTHHMMSS (local)
  const m = val.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/);
  if (m) {
    const [, Y, Mo, D, h, mi, s, z] = m;
    const iso = `${Y}-${Mo}-${D}T${h}:${mi}:${s}${z || ''}`;
    return new Date(iso).toISOString();
  }
  // Fallback: try Date parsing
  const d = new Date(val);
  return isNaN(d) ? null : d.toISOString();
}

function unescape(s) {
  return s
    .replace(/\\n/gi, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\');
}

function extractParam(head, name) {
  const re = new RegExp(name + '=([^;:]+)', 'i');
  const m = head.match(re);
  return m ? m[1] : null;
}
