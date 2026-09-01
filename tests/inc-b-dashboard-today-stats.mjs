// INC-B · prueba de consumo del dashboard sobre `sesiones_registro`.
//
// No reimplementa la logica: EXTRAE `processTodayStats` del fuente real
// (`supabase/functions/dashboard/index.ts`) y la ejecuta. Si alguien cambia esa
// funcion, la prueba se ejecuta contra la version nueva; si alguien la borra o
// la renombra, la prueba falla en la extraccion en vez de pasar en vacio.
//
// Cubre las dos formas de "descartar filas en silencio" que INC-B encontro:
//   1. `estado === "cancelada"` — vocabulario de `citas`, no de esta tabla, que
//      usa ingles ('scheduled' por defecto, 'cancelled'/'confirmed' al escribir).
//   2. `new Date(s.fecha)` sin la hora — toda sesion de hoy caia en medianoche
//      UTC, siempre en el pasado, y `upcoming_2h` daba 0 siempre.
//
// Correr:  node tests/inc-b-dashboard-today-stats.mjs

import { readFileSync } from "node:fs";

const SRC = "supabase/functions/dashboard/index.ts";
const src = readFileSync(SRC, "utf8");

const m = src.match(
  /const processTodayStats = \(sessions: any\[\]\) => \{[\s\S]*?\n    \};/
);
if (!m) {
  console.error(`FALLO: no se pudo extraer processTodayStats de ${SRC}`);
  process.exit(1);
}
// De TypeScript a JavaScript: lo unico tipado dentro de la funcion son las
// anotaciones `: any[]` y `: any` de los parametros.
const js = m[0].replace(/: any\[\]/g, "").replace(/: any/g, "");
const processTodayStats = eval("(" + js.replace(/^const processTodayStats = /, "").replace(/;$/, "") + ")");

const pad = (n) => String(n).padStart(2, "0");
const hoy = new Date();
const fecha = `${hoy.getUTCFullYear()}-${pad(hoy.getUTCMonth() + 1)}-${pad(hoy.getUTCDate())}`;
const enHoras = (h) => {
  const d = new Date(Date.now() + h * 3600000);
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:00`;
};

let fallos = 0;
const chequeo = (nombre, real, esperado) => {
  const ok = real === esperado;
  if (!ok) fallos++;
  console.log(`${ok ? "OK  " : "FALLO"}  ${nombre}: ${real} (esperado ${esperado})`);
};

// ── Caso 1 · vocabulario real de la tabla (ingles) ──────────────────────────
{
  const filas = [
    { fecha, hora: "09:00:00", estado: "completed" },
    { fecha, hora: "10:00:00", estado: "confirmed" },
    { fecha, hora: "11:00:00", estado: "scheduled" },
    { fecha, hora: "12:00:00", estado: "cancelled" },
  ];
  const r = processTodayStats(filas);
  chequeo("total con vocabulario ingles", r.total_sessions, 4);
  chequeo("cancelled reconoce 'cancelled'", r.cancelled, 1);
  chequeo("completion_rate con 1 de 4 cancelada", r.completion_rate, 75);
}

// ── Caso 2 · vocabulario de `citas` (espanol), aceptado por compatibilidad ──
{
  const r = processTodayStats([
    { fecha, hora: "09:00:00", estado: "cancelada" },
    { fecha, hora: "10:00:00", estado: "confirmed" },
  ]);
  chequeo("cancelled tambien reconoce 'cancelada'", r.cancelled, 1);
}

// ── Caso 3 · upcoming_2h usa fecha + hora ───────────────────────────────────
{
  const r = processTodayStats([
    { fecha, hora: enHoras(1), estado: "scheduled" },   // dentro de 2h  → cuenta
    { fecha, hora: enHoras(5), estado: "scheduled" },   // dentro de 5h  → no
    { fecha, hora: "00:00:01", estado: "completed" },   // ya paso       → no
  ]);
  chequeo("upcoming_2h cuenta la sesion de dentro de 1h", r.upcoming_2h, 1);
}

// ── Caso 4 · no se rompe con filas incompletas ni con lista vacia ───────────
{
  const r = processTodayStats([{ fecha, hora: null, estado: null }, { fecha: null }]);
  chequeo("no explota con hora/estado nulos", r.total_sessions, 2);
  const v = processTodayStats([]);
  chequeo("lista vacia: completion_rate 0 (no 100)", v.completion_rate, 0);
}

// ── Caso 5 · la consulta pide `hora` ────────────────────────────────────────
{
  const pide = /\.from\("sesiones_registro"\)\s*\n\s*\.select\("([^"]+)"\)/.exec(src);
  const cols = pide ? pide[1].split(",").map((c) => c.trim()) : [];
  chequeo("el select incluye 'hora'", cols.includes("hora") ? 1 : 0, 1);
  chequeo("el select incluye 'estado'", cols.includes("estado") ? 1 : 0, 1);
}

console.log(fallos === 0 ? "\nINC-B: todas las comprobaciones pasan." : `\nINC-B: ${fallos} comprobacion(es) fallan.`);
process.exit(fallos === 0 ? 0 : 1);
