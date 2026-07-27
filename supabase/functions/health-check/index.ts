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

// Cuentas que NO son clientes reales: ejemplos, bots de testing y las cuentas
// internas del equipo (la coach, el socio, correos de la marca). Se excluyen de
// TODAS las listas para que el reporte muestre SOLO gente real que requiere
// acción. Antes se colaban bots, cuentas de test y el propio equipo, y el email
// quedaba ilegible ("son como parches de emails en uno").
const TEAM = new Set([
  "hi@pathwaycareercoach.com",
  "notificaciones@pathwaycareercoach.com",
  "micaela@pathwaycareercoach.com",
  "mmicaela.jairedin@gmail.com",
  "gonzaloalcalde97@gmail.com",
  "demo.coach@pathway.com",
]);
function isNoise(em: string): boolean {
  em = (em || "").toLowerCase().trim();
  if (!em || em === "anon") return true;
  if (TEAM.has(em)) return true;
  if (em.indexOf("ejemplo") >= 0 || em.indexOf("maria.ejemplo") === 0 || em.indexOf("maria.demo") === 0) return true;
  if (em.indexOf("bot.") === 0 || em.indexOf("bot-cli") >= 0 || em.indexOf("bottest") >= 0) return true;
  return false;
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
    q("usuarios?rol=in.(coach,admin)&select=id,nombre,email,rol,auth_id,last_seen,configuracion"),
    q("candidatos?select=*"),
    q(`client_errors?select=ts,kind,email,page,detail&ts=gte.${since}&order=ts.desc&limit=400`),
    q("informes?select=email"),
  ]);

  const realCoaches = coaches.filter((c) => !isNoise(c.email));
  const realCands = cands.filter((c) => !isNoise(c.email));
  const realErrs = errs.filter((e) => !isNoise(e.email));
  const hasReport = new Set(informes.map((r) => (r.email || "").toLowerCase()));
  const now = Date.now();
  const ageDays = (iso: string) => { const t = iso ? +new Date(iso) : 0; return t ? (now - t) / 86400000 : Infinity; };
  const hasIntake = (c: any) => !!(c.cargo || c.objetivo || c.situacion || c.peso || c.ingresos || c.nivel || c.experiencia || c.habilidades || c.altura || c.edad);

  type Issue = { sev: "alta" | "media"; t: string; d: string; items: string[] };
  const issues: Issue[] = [];

  // 1) Coaches sin ligar (auth_id null) que SÍ entraron hace poco → el linkeo
  //    falló de verdad. A los que NO entraron recién no los mostramos: la sesión
  //    se liga sola cuando vuelven a entrar, y no tiene sentido avisar de algo
  //    que no se puede forzar y que se arregla solo.
  const ultimoLogin = (c: any) => (c.configuracion && c.configuracion.last_login) || c.last_seen || null;
  const noAuth = realCoaches.filter((c) => c.rol === "coach" && !c.auth_id && ultimoLogin(c) && ageDays(ultimoLogin(c)) <= 7);
  if (noAuth.length) {
    issues.push({
      sev: "alta",
      t: "Coaches que entraron pero no ligaron la sesión",
      d: "Entraron en los últimos 7 días y aún no tienen auth_id: el linkeo (migrate-user-to-auth / pw_link_auth_id) puede estar fallando para ellos. Los que no entraron hace poco no se listan: ligan solos al volver a entrar.",
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
  // 5) Guardados que la base RECHAZÓ (últimas 24 h). Solo rechazos reales
  //    (HTTP 4xx/5xx) a tablas reales — NO los cortes de red ("Load failed" /
  //    "Failed to fetch"), que son blips del navegador y no algo que la coach
  //    pueda accionar. Solo cuentas reales (ya sin bots ni equipo).
  const WRITE = /(POST|PATCH|PUT)\s+\/rest\/v1\/(candidatos|informes|usuarios|cv_publicados)\b/i;
  const failErrs = realErrs.filter((e) => /^http_(4|5)\d\d$/.test(e.kind || "") && WRITE.test(e.detail || ""));
  if (failErrs.length) {
    issues.push({
      sev: "alta",
      t: "Guardados que la base rechazó",
      d: "La base rechazó guardar datos de un cliente real (no un corte de red). Puede ser una cuenta rota o una validación — vale mirarlo.",
      items: failErrs.slice(0, 12).map((e) => {
        const when = (e.ts || "").replace("T", " ").slice(0, 16);
        return `${e.email || "—"} · ${when} · ${(e.detail || "").slice(0, 70)}`;
      }),
    });
  }

  // 6) Páginas que crashearon (errores de JS) — últimas 24 h, DEDUPLICADAS.
  //    Antes salían 15 líneas del MISMO error de login → ilegible. Ahora se
  //    agrupan por página + error y se muestra cuántas veces pasó: 1 línea = 1 bug.
  const normErr = (d: string) => (d || "").replace(/@v[0-9a-f]+.*$/i, "").replace(/\s+/g, " ").trim().slice(0, 80);
  const jsRaw = realErrs.filter((e) => e.kind === "jserror" && !/_AutofillCallbackHandler|ResizeObserver loop/.test(e.detail || ""));
  const jsGroups: Record<string, { page: string; msg: string; n: number }> = {};
  for (const e of jsRaw) {
    const page = (e.page || "").split("#")[0];
    const msg = normErr(e.detail || "");
    const key = page + " :: " + msg;
    if (!jsGroups[key]) jsGroups[key] = { page, msg, n: 0 };
    jsGroups[key].n++;
  }
  const jsList = Object.values(jsGroups).sort((a, b) => b.n - a.n);
  if (jsList.length) {
    issues.push({
      sev: "alta",
      t: "Páginas que crashearon",
      d: "Se rompió algo en pantalla para usuarios reales. Cada línea es UN bug (con cuántas veces pasó).",
      items: jsList.slice(0, 10).map((g) => `${g.page} · ${g.msg}${g.n > 1 ? ` (${g.n}×)` : ""}`),
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

  // ── Armar el bloque HTML: DOS bloques claros ──────────────────────────────
  //    🔴 Para arreglar (bugs)  ·  📋 Acciones con clientes.
  //    Antes era una lista larga y plana que mezclaba bugs con tareas y era
  //    imposible de leer. Ahora arriba lo que se rompe, abajo lo que hacer.
  const BUG_TITLES = new Set([
    "Coaches que entraron pero no ligaron la sesión",
    "Guardados que la base rechazó",
    "Páginas que crashearon",
    "Funciones del servidor que fallaron",
  ]);
  const bugs = issues.filter((i) => BUG_TITLES.has(i.t));
  const acciones = issues.filter((i) => !BUG_TITLES.has(i.t));
  const nBug = bugs.reduce((n, i) => n + i.items.length, 0);
  const nAcc = acciones.reduce((n, i) => n + i.items.length, 0);
  const total = nBug + nAcc;
  const hasAlta = issues.some((i) => i.sev === "alta");

  const card = (i: Issue): string => {
    const color = i.sev === "alta" ? "#C0756E" : "#8E7A35";
    const lis = i.items.map((x) => `<li style="padding:3px 0;font-size:13px;color:#2D2929;">${esc(x)}</li>`).join("");
    return (
      `<div style="border:1px solid #EDEAE8;border-radius:10px;padding:12px 15px;margin:9px 0;">` +
      `<div style="font-weight:600;color:${color};font-size:14.5px;margin-bottom:3px;">${esc(i.t)} (${i.items.length})</div>` +
      `<div style="font-size:12.5px;color:#5A5A55;margin-bottom:7px;line-height:1.45;">${esc(i.d)}</div>` +
      `<ul style="margin:0;padding-left:18px;">${lis}</ul></div>`
    );
  };
  const section = (title: string, list: Issue[]): string =>
    list.length ? `<h3 style="font-family:Georgia,serif;color:#1B2E26;font-size:15.5px;margin:16px 0 2px;">${title}</h3>` + list.map(card).join("") : "";

  const html =
    `<div style="font-family:Inter,-apple-system,sans-serif;margin:0 0 8px;color:#2D2929;">` +
    `<h2 style="font-family:Georgia,serif;color:#1B2E26;font-size:18px;margin:0 0 4px;">🩺 Revisión diaria</h2>` +
    `<p style="font-size:13px;color:#5A5A55;margin:0 0 4px;line-height:1.5;">` +
      (nBug ? `<strong style="color:#C0756E;">${nBug} para arreglar</strong>` : `<strong style="color:#2D6A4F;">0 bugs</strong>`) +
      ` · <strong>${nAcc}</strong> acción${nAcc === 1 ? "" : "es"} con clientes. Solo lo que necesita tu atención (sin bots ni cuentas del equipo).</p>` +
    section("🔴 Para arreglar", bugs) +
    section("📋 Acciones con clientes", acciones) +
    `</div>`;

  // Devuelve el bloque para que el Testing Agent lo incruste en su email diario.
  return json({ ok: true, count: total, hasAlta, html });
});
