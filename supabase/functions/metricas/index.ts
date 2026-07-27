// ===================================================================
// metricas — Pathway OS · Nivel 1 (Activation). READ-ONLY.
//
// Lee la tabla `eventos` (event store) con SERVICE ROLE y calcula, para el
// Dashboard CEO del panel:
//   - Embudo: conteo de eventos por tipo (ventana configurable).
//   - Activación por coach: perfil + invitó cliente + el cliente entró
//     (session-agnostic: NO exige sesiones — un coach que atiende en persona
//     pero gestiona por Pathway cuenta como activado).
//   - Health Score por coach (v1, heurístico): actividad reciente + clientes
//     que entraron + recencia.
//
// SEGURIDAD (mismo gate que admin-coach-op / crear-coach):
//   Solo responde si el que llama tiene un JWT válido cuyo email/auth_id es
//   rol='admin' en usuarios. Sin eso → 403. Nadie lee `eventos` con la anon key
//   (la tabla no tiene policy de SELECT); la lectura vive SOLO acá, con service
//   role, detrás del gate de admin.
//
// Body (POST, opcional): { dias?: number }  — ventana del embudo (default 30).
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

// Identidad verificada por Supabase Auth (email + uid) a partir del JWT.
async function callerIdentity(token: string): Promise<{ email: string | null; uid: string | null }> {
  if (!token || token === ANON) return { email: null, uid: null };
  try {
    const r = await fetch(`${SB_URL}/auth/v1/user`, { headers: { apikey: ANON, Authorization: `Bearer ${token}` } });
    if (!r.ok) return { email: null, uid: null };
    const u = await r.json();
    const em = (u && u.email ? String(u.email) : "").trim().toLowerCase();
    const uid = (u && u.id ? String(u.id) : "").trim();
    return { email: EMAIL_RE.test(em) ? em : null, uid: isUuid(uid) ? uid : null };
  } catch {
    return { email: null, uid: null };
  }
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
  } catch {
    return false;
  }
}

interface Evento {
  tipo: string;
  dominio: string | null;
  actor_email: string | null;
  actor_rol: string | null;
  entidad_id: string | null;
  ts: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  if (!SB_URL || !SERVICE) return json({ error: "env" }, 500);

  // ── Gate de admin ──
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  const who = await callerIdentity(token);
  if (!(await isAdmin(who.email, who.uid))) return json({ error: "forbidden" }, 403);

  const body = await req.json().catch(() => ({}));
  const dias = Math.max(1, Math.min(365, parseInt(String((body as { dias?: number }).dias ?? 30), 10) || 30));

  // ── Leer eventos (últimos 365 días; la activación es acumulada, el embudo por ventana) ──
  const cutoff = new Date(Date.now() - 365 * 86400_000).toISOString();
  let eventos: Evento[] = [];
  try {
    const r = await fetch(
      `${SB_URL}/rest/v1/eventos?select=tipo,dominio,actor_email,actor_rol,entidad_id,ts` +
        `&ts=gte.${cutoff}&order=ts.desc&limit=20000`,
      { headers: svc },
    );
    if (!r.ok) return json({ error: "read_failed", status: r.status }, 502);
    eventos = await r.json();
  } catch (_e) {
    return json({ error: "unreachable" }, 502);
  }

  const now = Date.now();
  const winMs = dias * 86400_000;
  const isTest = (e: Evento) => /^(manual|console)$/.test(String(e.dominio || "")) || e.tipo === "TestEvent";

  // ── Embudo: conteo por tipo en la ventana ──
  const funnel: Record<string, number> = {};
  for (const e of eventos) {
    if (isTest(e)) continue;
    if (now - new Date(e.ts).getTime() > winMs) continue;
    funnel[e.tipo] = (funnel[e.tipo] || 0) + 1;
  }

  // ── Índices para activación (acumulado, todo el histórico leído) ──
  // Clientes que ENTRARON (aceptaron): por email.
  const clientesEntraron = new Set<string>();
  // Coach que invitó a cada cliente: clientEmail -> coachEmail.
  const clienteCoach: Record<string, string> = {};
  // Coaches con perfil completo.
  const coachesConPerfil = new Set<string>();
  // Actividad por coach: email -> { last:ms, ev14:int, tipos:Set }.
  const act: Record<string, { last: number; ev14: number; tipos: Set<string> }> = {};

  const bump = (coach: string, e: Evento) => {
    if (!coach) return;
    const t = new Date(e.ts).getTime();
    const a = act[coach] || (act[coach] = { last: 0, ev14: 0, tipos: new Set() });
    if (t > a.last) a.last = t;
    if (now - t <= 14 * 86400_000) a.ev14++;
    a.tipos.add(e.tipo);
  };

  for (const e of eventos) {
    if (isTest(e)) continue;
    const em = (e.actor_email || "").toLowerCase();
    const esCoach = e.actor_rol === "coach" || e.actor_rol === "admin" || e.actor_rol === "owner";
    if (e.tipo === "ClientAccepted") {
      const c = (e.actor_email || e.entidad_id || "").toLowerCase();
      if (c) clientesEntraron.add(c);
    }
    if (e.tipo === "ClientInvited" && esCoach) {
      const cliente = (e.entidad_id || "").toLowerCase();
      if (cliente && !clienteCoach[cliente]) clienteCoach[cliente] = em;
      bump(em, e);
    }
    if (e.tipo === "ProfileCompleted" && esCoach) { coachesConPerfil.add(em); bump(em, e); }
    if ((e.tipo === "SessionCompleted") && esCoach) bump(em, e);
  }

  // Clientes que entraron, agrupados por su coach.
  const clientesEntraronPorCoach: Record<string, number> = {};
  for (const [cliente, coach] of Object.entries(clienteCoach)) {
    if (clientesEntraron.has(cliente)) clientesEntraronPorCoach[coach] = (clientesEntraronPorCoach[coach] || 0) + 1;
  }
  // # clientes invitados por coach.
  const invitadosPorCoach: Record<string, number> = {};
  for (const coach of Object.values(clienteCoach)) invitadosPorCoach[coach] = (invitadosPorCoach[coach] || 0) + 1;

  // ── Estado + Health Score por coach ──
  const emails = new Set<string>([...Object.keys(act), ...coachesConPerfil]);
  const coaches = [...emails].map((email) => {
    const a = act[email] || { last: 0, ev14: 0, tipos: new Set<string>() };
    const perfil = coachesConPerfil.has(email);
    const invitados = invitadosPorCoach[email] || 0;
    const clientesEntr = clientesEntraronPorCoach[email] || 0;
    // ACTIVADO (session-agnostic): perfil + invitó cliente + al menos un cliente entró.
    const activado = perfil && invitados > 0 && clientesEntr > 0;
    const diasSinActividad = a.last ? Math.floor((now - a.last) / 86400_000) : 999;
    // Health Score v1 (0-100): actividad reciente + clientes reales + recencia.
    let score = 0;
    if (activado) score += 30;
    score += Math.min(30, a.ev14 * 6);
    score += Math.min(25, clientesEntr * 12);
    score += diasSinActividad <= 7 ? 15 : diasSinActividad <= 14 ? 8 : 0;
    score = Math.max(0, Math.min(100, score));
    const estado = score >= 70 ? "verde" : score < 40 ? "riesgo" : "medio";
    return {
      email,
      perfil,
      invitados,
      clientes_entraron: clientesEntr,
      activado,
      eventos_14d: a.ev14,
      dias_sin_actividad: diasSinActividad,
      health_score: score,
      estado,
    };
  }).sort((x, y) => y.health_score - x.health_score);

  const resumen = {
    coaches_total: coaches.length,
    coaches_activados: coaches.filter((c) => c.activado).length,
    coaches_en_riesgo: coaches.filter((c) => c.estado === "riesgo").length,
    clientes_entraron: clientesEntraron.size,
    eventos_leidos: eventos.filter((e) => !isTest(e)).length,
  };

  return json({
    ok: true,
    generado_at: new Date().toISOString(),
    ventana_dias: dias,
    embudo: funnel,
    resumen,
    coaches,
    definiciones: {
      activado: "perfil + invitó cliente + al menos un cliente entró (no exige sesiones)",
      health_score: "v1: activado 30 + actividad_14d(≤30) + clientes_entraron(≤25) + recencia(≤15)",
    },
  });
});
