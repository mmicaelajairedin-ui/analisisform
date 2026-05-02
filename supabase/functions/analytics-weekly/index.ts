// Supabase Edge Function — analytics-weekly
//
// Genera un reporte semanal automático de tráfico web combinando datos de
// Cloudflare Analytics (vía GraphQL API) + análisis con Claude. Manda un
// email corto con link al panel (panel.html → seccion Web Analytics).
//
// IMPORTANTE: cada sitio se analiza POR SEPARADO. Pathway y micaelajairedin
// son negocios distintos — el agente no debe cruzar narrativas ni transferir
// conclusiones de uno al otro.
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
//   AGENT_TRIGGER_SECRET  — string compartido con GitHub Actions
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
const PANEL_URL = "https://pathwaycareercoach.com/panel.html#webanalytics";
const HISTORY_WEEKS = 4;  // semanas previas a leer para contexto/comparacion

interface ZoneConfig {
  key: string;
  envVar: string;
  label: string;
}

const ZONES: ZoneConfig[] = [
  { key: "mj", envVar: "CLOUDFLARE_ZONE_MJ", label: "micaelajairedin.com" },
  { key: "pw", envVar: "CLOUDFLARE_ZONE_PW", label: "pathwaycareercoach.com" },
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

const SYSTEM_ANALYTICS = `Sos un analista de marketing digital. Tu tarea: analizar las metricas de UN sitio web especifico (no de varios), comparar con su histórico reciente, y dar hipotesis y acciones concretas.

REGLA CRITICA: vas a recibir un solo sitio por vez. NO menciones, compares ni transfieras conclusiones de otros sitios. Cada sitio es un negocio independiente con su propia estrategia. Si te llega contexto de "otro sitio", ignoralo — solo analiza el que se te pide.

REGLAS:
1. Usa el CONTEXTO del sitio (objetivo, audiencia, paginas clave, conversiones) para que las hipotesis y acciones sean ESPECIFICAS, no genericas.
2. Si ves un pico o caida, hipotetizá causas concretas considerando el calendario (festivos en España y LatAm, dia de la semana, fin de campaña, etc.).
3. Las acciones deben ser ESPECIFICAS y ejecutables esta semana, no consejos abstractos. Idealmente con metrica de exito.
4. Si hay datos de semanas previas, usalos para detectar tendencias y verificar si las hipotesis previas se cumplieron.
5. Si no hay datos suficientes para sostener una afirmacion, decilo. No inventes.
6. Mencioná dia de la semana cuando sea relevante (los patrones B2B son distintos de los B2C).

RESPONDÉ SOLO CON JSON VÁLIDO, sin markdown ni explicaciones previas:
{
  "headline": "1 frase con la noticia mas importante de esta semana para ESTE sitio",
  "resumen": "2-3 oraciones sobre el estado del trafico esta semana",
  "comparacion_semana_anterior": "string con cambio % o 'sin datos previos'",
  "tendencia_4_semanas": "string describiendo trend si hay datos (creciente/estable/caida)",
  "hipotesis": ["hipotesis 1 con evidencia", "hipotesis 2"],
  "acciones_esta_semana": ["accion 1 con metrica de exito", "accion 2", "accion 3"],
  "alertas": ["alerta 1 si aplica"],
  "que_replicar": "que funciono que vale la pena repetir",
  "verificacion_hipotesis_previas": "si hay reporte de la semana pasada, verificar si las hipotesis se cumplieron. Si no hay, devolver string vacio.",
  "experimento_propuesto": "1 experimento puntual para esta semana con metrica de exito medible"
}`;

interface ContextRow {
  zone: string;
  display_name?: string;
  objetivo_principal?: string;
  audiencia?: string;
  paginas_clave?: unknown;
  conversiones?: unknown;
  notas?: string;
}

async function callClaudeForZone(
  apiKey: string,
  zone: string,
  context: ContextRow | null,
  current: Record<string, unknown>,
  history: Array<Record<string, unknown>>,
): Promise<Record<string, unknown>> {
  const userContent =
    `# Sitio a analizar\n${zone}\n\n` +
    `# Contexto del sitio (configurado por la coach)\n${context ? JSON.stringify(context, null, 2) : "Sin contexto configurado todavia. Pedile a la coach que llene el contexto en el panel para mejor analisis."}\n\n` +
    `# Datos de esta semana\n${JSON.stringify(current, null, 2)}\n\n` +
    `# Histórico de las ${HISTORY_WEEKS} semanas previas (mas reciente primero)\n` +
    (history.length > 0 ? JSON.stringify(history, null, 2) : "Sin datos previos guardados todavia.");

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
  const cleaned = text.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
  return JSON.parse(cleaned);
}

// ── Email HTML (corto, link al panel) ─────────────────────

function fmtNum(n: number): string {
  return n.toLocaleString("es-ES");
}

function buildShortEmailHtml(
  periodStart: string,
  periodEnd: string,
  perZone: Array<{
    label: string;
    displayName: string;
    summary: ReturnType<typeof summariseRows>;
    analysis: any;
  }>,
): string {
  const cards = perZone
    .map((z) => {
      const headline = z.analysis?.headline || "—";
      const comp = z.analysis?.comparacion_semana_anterior || "";
      return `
        <div style="margin:14px 0;padding:16px;background:#fff;border-radius:10px;border-left:3px solid #E9C46A;">
          <div style="font-size:11px;color:#999;font-weight:700;letter-spacing:.06em;text-transform:uppercase;margin-bottom:6px;">${z.displayName}</div>
          <div style="font-size:14px;color:#1B4332;font-weight:600;line-height:1.4;margin-bottom:8px;">${headline}</div>
          <div style="font-size:12px;color:#666;">
            <strong>${fmtNum(z.summary.totalUniques)}</strong> visitas ·
            <strong>${z.summary.cachePct}%</strong> cache ·
            pico ${z.summary.peakDay.date} (${fmtNum(z.summary.peakDay.uniques)})
          </div>
          ${comp ? `<div style="font-size:12px;color:#666;margin-top:4px;">vs semana anterior: ${comp}</div>` : ""}
        </div>`;
    })
    .join("");

  return `
    <h2 style="margin:0 0 4px;color:#1B4332;font-size:20px;">Reporte semanal · ${periodStart} → ${periodEnd}</h2>
    <p style="margin:0 0 16px;font-size:13px;color:#666;">Resumen breve. El analisis completo, graficos, hipotesis, acciones y experimentos estan en el panel.</p>
    ${cards}
    <div style="text-align:center;margin:24px 0;">
      <a href="${PANEL_URL}" style="display:inline-block;padding:12px 28px;background:#1B4332;color:#fff;text-decoration:none;border-radius:10px;font-size:14px;font-weight:700;">
        Ver detalle en el panel →
      </a>
    </div>
    <p style="margin:18px 0 0;font-size:11px;color:#999;text-align:center;">Generado automaticamente. Histórico en panel → Web Analytics.</p>
  `;
}

// ── Supabase storage ──────────────────────────────────────

async function getRecentReports(
  supabaseUrl: string,
  serviceKey: string,
  zone: string,
  limit: number,
): Promise<Array<Record<string, unknown>>> {
  const url = `${supabaseUrl}/rest/v1/analytics_reports?zone=eq.${encodeURIComponent(zone)}&select=raw_metrics,analysis,period_start,period_end&order=period_end.desc&limit=${limit}`;
  const res = await fetch(url, {
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
  });
  if (!res.ok) return [];
  const arr = await res.json();
  return Array.isArray(arr) ? arr : [];
}

async function getSiteContext(
  supabaseUrl: string,
  serviceKey: string,
  zone: string,
): Promise<ContextRow | null> {
  const url = `${supabaseUrl}/rest/v1/site_context?zone=eq.${encodeURIComponent(zone)}&select=*&limit=1`;
  const res = await fetch(url, {
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
  });
  if (!res.ok) return null;
  const arr = await res.json();
  return Array.isArray(arr) && arr.length > 0 ? (arr[0] as ContextRow) : null;
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

  const now = new Date();
  const end = new Date(now); end.setUTCDate(end.getUTCDate() - 1);
  const start = new Date(end); start.setUTCDate(start.getUTCDate() - 6);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const periodStart = fmt(start);
  const periodEnd = fmt(end);

  try {
    // 1. Por cada zona: pull data + history + context, llamar a Claude separado.
    const perZoneTasks = ZONES.map(async (z) => {
      const zoneTag = Deno.env.get(z.envVar) || "";
      if (!zoneTag) {
        return { zone: z, summary: null, analysis: null, context: null, error: `missing ${z.envVar}` };
      }
      try {
        const [rows, history, context] = await Promise.all([
          fetchCloudflareDaily(zoneTag, CLOUDFLARE_API_TOKEN, periodStart, periodEnd),
          getRecentReports(SUPABASE_URL, SERVICE_KEY, z.label, HISTORY_WEEKS),
          getSiteContext(SUPABASE_URL, SERVICE_KEY, z.label),
        ]);
        const summary = summariseRows(rows);
        const currentPayload = { period: { start: periodStart, end: periodEnd }, metricas: summary };
        const historyPayload = history.map((h) => ({
          period: { start: (h as any).period_start, end: (h as any).period_end },
          metricas: (h as any).raw_metrics,
          analysis_previo: (h as any).analysis,
        }));
        const analysis = await callClaudeForZone(
          ANTHROPIC_API_KEY,
          z.label,
          context,
          currentPayload,
          historyPayload,
        );
        return { zone: z, summary, analysis, context, error: null as string | null };
      } catch (e) {
        return { zone: z, summary: null, analysis: null, context: null, error: String(e).slice(0, 300) };
      }
    });
    const perZone = await Promise.all(perZoneTasks);

    const successful = perZone.filter((p) => p.summary && p.analysis);
    if (successful.length === 0) {
      return new Response(
        JSON.stringify({ ok: false, error: perZone.map((p) => p.error).filter(Boolean).join("; ") }),
        { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
      );
    }

    // 2. Email corto con link al panel.
    const html = buildShortEmailHtml(
      periodStart,
      periodEnd,
      successful.map((p) => ({
        label: p.zone.label,
        displayName: (p.context as ContextRow | null)?.display_name || p.zone.label,
        summary: p.summary!,
        analysis: p.analysis,
      })),
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
    const emailStatus = emailRes.ok ? "ok" : `error: ${(await emailRes.text()).slice(0, 200)}`;

    // 3. Guardar 1 fila por zona (memoria).
    await Promise.all(
      successful.map((p) =>
        saveReport(SUPABASE_URL, SERVICE_KEY, {
          period_start: periodStart,
          period_end: periodEnd,
          zone: p.zone.label,
          raw_metrics: p.summary,
          analysis: p.analysis,
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
