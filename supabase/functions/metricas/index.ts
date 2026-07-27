// ===================================================================
// metricas — Pathway OS · Nivel 1 (Dashboard CEO). READ-ONLY.
//
// Única fuente backend del Dashboard CEO. El front NO calcula nada: solo pinta
// lo que devuelve esta función. Modo HÍBRIDO transitorio: hoy combina `eventos`
// (donde ya se emiten) con tablas base (`usuarios`, `candidatos`) para funcionar
// con datos reales desde el día 1. Cada KPI declara su fuente + estado de
// migración (🔴/🟡/🟢). Spec: docs/metricas-spec.md.
//
// Responde las 5 preguntas de negocio prioritarias:
//   ¿cuántos empiezan trial? · ¿cuántos llegan al WOW? · ¿cuántos pagan? ·
//   ¿dónde abandonan (mayor fuga)? · ¿quién está en riesgo?
//
// Métricas temporales (TTV, TtFP, Activation Velocity): contrato reservado
// (campos null), NO calculadas todavía (decisión pragmática).
//
// SEGURIDAD: gate de admin por JWT (mismo patrón que admin-coach-op). Nadie lee
// con la anon key; la lectura vive solo acá, con service role.
//
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY
// Deploy: supabase functions deploy metricas --no-verify-jwt
// ===================================================================

const SB_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const ANON = Deno.env.get("SUPABASE_ANON_KEY") || "";
const svc = { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` };

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const isUuid = (s: string) => /^[0-9a-f-]{32,36}$/i.test(s);

// ── CONFIG viva (nada hardcodeado en el front). Health Score por DIMENSIONES. ──
const ACTIVADO_REQUIERE = ["ProfileCompleted", "ClientInvited", "ClientAccepted"];
const HEALTH = {
  dimensiones: {
    activacion: { peso: 40, senales: { perfil: 40, invito: 30, cliente_entro: 30 } },
    uso:        { peso: 30, senales: { por_evento_14d: 20, tope: 100 } },
    clientes:   { peso: 20, senales: { por_cliente: 25, tope: 100 } },
    recencia:   { peso: 10, senales: { dias7: 100, dias14: 50, mas: 0 } },
  },
};
// Precios para el MRR (configurable). USD desde jun-2026.
const PRECIOS = { basic: 29, pro: 59, moneda: "USD" };

// ── Auth admin (idéntico a admin-coach-op) ──
async function callerIdentity(token: string): Promise<{ email: string | null; uid: string | null }> {
  if (!token || token === ANON) return { email: null, uid: null };
  try {
    const r = await fetch(`${SB_URL}/auth/v1/user`, { headers: { apikey: ANON, Authorization: `Bearer ${token}` } });
    if (!r.ok) return { email: null, uid: null };
    const u = await r.json();
    const em = (u && u.email ? String(u.email) : "").trim().toLowerCase();
    const uid = (u && u.id ? String(u.id) : "").trim();
    return { email: EMAIL_RE.test(em) ? em : null, uid: isUuid(uid) ? uid : null };
  } catch { return { email: null, uid: null }; }
}
async function isAdmin(email: string | null, uid: string | null): Promise<boolean> {
  const ors: string[] = [];
  if (email) ors.push(`email.ilike.${email}`);
  if (uid) ors.push(`auth_id.eq.${uid}`);
  if (!ors.length) return false;
  try {
    const r = await fetch(
      `${SB_URL}/rest/v1/usuarios?or=(${encodeURIComponent(ors.join(","))})&rol=eq.admin&select=id&limit=1`,
      { headers: svc },
    );
    if (!r.ok) return false;
    const rows = await r.json();
    return Array.isArray(rows) && rows.length > 0;
  } catch { return false; }
}

async function sbGet(path: string): Promise<unknown[]> {
  try {
    const r = await fetch(`${SB_URL}/rest/v1/${path}`, { headers: svc });
    if (!r.ok) return [];
    const j = await r.json();
    return Array.isArray(j) ? j : [];
  } catch { return []; }
}

interface Evento { tipo: string; dominio: string | null; actor_email: string | null; actor_rol: string | null; entidad_id: string | null; ts: string; }
interface Usuario { id: string; email: string; nombre: string | null; created_at: string; configuracion: Record<string, unknown> | null; activo: boolean | null; }
interface Candidato { coach_id: string | null; email: string | null; consent_at: string | null; }

// KPI con metadata de fuente (anti-híbrido-permanente).
function kpi(valor: number | string | null, unidad: string, fuente: string, migrar: string, estado: string, label = "") {
  return { valor, unidad, label, fuente, objetivo: "eventos", migrar_cuando: migrar, estado };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  if (!SB_URL || !SERVICE) return json({ error: "env" }, 500);

  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  const who = await callerIdentity(token);
  if (!(await isAdmin(who.email, who.uid))) return json({ error: "forbidden" }, 403);

  const body = await req.json().catch(() => ({}));
  const dias = Math.max(1, Math.min(365, parseInt(String((body as { dias?: number }).dias ?? 30), 10) || 30));
  const now = Date.now();
  const winMs = dias * 86400_000;

  // ── Lecturas (service role) ──
  const cutoff = new Date(now - 365 * 86400_000).toISOString();
  const [eventos, usuariosRaw, candidatos] = await Promise.all([
    sbGet(`eventos?select=tipo,dominio,actor_email,actor_rol,entidad_id,ts&ts=gte.${cutoff}&order=ts.desc&limit=20000`) as Promise<Evento[]>,
    sbGet(`usuarios?rol=eq.coach&select=id,email,nombre,created_at,configuracion,activo&limit=5000`) as Promise<Usuario[]>,
    sbGet(`candidatos?select=coach_id,email,consent_at&limit=50000`) as Promise<Candidato[]>,
  ]);

  // ── Calidad de dato: fuera los coaches SUSPENDIDOS ────────────────────────
  // Eliminado = la fila de usuarios se borró → ya no llega acá.
  // Suspendido = activo=false (lo pone el admin con set_active, o una suscripción
  // cancelada/impaga desde Stripe). Esos NO son roster vivo: ensucian el Health
  // Score y el embudo (aparecían como coaches reales). Se excluyen del cálculo;
  // se reporta cuántos se sacaron para que el número sea transparente, no mágico.
  // `activo` null/undefined (cuentas viejas sin la columna) = se conservan.
  const suspendidos = usuariosRaw.filter((u) => u.activo === false).length;
  const usuarios = usuariosRaw.filter((u) => u.activo !== false);

  const isTest = (e: Evento) => /^(manual|console)$/.test(String(e.dominio || "")) || e.tipo === "TestEvent";

  // ── Índices de eventos por coach ──
  const evProfile = new Set<string>();          // coach emails con ProfileCompleted
  const evInvited: Record<string, Set<string>> = {}; // coach -> set(cliente) invitados por evento
  const evAccepted = new Set<string>();          // cliente emails con ClientAccepted
  const act: Record<string, { last: number; ev14: number }> = {}; // actividad por coach
  const embudoEv: Record<string, number> = {};   // conteo de eventos por tipo en ventana (para referencia)

  const bump = (coach: string, ts: string) => {
    if (!coach) return;
    const t = new Date(ts).getTime();
    const a = act[coach] || (act[coach] = { last: 0, ev14: 0 });
    if (t > a.last) a.last = t;
    if (now - t <= 14 * 86400_000) a.ev14++;
  };
  for (const e of eventos) {
    if (isTest(e)) continue;
    if (now - new Date(e.ts).getTime() <= winMs) embudoEv[e.tipo] = (embudoEv[e.tipo] || 0) + 1;
    const em = (e.actor_email || "").toLowerCase();
    const esCoach = e.actor_rol === "coach" || e.actor_rol === "admin" || e.actor_rol === "owner";
    if (e.tipo === "ClientAccepted") { const c = (e.actor_email || e.entidad_id || "").toLowerCase(); if (c) evAccepted.add(c); }
    if (e.tipo === "ClientInvited" && esCoach) { (evInvited[em] || (evInvited[em] = new Set())).add((e.entidad_id || "").toLowerCase()); bump(em, e.ts); }
    if (e.tipo === "ProfileCompleted" && esCoach) { evProfile.add(em); bump(em, e.ts); }
    if (e.tipo === "SessionCompleted" && esCoach) bump(em, e.ts);
  }

  // ── Índices base (candidatos por coach) ──
  const clientesPorCoachId: Record<string, { total: number; entraron: number }> = {};
  for (const c of candidatos) {
    const cid = String(c.coach_id || "");
    if (!cid) continue;
    const b = clientesPorCoachId[cid] || (clientesPorCoachId[cid] = { total: 0, entraron: 0 });
    b.total++;
    if (c.consent_at) b.entraron++; // el cliente entró y aceptó = proxy base de ClientAccepted
  }

  const truthy = (v: unknown) => v === true || (typeof v === "string" && v.length > 0) || (typeof v === "number" && v > 0);

  // ── Modelo por coach (base + eventos) ──
  const coaches = usuarios.map((u) => {
    const email = (u.email || "").toLowerCase();
    const cfg = (u.configuracion || {}) as Record<string, unknown>;
    const baseCli = clientesPorCoachId[String(u.id)] || { total: 0, entraron: 0 };
    const evInv = evInvited[email] ? evInvited[email].size : 0;
    const a = act[email] || { last: 0, ev14: 0 };

    // Señales de fase (evento OR base fallback → funciona hoy):
    const perfil = evProfile.has(email) || truthy(cfg.perfil_publico_activo) || (!!u.nombre && (truthy(cfg.bio) || truthy(cfg.titulo_profesional)));
    const stripe = truthy(cfg.stripe_account_id);
    const invitados = Math.max(evInv, baseCli.total);
    // Cliente que entró: evento ClientAccepted (por cliente de este coach) o base consent_at.
    const evEntraron = evInvited[email] ? [...evInvited[email]].filter((c) => evAccepted.has(c)).length : 0;
    const clientesEntraron = Math.max(evEntraron, baseCli.entraron);
    const estadoSub = String(cfg.estado_sub || "");
    const paga = estadoSub === "activa";
    const enPrueba = estadoSub === "prueba" || (!!cfg.fecha_fin_prueba && !paga);

    // ACTIVADO (session-agnostic): perfil + invitó + cliente entró.
    const activado = perfil && invitados > 0 && clientesEntraron > 0;
    const diasSinAct = a.last ? Math.floor((now - a.last) / 86400_000) : 999;

    // ── Health Score por dimensiones ──
    const D = HEALTH.dimensiones;
    const dimAct = (perfil ? D.activacion.senales.perfil : 0) + (invitados > 0 ? D.activacion.senales.invito : 0) + (clientesEntraron > 0 ? D.activacion.senales.cliente_entro : 0);
    const dimUso = Math.min(D.uso.senales.tope, a.ev14 * D.uso.senales.por_evento_14d);
    const dimCli = Math.min(D.clientes.senales.tope, clientesEntraron * D.clientes.senales.por_cliente);
    const dimRec = a.last ? (diasSinAct <= 7 ? D.recencia.senales.dias7 : diasSinAct <= 14 ? D.recencia.senales.dias14 : D.recencia.senales.mas) : 0;
    const health = Math.round(
      dimAct * (D.activacion.peso / 100) + dimUso * (D.uso.peso / 100) + dimCli * (D.clientes.peso / 100) + dimRec * (D.recencia.peso / 100),
    );
    const estado = health >= 70 ? "verde" : health < 40 ? "riesgo" : "medio";

    return {
      id: u.id, email, nombre: u.nombre || null,
      perfil, stripe, invitados, clientes_entraron: clientesEntraron,
      activado, paga, en_prueba: enPrueba,
      eventos_14d: a.ev14, dias_sin_actividad: diasSinAct,
      health_score: health,
      health_dim: { activacion: dimAct, uso: dimUso, clientes: dimCli, recencia: dimRec },
      estado,
      // reservado (pragmático: contrato listo, sin calcular)
      velocidad: null, ttv_horas: null, ttfc_horas: null, ttfs_horas: null, ttfp_horas: null,
      fuente: "mixto",
      _reservado_v2: { activation_stage: null, wow_at: null, tendencia: null, segmento: null },
      _created: u.created_at,
    };
  });

  const total = coaches.length || 1;
  const nAct = coaches.filter((c) => c.activado).length;
  const nPaga = coaches.filter((c) => c.paga).length;
  const nRiesgo = coaches.filter((c) => c.estado === "riesgo").length;
  const nTrialWin = coaches.filter((c) => c._created && now - new Date(c._created).getTime() <= winMs).length;
  const nWow = coaches.filter((c) => c.clientes_entraron > 0).length;
  const nAtascados = coaches.filter((c) => c.en_prueba && !c.activado).length;
  const nEnTrial = coaches.filter((c) => c.en_prueba).length;
  const nPerfil = coaches.filter((c) => c.perfil).length;
  const nPrimerCli = coaches.filter((c) => c.invitados > 0).length;

  // MRR (base): coaches pagando × precio de su plan.
  let mrrBasic = 0, mrrPro = 0;
  for (const u of usuarios) {
    const cfg = (u.configuracion || {}) as Record<string, unknown>;
    if (String(cfg.estado_sub || "") !== "activa") continue;
    if (String(cfg.plan || "") === "pro") mrrPro++; else mrrBasic++;
  }
  const mrr = mrrBasic * PRECIOS.basic + mrrPro * PRECIOS.pro;

  // ── Embudo (11 fases; Lead/Demo/Retained reservados = null, pragmático) ──
  const cnt = (f: (c: typeof coaches[number]) => boolean) => coaches.filter(f).length;
  const nStripe = cnt((c) => c.stripe);
  const nSesion = new Set(eventos.filter((e) => !isTest(e) && e.tipo === "SessionCompleted").map((e) => (e.actor_email || "").toLowerCase())).size;
  const fases: Array<{ fase: string; label: string; evento: string | null; valor: number | null; fuente: string; estado: string }> = [
    { fase: "lead", label: "Lead", evento: "LeadCreated", valor: null, fuente: "base_temporal", estado: "🔴" },
    { fase: "demo", label: "Demo", evento: null, valor: null, fuente: "base_temporal", estado: "🔴" },
    { fase: "trial", label: "Trial Started", evento: "TrialStarted", valor: total, fuente: "mixto", estado: "🟡" },
    { fase: "perfil", label: "Profile Completed", evento: "ProfileCompleted", valor: nPerfil, fuente: "mixto", estado: "🟡" },
    { fase: "stripe", label: "Stripe Connected", evento: "StripeConnected", valor: nStripe, fuente: "mixto", estado: "🟡" },
    { fase: "invito", label: "First Client Invited", evento: "ClientInvited", valor: nPrimerCli, fuente: "mixto", estado: "🟡" },
    { fase: "acepto", label: "First Client Accepted", evento: "ClientAccepted", valor: nWow, fuente: "mixto", estado: "🟡" },
    { fase: "sesion", label: "First Session/Task", evento: "SessionCompleted", valor: nSesion, fuente: "eventos", estado: "🟡" },
    { fase: "wow", label: "WOW Reached", evento: null, valor: nAct, fuente: "mixto", estado: "🟡" },
    { fase: "pago", label: "Subscription Paid", evento: "PaymentSucceeded", valor: nPaga, fuente: "mixto", estado: "🟡" },
    { fase: "retenido", label: "Retained (30d)", evento: null, valor: null, fuente: "base_temporal", estado: "🔴" },
  ];
  // pct del anterior (sobre fases con valor)
  let prev: number | null = null;
  const embudo = fases.map((f) => {
    const pct_del_anterior = f.valor != null && prev != null && prev > 0 ? Math.round((f.valor / prev) * 100) : null;
    const pct_del_total = f.valor != null ? Math.round((f.valor / total) * 100) : null;
    if (f.valor != null) prev = f.valor;
    return { ...f, pct_del_total, pct_del_anterior };
  });
  // mayor fuga: la caída % más grande entre fases consecutivas con valor.
  let mayorFuga = "—", peorCaida = 101;
  for (let i = 1; i < embudo.length; i++) {
    const p = embudo[i].pct_del_anterior;
    if (p != null && p < peorCaida) { peorCaida = p; mayorFuga = `${embudo[i - 1].label} → ${embudo[i].label} (${p}%)`; }
  }

  const pct = (n: number) => Math.round((n / total) * 100);

  return json({
    ok: true,
    generado_at: new Date().toISOString(),
    ventana_dias: dias,
    config: { activado_requiere: ACTIVADO_REQUIERE, health: HEALTH },
    kpis: {
      coaches_en_trial:    kpi(nEnTrial, "count", "base_temporal", "TrialStarted cableado", "🔴", "Coaches en trial"),
      trials_semana:       kpi(nTrialWin, "count", "base_temporal", "TrialStarted cableado + 4 sem", "🔴", "Trials en la ventana"),
      wow_total:           kpi(nWow, "count", "mixto", "todos los eventos de fase implementados", "🟡", "Coaches que llegaron al WOW"),
      pagando:             kpi(nPaga, "count", "base_temporal", "PaymentSucceeded cableado", "🔴", "Coaches pagando"),
      pct_trial_pago:      kpi(pct(nPaga), "pct", "base_temporal", "TrialStarted+PaymentSucceeded + 90 días", "🟡", "% trial → pago"),
      activacion_pct:      kpi(pct(nAct), "pct", "mixto", "cobertura de eventos ≥90%", "🟡", "% activados"),
      pct_perfil:          kpi(pct(nPerfil), "pct", "mixto", "cobertura ≥90%", "🟡", "% completa perfil"),
      pct_primer_cliente:  kpi(pct(nPrimerCli), "pct", "mixto", "cobertura ≥90%", "🟡", "% invita primer cliente"),
      atascados_onboarding:kpi(nAtascados, "count", "mixto", "todos los eventos de fase", "🟡", "Atascados en onboarding"),
      coaches_riesgo:      kpi(nRiesgo, "count", "mixto", "Health v2", "🟡", "Coaches en riesgo"),
      mayor_fuga:          kpi(mayorFuga, "texto", "mixto", "embudo 100% eventos", "🟡", "Mayor fuga del embudo"),
      mrr:                 kpi(mrr, "usd", "base_temporal", "PaymentSucceeded + plan por eventos", "🟡", "MRR (" + PRECIOS.moneda + ")"),
    },
    embudo,
    coaches: coaches
      .map((c) => { const { _created, ...rest } = c; return rest; })
      .sort((a, b) => a.health_score - b.health_score),
    // Métricas temporales: contrato reservado, NO calculadas (decisión pragmática).
    tiempos: {
      ttv:                kpi(null, "horas", "mixto", "cohorte post-event-bus + TrialStarted", "🔴", "Time To Value"),
      time_first_client:  kpi(null, "horas", "mixto", "cohorte post-event-bus", "🔴", "Time to First Client"),
      time_first_session: kpi(null, "horas", "mixto", "cohorte post-event-bus", "🔴", "Time to First Session"),
      time_first_payment: kpi(null, "horas", "eventos", "PaymentSucceeded cableado", "🔴", "Time to First Payment"),
      activation_velocity: { buckets: null, fuente: "mixto", estado: "🔴" },
    },
    resumen: {
      coaches_total: coaches.length,
      coaches_activados: nAct,
      coaches_en_riesgo: nRiesgo,
      coaches_suspendidos_excluidos: suspendidos,
      clientes_entraron: coaches.reduce((s, c) => s + c.clientes_entraron, 0),
      eventos_leidos: eventos.filter((e) => !isTest(e)).length,
    },
    fuentes: [
      { kpi: "WOW / First Client Accepted", fuente_actual: "mixto", fuente_objetivo: "eventos", condicion: "cobertura de eventos", estado: "🟡" },
      { kpi: "Activación", fuente_actual: "mixto", fuente_objetivo: "eventos", condicion: "eventos de fase + 8 sem", estado: "🟡" },
      { kpi: "Health Score", fuente_actual: "mixto", fuente_objetivo: "eventos", condicion: "Health v2 (sesiones/tareas/logins)", estado: "🟡" },
      { kpi: "Trial iniciado / Trial→Pago", fuente_actual: "mixto", fuente_objetivo: "eventos", condicion: "TrialStarted+PaymentSucceeded ya se emiten; falta cohorte de 90 días para contar por evento", estado: "🟡" },
      { kpi: "Stripe / Pago (embudo)", fuente_actual: "mixto", fuente_objetivo: "eventos", condicion: "StripeConnected/PaymentSucceeded cableados; el conteo sigue en base hasta cobertura total", estado: "🟡" },
      { kpi: "Métricas temporales (TTV, etc.)", fuente_actual: "base_temporal", fuente_objetivo: "eventos", condicion: "cohorte post-bus + eventos server-side", estado: "🔴" },
    ],
  });
});
