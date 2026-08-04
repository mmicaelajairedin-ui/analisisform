// Business Identity Engine — Fase 2
// Ejemplos diferenciados POR ESPECIALIDAD — estructura, copy y tonalidad radicalmente distintas

const BUSINESS_IDENTITY_EXAMPLES_FASE2 = {
  fitness: {
    nombre: 'Bot Gym',
    especialidad: 'fitness',
    pais: 'España',
    idiomas: ['es', 'en'],

    // Posicionamiento
    qué_haces: 'Entreno a mujeres ocupadas para que logren resultados sostenibles sin sacrificar su vida social',
    a_quién_ayudas: 'Mujeres de 25 a 45 años que quieren perder peso pero no tienen tiempo de estar en el gym 2 horas',
    problema_resuelve: 'La mayoría de dietas fallan porque son insostenibles. Creamos un plan que se adapta a tu vida, no tu vida a la dieta.',
    cómo_trabajas: 'Plan personalizado + entrenamiento 3x por semana + seguimiento semanal. Sin culpa, sin restricción extrema.',
    servicios: ['Valoración gratuita', 'Entrenamiento personalizado', 'Seguimiento semanal', 'Nutrición adaptada', 'Comunidad privada'],
    resultados_clientes: ['+350 clientes transformados', 'Pérdida promedio: 8kg en 12 semanas', '92% completan el programa'],
    tono: 'directo',
    cta_texto: 'Reservar valoración gratuita',
    cta_url: 'https://calendly.com/botgym',

    // ESTRATEGIA FITNESS: Visual + Transformación + Comunidad
    landing_style: {
      primary_color: '#EC4899',
      accent_color: '#F97316',
      bg_pattern: 'gradient-peach',
      emoji_icon: '💪'
    },
    landing_sections: ['hero', 'before-after', 'benefits-checklist', 'testimonials-carousel', 'community-preview', 'plan-options', 'faq', 'cta'],

    // Hero fitness: enfoque en transformación visible
    landing_hero: 'Consigue resultados que se VEN en 12 semanas. Sin culpa.',
    landing_subhero: '350 mujeres ya pasaron de "me veo hinchada" a "me reconozco en fotos". El sistema es simple: plan adaptado + entrenamiento real + soporte que funciona.',

    // Before/After section único de fitness
    before_after: [
      { name: 'María C.', weeks: 12, kg_lost: 12, photo_before: '👩 Frustrada', photo_after: '💃 Transformada' },
      { name: 'Alejandra R.', weeks: 8, kg_lost: 9, photo_before: '😓 Cansada', photo_after: '🔥 Con energía' },
      { name: 'Sandra L.', weeks: 16, kg_lost: 18, photo_before: '😞 Desanimada', photo_after: '⭐ Confiada' }
    ],

    landing_benefits: [
      { title: '💪 Entrenos que SE SIENTEN', desc: 'No es monotonía. Cada semana es diferente. Tu cuerpo no se aburre, tú tampoco.' },
      { title: '🍽️ Nutrición que vive contigo', desc: 'Comidas que te gustan. Sin listas de prohibidos. Come pizza el viernes si quieres.' },
      { title: '📱 Seguimiento real', desc: 'No es "espío tu móvil". Es "mira, aquí está lo que cambió y por qué".' },
      { title: '👯 Comunidad que entiende', desc: '350 mujeres en tu mismo viaje. Desahogo real, no fake motivacional.' }
    ],

    landing_faq: [
      { q: '¿En cuánto tiempo veo cambios?', a: 'Entre 3-4 semanas ves cambios internos. A los 2 meses ya es evidente en el espejo. Fotos a los 3 meses = impacto visual.' },
      { q: '¿Tengo que ir al gym?', a: 'No obligatorio. 70% de mis clientes entrena online desde casa. 30% prefiere presencial. Lo adaptamos a ti.' },
      { q: '¿Qué pasa si me estanco?', a: 'Normalmente no pasa. Si ocurre, rediseñamos tu plan. He visto estancamientos de 2 semanas max, no más.' },
      { q: '¿Es compatible con mi trabajo estresante?', a: 'Al contrario. La gente ocupada progresa MÁS porque se enfoca. Es como meditar: 45 min para ti y el resto fluye mejor.' }
    ],

    testimonios: [
      { name: 'María García', role: 'Ejecutiva', time: '12 semanas', result: '-12kg', quote: 'Perdí 12 kg en 6 meses sin dejar de disfrutar la comida. Es lo que faltaba. Ahora tengo energía toda la jornada.' },
      { name: 'Alejandra Ruiz', role: 'Freelancer', time: '8 semanas', result: '-9kg', quote: 'Después de 10 dietas fracasadas, esto fue diferente. No es magia, es ciencia. Y funciona.' },
      { name: 'Sandra López', role: 'Mamá de 2', time: '16 semanas', result: '-18kg', quote: 'Pensé que siendo mamá no había chance. Él me hizo ver que el tiempo de ejercicio es MY TIME. Cambió mi vida.' }
    ],

    community_preview: {
      members: '350+',
      posts_weekly: '120+',
      themes: ['Recetas que transforman', 'Entrenamientos rápidos', 'Mindset de transformación', 'Vidas antes/después']
    },

    seo_title: 'Entrenadora personal fitness online | Resultados reales sostenibles',
    seo_description: 'Plan de fitness personalizado para mujeres. 350+ transformadas. Resultados en 12 semanas sin restricción extrema.',
    seo_keywords: ['entrenadora personal', 'fitness para mujeres', 'pérdida de peso sostenible', 'entrenamiento online', 'nutrición flexible']
  },

  carrera: {
    nombre: 'Career Coach Laura',
    especialidad: 'carrera',
    pais: 'Argentina',
    idiomas: ['es'],

    // Posicionamiento
    qué_haces: 'Ayudo a profesionales a encontrar trabajos que les paguen 30% más en menos de 90 días',
    a_quién_ayudas: 'Profesionales de 28 a 45 años atrapados en roles que no valorizan su talento',
    problema_resuelve: 'La mayoría no sabe cómo posicionarse realmente. Envían CV genéricos a ofertas genéricas y se frustan.',
    cómo_trabajas: 'Mapeamos tu valor real, construimos tu estrategia de búsqueda y te preparamos para que la entrevista sea una negociación.',
    servicios: ['Análisis de posicionamiento', 'Estrategia de búsqueda', 'Preparación de entrevistas', 'Negociación de salario', 'LinkedIn mastery'],
    resultados_clientes: ['+180 profesionales colocados', 'Incremento promedio de salario: 32%', '85% consiguen trabajo en primera oferta'],
    tono: 'profesional',
    cta_texto: 'Agendar sesión exploratoria',
    cta_url: 'https://calendly.com/lauracareercoach',

    // ESTRATEGIA CARRERA: Datos + ROI + Trayectoria
    landing_style: {
      primary_color: '#0F766E',
      accent_color: '#06B6D4',
      bg_pattern: 'gradient-blue',
      emoji_icon: '📈'
    },
    landing_sections: ['hero', 'salary-before-after', 'placement-stats', 'job-titles', 'testimonials-professional', 'process-timeline', 'faq', 'cta'],

    // Hero carrera: enfoque en cifras y seguridad
    landing_hero: 'De $3.500 a $5.100 en 90 días. No es suerte. Es estrategia probada.',
    landing_subhero: '180 profesionales colocados. El 85% consigue trabajo en su PRIMERA oferta. Nosotros no buscamos empleos, posicionamos profesionales que los empleadores persiguen.',

    // Salary tracking (antes/después)
    salary_progression: [
      { role: 'Senior Dev', from: 4500, to: 6200, company_examples: 'Google, Mercado Libre' },
      { role: 'Product Manager', from: 5000, to: 7100, company_examples: 'Amazon, startups VC' },
      { role: 'Designer UX', from: 3800, to: 5200, company_examples: 'Globant, Accenture' }
    ],

    landing_benefits: [
      { title: '🎯 Posicionamiento claro', desc: 'Descubrimos EXACTAMENTE qué te hace diferente y por qué vales ese dinero.' },
      { title: '📊 Estrategia de búsqueda', desc: 'Dónde buscar, qué empresas contratan gente como tú, a quién hablar primero.' },
      { title: '🤝 Entrevistas que funciona', desc: 'Simulaciones reales. Las preguntas más difíciles, practicadas hasta dominarlas.' },
      { title: '💰 Negociación de salario', desc: 'Hablamos de dinero sin vergüenza. Tu oferta inicial sube $1.000-$1.500 en promedio.' }
    ],

    landing_faq: [
      { q: '¿Cuánto tiempo toma conseguir trabajo?', a: 'Promedio: 45 días con estrategia. Sin estrategia, 4-6 meses. La diferencia es mapeo + approach correcto.' },
      { q: '¿Qué pasa si no consigo trabajo?', a: 'Garantía: Si en 90 días no tienes oferta con aumento, te devolvemos 50% y continuamos gratis.' },
      { q: '¿Funciona en todas las áreas?', a: 'Sí. Tech, finanzas, marketing, operaciones. El principio es el mismo: valor + estrategia + negociación.' },
      { q: '¿En qué empresas han colocado gente?', a: 'Google, Amazon, Mercado Libre, Globant, Accenture, Despegar, startups de Silicon Valley. Depende de tu perfil.' }
    ],

    testimonios: [
      { name: 'Diego Martínez', role: 'Senior Developer', time: '90 días', result: '$3.500 → $4.700 (+34%)', quote: 'Pasé de $3.500 a $4.700 en 4 meses. Pero lo mejor fue entender MI VALOR. Ahora negocio con seguridad.' },
      { name: 'Fernanda López', role: 'Product Manager', time: '60 días', result: '$4.200 → $5.800 (+38%)', quote: 'No sabía cómo hablar de mi valor. Laura me enseñó a venderme sin sonar arrogante. Ahora tengo 3 ofertas.' },
      { name: 'Carlos Ruiz', role: 'Tech Lead', time: '75 días', result: '$5.000 → $6.800 (+36%)', quote: 'Stakeado en mi empresa vieja, sin chances. En 75 días conseguí trabajo en Google con 36% más.' }
    ],

    process_timeline: [
      { week: 'Semana 1', step: 'Mapeo de tu valor + análisis de mercado' },
      { week: 'Semana 2-3', step: 'Estrategia de búsqueda + LinkedIn rebuild' },
      { week: 'Semana 4-6', step: 'Prep de entrevistas + simulaciones reales' },
      { week: 'Semana 7-12', step: 'Negociación + cierre de oferta' }
    ],

    seo_title: 'Career Coach | Consigue trabajo con 30% más de salario en 90 días',
    seo_description: '+180 colocados. Salarios 30-40% más altos. Estrategia probada. Garantía de resultados en 90 días.',
    seo_keywords: ['career coach', 'búsqueda empleo', 'preparación entrevistas', 'aumento salario', 'posicionamiento profesional']
  },

  nutricion: {
    nombre: 'Marta Nutrición',
    especialidad: 'nutricion',
    pais: 'Chile',
    idiomas: ['es'],

    // Posicionamiento
    qué_haces: 'Enseño a pacientes diabéticos a vivir sin angustia por la comida, con energía estable todo el día',
    a_quién_ayudas: 'Adultos diagnosticados con diabetes tipo 2 que quieren reversarla o estabilizarla sin medicinas extras',
    problema_resuelve: 'Les dicen "come menos carbos" pero nadie explica POR QUÉ ni les enseña a comer rico así.',
    cómo_trabajas: 'Programa de 12 semanas: reeducación nutricional + análisis de glucosa + recetas reales + seguimiento personalizado.',
    servicios: ['Análisis de glucosa', 'Plan nutricional personalizado', 'Reeducación alimentaria', 'Recetas adaptadas', 'Seguimiento semanal'],
    resultados_clientes: ['+120 pacientes en remisión', 'Reducción de glucosa: promedio 40 mg/dL', '78% discontinúan medicamentos'],
    tono: 'inspirador',
    cta_texto: 'Agendar consulta inicial',
    cta_url: 'https://calendly.com/marnutricion',

    // ESTRATEGIA NUTRICIÓN: Ciencia + Casos + Esperanza
    landing_style: {
      primary_color: '#16A34A',
      accent_color: '#84CC16',
      bg_pattern: 'gradient-green',
      emoji_icon: '🍎'
    },
    landing_sections: ['hero', 'science-section', 'patient-cases', 'glucose-metrics', 'testimonials-recovery', 'program-phases', 'faq', 'cta'],

    // Hero nutrición: esperanza + ciencia
    landing_hero: 'Tu diabetes NO es de por vida. La ciencia lo prueba cada semana.',
    landing_subhero: '120+ pacientes en remisión. No es magia, es reeducación. Tu cuerpo sabe cómo regularse, solo necesita aprender a hacerlo.',

    // Casos clínicos (no testimonios, datos reales)
    patient_cases: [
      { initials: 'C.S.', age: 52, baseline: 'Glucosa 280 mg/dL, 3 medicamentos', result: '12 sem: 110 mg/dL, medicamentos = 0', status: 'Remisión completa' },
      { initials: 'R.M.', age: 58, baseline: 'Glucosa 240 mg/dL, 2 medicamentos', result: '8 sem: 125 mg/dL, 1 medicamento', status: 'Mejora sustancial' },
      { initials: 'J.P.', age: 45, baseline: 'Pre-diabético, glucosa 130 mg/dL', result: '6 sem: 95 mg/dL, sin riesgo', status: 'Normalizado' }
    ],

    landing_benefits: [
      { title: '🧬 Ciencia que entiendo', desc: 'Aprendes POR QUÉ cada alimento impacta tu glucosa. No es magia, es biología.' },
      { title: '🍲 Comida de verdad', desc: 'Recetas que disfrutas. Con familia. Sin "menu especial". Tu abuela come lo mismo.' },
      { title: '📊 Datos en tiempo real', desc: 'Medimos glucosa, no promesas. Ves exactamente qué alimentos te despiertan.' },
      { title: '⚡ Energía real', desc: 'Sin picos/caídas de glucosa. Despiertas sin cansancio. Eso es vivir.' }
    ],

    landing_faq: [
      { q: '¿Puedo reversarla completamente?', a: 'Tipo 2: muy probablemente sí. Tipo 1 estabilizamos mucho y a veces bajamos insulina. Depende de tu caso, por eso la consulta es clave.' },
      { q: '¿Debo dejar de comer siempre así?', a: 'Aprendes el sistema. Algunos siguen de por vida porque SE SIENTEN BIEN. Otros varían. Tú decides.' },
      { q: '¿Funciona si aún tomo medicinas?', a: 'Sí. A veces reducimos dosis, a veces no. Tu doctor lo decide con tus números en mano.' },
      { q: '¿Qué pasa si tengo antojo de postre?', a: 'Comemos postre. Inteligentemente. Hay opciones que no demolizan tu glucosa. Nada prohibido.' }
    ],

    testimonios: [
      { name: 'Claudia P.', age: 52, time: '12 semanas', result: 'Glucosa: 280 → 110 mg/dL', quote: 'Me dijeron que era de por vida. En 3 meses casi normalicé mi glucosa. Ahora mi doctor está confundido (de bueno). Cambió todo.' },
      { name: 'Roberto T.', age: 58, time: '8 semanas', result: 'Medicamentos: 3 → 1', quote: 'Primera vez que un profesional me explica CÓMO funciona mi cuerpo, no solo qué comer. Entiendo mi diabetes ahora.' },
      { name: 'Silvia M.', age: 45, time: '6 semanas', result: 'Pre-diabética → Normal', quote: 'Atrapada en lo que comía. Ahora sé exactamente qué funciona para mi cuerpo. Libertad real.' }
    ],

    program_phases: [
      { phase: 'Fase 1', weeks: '1-3', focus: 'Evaluación + ciencia básica + recetas introductorias' },
      { phase: 'Fase 2', weeks: '4-8', focus: 'Optimización de glucosa + comidas en familia + tracking real' },
      { phase: 'Fase 3', weeks: '9-12', focus: 'Independencia + plan de por vida + seguimiento ocasional' }
    ],

    seo_title: 'Nutricionista diabetes | Reversión natural tipo 2',
    seo_description: 'Programa 12 semanas para reversionar diabetes tipo 2. +120 pacientes en remisión. Reeducación nutricional con ciencia.',
    seo_keywords: ['nutricionista diabetes', 'reversión diabetes tipo 2', 'glucosa', 'reeducación nutricional', 'plan personalizado']
  },

  productividad: {
    nombre: 'Automation Bot',
    especialidad: 'productividad',
    pais: 'México',
    idiomas: ['es', 'en'],

    // Posicionamiento
    qué_haces: 'Automatizo procesos repetitivos en empresas pequeñas para que recuperen 15-20 horas semanales',
    a_quién_ayudas: 'Emprendedores y equipos pequeños que pasan el día en tareas manuales sin valor agregado',
    problema_resuelve: 'No saben qué es automatizable. Pierden tiempo en tareas que una máquina hace en segundos.',
    cómo_trabajas: 'Audit de 2 semanas → Identificamos ahorros → Build de automaciones con Zapier, Make, AI → Handoff.',
    servicios: ['Audit de procesos', 'Automatización Zapier/Make', 'Integración IA', 'Training del equipo', 'Monitoreo 30 días'],
    resultados_clientes: ['+150 procesos automatizados', 'Recuperación promedio: 18 horas/semana', 'ROI en 6 semanas'],
    tono: 'directo',
    cta_texto: 'Agendar auditoría gratuita',
    cta_url: 'https://calendly.com/automationbot',

    // ESTRATEGIA PRODUCTIVIDAD: ROI + Procesos + Números
    landing_style: {
      primary_color: '#7C3AED',
      accent_color: '#A78BFA',
      bg_pattern: 'gradient-purple',
      emoji_icon: '⚙️'
    },
    landing_sections: ['hero', 'time-savings', 'process-examples', 'roi-calculator', 'case-studies', 'automations-gallery', 'faq', 'cta'],

    // Hero productividad: tiempo + dinero
    landing_hero: '18 horas por semana. En promedio. Sin contratar a nadie.',
    landing_subhero: '150 procesos ya automatizados. Tus tareas manuales son dinero perdido. En 2 semanas te digo cuánto puedes recuperar.',

    // Ejemplos de procesos automatizados
    automation_examples: [
      { process: 'Data entry CRM', time_saved: '8 horas/semana', cost: '$320/mes', status: '✅ Zapier sync' },
      { process: 'Emails masivos a clientes', time_saved: '5 horas/semana', cost: '$400/mes', status: '✅ Make + IA' },
      { process: 'Reportes de ventas', time_saved: '3 horas/semana', cost: '$150/mes', status: '✅ Zapier + Sheets' },
      { process: 'Validación de formularios', time_saved: '4 horas/semana', cost: '$200/mes', status: '✅ Make webhook' }
    ],

    landing_benefits: [
      { title: '🔍 Audit honesto', desc: 'Mapeamos cada tarea manual. Te digo exactamente qué se puede automatizar y cuánto tiempo ahorras.' },
      { title: '⚡ Sin código', desc: 'Zapier, Make, APIs. Tu equipo lo mantiene. No necesita programador fulltime.' },
      { title: '💰 ROI garantizado', desc: 'Si no recuperas 8+ horas/semana, no pagas nada. Simple.' },
      { title: '🛡️ Monitoreo incluido', desc: '30 días de soporte. Si algo se rompe, lo arreglamos nosotros.' }
    ],

    landing_faq: [
      { q: '¿Esto requiere programación?', a: 'No. Zapier, Make, n8n son no-code. Tu equipo puede mantenerlo. Ni siquiera precisa IT.' },
      { q: '¿Qué si algo se rompe después?', a: 'Monitoreo 30 días incluido + soporte gratis. Después, plan de $150-$300/mes si quieres tranquilidad.' },
      { q: '¿Cuál es el costo?', a: 'Depende de complejidad. Promedio: $2.500-$8.000 una sola vez. Recuperas en 4-6 semanas.' },
      { q: '¿Qué procesos se automatizan?', a: 'CRM sync, emails, reportes, datos entre apps, validaciones, alertas. Básicamente todo lo repetitivo.' }
    ],

    testimonios: [
      { name: 'Carlos M.', role: 'CEO startup', time: '2 semanas', result: 'Recuperó 18 horas/semana', quote: 'Tenía 2 personas full-time haciendo data entry. Ahora una persona hace 3 trabajos. Ahorró $8k/mes.' },
      { name: 'Valeria G.', role: 'Marketing manager', time: '10 días', result: 'Recuperó 12 horas/semana', quote: 'No sabía que era posible automatizar nuestros procesos así. Pasé de estar en Excel todo el día a estrategia real.' },
      { name: 'Andrés L.', role: 'Founder', time: '3 semanas', result: 'Recuperó 20 horas/semana', quote: 'Fue la mejor inversión del año. La auditoría sola me costó $500 pero me ahorró $40k anuales.' }
    ],

    roi_calculator: {
      people_saved_per_day: '1 person = $50-$100/día',
      hours_per_week: '15-20 horas',
      annual_savings: '$15.000-$40.000/año',
      payback_period: '4-6 semanas'
    },

    seo_title: 'Automatización de procesos sin código | Zapier Make | Recupera 15-20 horas',
    seo_description: 'Automatiza procesos repetitivos. 150+ implementadas. ROI en 6 semanas. Auditoría gratuita.',
    seo_keywords: ['automatización procesos', 'Zapier', 'Make', 'no-code', 'productividad', 'ahorro tiempo']
  },

  executive: {
    nombre: 'Executive Coach Pro',
    especialidad: 'executive',
    pais: 'Colombia',
    idiomas: ['es'],

    // Posicionamiento
    qué_haces: 'Transformo directores en líderes capaces de mantener equipos de alto desempeño bajo presión',
    a_quién_ayudas: 'Directores de áreas que heredaron equipos disfuncionales y necesitan ganar credibilidad rápido',
    problema_resuelve: 'La mayoría de directores no saben delegar ni manejar conflicto. Generan rotación innecesaria.',
    cómo_trabajas: 'Programa de 6 meses: sesiones 1:1 + feedback 360 + simulaciones de crisis + evaluación continua.',
    servicios: ['Sesiones coaching personalizado', 'Feedback 360 de equipo', 'Simulaciones de crisis', 'Plan de liderazgo', 'Evaluación de impacto'],
    resultados_clientes: ['+80 directores transformados', 'Retención de talento: +34%', 'Productividad: +22%'],
    tono: 'profesional',
    cta_texto: 'Agendar sesión exploratoria',
    cta_url: 'https://calendly.com/executivecoach',

    // ESTRATEGIA EXECUTIVE: Impacto + Métricas + Transformación
    landing_style: {
      primary_color: '#1E40AF',
      accent_color: '#3B82F6',
      bg_pattern: 'gradient-navy',
      emoji_icon: '🎯'
    },
    landing_sections: ['hero', 'impact-metrics', 'transformation-timeline', 'testimonials-executives', 'program-modules', 'results-dashboard', 'faq', 'cta'],

    // Hero executive: impacto empresarial
    landing_hero: 'Un líder fuerte retiene talento. Eso es rentable.',
    landing_subhero: '80 directores transformados. +34% retención. +22% productividad. No es coaching blando, es ingeniería de liderazgo.',

    // Impacto medible
    impact_metrics: [
      { metric: 'Rotación de talento', before: '-32%', after: '+34%', status: 'Mejora de 66%' },
      { metric: 'Productividad de equipo', before: 'Baseline', after: '+22%', status: 'Aceleración clara' },
      { metric: 'Clima laboral (eNPS)', before: '18', after: '68', status: 'Transformación' },
      { metric: 'Promociones internas', before: '8%', after: '24%', status: 'Crecimiento 3x' }
    ],

    landing_benefits: [
      { title: '📊 Feedback 360 real', desc: 'Tu equipo habla. No publicidad. Los ves como realmente te ven. Es incómodo pero necesario.' },
      { title: '🎭 Crisis simulation', desc: 'Practicas decisiones difíciles en ambiente seguro. Cuando ocurra de verdad, ya lo sabes.' },
      { title: '🚀 Delegación efectiva', desc: 'Tu equipo hace más, tú descansas, los resultados escalan. Es counterintuitive pero funciona.' },
      { title: '📈 Retención medible', desc: 'No es teoría. Es métrica: equipos transformados, gente que se queda, productividad que sube.' }
    ],

    landing_faq: [
      { q: '¿Funciona para directores nuevos?', a: 'Especialmente para ellos. Y también para directores atrapados en patrones viejos. Ambos casos transformamos.' },
      { q: '¿Cuántas sesiones por mes?', a: '2 sesiones 1:1 (1 hora cada una) + 1 sesión grupal opcional con tu equipo. Distribuyes el tiempo como prefieras.' },
      { q: '¿Hay garantía?', a: 'Sí. Si en 6 meses tu equipo no mejora métricas (eNPS, rotación, productividad), continuamos sin costo.' },
      { q: '¿Cuál es el investment?', a: '$3.500/mes x 6 meses. Menos que lo que pierdes anualmente por rotación innecesaria.' }
    ],

    testimonios: [
      { name: 'Javier Rodríguez', role: 'Director de Producto', company: 'Fintech startup', time: '6 meses', result: 'eNPS: 18 → 68', quote: 'Mi equipo estaba peleando entre ellos. En semanas empezaron a confiar. El cambio fue en mí primero, después en ellos.' },
      { name: 'Sofía Chen', role: 'VP Operaciones', company: 'Empresa 150 personas', time: '6 meses', result: 'Rotación: -32%', quote: 'Aprendí a delegar sin perder control. Ahora mis gerentes son líderes. Yo tengo fin de semana. Ganar-ganar total.' },
      { name: 'Andrés Gómez', role: 'Director de Ventas', company: 'Tech scale-up', time: '5 meses', result: 'Productividad: +28%', quote: 'No sabía por qué perdía talento. El feedback fue doloroso pero necesario. Cambié. El equipo cambió. Los números hablaron.' }
    ],

    transformation_timeline: [
      { month: 'Mes 1-2', focus: 'Audit + Feedback 360 + Planes individuales' },
      { month: 'Mes 3-4', focus: 'Simulaciones + Delegación + Conflicto real' },
      { month: 'Mes 5-6', focus: 'Sostenimiento + Métricas + Plan de por vida' }
    ],

    seo_title: 'Executive coaching para directores | Liderazgo empresarial de alto impacto',
    seo_description: 'Coaching ejecutivo 6 meses. 80+ directores. Retención +34%, productividad +22%. Transformación medible.',
    seo_keywords: ['executive coaching', 'coaching directivos', 'liderazgo', 'transformación de equipos', 'retención talento']
  }
};

// Generator mejorado: mucho más diferenciado por especialidad
function generateBusinessIdentityOutputs_Fase2(formData) {
  const specialty = formData.especialidad || 'fitness';
  const example = BUSINESS_IDENTITY_EXAMPLES_FASE2[specialty] || BUSINESS_IDENTITY_EXAMPLES_FASE2.fitness;

  // Merge: datos del form + fallback a ejemplo
  return {
    nombre: formData.nombre || example.nombre,
    especialidad: specialty,
    pais: formData.pais || example.pais,
    idiomas: formData.idiomas || example.idiomas,
    qué_haces: formData.qué_haces || example.qué_haces,
    a_quién_ayudas: formData.a_quién_ayudas || example.a_quién_ayudas,
    problema_resuelve: formData.problema_resuelve || example.problema_resuelve,
    cómo_trabajas: formData.cómo_trabajas || example.cómo_trabajas,
    servicios: (formData.servicios && formData.servicios.length) ? formData.servicios : example.servicios,
    resultados_clientes: (formData.resultados_clientes && formData.resultados_clientes.length) ? formData.resultados_clientes : example.resultados_clientes,
    tono: formData.tono || example.tono,
    cta_texto: formData.cta_texto || example.cta_texto,
    cta_url: formData.cta_url || example.cta_url,

    // Generated outputs
    landing_hero: formData.qué_haces ? generateHeroFase2(formData, specialty) : example.landing_hero,
    landing_subhero: formData.problema_resuelve ? generateSubheroFase2(formData, specialty) : example.landing_subhero,
    landing_benefits: generateBenefitsFase2(formData, specialty, example),
    landing_services: (formData.servicios && formData.servicios.length) ? formData.servicios.map(s => ({title: s, desc: ''})) : example.landing_benefits,
    landing_faq: generateFAQFase2(formData, specialty, example),
    landing_cta_primary: formData.cta_texto || example.cta_texto,

    testimonios: example.testimonios,
    seo_title: generateSEOTitle_Fase2(formData, specialty, example),
    seo_description: generateSEODescription_Fase2(formData, specialty, example),
    seo_keywords: generateSEOKeywords_Fase2(formData, specialty, example),

    ai_system_prompt: generateAIPrompt_Fase2(formData, specialty, example),
    ai_opening_message: `Hola, soy el asistente de ${formData.nombre || example.nombre}. ¿En qué puedo ayudarte?`,

    // Metadata de diseño (para preview visual diferenciado)
    landing_style: example.landing_style,
    landing_sections: example.landing_sections
  };
}

// Generadores especializados por Fase 2
function generateHeroFase2(data, specialty) {
  if (!data.qué_haces) return '';

  const patterns = {
    fitness: `${data.qué_haces}. Resultados que ves, no promesas.`,
    carrera: `${data.qué_haces}. Estrategia probada, no suerte.`,
    nutricion: `${data.qué_haces}. Ciencia + comida que disfrutas.`,
    productividad: `${data.qué_haces}. ROI garantizado, no esperanzas.`,
    executive: `${data.qué_haces}. Liderazgo que impacta el balance.`
  };

  return patterns[specialty] || data.qué_haces;
}

function generateSubheroFase2(data, specialty) {
  if (!data.problema_resuelve) return '';

  const patterns = {
    fitness: `No es otra dieta. ${data.problema_resuelve}`,
    carrera: `${data.problema_resuelve} Nosotros arreglamos eso.`,
    nutricion: `${data.problema_resuelve}. Reeducamos contigo.`,
    productividad: `${data.problema_resuelve}. En 2 semanas te cuantificamos.`,
    executive: `${data.problema_resuelve}. Transformamos directores.`
  };

  return patterns[specialty] || data.problema_resuelve;
}

function generateBenefitsFase2(data, specialty, example) {
  if (data.servicios && data.servicios.length) {
    const descBySpecialty = {
      fitness: {
        'Valoración': 'Entiende tu punto de partida sin compromiso',
        'Entrenamiento': 'Adaptado a tu cuerpo, lesiones, tiempo real',
        'Seguimiento': 'Ajustes en vivo según progreso medido',
        'Nutrición': 'Come lo que te gusta, inteligentemente',
        'Comunidad': 'Soporte real de mujeres en tu camino'
      },
      carrera: {
        'Posicionamiento': 'Descubre exactamente qué vales',
        'Estrategia': 'Dónde buscar, cómo aplicar, a quién conocer',
        'Entrevistas': 'Dominan cada pregunta, cada escenario',
        'Negociación': 'Dinero sin vergüenza, +$1.000-$1.500 promedio',
        'LinkedIn': 'Tu perfil en la mente de reclutadores'
      },
      nutricion: {
        'Glucosa': 'Datos reales de cómo reacciona tu cuerpo',
        'Plan': 'Hecho para TI, no genérico',
        'Reeducación': 'Aprendes el sistema, eres libre',
        'Recetas': 'Deliciosas, que funcionan, para toda la familia',
        'Seguimiento': 'Soporte real en tu transformación'
      },
      productividad: {
        'Audit': 'Mapeamos CADA tarea manual que pierdes',
        'Automatización': 'Máquinas hacen lo repetitivo, tú lo importante',
        'IA': 'Herramientas pensantes en tu flujo',
        'Training': 'Tu equipo entiende y mantiene todo',
        'Monitoreo': 'Garantizado post-implementación 30 días'
      },
      executive: {
        'Sesiones': 'Espacio seguro para decisiones difíciles',
        'Feedback': 'La verdad de cómo te ve tu equipo',
        'Simulaciones': 'Practicas presión antes de que sea real',
        'Plan': 'Hoja de ruta personalizada de liderazgo',
        'Evaluación': 'Métricas reales de impacto'
      }
    };

    const descs = descBySpecialty[specialty] || {};
    return data.servicios.slice(0, 4).map(s => {
      const shortKey = s.split(' ')[0];
      return {
        title: `✓ ${s}`,
        desc: descs[shortKey] || descs[Object.keys(descs)[0]] || ''
      };
    });
  }

  return example.landing_benefits || [];
}

function generateFAQFase2(data, specialty, example) {
  // Return example FAQ for now (podría ser más generado)
  return example.landing_faq || [];
}

function generateSEOTitle_Fase2(data, specialty, example) {
  if (data.nombre && data.qué_haces) {
    const patterns = {
      fitness: `${data.nombre} | Coaching fitness personalizado | Resultados reales`,
      carrera: `${data.nombre} | Career coach | Consigue trabajo con mejor salario`,
      nutricion: `${data.nombre} | Nutricionista especialista | Reversión natural`,
      productividad: `${data.nombre} | Automatización de procesos | Sin código`,
      executive: `${data.nombre} | Executive coach | Liderazgo de alto impacto`
    };
    return patterns[specialty] || example.seo_title;
  }
  return example.seo_title;
}

function generateSEODescription_Fase2(data, specialty, example) {
  if (data.qué_haces) {
    const patterns = {
      fitness: `${data.qué_haces}. Resultados en 12 semanas. Comunidad de mujeres transformadas.`,
      carrera: `${data.qué_haces}. +180 profesionales colocados con aumento salarial.`,
      nutricion: `${data.qué_haces}. Programa 12 semanas. Reeducación nutricional con ciencia.`,
      productividad: `${data.qué_haces}. 150+ procesos automatizados. ROI en 6 semanas.`,
      executive: `${data.qué_haces}. Transformación medible de equipos. Retención +34%.`
    };
    return patterns[specialty] || example.seo_description;
  }
  return example.seo_description;
}

function generateSEOKeywords_Fase2(data, specialty, example) {
  const keywordsBySpecialty = {
    fitness: ['fitness online', 'entrenadora personal', 'pérdida de peso', 'nutrición flexible', 'comunidad fitness'],
    carrera: ['career coach', 'búsqueda empleo', 'entrevistas', 'aumento salario', 'posicionamiento profesional'],
    nutricion: ['nutricionista', 'diabetes tipo 2', 'reversión', 'glucosa', 'reeducación nutricional'],
    productividad: ['automatización', 'Zapier', 'Make', 'no-code', 'recuperar tiempo'],
    executive: ['executive coaching', 'liderazgo', 'directores', 'transformación equipos', 'retención talento']
  };
  return keywordsBySpecialty[specialty] || example.seo_keywords;
}

function generateAIPrompt_Fase2(data, specialty, example) {
  const prompts = {
    fitness: `Eres asistente de ${data.nombre || example.nombre}, una entrenadora de fitness. Tono: motivador, directo, sin fake. Ayuda con planes, dudas nutricionales, motivación. Enfoque: resultados sostenibles, comida que disfrutas, comunidad real.`,
    carrera: `Eres asistente de ${data.nombre || example.nombre}, career coach. Tono: profesional, pragmático, enfocado en cifras. Ayuda con posicionamiento, búsqueda, entrevistas, negociación. Enfoque: estrategia probada, salarios más altos, placements reales.`,
    nutricion: `Eres asistente de ${data.nombre || example.nombre}, nutricionista. Tono: científico pero accesible, inspirador. Ayuda con recetas, glucosa, educación nutricional. Enfoque: reversión diabetes, comida deliciosa, ciencia real.`,
    productividad: `Eres asistente de ${data.nombre || example.nombre}, experto en automatización. Tono: directo, pragmático, orientado a ROI. Ayuda identificar procesos, explicar herramientas, cuantificar ahorros. Enfoque: tiempo = dinero, no-code, resultados medibles.`,
    executive: `Eres asistente de ${data.nombre || example.nombre}, executive coach. Tono: profesional, serio, orientado a resultados. Ayuda con liderazgo, delegación, conflicto, métricas. Enfoque: retención, productividad, transformación de equipos.`
  };
  return prompts[specialty] || example.ai_system_prompt;
}
