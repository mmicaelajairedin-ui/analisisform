// Supabase Edge Function — error-guard (Guardia de errores)
//
// Revisa la tabla `client_errors` (la escribe pw-observe.js desde el navegador)
// y, si hay errores NUEVOS sin avisar, le manda a la coach un email-resumen para
// que se entere AL TOQUE cuando algo falla en producción: una reserva que no se
// guardó, un email que no salió, un error de JS que rompe una pantalla. Antes
// esos fallos eran silenciosos (te enterabas cuando se quejaba un cliente).
//
// Idempotente: marca notified_at en las filas que ya avisó → nunca repite el
// mismo error. Si el email falla, NO las marca (se reintentan en la próxima
// corrida). Lo dispara un cron (GitHub Actions) cada ~30 min.
//
// Desplegar:  supabase functions deploy error-guard --no-verify-jwt
// Migration:  supabase/migrations/client_errors_notified.sql (agrega notified_at)
// Secrets (Supabase → Edge Functions → Secrets) — ya existen para otros agentes:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, AGENT_TRIGGER_SECRET, BREVO_API_KEY
//   REPORT_EMAIL_TO  → a dónde llega el aviso (cae a hi@pathwaycareercoach.com)

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, authorization, x-trigger-secret",
};

// Máximo de filas por corrida. Si hay un pico (miles), resumimos estas y las
// marcamos; el resto se avisa en la próxima corrida. Evita un email gigante.
const LIMIT = 500;

interface Row {
  id: number;
  kind?: string;
  detail?: string;
  page?: string;
  email?: string;
  ts?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  const SB_URL = Deno.env.get("SUPABASE_URL") || "";
  const SB_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const TRIGGER = Deno.env.get("AGENT_TRIGGER_SECRET") || "";
  const REPORT_TO = (Deno.env.get("REPORT_EMAIL_TO") || "hi@pathwaycareercoach.com").trim();
  if (!SB_URL || !SB_KEY) return json({ error: "supabase_env_missing" }, 500);

  // Auth: solo el cron con el secreto puede disparar.
  const got = req.headers.get("x-trigger-secret") || "";
  if (!TRIGGER || got !== TRIGGER) return json({ error: "unauthorized" }, 401);

  // 1) Errores sin notificar, más viejo primero.
  const q = `${SB_URL}/rest/v1/client_errors` +
    `?select=id,kind,detail,page,email,ts` +
    `&notified_at=is.null&order=ts.asc&limit=${LIMIT}`;
  let rows: Row[] = [];
  try {
    const r = await fetch(q, { headers: sbH(SB_KEY) });
    if (!r.ok) return json({ error: "query_failed", status: r.status }, 502);
    rows = await r.json();
  } catch (_e) {
    return json({ error: "unreachable" }, 502);
  }
  if (!rows.length) return json({ ok: true, nuevos: 0 });

  // 2) Resumen agrupado por página + tipo (un flood de lo mismo cuenta como ×N).
  const groups: Record<string, { page: string; kind: string; n: number; last: string; sample: string; emails: Set<string> }> = {};
  for (const row of rows) {
    const page = (row.page || "—").slice(0, 80);
    const kind = row.kind || "—";
    const key = page + " · " + kind;
    if (!groups[key]) groups[key] = { page, kind, n: 0, last: row.ts || "", sample: row.detail || "", emails: new Set() };
    const g = groups[key];
    g.n++;
    if ((row.ts || "") > g.last) g.last = row.ts || "";
    if (!g.sample && row.detail) g.sample = row.detail;
    if (row.email) g.emails.add((row.email + "").toLowerCase());
  }
  const list = Object.values(groups).sort((a, b) => b.n - a.n);

  // Un fallo de guardado (http_4xx/5xx, neterror) es más urgente que un jserror
  // suelto: lo marcamos para que salte a la vista en el asunto.
  const criticos = list.filter((g) => /^http_|neterror|fetch/i.test(g.kind)).reduce((s, g) => s + g.n, 0);
  const total = rows.length;
  const capped = total >= LIMIT ? " (y más)" : "";

  // 3) Email-resumen a la coach.
  const filas = list.map((g) => {
    const emails = [...g.emails].slice(0, 3).join(", ") + (g.emails.size > 3 ? ` +${g.emails.size - 3}` : "");
    return `<tr>
      <td style="padding:8px 10px;border-bottom:1px solid #EEE;font-weight:700;color:#B4231F">${esc(String(g.n))}×</td>
      <td style="padding:8px 10px;border-bottom:1px solid #EEE"><code>${esc(g.kind)}</code></td>
      <td style="padding:8px 10px;border-bottom:1px solid #EEE">${esc(g.page)}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #EEE;color:#5A6A60;font-size:12px">${esc((g.sample || "").slice(0, 120))}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #EEE;color:#7A8A80;font-size:12px">${esc(emails || "—")}</td>
    </tr>`;
  }).join("");

  const html = `<div style="font-family:Inter,-apple-system,Segoe UI,Arial,sans-serif;color:#1B2E26;max-width:640px">
    <h2 style="font-family:Georgia,serif;color:#B4231F;margin:0 0 4px">⚠️ ${esc(String(total))}${capped} error(es) nuevo(s) en Pathway</h2>
    <p style="font-size:13.5px;color:#5A6A60;margin:0 0 14px">${criticos > 0 ? `<strong style="color:#B4231F">${esc(String(criticos))} son de guardado/red</strong> (posible reserva o dato que no se guardó). ` : ""}Revisá lo de abajo. Si es de guardado, puede haber un cliente afectado.</p>
    <table style="border-collapse:collapse;width:100%;font-size:13px;border:1px solid #EEE;border-radius:8px;overflow:hidden">
      <thead><tr style="background:#F6F8F5;text-align:left">
        <th style="padding:8px 10px">#</th><th style="padding:8px 10px">Tipo</th><th style="padding:8px 10px">Página</th><th style="padding:8px 10px">Detalle</th><th style="padding:8px 10px">Quién</th>
      </tr></thead>
      <tbody>${filas}</tbody>
    </table>
    <p style="font-size:12px;color:#9AA69E;margin-top:14px">Para ver todo el detalle: Supabase → SQL Editor →
      <code>SELECT ts,kind,email,page,detail FROM client_errors ORDER BY ts DESC LIMIT 100;</code></p>
    <p style="font-size:11.5px;color:#B9C2BB;margin-top:6px">Guardia de errores de Pathway · te aviso solo cuando hay algo nuevo.</p>
  </div>`;

  let emailOk = false;
  try {
    const r = await fetch(`${SB_URL}/functions/v1/send-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: REPORT_TO,
        to_name: "Pathway",
        subject: `⚠️ ${total}${capped} error(es) nuevo(s) en Pathway`,
        html,
        reply_to: "hi@pathwaycareercoach.com",
        signature: "none",
      }),
    });
    emailOk = r.ok;
  } catch (_e) {
    emailOk = false;
  }

  // 4) Marcar como avisadas SOLO si el email salió (si falló, se reintenta).
  if (!emailOk) return json({ ok: false, nuevos: total, email: "failed" }, 502);
  const ids = rows.map((r) => r.id).join(",");
  try {
    await fetch(`${SB_URL}/rest/v1/client_errors?id=in.(${ids})`, {
      method: "PATCH",
      headers: { ...sbH(SB_KEY), "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ notified_at: new Date().toISOString() }),
    });
  } catch (_e) { /* si el PATCH falla, el próximo run puede reavisar — preferible a perder el aviso */ }

  return json({ ok: true, nuevos: total, criticos, grupos: list.length, email: "sent" });
});

function sbH(key: string) {
  return { apikey: key, Authorization: "Bearer " + key };
}
function esc(s: string) {
  return (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}
