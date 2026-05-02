// Supabase Edge Function — analytics-weekly
//
// Genera un reporte semanal automático de tráfico web combinando datos de
// Cloudflare Analytics (vía GraphQL API) + análisis con Claude. Manda el
// reporte por email vía Brevo (la edge function send-email).
//
// Se ejecuta cada lunes a las 8:00 UTC, disparada por GitHub Actions
// (.github/workflows/weekly-analytics.yml) → POST a esta función.
//
// Desplegar:
//   supabase functions deploy analytics-weekly --no-verify-jwt
//
// Env vars requeridas (Supabase → Edge Functions → Secrets):
//   ANTHROPIC_API_KEY     — sk-ant-...
//   CLOUDFLARE_API_TOKEN  — token con permiso "Analytics: Read" en ambas zonas
//   CLOUDFLARE_ZONE_MJ    — zone ID de micaelajairedin.com
//   CLOUDFLARE_ZONE_PW    — zone ID de pathwaycareercoach.com
//   REPORT_EMAIL_TO       — email destino (ej: hi@pathwaycareercoach.com)
//   SUPABASE_URL          — auto-inyectada por Supabase
//   SUPABASE_SERVICE_ROLE_KEY — auto-inyectada por Supabase
//   AGENT_TRIGGER_SECRET  — string compartido con GitHub Actions; protege el endpoint
//
// Trigger manual (testing):
//   curl -X POST https://<proyecto>.supabase.co/functions/v1/analytics-weekly \
//     -H "X-Trigger-Secret: <AGENT_TRIGGER_SECRET>"

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, x-trigger-secret",
};

const CLAUDE_MODEL = "claude-sonnet-4-5";

const ZONES: Array<{ key: string; envVar: string; label: string; role: string }> = [
  {
    key: "mj",
    envVar: "CLOUDFLARE_ZONE_MJ",
    label: "micaelajairedin.com",
    role: "Web personal de Micaela (coach individual). Objetivo: captar candidatos que buscan mentoría 1-a-1.",
  },
  {
    key: "pw",
    envVar: "CLOUDFLARE_ZONE_PW",
    label: "pathwaycareercoach.com",
    role: "Plataforma SaaS para coaches y coachees. Objetivo: registrar coaches y completar formularios de candidatos.",
  },
];

// ── Cloudflare GraphQL ────────────────────────────────────

interface DailyRow {
  date: string;
  uniques: number;
  requests: number;
  cachedRequests: number;
  bytes: number;
  cachedBytes: number;
  topCountries: Array<{ country: string; requests: number }>;
}

async function fetchCloudflareDaily(
  zoneTag: string,
  apiToken: string,
  startDate: string,
  endDate: string,
): Promise<DailyRow[]> {
  const query = `
    query ($zoneTag: String!, $start: Date!, $end: Date!) {
      viewer {
        zones(filter: { zoneTag: $zoneTag }) {
          httpRequests1dGroups(
            limit: 14
            filter: { date_geq: $start, date_leq: $end }
            orderBy: [date_ASC]
          ) {
            dimensions { date }
            sum {
              requests
              cachedRequests
              bytes
              cachedBytes
              countryMap { clientCountryName requests }
            }
            uniq { uniques }
          }
        }
      }
    }
  `;
  const res = await fetch("https://api.cloudflare.com/client/v4/graphql", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiToken}`,
    },
    body: JSON.stringify({
      query,
      variables: { zoneTag, start: startDate, end: endDate },
    }),
  });
  if (!res.ok) {
    throw new Error(`Cloudflare GraphQL ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  const json = await res.json();
  if (json.errors) {
    throw new Error(`Cloudflare GraphQL errors: ${JSON.stringify(json.errors).slice(0, 300)}`);
  }
  const groups = json?.data?.viewer?.zones?.[0]?.httpRequests1dGroups || [];
  return groups.map((g: any) => ({
    date: g.dimensions.date,
    uniques: g.uniq?.uniques || 0,
    requests: g.sum?.requests || 0,
    cachedRequests: g.sum?.cachedRequests || 0,
    bytes: g.sum?.bytes || 0,
    cachedBytes: g.sum?.cachedBytes || 0,
    topCountries: (g.sum?.countryMap || [])
      .map((c: any) => ({ country: c.clientCountryName, requests: c.requests }))
      .sort((a: any, b: any) => b.requests - a.requests)
      .slice(0, 5),
  }));
}

function summariseRows(rows: DailyRow[]) {
  const totalUniques = rows.reduce((s, r) => s + r.uniques, 0);
  const totalRequests = rows.reduce((s, r) => s + r.requests, 0);
  const totalCached = rows.reduce((s, r) => s + r.cachedRequests, 0);
  const totalBytes = rows.reduce((s, r) => s + r.bytes, 0);
  const cachePct = totalRequests > 0 ? (totalCached / totalRequests) * 100 : 0;

  const countryAgg = new Map<string, number>();
  for (const r of rows) {
    for (const c of r.topCountries) {
      countryAgg.set(c.country, (countryAgg.get(c.country) || 0) + c.requests);
    }
  }
  const topCountries = Array.from(countryAgg.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([country, requests]) => ({ country, requests }));

  return {
    days: rows.length,
    totalUniques,
    totalRequests,
    totalBytes,
    cachePct: Number(cachePct.toFixed(1)),
    avgUniquesPerDay: rows.length > 0 ? Math.round(totalUniques / rows.length) : 0,
    peakDay: rows.reduce(
      (best, r) => (r.uniques > best.uniques ? r : best),
      { date: "", uniques: 0 } as DailyRow,
    ),
    topCountries,
    daily: rows.map((r) => ({
      date: r.date,
      uniques: r.uniques,
      requests: r.requests,
      cachePct: r.requests > 0 ? Number(((r.cachedRequests / r.requests) * 100).toFixed(1)) : 0,
    })),
  };
}

// ── Claude ────────────────────────────────────────────────

const SYSTEM_ANALYTICS = `Sos un analista de marketing digital especializado en negocios SaaS y servicios profesionales. Tu cliente es Micaela Jairedin, coach de carrera, dueña de dos sitios:

1. micaelajairedin.com → su web personal como coach individual. Objetivo: captar candidatos para mentoría 1-a-1.
2. pathwaycareercoach.com → plataforma SaaS donde otros coaches registran clientes. Objetivo: registrar coaches y candidatos completando el formulario.

Tu tarea: leer las métricas de tráfico de la última semana de cada sitio, compararlas con la semana anterior si hay datos previos, y devolver un análisis ACCIONABLE en JSON.

REGLAS:
1. NO seas genérico. Si ves un pico, hipotetizá causas concretas (publicación, festivo, día de la semana, fin de campaña, etc.). Considerá el calendario (festivos en España y LatAm).
2. Las acciones deben ser ESPECÍFICAS y ejecutables esta semana, no consejos abstractos.
3. Si no hay datos suficientes para sostener una afirmación, decilo. No inventes.
4. Distinguí "lo que funcionó" (replicable) de "ruido" (no replicable).
5. Mencioná el día de la semana de cada fecha cuando sea relevante (los patrones B2B son distintos de los B2C).

RESPONDÉ SOLO CON JSON VÁLIDO, sin markdown ni explicaciones previas. Estructura exacta:
{
  "headline": "1 frase con la noticia más importante de la semana",
  "sitios": [
    {
      "sitio": "micaelajairedin.com",
      "resumen": "2-3 oraciones sobre el estado del tráfico esta semana",
      "comparacion_semana_anterior": "string con cambio % o 'sin datos previos'",
      "hipotesis": ["hipótesis 1 concreta con evidencia", "hipótesis 2"],
      "acciones_esta_semana": ["acción 1 específica y ejecutable", "acción 2", "acción 3"],
      "alertas": ["alerta 1 si aplica"],
      "que_replicar": "qué funcionó que vale la pena repetir"
    },
    {
      "sitio": "pathwaycareercoach.com",
      "resumen": "...",
      "comparacion_semana_anterior": "...",
      "hipotesis": ["..."],
      "acciones_esta_semana": ["..."],
      "alertas": ["..."],
      "que_replicar": "..."
    }
  ],
  "experimento_propuesto": "1 experimento puntual para esta semana que pueda mover la aguja, con métrica de éxito medible"
}`;

async function callClaude(
  apiKey: string,
  current: Record<string, unknown>,
  previous: Record<string, unknown> | null,
): Promise<Record<string, unknown>> {
  const userContent =
    `# Datos de esta semana\n\n${JSON.stringify(current, null, 2)}\n\n` +
    `# Datos de la semana anterior (para comparar)\n\n` +
    (previous ? JSON.stringify(previous, null, 2) : "Sin datos previos guardados todavía.");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 2400,
      system: SYSTEM_ANALYTICS,
      messages: [{ role: "user", content: userContent }],
    }),
  });
  if (!res.ok) {
    throw new Error(`Claude ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  const json = await res.json();
  const text: string = json?.content?.[0]?.text || "";
  // El modelo puede envolver con ```json ... ```; limpiar.
  const cleaned = text.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
  return JSON.parse(cleaned);
}

// ── Email HTML ────────────────────────────────────────────

function fmtNum(n: number): string {
  return n.toLocaleString("es-ES");
}
function fmtBytes(b: number): string {
  if (b > 1024 * 1024 * 1024) return (b / 1024 / 1024 / 1024).toFixed(2) + " GB";
  return (b / 1024 / 1024).toFixed(1) + " MB";
}

function buildEmailHtml(
  periodStart: string,
  periodEnd: string,
  perZone: Array<{ label: string; summary: ReturnType<typeof summariseRows> }>,
  analysis: any,
): string {
  const sitiosHtml = (analysis.sitios || [])
    .map((s: any, i: number) => {
      const summary = perZone[i]?.summary;
      const dailyTable = summary
        ? `<table style="border-collapse:collapse;width:100%;font-size:12px;margin:8px 0;">
            <thead><tr style="background:#f6f3f4;color:#5e5050;">
              <th style="text-align:left;padding:6px;">Día</th>
              <th style="text-align:right;padding:6px;">Visitas</th>
              <th style="text-align:right;padding:6px;">Reqs</th>
              <th style="text-align:right;padding:6px;">Cache</th>
            </tr></thead>
            <tbody>${
              summary.daily
                .map(
                  (d) =>
                    `<tr><td style="padding:6px;border-top:1px solid #eee;">${d.date}</td><td style="padding:6px;border-top:1px solid #eee;text-align:right;">${fmtNum(d.uniques)}</td><td style="padding:6px;border-top:1px solid #eee;text-align:right;">${fmtNum(d.requests)}</td><td style="padding:6px;border-top:1px solid #eee;text-align:right;">${d.cachePct}%</td></tr>`,
                )
                .join("")
            }</tbody>
          </table>`
        : "";
      return `
        <div style="margin:24px 0;padding:18px;background:#fafafa;border-radius:10px;border-left:3px solid #8C7B80;">
          <h3 style="margin:0 0 10px;color:#1B4332;font-size:16px;">${s.sitio}</h3>
          ${
            summary
              ? `<div style="font-size:13px;color:#666;margin-bottom:10px;">
                  <strong>${fmtNum(summary.totalUniques)}</strong> visitantes ·
                  <strong>${fmtNum(summary.totalRequests)}</strong> requests ·
                  <strong>${summary.cachePct}%</strong> cache ·
                  pico ${summary.peakDay.date} (${fmtNum(summary.peakDay.uniques)})
                </div>`
              : ""
          }
          <p style="margin:8px 0;font-size:13px;"><strong>Resumen:</strong> ${s.resumen || "—"}</p>
          <p style="margin:8px 0;font-size:13px;"><strong>vs semana anterior:</strong> ${s.comparacion_semana_anterior || "—"}</p>
          ${
            (s.hipotesis || []).length
              ? `<p style="margin:8px 0 4px;font-size:13px;"><strong>Hipótesis:</strong></p>
                <ul style="margin:4px 0 8px 18px;font-size:13px;color:#444;">${
                  (s.hipotesis as string[]).map((h) => `<li>${h}</li>`).join("")
                }</ul>`
              : ""
          }
          ${
            (s.acciones_esta_semana || []).length
              ? `<p style="margin:8px 0 4px;font-size:13px;color:#1B4332;"><strong>Acciones esta semana:</strong></p>
                <ul style="margin:4px 0 8px 18px;font-size:13px;color:#1B4332;">${
                  (s.acciones_esta_semana as string[]).map((a) => `<li>${a}</li>`).join("")
                }</ul>`
              : ""
          }
          ${
            (s.alertas || []).length
              ? `<div style="background:#fff4e6;border-radius:6px;padding:8px 12px;margin:8px 0;font-size:13px;">⚠️ ${
                  (s.alertas as string[]).join(" · ")
                }</div>`
              : ""
          }
          ${s.que_replicar ? `<p style="margin:8px 0;font-size:13px;"><strong>Replicar:</strong> ${s.que_replicar}</p>` : ""}
          ${dailyTable}
        </div>`;
    })
    .join("");

  return `
    <h2 style="margin:0 0 6px;color:#1B4332;">Reporte semanal · ${periodStart} → ${periodEnd}</h2>
    <p style="margin:0 0 18px;font-size:14px;color:#444;">${analysis.headline || ""}</p>
    ${sitiosHtml}
    ${
      analysis.experimento_propuesto
        ? `<div style="margin:24px 0;padding:16px;background:#eef6f1;border-radius:10px;">
            <h3 style="margin:0 0 8px;color:#2D6A4F;font-size:15px;">🧪 Experimento propuesto</h3>
            <p style="margin:0;font-size:13px;">${analysis.experimento_propuesto}</p>
          </div>`
        : ""
    }
    <p style="margin:18px 0 0;font-size:11px;color:#999;">Generado automáticamente por analytics-weekly. Histórico en Supabase → analytics_reports.</p>
  `;
}

// ── Supabase storage ──────────────────────────────────────

async function getPreviousReport(
  supabaseUrl: string,
  serviceKey: string,
  zone: string,
): Promise<Record<string, unknown> | null> {
  const url = `${supabaseUrl}/rest/v1/analytics_reports?zone=eq.${encodeURIComponent(zone)}&select=raw_metrics,analysis,period_start,period_end&order=period_end.desc&limit=1`;
  const res = await fetch(url, {
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
  });
  if (!res.ok) return null;
  const arr = await res.json();
  return Array.isArray(arr) && arr.length > 0 ? arr[0] : null;
}

async function saveReport(
  supabaseUrl: string,
  serviceKey: string,
  row: Record<string, unknown>,
): Promise<void> {
  const res = await fetch(`${supabaseUrl}/rest/v1/analytics_reports`, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(row),
  });
  if (!res.ok) {
    throw new Error(`Save report ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
}

// ── Handler ───────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ ok: false, error: "POST only" }), {
      status: 405,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  // Auth simple por shared secret (no usamos JWT porque la disparamos desde GH Actions).
  const triggerSecret = Deno.env.get("AGENT_TRIGGER_SECRET") || "";
  const provided = req.headers.get("x-trigger-secret") || "";
  if (!triggerSecret || provided !== triggerSecret) {
    return new Response(JSON.stringify({ ok: false, error: "unauthorized" }), {
      status: 401,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") || "";
  const CLOUDFLARE_API_TOKEN = Deno.env.get("CLOUDFLARE_API_TOKEN") || "";
  const REPORT_EMAIL_TO = Deno.env.get("REPORT_EMAIL_TO") || "";
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

  const missing = [
    ["ANTHROPIC_API_KEY", ANTHROPIC_API_KEY],
    ["CLOUDFLARE_API_TOKEN", CLOUDFLARE_API_TOKEN],
    ["REPORT_EMAIL_TO", REPORT_EMAIL_TO],
    ["SUPABASE_URL", SUPABASE_URL],
    ["SUPABASE_SERVICE_ROLE_KEY", SERVICE_KEY],
  ].filter(([, v]) => !v).map(([k]) => k);
  if (missing.length) {
    return new Response(
      JSON.stringify({ ok: false, error: `missing env: ${missing.join(", ")}` }),
      { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
    );
  }

  // Rango: últimos 7 días completos (ayer hacia atrás).
  const now = new Date();
  const end = new Date(now); end.setUTCDate(end.getUTCDate() - 1);
  const start = new Date(end); start.setUTCDate(start.getUTCDate() - 6);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const periodStart = fmt(start);
  const periodEnd = fmt(end);

  try {
    // 1. Pull Cloudflare data + previous reports for both zones in parallel.
    const perZoneTasks = ZONES.map(async (z) => {
      const zoneTag = Deno.env.get(z.envVar) || "";
      if (!zoneTag) {
        return { zone: z, summary: null, previous: null, error: `missing ${z.envVar}` };
      }
      const [rows, previous] = await Promise.all([
        fetchCloudflareDaily(zoneTag, CLOUDFLARE_API_TOKEN, periodStart, periodEnd),
        getPreviousReport(SUPABASE_URL, SERVICE_KEY, z.label),
      ]);
      return { zone: z, summary: summariseRows(rows), previous, error: null as string | null };
    });
    const perZone = await Promise.all(perZoneTasks);

    const errored = perZone.filter((p) => p.error);
    if (errored.length === ZONES.length) {
      return new Response(
        JSON.stringify({ ok: false, error: errored.map((e) => e.error).join("; ") }),
        { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
      );
    }

    // 2. Build payload for Claude.
    const currentPayload = {
      period: { start: periodStart, end: periodEnd },
      sitios: perZone
        .filter((p) => p.summary)
        .map((p) => ({
          sitio: p.zone.label,
          rol: p.zone.role,
          metricas: p.summary,
        })),
    };
    const previousPayload = perZone
      .filter((p) => p.previous)
      .map((p) => ({
        sitio: p.zone.label,
        period: { start: (p.previous as any).period_start, end: (p.previous as any).period_end },
        analysis: (p.previous as any).analysis,
        metricas: (p.previous as any).raw_metrics,
      }));

    // 3. Claude analysis.
    const analysis = await callClaude(
      ANTHROPIC_API_KEY,
      currentPayload,
      previousPayload.length > 0 ? { sitios: previousPayload } : null,
    );

    // 4. Build email & send.
    const html = buildEmailHtml(
      periodStart,
      periodEnd,
      perZone.filter((p) => p.summary).map((p) => ({ label: p.zone.label, summary: p.summary! })),
      analysis,
    );

    const emailRes = await fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SERVICE_KEY}`,
      },
      body: JSON.stringify({
        to: REPORT_EMAIL_TO,
        to_name: "Micaela",
        subject: `📊 Reporte semanal ${periodStart} → ${periodEnd}`,
        html,
      }),
    });
    const emailOk = emailRes.ok;
    const emailStatus = emailOk ? "ok" : `error: ${(await emailRes.text()).slice(0, 200)}`;

    // 5. Persist one row per zone (so memory works per-site next week).
    await Promise.all(
      perZone
        .filter((p) => p.summary)
        .map((p) =>
          saveReport(SUPABASE_URL, SERVICE_KEY, {
            period_start: periodStart,
            period_end: periodEnd,
            zone: p.zone.label,
            raw_metrics: p.summary,
            analysis: (analysis.sitios || []).find((s: any) => s.sitio === p.zone.label) || analysis,
            email_sent_to: REPORT_EMAIL_TO,
            email_status: emailStatus,
          }),
        ),
    );

    return new Response(
      JSON.stringify({
        ok: true,
        period: { start: periodStart, end: periodEnd },
        zones: perZone.map((p) => ({ zone: p.zone.label, ok: !!p.summary, error: p.error })),
        email: emailStatus,
      }),
      { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ ok: false, error: String(e).slice(0, 500) }),
      { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
    );
  }
});
