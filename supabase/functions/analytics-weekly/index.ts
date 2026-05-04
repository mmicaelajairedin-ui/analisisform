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

// ── Conversiones desde Supabase ───────────────────────────
// Solo aplica para Pathway (su backend vive en este Supabase).
// Para micaelajairedin.com NO hay datos en este Supabase: la web personal
// de Micaela tiene su propio backend. Skip silencioso para esa zona.

interface Conversions {
  // Top of funnel — leads/registros (NO son ventas)
  formularios_completados: number | null;  // candidatos.created_at — leads de mentoria
  coaches_registrados: number | null;      // usuarios rol=coach — incluye trials sin pagar y posibles tests
  leads_chatbot: number | null;            // contactos_chat — leads brutos del chat

  // Mid funnel — trial activado via Stripe (NO son ventas todavia)
  coaches_trial_activado: number | null;   // leads_pricing.trial_iniciado_at — empezo trial real

  // BOTTOM funnel — ventas reales con dinero entrante
  coaches_pagantes: number | null;         // leads_pricing.pago_at — coach que efectivamente pago
  pack_express_compras: number | null;     // cv_express — compra puntual one-shot
}

async function countRows(
  supabaseUrl: string,
  serviceKey: string,
  pathQuery: string,
): Promise<number | null> {
  // Usa Prefer:count=exact + Range:0-0 para obtener solo el total sin filas.
  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/${pathQuery}`, {
      method: "GET",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        Prefer: "count=exact",
        Range: "0-0",
      },
    });
    if (!res.ok) return null;
    const range = res.headers.get("Content-Range") || "";
    const total = range.split("/")[1];
    return total && total !== "*" ? parseInt(total, 10) : null;
  } catch (_e) {
    return null;
  }
}

// ── Calendly (Micaela) ────────────────────────────────────
// La web personal de Micaela captura leads con un boton "Agendar llamada"
// que abre Calendly. Cada evento agendado es una conversion. Llamamos a la
// API de Calendly cada lunes para contar eventos del periodo.
//
// Setup:
//   CALENDLY_API_TOKEN_MJ → Personal Access Token de Calendly de Micaela
//     (https://calendly.com/integrations/api_webhooks → Personal Access Tokens)
//   CALENDLY_USER_URI_MJ  → opcional. Si no se pasa, lo descubrimos via /users/me.

interface MicaelaConversions {
  llamadas_agendadas: number;
  llamadas_activas: number;
  llamadas_canceladas: number;
}

async function getCalendlyUserUri(apiToken: string): Promise<string | null> {
  try {
    const res = await fetch("https://api.calendly.com/users/me", {
      headers: { Authorization: `Bearer ${apiToken}` },
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.resource?.uri || null;
  } catch (_e) {
    return null;
  }
}

async function fetchMicaelaConversions(
  apiToken: string,
  configuredUri: string,
  start: string,
  end: string,
): Promise<MicaelaConversions | null> {
  if (!apiToken) return null;
  const uri = configuredUri || (await getCalendlyUserUri(apiToken));
  if (!uri) return null;
  const startTs = `${start}T00:00:00Z`;
  const endTs = `${end}T23:59:59Z`;
  let url: string | null = `https://api.calendly.com/scheduled_events?user=${encodeURIComponent(uri)}&min_start_time=${encodeURIComponent(startTs)}&max_start_time=${encodeURIComponent(endTs)}&count=100`;
  const events: Array<{ status?: string }> = [];
  // Paginar por si hay mas de 100 (improbable pero defensivo)
  let safety = 5;
  while (url && safety-- > 0) {
    try {
      const res = await fetch(url, { headers: { Authorization: `Bearer ${apiToken}` } });
      if (!res.ok) break;
      const json = await res.json();
      const collection = json?.collection || [];
      for (const e of collection) events.push(e);
      url = json?.pagination?.next_page || null;
    } catch (_e) {
      break;
    }
  }
  const active = events.filter((e) => e.status === "active").length;
  const canceled = events.filter((e) => e.status === "canceled").length;
  return {
    llamadas_agendadas: events.length,
    llamadas_activas: active,
    llamadas_canceladas: canceled,
  };
}

async function fetchPathwayConversions(
  supabaseUrl: string,
  serviceKey: string,
  start: string,
  end: string,
): Promise<Conversions> {
  const endTs = `${end}T23:59:59`;
  const dateFilter = (col: string) => `${col}=gte.${start}&${col}=lte.${endTs}`;
  const [forms, regs, packs, leads, trials, pagos] = await Promise.all([
    countRows(supabaseUrl, serviceKey, `candidatos?${dateFilter("created_at")}&select=id`),
    countRows(supabaseUrl, serviceKey, `usuarios?rol=eq.coach&${dateFilter("created_at")}&select=id`),
    countRows(supabaseUrl, serviceKey, `cv_express?${dateFilter("created_at")}&select=email`),
    countRows(supabaseUrl, serviceKey, `contactos_chat?${dateFilter("fecha")}&select=id`),
    countRows(supabaseUrl, serviceKey, `leads_pricing?${dateFilter("trial_iniciado_at")}&select=id`),
    countRows(supabaseUrl, serviceKey, `leads_pricing?${dateFilter("pago_at")}&select=id`),
  ]);
  return {
    formularios_completados: forms,
    coaches_registrados: regs,
    coaches_trial_activado: trials,
    coaches_pagantes: pagos,
    pack_express_compras: packs,
    leads_chatbot: leads,
  };
}

// ── Claude ────────────────────────────────────────────────

const SYSTEM_ANALYTICS = `Sos un analista de marketing digital senior. Analizas un sitio web por vez (NUNCA dos juntos), comparas con su histórico reciente, y das insights NO OBVIOS + acciones concretas + experimentos medibles.

REGLA CRITICA: solo analizas el sitio que se te pide. NO menciones, compares ni transfieras conclusiones de otros sitios. Si te llega contexto de "otro sitio", ignoralo.

REGLAS DE CALIDAD:
1. Usa el CONTEXTO del sitio (objetivo, audiencia, paginas clave, conversiones) para ESPECIFICIDAD. Si no hay contexto configurado, decilo y pedi que la coach lo configure.
2. Las hipotesis deben tener evidencia: cita el numero/dato concreto que la sostiene.
3. Las acciones deben ser EJECUTABLES con metrica de exito clara. Verbo + objeto + numero (ej: "Cambiar el CTA principal de 'Empezar' a 'Empezar prueba 14 dias gratis' y medir CTR del boton durante 7 dias").
4. Las predicciones de pruebas A/B deben ser CUANTITATIVAS ("CTR sube ~10%") asi la semana siguiente podemos verificarlas con datos.
5. Si no hay datos suficientes, decilo. NO inventes.
6. Considera el calendario al hipotetizar: festivos España/LatAm, dia de semana, eventos.
7. Diferencia QUICK WINS (lo que se hace en <30 min con impacto rapido) de ACCIONES ESTRATEGICAS (bets a 2+ semanas).
8. Buscar OPORTUNIDADES NO OBVIAS: cosas que los datos sugieren pero la coach probablemente no esta viendo (ej: "30% del trafico es de Mexico pero no hay contenido localizado", "los miercoles cae 50% — hay un hueco para llenar").
9. Si hay datos de conversion (formularios completados, registros, leads), enfocate en CONVERSION RATE no solo en visitas. Visitas son vanity metric — conversion paga las cuentas.

REGLAS DE PRIORIZACION (para que la coach pueda actuar, no se ahogue en lista larga):
- MAX 3 quick_wins. Solo los de MAS ALTO LEVERAGE.
- MAX 2 acciones_estrategicas.
- MAX 2 pruebas_ab_propuestas.
- MAX 3 hipotesis. MAX 3 oportunidades_no_obvias.
- Mejor menos y bien fundadas que muchas y debiles.

REGLA DE TRANSPARENCIA:
- Si en alguna hipotesis o accion estas asumiendo algo que NO esta verificado con datos, agregalo en \`asunciones\`. Ejemplo: "Asumo que el pico del domingo es trafico humano real (no bot/scraper) — verificar en Cloudflare Bot Fight Mode antes de invertir en replicarlo".

REGLA DE FEEDBACK LOOP:
- Si te llega un campo \`acciones_completadas_semana_pasada\`, debes verificar en \`verificacion_acciones_previas\` si los datos de esta semana muestran impacto. Si la coach NO marco nada, decilo amablemente: "no se marcaron acciones como completadas — para mejorar este reporte, marca cuales hiciste en el panel".

RESPONDÉ SOLO CON JSON VÁLIDO, sin markdown:
{
  "headline": "1 frase con la noticia mas importante de la semana para ESTE sitio",
  "resumen": "2-3 oraciones sobre el estado del trafico Y conversion (si hay datos de conversion)",
  "comparacion_semana_anterior": "cambio % o 'sin datos previos'",
  "tendencia_4_semanas": "trend (creciente/estable/caida) si hay datos historicos",
  "hipotesis": ["MAX 3 hipotesis, cada una con dato concreto"],
  "oportunidades_no_obvias": ["MAX 3 oportunidades con evidencia"],
  "asunciones": ["lista de cosas que estas asumiendo sin haber verificado, para que la coach valide antes de actuar"],
  "quick_wins": ["MAX 3 acciones <30 min con metrica esperada, ranqueadas por impacto"],
  "acciones_estrategicas": ["MAX 2 bets a 2+ semanas con metrica de exito"],
  "pruebas_ab_propuestas": [
    {"prueba": "Cambiar X por Y en pagina Z", "prediccion": "CTR sube ~10%", "duracion": "7 dias", "metrica": "% click en boton X"}
  ],
  "alertas": ["alertas criticas si aplican"],
  "que_replicar": "que funciono que vale la pena repetir, citando dato",
  "verificacion_hipotesis_previas": "si hay reporte previo: lista cada hipotesis previa y decir si los datos esta semana la confirman/refutan. Si no hay, string vacio.",
  "verificacion_pruebas_ab_previas": "si hay pruebas_ab_propuestas en reporte previo, decir si la prediccion se cumplio segun los datos. Si no hay, string vacio.",
  "verificacion_acciones_previas": "si la coach marco acciones como completadas (ver acciones_completadas_semana_pasada), evaluar el impacto en los datos de esta semana. Si no marco nada, mensaje amable.",
  "experimento_estrella": "el experimento mas alto-leverage para esta semana, con metrica medible y prediccion cuantitativa"
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
  conversions: Conversions | MicaelaConversions | null,
  completedActions: Array<Record<string, string>>,
): Promise<Record<string, unknown>> {
  const completedBlock = completedActions.length > 0
    ? `# Acciones que la coach marco como completadas la semana pasada\n${JSON.stringify(completedActions, null, 2)}\n\nVerifica en \`verificacion_acciones_previas\` si el impacto es visible en los datos de esta semana.\n\n`
    : `# Acciones completadas la semana pasada\nNinguna accion fue marcada como completada por la coach. Mencionarlo amablemente en \`verificacion_acciones_previas\`.\n\n`;

  // El bloque de conversiones cambia segun el sitio. Pathway tiene funnel
  // multi-etapa (registros → trials → pagos). Micaela tiene Calendly (llamadas
  // agendadas → activas → canceladas).
  const isPathwayConversions = conversions && "coaches_pagantes" in conversions;
  const isMicaelaConversions = conversions && "llamadas_agendadas" in conversions;

  let conversionsBlock = `# Conversiones\nNo hay datos de conversion disponibles para este sitio.\n\n`;
  if (isPathwayConversions) {
    conversionsBlock = `# Conversiones (datos REALES del backend, no Cloudflare)\n${JSON.stringify(conversions, null, 2)}\n\n## CRITICO — distincion entre ETAPAS DEL FUNNEL\n\nEl funnel de Pathway tiene varias etapas. NO las trates a todas como "ventas":\n\n- **TOP de funnel (LEADS, NO ventas):**\n  - \`formularios_completados\`: candidatos que llenaron el form de intake. Son leads para Micaela coach individual.\n  - \`coaches_registrados\`: cuentas creadas. Incluye gente en trial sin pagar Y posibles cuentas de prueba/test que crea la propia coach. NO ES VENTA.\n  - \`leads_chatbot\`: leads brutos del chat de la landing.\n\n- **MID de funnel (TRIAL ACTIVADO, NO venta todavia):**\n  - \`coaches_trial_activado\`: empezaron trial real via Stripe.\n\n- **BOTTOM de funnel (VENTAS REALES, dinero entrante):**\n  - \`coaches_pagantes\`: pagaron efectivamente. ESTO SI ES VENTA.\n  - \`pack_express_compras\`: compraron el Pack Express (one-shot). ESTO SI ES VENTA.\n\nCuando hables de "ventas", "conversion" o "revenue", referite SOLO a \`coaches_pagantes\` + \`pack_express_compras\`. Lo demas son leads o trials.\n\nSi \`coaches_registrados\` > 0 pero \`coaches_pagantes\` = 0, di explicitamente "X registros (sin ventas reales todavia)".\n\n`;
  } else if (isMicaelaConversions) {
    conversionsBlock = `# Conversiones (Calendly API — eventos agendados en el periodo)\n${JSON.stringify(conversions, null, 2)}\n\n## Lectura para Micaela\n\n- \`llamadas_agendadas\`: total de eventos creados (alguien hizo click en el link y agendó).\n- \`llamadas_activas\`: las que NO se cancelaron — son las que efectivamente van a ocurrir o ya ocurrieron.\n- \`llamadas_canceladas\`: agendadas pero canceladas despues. Vale la pena vigilarlas: si la tasa de cancelacion es alta puede indicar mensaje confuso, fricción en el formulario de Calendly, o leads de baja intencion.\n\nEl objetivo de Micaela es captar leads para mentoria 1-a-1, asi que cada llamada activa es un PROSPECT calificado. Cruza con el trafico de Cloudflare para calcular conversion rate (visitas → llamadas agendadas). Si la tasa es <1%, hay un problema de mensaje o CTA en su web. Si es >3%, esta funcionando — escalar trafico.\n\n`;
  }

  const userContent =
    `# Sitio a analizar\n${zone}\n\n` +
    `# Contexto del sitio (configurado por la coach)\n${context ? JSON.stringify(context, null, 2) : "Sin contexto configurado todavia. Pedile a la coach que llene el contexto en el panel para mejor analisis."}\n\n` +
    `# Datos de esta semana\n${JSON.stringify(current, null, 2)}\n\n` +
    conversionsBlock +
    completedBlock +
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
      // El prompt expandido pide muchos campos (oportunidades, quick_wins,
      // acciones_estrategicas, pruebas_ab estructuradas, verificaciones, etc).
      // 2400 truncaba la JSON. 6000 deja margen para reportes ricos sin
      // sobrar mucho.
      max_tokens: 6000,
      system: SYSTEM_ANALYTICS,
      messages: [{ role: "user", content: userContent }],
    }),
  });
  if (!res.ok) {
    throw new Error(`Claude ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  const json = await res.json();
  const text: string = json?.content?.[0]?.text || "";
  // Parsing defensivo: el modelo a veces envuelve con ```json ... ``` o
  // agrega texto antes/despues. Extraer la primera { hasta la ultima } valida.
  const cleaned = extractJson(text);
  try {
    return JSON.parse(cleaned);
  } catch (e) {
    // Si aun asi falla, devolvemos un payload minimo para no romper el flow
    // y guardamos el texto crudo en un campo para poder debugear.
    return {
      headline: "Error parseando respuesta de Claude — ver _raw para texto",
      resumen: "El modelo devolvio JSON invalido. Revisar _raw y subir max_tokens si esta truncado.",
      _parse_error: String(e).slice(0, 200),
      _raw: text.slice(0, 5000),
    };
  }
}

function extractJson(text: string): string {
  // Strip markdown code fences si los hay
  let s = text.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
  // Si el modelo agrego texto antes del JSON, encontrar la primera {
  const firstBrace = s.indexOf("{");
  if (firstBrace > 0) s = s.slice(firstBrace);
  // Encontrar el último } valido (por si agrego texto despues)
  const lastBrace = s.lastIndexOf("}");
  if (lastBrace > 0 && lastBrace < s.length - 1) s = s.slice(0, lastBrace + 1);
  return s.trim();
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
    summary: ReturnType<typeof summariseRows> & { conversions?: Conversions };
    analysis: any;
  }>,
): string {
  const cards = perZone
    .map((z) => {
      const headline = z.analysis?.headline || "—";
      const comp = z.analysis?.comparacion_semana_anterior || "";
      const conv = z.summary.conversions as any;
      let convLine = "";
      if (conv && "coaches_pagantes" in conv) {
        const ventas = (conv.coaches_pagantes ?? 0) + (conv.pack_express_compras ?? 0);
        convLine = `<div style="margin-top:6px;">
          <div style="font-size:13px;color:#1B4332;font-weight:700;">
            💰 Ventas reales: ${ventas} (${conv.coaches_pagantes ?? 0} suscripciones · ${conv.pack_express_compras ?? 0} packs)
          </div>
          <div style="font-size:11px;color:#666;margin-top:2px;">
            Funnel: ${conv.formularios_completados ?? 0} formularios · ${conv.coaches_registrados ?? 0} registros · ${conv.coaches_trial_activado ?? 0} trials · ${conv.leads_chatbot ?? 0} leads chat
          </div>
        </div>`;
      } else if (conv && "llamadas_agendadas" in conv) {
        convLine = `<div style="margin-top:6px;">
          <div style="font-size:13px;color:#1B4332;font-weight:700;">
            📞 Llamadas activas: ${conv.llamadas_activas ?? 0}
          </div>
          <div style="font-size:11px;color:#666;margin-top:2px;">
            Calendly: ${conv.llamadas_agendadas ?? 0} agendadas · ${conv.llamadas_canceladas ?? 0} canceladas
          </div>
        </div>`;
      }
      return `
        <div style="margin:14px 0;padding:16px;background:#fff;border-radius:10px;border-left:3px solid #E9C46A;">
          <div style="font-size:11px;color:#999;font-weight:700;letter-spacing:.06em;text-transform:uppercase;margin-bottom:6px;">${z.displayName}</div>
          <div style="font-size:14px;color:#1B4332;font-weight:600;line-height:1.4;margin-bottom:8px;">${headline}</div>
          <div style="font-size:12px;color:#666;">
            <strong>${fmtNum(z.summary.totalUniques)}</strong> visitas ·
            <strong>${z.summary.cachePct}%</strong> cache ·
            pico ${z.summary.peakDay.date} (${fmtNum(z.summary.peakDay.uniques)})
          </div>
          ${convLine}
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
  // Incluye actions_done para que el agente sepa que acciones marco la coach
  // como cumplidas en reportes anteriores y pueda verificar impacto.
  // Defensa: pedimos un poco mas de filas y deduplicamos por period_end.
  // Si el unique constraint todavia no se aplico (migration pendiente),
  // esto evita que el agente vea la misma semana repetida.
  const url = `${supabaseUrl}/rest/v1/analytics_reports?zone=eq.${encodeURIComponent(zone)}&select=raw_metrics,analysis,actions_done,period_start,period_end&order=period_end.desc&limit=${limit * 3}`;
  const res = await fetch(url, {
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
  });
  if (!res.ok) return [];
  const arr = await res.json();
  if (!Array.isArray(arr)) return [];
  // Dedup por period_end: si hay duplicados, nos quedamos con el primero
  // (que es el mas reciente por el order=period_end.desc).
  const seen = new Set<string>();
  const unique: Array<Record<string, unknown>> = [];
  for (const row of arr) {
    const key = String((row as any).period_end || "");
    if (!key || seen.has(key)) continue;
    seen.add(key);
    unique.push(row);
    if (unique.length >= limit) break;
  }
  return unique;
}

// Extrae las acciones que la coach marco como cumplidas en el reporte mas
// reciente. El resultado es legible para Claude (lista de strings con la
// accion completa de cada categoria marcada).
function extractCompletedActions(prevReport: Record<string, unknown> | undefined): Array<Record<string, string>> {
  if (!prevReport) return [];
  const analysis = (prevReport as any).analysis || {};
  const done = (prevReport as any).actions_done || {};
  const completed: Array<Record<string, string>> = [];
  const categorias: Array<{ key: string; label: string; isObj?: boolean }> = [
    { key: "quick_wins", label: "Quick win" },
    { key: "acciones_estrategicas", label: "Accion estrategica" },
    { key: "pruebas_ab_propuestas", label: "Prueba A/B", isObj: true },
  ];
  for (const cat of categorias) {
    const items = analysis[cat.key];
    const flags = done[cat.key];
    if (!Array.isArray(items) || !Array.isArray(flags)) continue;
    items.forEach((item: unknown, i: number) => {
      if (flags[i] === true) {
        const text = cat.isObj && typeof item === "object" && item
          ? (item as any).prueba || JSON.stringify(item)
          : typeof item === "string"
          ? item
          : JSON.stringify(item);
        completed.push({ categoria: cat.label, accion: text });
      }
    });
  }
  return completed;
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
  // UPSERT en (zone, period_end) — si ya existe un reporte para esa
  // semana/zona, lo actualiza en vez de duplicar. Evita que el agente
  // vea el mismo periodo repetido como "histórico" cuando se dispara
  // el workflow varias veces dentro de la misma semana.
  // Requiere migration analytics_reports_dedup.sql aplicada (UNIQUE constraint).
  const res = await fetch(`${supabaseUrl}/rest/v1/analytics_reports?on_conflict=zone,period_end`, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal",
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
        // Pathway: conversiones desde el backend en este Supabase.
        // Micaela: conversiones desde Calendly API (eventos agendados).
        const isPathway = z.label === "pathwaycareercoach.com";
        const isMicaela = z.label === "micaelajairedin.com";
        const calendlyToken = Deno.env.get("CALENDLY_API_TOKEN_MJ") || "";
        const calendlyUri = Deno.env.get("CALENDLY_USER_URI_MJ") || "";
        const [rows, history, context, conversions] = await Promise.all([
          fetchCloudflareDaily(zoneTag, CLOUDFLARE_API_TOKEN, periodStart, periodEnd),
          getRecentReports(SUPABASE_URL, SERVICE_KEY, z.label, HISTORY_WEEKS),
          getSiteContext(SUPABASE_URL, SERVICE_KEY, z.label),
          isPathway
            ? fetchPathwayConversions(SUPABASE_URL, SERVICE_KEY, periodStart, periodEnd)
            : isMicaela
              ? fetchMicaelaConversions(calendlyToken, calendlyUri, periodStart, periodEnd)
              : Promise.resolve(null as Conversions | null),
        ]);
        const summary = summariseRows(rows);
        // Mergear conversions en el summary que se guarda como raw_metrics.
        // El panel lo lee desde ahi para mostrar KPIs de conversion.
        const summaryWithConv = conversions
          ? { ...summary, conversions }
          : summary;
        const currentPayload = { period: { start: periodStart, end: periodEnd }, metricas: summary };
        const historyPayload = history.map((h) => ({
          period: { start: (h as any).period_start, end: (h as any).period_end },
          metricas: (h as any).raw_metrics,
          analysis_previo: (h as any).analysis,
        }));
        // Acciones marcadas como cumplidas en el reporte mas reciente.
        const completedActions = extractCompletedActions(history[0]);
        const analysis = await callClaudeForZone(
          ANTHROPIC_API_KEY,
          z.label,
          context,
          currentPayload,
          historyPayload,
          conversions,
          completedActions,
        );
        return { zone: z, summary: summaryWithConv, analysis, context, error: null as string | null };
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
