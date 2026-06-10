/**
 * ANÁLISIS DE BACKUP — para el reporte de testing diario
 *
 * Responde la pregunta de Micaela: "¿mis backups están funcionando?"
 * Mira dos cosas distintas y complementarias:
 *
 *   1. EL JOB de backup — ¿corrió el workflow de backup y terminó OK hace poco?
 *      (consulta la API de GitHub Actions con GH_TOKEN)
 *   2. LA FUENTE del backup — ¿las tablas que el backup exporta siguen accesibles
 *      y tienen datos? (consulta Supabase) Si una tabla deja de responder, el
 *      próximo backup saldría vacío o incompleto SIN avisar.
 *
 * Escribe tests/results/backup-status.json, que generate-report.js lee y
 * renderiza como sección "💾 Análisis de Backup" en el email.
 *
 * No tira excepción nunca: si falta el token o la red falla, deja el dato en
 * 'desconocido' para no romper el reporte.
 *
 * Uso (en GitHub Actions, tras los tests):
 *   GH_TOKEN=... GITHUB_REPOSITORY=owner/repo node tests/backup-check.js
 */

const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, 'results', 'backup-status.json');

// Mismas tablas que exporta scripts/backup-export.js (la data irremplazable).
const BACKUP_TABLES = [
  'candidatos', 'usuarios', 'informes', 'cv_publicados', 'cv_express',
  'contactos_chat', 'leads_pricing', 'solicitudes', 'site_context',
  'analytics_reports', 'push_subscriptions',
];
// Tablas que NO pueden estar vacías (si lo están, algo se borró/rompió).
const MUST_HAVE_DATA = ['candidatos', 'usuarios'];

// Workflows de backup en .github/workflows (el testing mira ambos y se queda
// con el más reciente que haya terminado OK).
const BACKUP_WORKFLOWS = ['backup.yml', 'supabase-backup.yml'];

const SB_URL = 'https://ddxnrsnjdvtqhxunxnwj.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkeG5yc25qZHZ0cWh4dW54bndqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxNDk5MzksImV4cCI6MjA5MDcyNTkzOX0.t82X1x-PDgFDGYhKC7YXoRKhga9I8Hjet60QUYvtZLU';
const SB_HEADERS = { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` };

// ── 1. El JOB: última corrida de los workflows de backup ───────────────
async function checkBackupJob() {
  const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPOSITORY; // "owner/repo"
  if (!token || !repo) {
    return { state: 'desconocido', note: 'Sin GH_TOKEN/GITHUB_REPOSITORY — no se pudo consultar GitHub Actions' };
  }

  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'pathway-testing-agent',
  };

  let best = null; // la corrida más reciente entre todos los workflows
  for (const wf of BACKUP_WORKFLOWS) {
    try {
      const url = `https://api.github.com/repos/${repo}/actions/workflows/${wf}/runs?per_page=1`;
      const res = await fetch(url, { headers });
      if (!res.ok) continue;
      const data = await res.json();
      const run = (data.workflow_runs || [])[0];
      if (!run) continue;
      const created = new Date(run.created_at).getTime();
      if (!best || created > best.created) {
        best = {
          workflow: wf,
          conclusion: run.conclusion,           // success | failure | cancelled | null (en curso)
          status: run.status,                    // completed | in_progress | queued
          created,
          createdAt: run.created_at,
          url: run.html_url,
        };
      }
    } catch (e) { /* probar el siguiente workflow */ }
  }

  if (!best) {
    return { state: 'desconocido', note: 'No se encontraron corridas de los workflows de backup' };
  }

  const ageHours = (Date.now() - best.created) / 36e5;
  let state;
  if (best.status !== 'completed') {
    state = 'en_curso';
  } else if (best.conclusion === 'success') {
    // Backup diario: si la última exitosa tiene más de 26h, se está atrasando.
    state = ageHours <= 26 ? 'ok' : 'atrasado';
  } else {
    state = 'fallo';
  }

  return {
    state,
    workflow: best.workflow,
    conclusion: best.conclusion,
    createdAt: best.createdAt,
    ageHours: Math.round(ageHours * 10) / 10,
    url: best.url,
  };
}

// ── 2. La FUENTE: tablas del backup accesibles y con datos ─────────────
async function checkBackupSource() {
  const tables = [];
  for (const t of BACKUP_TABLES) {
    try {
      const res = await fetch(
        `${SB_URL}/rest/v1/${t}?select=id&limit=1`,
        { headers: { ...SB_HEADERS, Prefer: 'count=exact' } }
      );
      if (res.status === 404) {
        // La tabla no existe (todavía) — no es un error de backup.
        tables.push({ name: t, reachable: true, exists: false, count: 0 });
        continue;
      }
      if (!res.ok) {
        tables.push({ name: t, reachable: false, exists: null, count: null });
        continue;
      }
      const range = res.headers.get('content-range'); // "0-0/123"
      const count = range ? parseInt(range.split('/')[1], 10) : null;
      tables.push({ name: t, reachable: true, exists: true, count: Number.isFinite(count) ? count : null });
    } catch (e) {
      tables.push({ name: t, reachable: false, exists: null, count: null });
    }
  }
  return tables;
}

(async function () {
  const job = await checkBackupJob();
  const tables = await checkBackupSource();

  const unreachable = tables.filter(t => t.reachable === false).map(t => t.name);
  const empty = tables.filter(t => MUST_HAVE_DATA.includes(t.name) && t.exists && t.count === 0).map(t => t.name);

  const notes = [];
  if (unreachable.length) notes.push(`Tablas sin responder: ${unreachable.join(', ')} — el backup saldría incompleto.`);
  if (empty.length) notes.push(`Tablas críticas vacías: ${empty.join(', ')} — revisar si se perdieron datos.`);
  if (job.state === 'fallo') notes.push(`El último job de backup (${job.workflow}) terminó con error.`);
  if (job.state === 'atrasado') notes.push(`El último backup OK fue hace ${job.ageHours}h (debería ser diario).`);
  if (job.state === 'desconocido') notes.push(job.note || 'No se pudo verificar el job de backup.');

  // Estado general del backup.
  let status = 'ok';
  if (unreachable.length || empty.length || job.state === 'fallo') status = 'critical';
  else if (job.state === 'atrasado' || job.state === 'desconocido') status = 'warning';

  const result = {
    checkedAt: new Date().toISOString(),
    status,                 // ok | warning | critical
    job,
    tables,
    summary: {
      tablasOk: tables.filter(t => t.reachable !== false).length,
      tablasTotal: tables.length,
      unreachable,
      empty,
    },
    notes,
  };

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(result, null, 2));

  console.log(`💾 Análisis de backup: ${status.toUpperCase()}`);
  console.log(`   Job: ${job.state}${job.ageHours != null ? ` (hace ${job.ageHours}h)` : ''}`);
  console.log(`   Tablas: ${result.summary.tablasOk}/${result.summary.tablasTotal} accesibles`);
  if (notes.length) notes.forEach(n => console.log(`   ⚠️  ${n}`));
})().catch(err => {
  // Nunca romper el reporte por esto.
  console.error('backup-check error (no fatal):', err.message);
  try {
    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT, JSON.stringify({
      checkedAt: new Date().toISOString(),
      status: 'warning',
      job: { state: 'desconocido' },
      tables: [],
      notes: ['No se pudo completar el análisis de backup: ' + err.message],
    }, null, 2));
  } catch (e) { /* nada más que hacer */ }
});
