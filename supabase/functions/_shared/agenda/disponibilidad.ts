// disponibilidad.ts — calcula los huecos libres de un coach.
//
// Es la pieza con más riesgo de error de toda la reconstrucción, porque los
// fallos NO se ven: un hueco mal calculado no lanza ninguna excepción, se
// ofrece a un cliente y el coach descubre el problema cuando alguien aparece
// a una hora imposible. Por eso está separada, es pura y está bajo prueba.
//
// SEMÁNTICA HEREDADA DE PATHWAY, a propósito. Se replica `_coachInstants` y
// `_slotBusy` de `reservar.html:373-453` en lugar de reinventarlas: hoy son la
// referencia de lo que el cliente ve al reservar, y divergir crearía dos
// verdades sobre la misma pregunta.
//   · días: convención JS (0=domingo), defecto [1..5]
//   · el horario del día se interpreta en la zona DEL COACH
//   · `to <= from` significa que el tramo cruza medianoche  (t += 1440)
//   · el candidato entra si `inicio + duracion <= fin_del_tramo`
//   · solape con margen: `a < ocupado.fin + buf && b > ocupado.inicio - buf`
//   · aviso mínimo: el hueco debe empezar después de `ahora + min_notice_h`
//
// LO QUE ARREGLA RESPECTO A LO QUE HAY HOY:
//   1. Suma los BLOQUES de `agenda_bloques`, que hoy no los lee nadie.
//   2. Sigue leyendo `configuracion.bloqueados[]`, que es el único mecanismo
//      que hoy funciona. Los dos a la vez: no se retira nada en esta fase.
//   3. Recibe `ahora` inyectado: sin eso la función no es comprobable.
//   4. No usa la `Z` sobre horas locales (P1) ni `getDay()` sin corregir (P3).

import {
  CONFIG_POR_DEFECTO,
  ZONA_POR_DEFECTO,
  type ConfigCoach,
  type Ocupado,
  type OpcionesHuecos,
} from './tipos.ts';

const MS_MIN = 60_000;
const MS_DIA = 86_400_000;

/** Desfase de una zona respecto a UTC, en ms, para un instante dado. */
export function desfaseZonaMs(utcMs: number, tz: string): number {
  const zona = tz || ZONA_POR_DEFECTO;
  try {
    const dtf = new Intl.DateTimeFormat('en-US', {
      timeZone: zona,
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    const p: Record<string, string> = {};
    for (const parte of dtf.formatToParts(new Date(utcMs))) p[parte.type] = parte.value;
    let h = Number(p.hour);
    if (h === 24) h = 0; // algunos entornos devuelven 24 en vez de 0
    const comoUtc = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), h, Number(p.minute), Number(p.second));
    return comoUtc - utcMs;
  } catch {
    return 0;
  }
}

/** Hora de pared en una zona → instante UTC.
 *
 *  Dos pasadas, igual que `reservar.html:364`: la primera da un desfase
 *  aproximado y la segunda lo corrige, que es lo que hace falta en los días
 *  de cambio de hora oficial. */
export function paredAUtc(
  y: number,
  mo: number,
  d: number,
  h: number,
  mi: number,
  tz: string,
): number {
  const supuesto = Date.UTC(y, mo - 1, d, h, mi, 0);
  let off = desfaseZonaMs(supuesto, tz);
  off = desfaseZonaMs(supuesto - off, tz);
  return supuesto - off;
}

export interface FechaEnZona {
  y: number;
  mo: number;
  d: number;
  /** Día de la semana en convención JS: 0=domingo … 6=sábado. */
  wd: number;
}

/** Año, mes, día y día de la semana de un instante, vistos EN una zona. */
export function fechaEnZona(utcMs: number, tz: string): FechaEnZona {
  const zona = tz || ZONA_POR_DEFECTO;
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: zona,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  });
  const p: Record<string, string> = {};
  for (const parte of dtf.formatToParts(new Date(utcMs))) p[parte.type] = parte.value;
  const WD: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return { y: Number(p.year), mo: Number(p.month), d: Number(p.day), wd: WD[p.weekday] ?? 0 };
}

const dosDigitos = (n: number) => String(n).padStart(2, '0');

export function claveDia(f: FechaEnZona): string {
  return `${f.y}-${dosDigitos(f.mo)}-${dosDigitos(f.d)}`;
}

/** 'HH:MM' → minutos desde medianoche. Devuelve null si no tiene la forma. */
export function minutosDeHora(hhmm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm || '');
  if (!m) return null;
  const h = Number(m[1]);
  const mi = Number(m[2]);
  if (h > 23 || mi > 59) return null;
  return h * 60 + mi;
}

/** Normaliza lo que venga en `usuarios.configuracion` al contrato.
 *  Réplica de `normDisp` (`reservar.html:455-473`) para no divergir. */
export function normalizarConfig(bruto: unknown): ConfigCoach {
  const d = (bruto ?? {}) as Record<string, unknown>;
  if (typeof d !== 'object' || d === null) return { ...CONFIG_POR_DEFECTO };

  const days = Array.isArray(d.days) && d.days.length
    ? (d.days as unknown[]).map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n <= 6)
    : [...CONFIG_POR_DEFECTO.days];

  const horarios: Record<string, { from: string; to: string }> = {};
  if (d.horarios && typeof d.horarios === 'object') {
    for (const [k, v] of Object.entries(d.horarios as Record<string, unknown>)) {
      const h = v as { from?: string; to?: string };
      if (h && minutosDeHora(h.from ?? '') !== null && minutosDeHora(h.to ?? '') !== null) {
        horarios[String(Number(k))] = { from: h.from as string, to: h.to as string };
      }
    }
  }

  const num = (v: unknown, def: number) => (Number.isFinite(Number(v)) ? Math.max(0, Number(v)) : def);

  return {
    days: days.length ? days : [...CONFIG_POR_DEFECTO.days],
    from: minutosDeHora(String(d.from ?? '')) !== null ? String(d.from) : CONFIG_POR_DEFECTO.from,
    to: minutosDeHora(String(d.to ?? '')) !== null ? String(d.to) : CONFIG_POR_DEFECTO.to,
    horarios,
    tz: typeof d.tz === 'string' && d.tz ? d.tz : '',
    min_notice_h: num(d.min_notice_h, 0),
    buffer_min: num(d.buffer_min, 0),
    bloqueados: Array.isArray(d.bloqueados) ? (d.bloqueados as unknown[]).map(String) : [],
    zoom_url: typeof d.zoom_url === 'string' ? d.zoom_url : null,
  };
}

/** ¿El hueco [inicio, inicio+duracion) pisa algún ocupado, con margen? */
export function huecoOcupado(
  inicioMs: number,
  duracionMin: number,
  ocupados: readonly Ocupado[],
  bufferMin: number,
): boolean {
  const a = inicioMs;
  const b = inicioMs + duracionMin * MS_MIN;
  const buf = bufferMin * MS_MIN;
  for (const o of ocupados) {
    // Intervalo semiabierto expandido por el margen. Sin el semiabierto, una
    // cita que acaba a las 10:00 bloquearía otra que empieza a las 10:00.
    if (a < o.fin + buf && b > o.inicio - buf) return true;
  }
  return false;
}

/**
 * Instantes libres de un coach, en epoch ms y ordenados.
 *
 * Resta, en este orden: días no laborables · días bloqueados por
 * `configuracion.bloqueados` · el aviso mínimo · y todo lo que venga en
 * `ocupados` (citas, `agenda_bloques` y FreeBusy de Google, ya normalizados).
 */
export function huecosLibres(
  config: ConfigCoach,
  ocupados: readonly Ocupado[],
  opts: OpcionesHuecos,
): number[] {
  const { desde, hasta, duracionMin, ahora } = opts;
  if (!(duracionMin > 0) || !(hasta > desde)) return [];

  const tz = config.tz || ZONA_POR_DEFECTO;
  const paso = Math.max(opts.pasoMin ?? Math.max(duracionMin, 15), 1);
  const maxDias = opts.maxDias ?? 120;
  // Igual que Pathway: al menos un minuto de aviso, aunque min_notice_h sea 0.
  const aviso = Math.max(MS_MIN, config.min_notice_h * 3_600_000);
  const noAntesDe = ahora + aviso;
  const bloqueados = new Set(config.bloqueados);
  const dias = new Set(config.days);

  const salida: number[] = [];
  const primera = fechaEnZona(desde, tz);
  const totalDias = Math.min(maxDias, Math.ceil((hasta - desde) / MS_DIA) + 2);

  for (let i = 0; i < totalDias; i++) {
    // Se sondea el MEDIODÍA de cada fecha para derivar el día real: evita los
    // bordes del cambio de hora, donde la medianoche puede no existir.
    const sonda = paredAUtc(primera.y, primera.mo, primera.d + i, 12, 0, tz);
    const dia = fechaEnZona(sonda, tz);

    if (!dias.has(dia.wd)) continue;
    if (bloqueados.has(claveDia(dia))) continue;

    const excepcion = config.horarios[String(dia.wd)];
    const desdeMin = minutosDeHora(excepcion?.from ?? config.from) ?? 540;
    let hastaMin = minutosDeHora(excepcion?.to ?? config.to) ?? 1080;
    // Tramo que cruza medianoche.
    if (hastaMin <= desdeMin) hastaMin += 1440;

    for (let m = desdeMin; m + duracionMin <= hastaMin; m += paso) {
      const dentroDelDia = m % 1440;
      const diasExtra = Math.floor(m / 1440);
      const ms = paredAUtc(
        dia.y,
        dia.mo,
        dia.d + diasExtra,
        Math.floor(dentroDelDia / 60),
        dentroDelDia % 60,
        tz,
      );

      if (ms <= noAntesDe) continue;
      if (ms < desde) continue;
      if (ms + duracionMin * MS_MIN > hasta) continue;
      if (huecoOcupado(ms, duracionMin, ocupados, config.buffer_min)) continue;

      salida.push(ms);
    }
  }

  // Un tramo que cruza medianoche puede generar el mismo instante dos veces.
  return [...new Set(salida)].sort((a, b) => a - b);
}
