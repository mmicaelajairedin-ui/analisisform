// cliente-timeline — devuelve los "avances" (eventos) de UN cliente para el
// timeline del panel. Los eventos viven en `eventos` (nadie los lee con la anon
// key), así que esta function (service role) los lee — PERO solo después de
// verificar que quien pregunta es el COACH dueño de ese cliente (o admin).
//
// Entrada:  POST { email: "<cliente>" }  + Authorization: Bearer <jwt del coach>
// Salida:   { items: [{ tipo, titulo, ts }] }  (máx 14, más nuevo primero)
//
// Deploy: supabase functions deploy cliente-timeline --no-verify-jwt
// (verifica el JWT a mano contra /auth/v1/user; el gate real es la propiedad).

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

// Quién llama (verifica el JWT contra el endpoint de auth).
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
// La fila de usuarios del que llama (id + rol), por email o auth_id.
async function callerUsuario(email: string | null, uid: string | null): Promise<{ id: string; rol: string } | null> {
  const ors: string[] = [];
  if (email) ors.push(`email.ilike.${email}`);
  if (uid) ors.push(`auth_id.eq.${uid}`);
  if (!ors.length) return null;
  try {
    const r = await fetch(
      `${SB_URL}/rest/v1/usuarios?or=(${encodeURIComponent(ors.join(","))})&select=id,rol&limit=1`,
      { headers: svc },
    );
    if (!r.ok) return null;
    const rows = await r.json();
    if (Array.isArray(rows) && rows.length) return { id: String(rows[0].id), rol: String(rows[0].rol || "") };
    return null;
  } catch { return null; }
}
// ¿El coach `coachId` es dueño del cliente `email`? (existe en candidatos con ese coach_id)
async function coachOwnsClient(coachId: string, email: string): Promise<boolean> {
  try {
    const r = await fetch(
      `${SB_URL}/rest/v1/candidatos?email=eq.${encodeURIComponent(email)}&coach_id=eq.${encodeURIComponent(coachId)}&select=email&limit=1`,
      { headers: svc },
    );
    if (!r.ok) return false;
    const rows = await r.json();
    return Array.isArray(rows) && rows.length > 0;
  } catch { return false; }
}

// tipo de evento → título claro para el coach (sin nombres técnicos ni detalle
// largo). Lo que no está en el mapa NO se muestra (nada de tipos crudos).
const TITULOS: Record<string, string> = {
  ClientAccepted: "Se sumó a su espacio",
  ReportGenerated: "Se publicó su informe",
  ReportViewed: "Leyó su informe",
  TaskCompleted: "Cumplió una tarea",
  WowReached: "Optimizó su LinkedIn",
  CallBooked: "Agendó una llamada",
  SessionCompleted: "Tuvo una sesión",
  ProgramFinished: "Llegó a la última etapa",
};

interface Evento { tipo: string; ts: string; payload?: Record<string, unknown> | null; }

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  if (!SB_URL || !SERVICE) return json({ error: "env" }, 500);

  const body = await req.json().catch(() => ({}));
  const email = (body && body.email ? String(body.email) : "").trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return json({ error: "email" }, 400);

  // 1) Identidad del que llama (JWT del coach).
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  const who = await callerIdentity(token);
  const me = await callerUsuario(who.email, who.uid);
  if (!me) return json({ error: "unauthorized" }, 401);

  // 2) Autorización: admin ve cualquiera; el coach SOLO a sus clientes.
  if (me.rol !== "admin") {
    const owns = await coachOwnsClient(me.id, email);
    if (!owns) return json({ error: "forbidden" }, 403);
  }

  // 3) Eventos del cliente: los que emitió él (actor_email) o los que lo tienen
  //    como entidad (entidad_id). Best-effort: si la tabla no existe, [].
  let eventos: Evento[] = [];
  try {
    const r = await fetch(
      `${SB_URL}/rest/v1/eventos?select=tipo,ts,payload&or=(actor_email.eq.${encodeURIComponent(email)},entidad_id.eq.${encodeURIComponent(email)})&order=ts.desc&limit=60`,
      { headers: svc },
    );
    if (r.ok) { const j = await r.json(); if (Array.isArray(j)) eventos = j as Evento[]; }
  } catch { /* best-effort */ }

  // 4) Mapear a títulos claros; descartar tipos no mapeados y duplicados
  //    exactos (mismo tipo + mismo minuto).
  const seen = new Set<string>();
  const items: Array<{ tipo: string; titulo: string; ts: string }> = [];
  for (const e of eventos) {
    const titulo = TITULOS[e.tipo];
    if (!titulo) continue;
    const k = e.tipo + "|" + String(e.ts).slice(0, 16);
    if (seen.has(k)) continue;
    seen.add(k);
    items.push({ tipo: e.tipo, titulo, ts: e.ts });
    if (items.length >= 14) break;
  }

  return json({ items });
});
