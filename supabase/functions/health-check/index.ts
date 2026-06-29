// Supabase Edge Function — health-check
//
// Revisión DIARIA del estado de los usuarios/datos. Corre del lado servidor
// (service role → ve TODO, sin límites de RLS) y manda un email a la coach
// SOLO si encuentra problemas. Los días que está todo OK, no manda nada.
//
// Qué detecta (no arregla nada — solo avisa):
//   • Coaches con la sesión sin ligar (auth_id null) → no ven/agregan clientes.
//   • Clientes sin coach (huérfanos).
//   • Clientes sin nicho (entran al portal equivocado).
//   • Emails de cliente duplicados.
//   • Guardados que fallaron en las últimas 24 h (de client_errors).
//
// Lo dispara GitHub Actions (daily-health.yml) con:
//   POST /functions/v1/health-check   -H "X-Trigger-Secret: <AGENT_TRIGGER_SECRET>"
//
// Desplegar:
//   supabase functions deploy health-check --no-verify-jwt
//
// Env (Supabase → Edge Functions → Secrets):
//   SUPABASE_URL                — auto
//   SUPABASE_SERVICE_ROLE_KEY   — auto
//   AGENT_TRIGGER_SECRET        — mismo valor que el secret de GitHub Actions
//   REPORT_EMAIL_TO             — email(s) destino (coma para varios)

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, authorization, apikey, x-client-info, x-trigger-secret",
};

const DEMO_COACH = "demo.coach@pathway.com";
function isDemoEmail(em: string): boolean {
  em = (em || "").toLowerCase();
  return em.indexOf("ejemplo@pathwaycareercoach.com") >= 0 || em.indexOf("maria.ejemplo") === 0;
}
function esc(s: string): string {
  return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "content-type": "application/json; charset=utf-8" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  const SB_URL = Deno.env.get("SUPABASE_URL") || "";
  const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const TRIGGER = Deno.env.get("AGENT_TRIGGER_SECRET") || "";
  const TO = Deno.env.get("REPORT_EMAIL_TO") || "";
  if (!SB_URL || !SERVICE) return json({ error: "env_missing" }, 500);

  // Seguridad: solo se dispara con el secret compartido (igual que el agente).
  if (!TRIGGER || req.headers.get("x-trigger-secret") !== TRIGGER) {
    return json({ error: "unauthorized" }, 401);
  }

  const h = { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` };
  async function q(path: string): Promise<any[]> {
    try {
      const r = await fetch(`${SB_URL}/rest/v1/${path}`, { headers: h });
      if (!r.ok) return [];
      return await r.json();
    } catch {
      return [];
    }
  }

  // ── Traer datos (service role → sin RLS) ──────────────────────────────────
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const [coaches, cands, errs, informes] = await Promise.all([
    q("usuarios?rol=in.(coach,admin)&select=id,nombre,email,rol,auth_id"),
    q("candidatos?select=*"),
    q(`client_errors?select=ts,kind,email,page,detail&ts=gte.${since}&order=ts.desc&limit=400`),
    q("informes?select=email"),
  ]);

  const realCoaches = coaches.filter((c) => (c.email || "").toLowerCase() !== DEMO_COACH);
  const realCands = cands.filter((c) => !isDemoEmail(c.email));
  const realErrs = errs.filter((e) => (e.email || "").toLowerCase() !== DEMO_COACH);
  const hasReport = new Set(informes.map((r) => (r.email || "").toLowerCase()));
  const now = Date.now();
  const ageDays = (iso: string) => { const t = iso ? +new Date(iso) : 0; return t ? (now - t) / 86400000 : Infinity; };
  const hasIntake = (c: any) => !!(c.cargo || c.objetivo || c.situacion || c.peso || c.ingresos || c.nivel || c.experiencia || c.habilidades || c.altura || c.edad);

  type Issue = { sev: "alta" | "media"; t: string; d: string; items: string[] };
  const issues: Issue[] = [];

  // 1) Coaches con sesión sin ligar (auth_id null)
  const noAuth = realCoaches.filter((c) => c.rol === "coach" && !c.auth_id);
  if (noAuth.length) {
    issues.push({
      sev: "alta",
      t: "Coaches con la sesión sin ligar",
      d: "No tienen auth_id: cuando entran pueden NO ver ni agregar clientes. Que cierren sesión y vuelvan a entrar.",
      items: noAuth.map((c) => `${c.nombre || "—"} · ${c.email || ""}`),
    });
  }
  // 2) Clientes sin coach (huérfanos)
  const orphan = realCands.filter((c) => !c.coach_id);
  if (orphan.length) {
    issues.push({
      sev: "alta",
      t: "Clientes sin coach (huérfanos)",
      d: "No están atados a ningún coach. Hay que reasignarlos o reingresarlos con el coach correcto.",
      items: orphan.map((c) => `${c.nombre || "—"} · ${c.email || ""}`),
    });
  }
  // 3) Clientes sin nicho
  const noNicho = realCands.filter((c) => c.coach_id && !c.nicho);
  if (noNicho.length) {
    issues.push({
      sev: "media",
      t: "Clientes sin nicho",
      d: "Sin nicho pueden entrar al portal equivocado. Conviene asignarles carrera / fitness / finanzas.",
      items: noNicho.map((c) => `${c.nombre || "—"} · ${c.email || ""}`),
    });
  }
  // 4) Emails de cliente duplicados
  const seen: Record<string, number> = {};
  realCands.forEach((c) => {
    const em = (c.email || "").toLowerCase();
    if (em) seen[em] = (seen[em] || 0) + 1;
  });
  const dups = Object.keys(seen).filter((em) => seen[em] > 1);
  if (dups.length) {
    issues.push({
      sev: "media",
      t: "Emails de cliente duplicados",
      d: "El mismo email aparece en más de un cliente. Puede confundir el acceso.",
      items: dups.map((em) => `${em} (×${seen[em]})`),
    });
  }
  // 5) Guardados que fallaron en las últimas 24 h
  //    Solo escrituras a tablas reales (no logins fallidos ni ruido de push).
  const WRITE = /(POST|PATCH|PUT)\s+\/rest\/v1\/(candidatos|informes|usuarios|cv_publicados)\b/i;
  const NETFAIL = /(Failed to fetch|Load failed)/i;
  const failErrs = errs.filter((e) => {
    const em = (e.email || "").toLowerCase();
    if (em === DEMO_COACH || em === "anon") return false;
    const det = e.detail || "";
    const kind = e.kind || "";
    const isHttpFail = /^http_(4|5)\d\d$/.test(kind) && WRITE.test(det);
    const isNetFail = kind === "neterror" && (WRITE.test(det) || NETFAIL.test(det));
    return isHttpFail || isNetFail;
  });
  if (failErrs.length) {
    issues.push({
      sev: "alta",
      t: "Guardados que fallaron (últimas 24 h)",
      d: "Hubo intentos de guardar que la base rechazó o se cortaron. Puede ser una cuenta rota o un corte de red.",
      items: failErrs.slice(0, 20).map((e) => {
        const when = (e.ts || "").replace("T", " ").slice(0, 16);
        return `${e.email || "—"} · ${e.page || ""} · ${when} · ${(e.detail || "").slice(0, 80)}`;
      }),
    });
  }

  // 6) Páginas que crashearon (errores de JS) — últimas 24 h
  const jsErrs = realErrs.filter((e) => e.kind === "jserror" && !/_AutofillCallbackHandler|ResizeObserver loop/.test(e.detail || ""));
  if (jsErrs.length) {
    issues.push({
      sev: "alta",
      t: "Páginas que crashearon (errores de JS)",
      d: "Se rompió algo en pantalla para un usuario. Cada uno es un bug para mirar.",
      items: jsErrs.slice(0, 15).map((e) => `${e.page || ""} · ${(e.detail || "").slice(0, 90)}`),
    });
  }
  // 7) Funciones del servidor que fallaron (IA, emails…) — últimas 24 h
  const fnErrs = realErrs.filter((e) => /^http_5\d\d$/.test(e.kind || "") && /functions\/v1\//.test(e.detail || ""));
  if (fnErrs.length) {
    issues.push({
      sev: "alta",
      t: "Funciones del servidor que fallaron",
      d: "Una función devolvió error (ej: el informe IA que no se genera).",
      items: fnErrs.slice(0, 15).map((e) => `${e.email || "—"} · ${(e.detail || "").slice(0, 90)}`),
    });
  }
  // 8) Clientes con intake completo pero SIN informe IA (+3 días)
  const noReport = realCands.filter((c) => c.activo !== false && c.coach_id && hasIntake(c) && ageDays(c.created_at) > 3 && !hasReport.has((c.email || "").toLowerCase()));
  if (noReport.length) {
    issues.push({
      sev: "alta",
      t: "Clientes sin informe IA generado",
      d: "Completaron su perfil pero no tienen informe. Es el producto que esperan — conviene generarlo.",
      items: noReport.slice(0, 20).map((c) => `${c.nombre || "—"} · ${c.email || ""}`),
    });
  }
  // 9) Intake sin completar hace +3 días (con acceso)
  const intakePend = realCands.filter((c) => c.activo !== false && c.coach_id && !hasIntake(c) && ageDays(c.created_at) > 3);
  if (intakePend.length) {
    issues.push({
      sev: "media",
      t: "Intake sin completar (+3 días)",
      d: "Tienen acceso pero no llenaron su perfil. Sin eso no se les puede armar el plan — conviene recordarles.",
      items: intakePend.slice(0, 20).map((c) => `${c.nombre || "—"} · ${c.email || ""}`),
    });
  }
  // 10) Clientes inactivos hace +14 días (riesgo de abandono)
  const inactivos = realCands.filter((c) => c.activo !== false && c.coach_id && hasIntake(c) && c.cliente_last_seen && ageDays(c.cliente_last_seen) > 14);
  if (inactivos.length) {
    issues.push({
      sev: "media",
      t: "Clientes inactivos (+14 días sin entrar)",
      d: "No entran hace rato — riesgo de que abandonen. Un mensaje puede reengancharlos.",
      items: inactivos.slice(0, 20).map((c) => `${c.nombre || "—"} · ${c.email || ""}`),
    });
  }
  // 11) Pasaron el mes y siguen con acceso activo
  const pasMes = realCands.filter((c) => c.activo !== false && c.coach_id && ageDays(c.created_at) > 35);
  if (pasMes.length) {
    issues.push({
      sev: "media",
      t: "Clientes con +35 días y acceso activo",
      d: "Pasaron bastante del mes y siguen con acceso. Revisá si renovaron o conviene cerrarles el acceso.",
      items: pasMes.slice(0, 20).map((c) => `${c.nombre || "—"} · ${c.email || ""}`),
    });
  }

  // ── Si no hay nada, devolvemos vacío (el reporte de testing dirá "todo ok") ──
  if (!issues.length) {
    return json({ ok: true, count: 0, hasAlta: false, html: "" });
  }

  // ── Armar el bloque HTML (lo incrusta el email del Testing Agent) ──────────
  const total = issues.reduce((n, i) => n + i.items.length, 0);
  const hasAlta = issues.some((i) => i.sev === "alta");
  const cards = issues
    .map((i) => {
      const color = i.sev === "alta" ? "#C0756E" : "#8E7A35";
      const dot = i.sev === "alta" ? "🔴" : "🟡";
      const lis = i.items
        .map((x) => `<li style="padding:4px 0;font-size:13px;color:#2D2929;">${esc(x)}</li>`)
        .join("");
      return (
        `<div style="border:1px solid #EDEAE8;border-radius:10px;padding:14px 16px;margin:12px 0;">` +
        `<div style="font-weight:600;color:${color};font-size:15px;margin-bottom:4px;">${dot} ${esc(i.t)} (${i.items.length})</div>` +
        `<div style="font-size:13px;color:#5A5A55;margin-bottom:8px;line-height:1.5;">${esc(i.d)}</div>` +
        `<ul style="margin:0;padding-left:18px;">${lis}</ul></div>`
      );
    })
    .join("");
  const html =
    `<div style="font-family:Inter,-apple-system,sans-serif;margin:0 0 8px;color:#2D2929;">` +
    `<h2 style="font-family:Georgia,serif;color:#1B2E26;font-size:18px;margin:0 0 6px;">🩺 Salud de usuarios · ${total} cosa${total === 1 ? "" : "s"} para revisar</h2>` +
    `<p style="font-size:13px;color:#5A5A55;margin:0 0 8px;">Revisión automática de tus usuarios y datos. Solo avisa — no cambia nada. Si querés arreglar algo, avisá y lo vemos.</p>` +
    cards +
    `</div>`;

  // Devuelve el bloque para que el Testing Agent lo incruste en su email diario.
  return json({ ok: true, count: total, hasAlta, html });
});
