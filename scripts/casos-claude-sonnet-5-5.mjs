/**
 * Casos de uso de las cuatro funciones de texto de Claude, para la migración
 * de claude-sonnet-4-5 (se retira el 30-11-2026) a claude-sonnet-5-5.
 *
 * Los usan las DOS pruebas:
 *   · probar-migracion-sonnet-5-5.mjs — contrato, sin red ni clave.
 *   · comparar-sonnet-4-5-vs-5-5.mjs  — comparación real contra la API.
 *
 * Todas las entradas son INVENTADAS: ninguna persona, correo ni coach real.
 * Cubren cada ruta que el frontend usa hoy (comprobado con grep sobre los
 * HTML que llaman a cada función):
 *
 *   generar-informe · generar_informe carrera / fitness / life (panel-v2,
 *                     formulario) · sugerir_empleos (cliente) · cv_express
 *                     ES y EN: CV + CARTA + LinkedIn (cv-express) ·
 *                     traducir_express (pw-express-lang) · analizar_linkedin
 *                     (cliente, panel-v2)
 *   ia-pathway      · chat del coach · chat del cliente con contexto · varios
 *                     turnos · pregunta que debe escalar
 *   recomendar-coach · con área y sin área (coaches.html)
 *   generar-perfil-coach · español e inglés (panel-v2)
 *
 * `comprobar(status, json)` devuelve la lista de fallos ESTRUCTURALES: lo que
 * el frontend necesita para pintar. La calidad del texto se juzga leyendo el
 * informe de la comparación, no con una expresión regular.
 */

const CV = `María Ejemplo — Analista de datos. 6 años de experiencia.
Empresa Uno (2021-hoy): analista senior; automatizó reportes en Python y SQL, redujo 40% el tiempo de cierre mensual.
Empresa Dos (2018-2021): analista junior; dashboards en Power BI para ventas.
Educación: Lic. en Economía, Universidad Ejemplo (2017). Inglés avanzado.`;

const LINKEDIN = `Titular: Analista de datos | SQL | Python | Power BI
Acerca de: Me gustan los números y resolver problemas. Trabajo con datos desde 2018.
Experiencia: Empresa Uno — Analista senior. Empresa Dos — Analista.`;

const HAY = (o, k) => o && o[k] !== undefined && o[k] !== null && o[k] !== '';
const ES_LISTA = (v, min = 1) => Array.isArray(v) && v.length >= min;

function comprobarInforme(status, j) {
  const f = [];
  if (status !== 200) return [`status ${status}`];
  if (!j || j.ok !== true) f.push('falta ok:true');
  const i = j && j.informe;
  if (!i || typeof i !== 'object') return [...f, 'falta informe'];
  for (const k of ['resumen', 'fortalezas', 'gaps', 'estrategia', 'mensaje_candidato']) if (!HAY(i, k)) f.push(`informe sin ${k}`);
  for (const k of ['cv_acciones', 'linkedin_acciones', 'networking_acciones']) {
    if (!ES_LISTA(i[k], 3)) f.push(`${k}: menos de 3 acciones`);
    else if (i[k].length > 5) f.push(`${k}: más de 5 acciones`);
  }
  return f;
}

export const COACHES = [
  { id: 'c1', nombre: 'Coach Carrera Uno', slug: 'coach-carrera-uno', titulo_profesional: 'Coach de carrera', tagline: 'Te ayudo a cambiar de trabajo', bio: 'Acompaño transiciones profesionales en tecnología y finanzas.', especialidades: ['carrera', 'entrevistas'], atiende: 'Online, LATAM', foto_url: null, configuracion: { coach_type: 'carrera', ideal_para: ['Cambiar de trabajo', 'Preparar entrevistas'], estado_sub: 'activa' }, activo: true, perfil_publico_activo: true },
  { id: 'c2', nombre: 'Coach Fitness Dos', slug: 'coach-fitness-dos', titulo_profesional: 'Entrenadora personal', tagline: 'Fuerza y hábitos', bio: 'Planes de fuerza para principiantes.', especialidades: ['fitness'], atiende: 'Online', foto_url: null, configuracion: { coach_type: 'fitness', estado_sub: 'activa' }, activo: true, perfil_publico_activo: true },
  { id: 'c3', nombre: 'Coach Life Tres', slug: 'coach-life-tres', titulo_profesional: 'Life coach', tagline: 'Claridad y propósito', bio: 'Procesos de autoconocimiento y metas personales.', especialidades: ['life'], atiende: 'Online, España', foto_url: null, configuracion: { coach_type: 'life', estado_sub: 'activa' }, activo: true, perfil_publico_activo: true },
  { id: 'c4', nombre: 'Coach Carrera Cuatro', slug: 'coach-carrera-cuatro', titulo_profesional: 'Especialista en LinkedIn', tagline: 'Tu perfil, visible', bio: 'Optimizo perfiles de LinkedIn para perfiles técnicos.', especialidades: ['carrera', 'linkedin'], atiende: 'Online', foto_url: null, configuracion: { coach_type: 'carrera', estado_sub: 'activa' }, activo: true, perfil_publico_activo: true },
];
const SLUGS = new Set(COACHES.map((c) => c.slug));

export const CASOS = [
  // ── generar-informe ──────────────────────────────────────────────────────
  {
    id: 'informe-carrera', fn: 'generar-informe',
    body: { nombre: 'María Ejemplo', edad: '31', experiencia: '6 años como analista de datos', sector: 'Finanzas', rol: 'Analista senior', educacion: 'Lic. en Economía', habilidades: 'SQL, Python, Power BI', objetivo: 'Pasar a un rol de Data Scientist en una fintech', idiomas: 'Español nativo, inglés avanzado', ubicacion: 'Buenos Aires', situacion: 'Empleada', urgencia: '3-6 meses', modalidad: 'Remoto', obstaculos: 'No sé cómo mostrar proyectos de ML sin experiencia formal' },
    comprobar: comprobarInforme,
  },
  {
    id: 'informe-fitness', fn: 'generar-informe',
    body: { nicho: 'fitness', nombre: 'Juan Ejemplo', edad: '38', objetivo: 'Bajar 6 kg y ganar fuerza sin lesionarme', situacion: 'Sedentario, trabajo de oficina', experiencia: 'Gimnasio hace 5 años, lo dejé', habilidades: 'Disponibilidad: 3 días por semana, 45 minutos', obstaculos: 'Dolor lumbar ocasional, poco tiempo', urgencia: '3 meses' },
    comprobar: comprobarInforme,
  },
  {
    id: 'informe-life', fn: 'generar-informe',
    body: { nicho: 'life', nombre: 'Lucía Ejemplo', edad: '44', objetivo: 'Recuperar el equilibrio entre trabajo y familia y decidir si cambio de ciudad', situacion: 'Directora de área, dos hijos', obstaculos: 'Me cuesta poner límites, siento culpa', urgencia: 'Este año' },
    comprobar: comprobarInforme,
  },
  {
    id: 'sugerir-empleos', fn: 'generar-informe',
    body: { accion: 'sugerir_empleos', objetivo: 'Data Scientist en fintech', sector: 'Finanzas', ubicacion: 'Buenos Aires', modalidad: 'Remoto', fortalezas: 'SQL, Python, automatización', estrategia: 'Mostrar proyectos con impacto medible' },
    comprobar(status, j) {
      if (status !== 200) return [`status ${status}`];
      const f = [];
      if (!ES_LISTA(j && j.empleos, 3)) f.push('empleos: menos de 3');
      else for (const [n, e] of j.empleos.entries()) if (!HAY(e, 'titulo')) f.push(`empleo ${n} sin título`);
      return f;
    },
  },
  {
    id: 'cv-express-es', fn: 'generar-informe',
    body: { accion: 'cv_express', objetivo: 'Conseguir un puesto de Data Scientist en una fintech en 6 meses', cv_texto: CV, linkedin_url: 'https://www.linkedin.com/in/ejemplo', linkedin_texto: LINKEDIN, idioma: 'es' },
    comprobar: comprobarCvExpress,
  },
  {
    id: 'cv-express-en', fn: 'generar-informe',
    body: { accion: 'cv_express', objetivo: 'Get a Data Scientist role at a fintech company within 6 months', cv_texto: CV, linkedin_url: 'https://www.linkedin.com/in/ejemplo', idioma: 'en' },
    comprobar(status, j) {
      const f = comprobarCvExpress(status, j);
      // Idioma: la carta tiene que estar en inglés (el prompt lo exige).
      const carta = String((j && j.carta) || '');
      if (carta && /\b(estimad|atentamente|saludos)\b/i.test(carta)) f.push('carta EN con palabras en español');
      return f;
    },
  },
  {
    id: 'traducir-express', fn: 'generar-informe',
    body: { accion: 'traducir_express', idioma: 'en', carta: 'Estimado equipo de selección:\n\nMe postulo al puesto de Data Scientist. En mis seis años como analista automaticé reportes y reduje un 40% el tiempo de cierre mensual.\n\nAtentamente,\nMaría Ejemplo', cv_optimizado: { nombre: 'María Ejemplo', rol_objetivo: 'Data Scientist', competencias: ['SQL', 'Python', 'Visualización de datos'] } },
    comprobar(status, j) {
      if (status !== 200) return [`status ${status}`];
      const f = [];
      if (!j || j.ok !== true) f.push('falta ok:true');
      if (j && j.warning) f.push(`warning: ${j.warning}`);
      if (!HAY(j, 'carta')) f.push('falta carta traducida');
      else if (/\b(estimad|atentamente)\b/i.test(j.carta)) f.push('la carta sigue en español');
      if (!HAY(j, 'cv_optimizado')) f.push('falta cv_optimizado traducido');
      return f;
    },
  },
  {
    id: 'analizar-linkedin', fn: 'generar-informe',
    body: { accion: 'analizar_linkedin', nombre: 'María Ejemplo', rol: 'Analista senior', sector: 'Finanzas', linkedin_texto: LINKEDIN, objetivo: 'Data Scientist' },
    comprobar(status, j) {
      if (status !== 200) return [`status ${status}`];
      const a = j && j.analisis;
      if (!j || j.ok !== true || !a || typeof a !== 'object') return ['falta analisis'];
      const f = [];
      for (const k of ['titular_propuesto', 'acerca_de_propuesto']) if (!HAY(a, k)) f.push(`analisis sin ${k}`);
      return f;
    },
  },

  // ── ia-pathway ───────────────────────────────────────────────────────────
  {
    id: 'chat-coach', fn: 'ia-pathway',
    body: { mode: 'coach', page: '/panel-v2.html', messages: [{ role: 'user', content: '¿Cómo invito a un cliente nuevo?' }] },
    comprobar: comprobarChat,
  },
  {
    id: 'chat-cliente-contexto', fn: 'ia-pathway',
    body: { mode: 'cliente', page: '/cliente.html', messages: [{ role: 'user', content: '¿Qué tengo que hacer esta semana?' }], context: { perfil: 'Objetivo: pasar a Data Scientist. Semana 2 de 6: CV optimizado.', agenda: 'Jueves 18:00 sesión con su coach.' } },
    comprobar: comprobarChat,
  },
  {
    id: 'chat-varios-turnos', fn: 'ia-pathway',
    body: { mode: 'cliente', messages: [
      { role: 'user', content: 'Hola, ¿dónde veo mi CV?' },
      { role: 'assistant', content: 'Lo encontrás en tu portal, en la sección de documentos.' },
      { role: 'user', content: 'Gracias. ¿Y cómo agendo una sesión?' },
    ] },
    comprobar: comprobarChat,
  },
  {
    id: 'chat-fuera-de-alcance', fn: 'ia-pathway',
    body: { mode: 'coach', messages: [{ role: 'user', content: 'Necesito que me devuelvan el dinero de la suscripción del mes pasado, ¿podés hacerlo vos?' }] },
    // Aquí lo esperado es que ESCALE. Se registra; no se exige, porque decidir
    // cuándo escalar es criterio del modelo y se compara leyendo.
    comprobar: comprobarChat,
  },

  // ── recomendar-coach ─────────────────────────────────────────────────────
  {
    id: 'recomendar-con-area', fn: 'recomendar-coach',
    body: { objetivo: 'Quiero mejorar mi perfil de LinkedIn para conseguir entrevistas en tecnología', area: 'carrera', pais: 'Argentina' },
    comprobar: comprobarRecomendar,
  },
  {
    id: 'recomendar-sin-area', fn: 'recomendar-coach',
    body: { objetivo: 'Siento que perdí el rumbo y quiero ordenar mis prioridades personales' },
    comprobar: comprobarRecomendar,
  },

  // ── generar-perfil-coach ─────────────────────────────────────────────────
  {
    id: 'perfil-coach-es', fn: 'generar-perfil-coach',
    body: { nombre: 'Coach Ejemplo', profesion: 'Coach de carrera certificada', ayuda: 'Ayudo a profesionales de tecnología a cambiar de trabajo y negociar mejor su salario', pais: 'México', especialidades: ['Entrevistas', 'LinkedIn'] },
    comprobar: comprobarPerfil,
  },
  {
    id: 'perfil-coach-en', fn: 'generar-perfil-coach',
    body: { nombre: 'Coach Example', profesion: 'Certified career coach', ayuda: 'I help tech professionals switch jobs and negotiate better pay', pais: 'United States', especialidades: ['Interviews'], lang: 'en' },
    comprobar: comprobarPerfil,
  },
];

function comprobarCvExpress(status, j) {
  if (status !== 200) return [`status ${status}`];
  const f = [];
  if (!j || j.ok === false) f.push('respuesta sin ok');
  if (!j || !j.cv_optimizado || typeof j.cv_optimizado !== 'object') f.push('falta cv_optimizado');
  else if (!ES_LISTA(j.cv_optimizado.experiencia)) f.push('cv_optimizado sin experiencia');
  if (!HAY(j, 'carta') || String(j.carta).length < 300) f.push('carta ausente o corta');
  if (!j || !j.linkedin_analisis) f.push('falta linkedin_analisis');
  if (j && j.warning) f.push(`warning: ${j.warning}`);
  return f;
}

function comprobarChat(status, j) {
  if (status !== 200) return [`status ${status}`];
  const f = [];
  if (!HAY(j, 'reply')) f.push('reply vacío');
  else if (j.reply === 'No estoy segura de poder ayudarte con eso desde aquí.') f.push('reply = respaldo de texto vacío');
  else if (j.reply === 'Ahora mismo no puedo responderte.') f.push('reply = respaldo de error');
  if (j && j.error) f.push(`error: ${j.error}`);
  if (/<\/?(thinking|antml|reasoning)/i.test(String(j && j.reply))) f.push('etiquetas internas en el texto');
  return f;
}

function comprobarRecomendar(status, j) {
  if (status !== 200) return [`status ${status}`];
  const r = j && j.recomendados;
  if (!ES_LISTA(r)) return ['ninguna recomendación'];
  const f = [];
  for (const x of r) {
    if (!SLUGS.has(x.slug)) f.push(`slug inventado: ${x.slug}`);
    if (!HAY(x, 'razon')) f.push(`${x.slug} sin razón`);
  }
  if (r.length > 3) f.push('más de 3');
  return f;
}

function comprobarPerfil(status, j) {
  if (status !== 200) return [`status ${status}`];
  const f = [];
  for (const k of ['titulo', 'tagline', 'bio']) if (!HAY(j, k)) f.push(`perfil sin ${k}`);
  for (const k of ['especialidades', 'ideal_para']) if (!ES_LISTA(j && j[k])) f.push(`perfil sin ${k}`);
  return f;
}
