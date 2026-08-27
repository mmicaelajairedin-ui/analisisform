/**
 * e2e-guard.js — Impide que una ejecución local o ad-hoc escriba en PRODUCCIÓN.
 *
 * POR QUÉ EXISTE
 * Los 27 clientes, 13 usuarios y 2 organizaciones de test que hay hoy en la base
 * real no los creó el cron diario (medido: 0 candidatos nuevos el 25, 26 y 27 de
 * agosto). Los creó una ejecución LOCAL: `run-tests-local.js` sirve la página en
 * `127.0.0.1`, pero la página lleva el backend de producción hardcodeado, así
 * que "local" solo describe dónde vive el HTML, no contra qué base escribe.
 *
 * DISEÑO — las cinco propiedades que pide A-4
 *  1. Identifica el entorno de CADA destino resuelto, no del proceso.
 *  2. Rechaza producción en ejecución local.
 *  3. Solo permite el destino declarado en PW_E2E_TARGET.
 *  4. Falla cerrado: sin PW_E2E_TARGET no se ejecuta nada.
 *  5. Nombra el destino rechazado y por qué.
 *
 * Y LA SEXTA, LA IMPORTANTE
 * No depende solo de una variable que el propio script pueda sobrescribir: la
 * lista de producción está DENTRO de este fichero y se evalúa sobre los destinos
 * REALES que el script declara. Aunque alguien exporte PW_E2E_TARGET=staging, si
 * el destino resuelto apunta a producción, se rechaza igual. La variable habilita;
 * no autoriza.
 */

'use strict';

/** Señales de producción. Hardcodeadas a propósito: es el ancla del guard. */
const PRODUCCION = [
  'pathwaycareercoach.com',
  'api.pathwaycareercoach.com',
  'analisisform.pages.dev',
  'ddxnrsnjdvtqhxunxnwj',            // project ref de producción
  'ddxnrsnjdvtqhxunxnwj.supabase.co',
];

/** `nwl` es el ref inválido de las seis claves anon rotas. No es producción,
 *  pero tampoco es un destino de test válido: se trata como no declarado. */
const REFS_INVALIDOS = ['ddxnrsnjdvtqhxunxnwl'];

function esProduccion(valor) {
  const v = String(valor || '').toLowerCase();
  return PRODUCCION.filter((señal) => v.includes(señal));
}

function bloque(lineas) {
  const ancho = Math.max(...lineas.map((l) => l.length)) + 2;
  const barra = '━'.repeat(ancho);
  return `\n${barra}\n${lineas.join('\n')}\n${barra}\n`;
}

/**
 * Comprueba TODOS los destinos antes de cualquier escritura. Lanza si alguno
 * apunta a producción, o si no se declaró entorno.
 *
 * @param {string} script  Nombre del script, para el mensaje.
 * @param {Array<{etiqueta:string, valor:string}>} destinos
 *        Todo sitio donde el script pueda escribir: la URL que abre el
 *        navegador, la URL de Supabase, y —clave— el backend que use la PÁGINA
 *        que se está manejando, aunque se sirva desde localhost.
 */
function assertDestinoSeguro(script, destinos) {
  const target = process.env.PW_E2E_TARGET;

  // (4) Falla cerrado: sin declaración explícita no se ejecuta.
  if (!target) {
    throw new Error(bloque([
      `  ${script}: no se declaró entorno de destino.`,
      '',
      '  Este script escribe datos. Declara explícitamente contra qué base:',
      '      PW_E2E_TARGET=<entorno> node ' + script,
      '',
      '  No se asume producción por defecto (A-4 del runbook de remediación).',
    ]));
  }

  // (1)(2)(5) El destino REAL manda sobre lo que diga la variable.
  const infractores = [];
  for (const d of destinos) {
    const señales = esProduccion(d.valor);
    if (señales.length) infractores.push({ ...d, señales });
  }

  if (infractores.length) {
    throw new Error(bloque([
      `  ${script}: DESTINO DE PRODUCCIÓN RECHAZADO.`,
      '',
      ...infractores.flatMap((i) => [
        `    ${i.etiqueta}`,
        `      valor  : ${i.valor}`,
        `      motivo : coincide con ${i.señales.join(', ')}`,
      ]),
      '',
      `  PW_E2E_TARGET=${target} no autoriza escribir en producción.`,
      '  La lista de producción vive en scripts/e2e-guard.js y no se puede',
      '  desactivar desde el script que se está ejecutando.',
      '',
      '  Si el destino es una PÁGINA servida en localhost, recuerda que la',
      '  página puede llevar su propio backend hardcodeado: eso también cuenta',
      '  como escribir en producción.',
    ]));
  }

  const invalidos = destinos.filter((d) =>
    REFS_INVALIDOS.some((r) => String(d.valor || '').toLowerCase().includes(r)));
  if (invalidos.length) {
    throw new Error(bloque([
      `  ${script}: destino con project ref INVÁLIDO.`,
      ...invalidos.map((i) => `    ${i.etiqueta}: ${i.valor}`),
      '',
      '  Ese ref no corresponde a ningún proyecto: las peticiones fallarán con 401.',
    ]));
  }

  console.log(`✓ [e2e-guard] destino declarado "${target}" — ${destinos.length} comprobado(s), ninguno es producción.`);
}

module.exports = { assertDestinoSeguro, esProduccion, PRODUCCION };
