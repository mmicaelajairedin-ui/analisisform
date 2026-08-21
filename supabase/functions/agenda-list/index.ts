// agenda-list — la ÚNICA lectura de agenda. La consumen el panel de Pathway y
// MultiCoach, con el mismo contrato.
//
// POR QUÉ EXISTE: hoy hay tres clientes leyendo `citas` por caminos distintos y
// cada uno decide por su cuenta qué puede ver. El alcance tiene que vivir en un
// solo sitio, y ese sitio tiene que ser el servidor (R-14).
//
// SEGURIDAD:
//   · El token se valida CONTRA AUTH (`GET /auth/v1/user`), no se descodifica.
//     Pathway despliega sus 78 funciones con `--no-verify-jwt` —su convención es
//     «cada función se autoriza sola por dentro»—, así que nadie ha comprobado
//     la firma antes de llegar aquí. Leer el payload en base64 aceptaría
//     cualquier token fabricado con el `sub` de otra persona.
//   · La identidad sale del token, NUNCA del cuerpo de la petición.
//   · service_role solo DESPUÉS de resolver la identidad.
//   · El alcance lo impone el servidor: si un coach pide el coach_id de un
//     compañero, recibe el suyo.
//   · No devuelve `email`, `telefono`, `respuestas` ni `notas_llamada`: la
//     agenda no los necesita y `citas` guarda datos personales (INC-025, R-32).
//
// Deploy: va en el repositorio y el CI de Pathway, NO a mano. `get-team-members`
// es hoy un inquilino no declarado (INC-011) y no se repite el patrón.

import {
  resolverIdentidad, filtroDeLectura, identidadDeAuth, soloCorreoExacto,
} from '../_shared/agenda/identidad.ts';
import { construirConsulta, traducirEvento } from '../_shared/agenda/consulta.ts';
import type { FilaCita } from '../_shared/agenda/consulta.ts';
import type { FilaUsuario, Jwt } from '../_shared/agenda/tipos.ts';

const SB_URL = Deno.env.get('SUPABASE_URL') || '';
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const ANON = Deno.env.get('SUPABASE_ANON_KEY') || '';
const svc = { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` };
// Origen público de la Sala. Configurable para no incrustar el dominio.
const ORIGEN_SALA = Deno.env.get('PATHWAY_WEB_ORIGIN') || 'https://pathwaycareercoach.com';

const CORS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}
function fallo(name: string, message: string, status: number): Response {
  // Nombres que la interfaz de MultiCoach ya traduce.
  return json({ error: { name, message } }, status);
}

/**
 * Valida el token CONTRA AUTH y devuelve la identidad.
 *
 * No se descodifica el JWT por nuestra cuenta: Pathway despliega todo con
 * `--no-verify-jwt`, así que nadie ha comprobado la firma antes de llegar aquí.
 * Leer el payload en base64 aceptaría cualquier token fabricado.
 */
async function identidadDelToken(req: Request): Promise<Jwt | null> {
  const auth = req.headers.get('Authorization') || '';
  const token = auth.replace(/^Bearer\s+/i, '').trim();
  if (!token || token === ANON) return null;   // la clave pública no es una sesión
  try {
    const r = await fetch(`${SB_URL}/auth/v1/user`, {
      headers: { apikey: ANON, Authorization: `Bearer ${token}` },
    });
    if (!r.ok) return null;
    return identidadDeAuth(await r.json().catch(() => null));
  } catch {
    return null;
  }
}

async function usuariosPor(campo: 'auth_id' | 'email', valor: string): Promise<FilaUsuario[]> {
  const filtro = campo === 'auth_id'
    ? `auth_id=eq.${encodeURIComponent(valor)}`
    : `email=ilike.${encodeURIComponent(valor)}`;
  const r = await fetch(`${SB_URL}/rest/v1/usuarios?${filtro}&select=id,org_id,rol,activo,email`, { headers: svc });
  if (!r.ok) return [];
  const filas = (await r.json().catch(() => [])) as FilaUsuario[];
  // `ilike` acota pero no basta: PostgREST no escapa `_`, que es comodín de
  // LIKE. Se confirma la coincidencia exacta antes de devolver nada.
  return campo === 'email' ? soloCorreoExacto(filas, valor) : filas;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 200, headers: CORS });
  if (req.method !== 'POST') return fallo('ServiceError', 'Solo POST.', 405);
  if (!SB_URL || !SERVICE || !ANON) return fallo('ServiceError', 'Faltan variables de entorno.', 500);

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return fallo('ServiceError', 'Cuerpo no es JSON.', 400); }

  const from = String(body.from ?? '');
  const to = String(body.to ?? '');
  if (!from || !to) return fallo('ServiceError', 'listEvents necesita un rango: from y to.', 400);
  const d0 = new Date(from), d1 = new Date(to);
  if (isNaN(+d0) || isNaN(+d1)) return fallo('ServiceError', 'El rango no es una fecha válida.', 400);
  if (d1 < d0) return fallo('ServiceError', 'El rango está invertido: to es anterior a from.', 400);

  // ── Identidad ──────────────────────────────────────────────────────────
  const jwt = await identidadDelToken(req);
  if (!jwt) return fallo('ForbiddenError', 'Sesión no válida.', 401);

  const porAuthId = await usuariosPor('auth_id', jwt.sub);
  const porEmail = porAuthId.length === 0 && jwt.email && jwt.email_verified
    ? await usuariosPor('email', jwt.email)
    : null;

  const id = resolverIdentidad(jwt, porAuthId, porEmail);
  if (!id.ok) {
    const status = id.motivo === 'no_encontrado' ? 404 : 403;
    return fallo(id.motivo === 'no_encontrado' ? 'NotFoundError' : 'ForbiddenError', id.motivo, status);
  }

  // ── Alcance, impuesto por el servidor ──────────────────────────────────
  const f = filtroDeLectura(id, body.coach_id ? String(body.coach_id) : null);

  const consulta = construirConsulta(f, {
    desdeIso: d0.toISOString(),
    hastaIso: d1.toISOString(),
    incluirCanceladas: body.incluir_canceladas === true,
  });
  // `null` = el alcance no puede producir resultados. Antes de lanzar una
  // consulta sin ámbito sobre `citas` con service_role, lista vacía.
  if (!consulta) return json({ ok: true, alcance: f.alcance, via: id.via, eventos: [] });

  const url = `${SB_URL}/rest/v1/citas?${consulta}`;
  const r = await fetch(url, { headers: svc });
  if (!r.ok) return fallo('ServiceError', `No se pudo leer la agenda (${r.status}).`, 502);
  const filas = (await r.json().catch(() => [])) as FilaCita[];

  // Nombres de coach en un solo viaje, no uno por fila.
  // Se filtra a los que tienen forma de uuid: `usuarios.id` es uuid y
  // `citas.coach_id` es text, así que UN valor mal formado haría que PostgREST
  // devolviera 400 y la página entera se quedara sin nombres. Ha pasado ya:
  // las citas 45 y 71 llevan en `coach_id` un id de ORGANIZACIÓN.
  const ES_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const ids = [...new Set(filas.map((c) => String(c.coach_id ?? '')).filter((v) => ES_UUID.test(v)))];
  const nombres = new Map<string, string>();
  if (ids.length) {
    const q = `id=in.(${ids.map(encodeURIComponent).join(',')})&select=id,nombre`;
    const rn = await fetch(`${SB_URL}/rest/v1/usuarios?${q}`, { headers: svc });
    if (rn.ok) {
      for (const u of (await rn.json().catch(() => [])) as { id: string; nombre: string }[]) {
        nombres.set(String(u.id), u.nombre || '—');
      }
    }
  }

  const eventos = filas.map((c) => traducirEvento(c, nombres.get(String(c.coach_id ?? '')) ?? '—', ORIGEN_SALA));
  return json({ ok: true, alcance: f.alcance, via: id.via, eventos });
});
