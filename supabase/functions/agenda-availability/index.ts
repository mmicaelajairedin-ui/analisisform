// agenda-availability — huecos libres de un coach.
//
// Sustituye a `get-coach-busy-slots`, que existe, NO está desplegada (cero
// coincidencias en deploy-functions.yml) y solo miraba Google. Su consecuencia
// medida: `reservar.html:447-448` recorre BUSY_SLOTS para descartar huecos y
// ese array nunca se llena, así que se ofrecen huecos ya ocupados (CASO-04).
//
// LO QUE RESTA, y es la diferencia con lo que hay hoy:
//   1. citas del coach (estado <> cancelada)
//   2. agenda_bloques                       ← hoy no lo lee NADIE
//   3. usuarios.configuracion.bloqueados[]  ← hoy es lo ÚNICO que funciona
//   4. FreeBusy de Google                   ← Fase 2, el hueco queda declarado
//   + aviso mínimo y margen entre sesiones
//
// Es público a propósito (`--no-verify-jwt`): lo llama `reservar.html`, donde
// el visitante no tiene sesión. Por eso NO devuelve datos de citas — solo
// instantes libres. Nada de nombres, correos ni motivos de bloqueo.

import {
  huecosLibres,
  normalizarConfig,
} from '../_shared/agenda/disponibilidad.ts';
import { DURACION_POR_DEFECTO_MIN, zonaDeCoach, type Ocupado } from '../_shared/agenda/tipos.ts';

const SB_URL = Deno.env.get('SUPABASE_URL') || '';
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const svc = { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` };

const CORS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...CORS, 'Content-Type': 'application/json' } });
const fallo = (name: string, message: string, status: number) => json({ error: { name, message } }, status);

const MAX_DIAS = 60;

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 200, headers: CORS });
  if (req.method !== 'POST') return fallo('ServiceError', 'Solo POST.', 405);
  if (!SB_URL || !SERVICE) return fallo('ServiceError', 'Faltan variables de entorno.', 500);

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return fallo('ServiceError', 'Cuerpo no es JSON.', 400); }

  const coachId = String(body.coach_id ?? '').trim();
  if (!coachId) return fallo('ServiceError', 'Falta coach_id.', 400);

  const d0 = new Date(String(body.desde ?? ''));
  const d1 = new Date(String(body.hasta ?? ''));
  if (isNaN(+d0) || isNaN(+d1)) return fallo('ServiceError', 'desde y hasta deben ser fechas válidas.', 400);
  if (d1 <= d0) return fallo('ServiceError', 'El rango está invertido.', 400);
  if (+d1 - +d0 > MAX_DIAS * 86_400_000) return fallo('ServiceError', `El rango no puede pasar de ${MAX_DIAS} días.`, 400);

  const duracion = Number(body.duracion_min) > 0 ? Number(body.duracion_min) : DURACION_POR_DEFECTO_MIN;

  // ── Configuración del coach: el horario vive en usuarios.configuracion ──
  const ru = await fetch(
    `${SB_URL}/rest/v1/usuarios?id=eq.${encodeURIComponent(coachId)}&select=id,configuracion&limit=1`,
    { headers: svc },
  );
  if (!ru.ok) return fallo('ServiceError', 'No se pudo leer la configuración.', 502);
  const us = (await ru.json().catch(() => [])) as { configuracion?: unknown }[];
  if (!us.length) return fallo('NotFoundError', 'Coach no encontrado.', 404);

  // OJO AL NIVEL: el panel guarda la agenda en `configuracion.disponibilidad`
  // (panel-v2.html, `disponibilidad:{days,from,to,tz,min_notice_h,buffer_min,
  // bloqueados,horarios}`), NO en la raiz de `configuracion`. Se estaba pasando
  // la raiz, donde no existe ninguna de esas claves, asi que normalizarConfig
  // devolvia SIEMPRE el defecto: se ignoraban los horarios reales del coach y
  // sus dias bloqueados (se podia reservar un dia que habia cerrado). `zoom_url`
  // si vive en la raiz, asi que se toma de ahi.
  const cfgRaw = (us[0].configuracion ?? {}) as Record<string, unknown>;
  const dispRaw = (cfgRaw.disponibilidad && typeof cfgRaw.disponibilidad === 'object')
    ? cfgRaw.disponibilidad
    : cfgRaw;
  const config = normalizarConfig(dispRaw);
  if (!config.zoom_url && typeof cfgRaw.zoom_url === 'string') config.zoom_url = cfgRaw.zoom_url;
  const zona = zonaDeCoach(config.tz, cfgRaw.pais);

  // ── Ocupación ───────────────────────────────────────────────────────────
  const desdeIso = d0.toISOString();
  const hastaIso = d1.toISOString();

  const [rc, rb] = await Promise.all([
    fetch(
      `${SB_URL}/rest/v1/citas?coach_id=eq.${encodeURIComponent(coachId)}` +
        `&estado=neq.cancelada&inicio=gte.${encodeURIComponent(desdeIso)}` +
        `&inicio=lte.${encodeURIComponent(hastaIso)}&select=inicio,fin`,
      { headers: svc },
    ),
    fetch(
      `${SB_URL}/rest/v1/agenda_bloques?coach_id=eq.${encodeURIComponent(coachId)}` +
        `&fin=gte.${encodeURIComponent(desdeIso)}&inicio=lte.${encodeURIComponent(hastaIso)}` +
        `&select=inicio,fin`,
      { headers: svc },
    ),
  ]);

  const ocupados: Ocupado[] = [];

  if (rc.ok) {
    for (const c of (await rc.json().catch(() => [])) as { inicio: string; fin: string | null }[]) {
      const ini = new Date(c.inicio).getTime();
      if (isNaN(ini)) continue;
      const fin = c.fin ? new Date(c.fin).getTime() : ini + DURACION_POR_DEFECTO_MIN * 60_000;
      ocupados.push({ inicio: ini, fin: isNaN(fin) ? ini + DURACION_POR_DEFECTO_MIN * 60_000 : fin, origen: 'cita' });
    }
  }

  // Si la tabla todavía no existe (M3 sin aplicar), PostgREST devuelve 404 y
  // aquí NO se rompe nada: simplemente no hay bloques que restar. Es el mismo
  // comportamiento que hoy, no una regresión.
  if (rb.ok) {
    for (const b of (await rb.json().catch(() => [])) as { inicio: string; fin: string }[]) {
      const ini = new Date(b.inicio).getTime();
      const fin = new Date(b.fin).getTime();
      if (!isNaN(ini) && !isNaN(fin) && fin > ini) ocupados.push({ inicio: ini, fin, origen: 'bloque' });
    }
  }

  // FreeBusy de Google: Fase 2. Se declara el hueco en la respuesta en vez de
  // fingir que la disponibilidad ya es completa.
  const fuentes = { citas: true, bloques: rb.ok, config_bloqueados: true, google_freebusy: false };

  const libres = huecosLibres(config, ocupados, {
    desde: +d0,
    hasta: +d1,
    duracionMin: duracion,
    ahora: Date.now(),
    maxDias: MAX_DIAS,
  });

  return json({
    ok: true,
    zona,
    duracion_min: duracion,
    libres: libres.map((ms) => new Date(ms).toISOString()),
    fuentes,
  });
});
