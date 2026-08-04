// Business Identity Engine — Real-world examples by specialty
// These are templates that power live preview generation

const BUSINESS_IDENTITY_EXAMPLES = {
  fitness: {
    nombre: 'Bot Gym',
    especialidad: 'fitness',
    qué_haces: 'Entreno a mujeres ocupadas para que logren resultados sostenibles sin sacrificar su vida social',
    a_quién_ayudas: 'Mujeres de 25 a 45 años que quieren perder peso pero no tienen tiempo de estar en el gym 2 horas',
    problema_resuelve: 'La mayoría de dietas fallan porque son insostenibles. Creamos un plan que se adapta a tu vida, no tu vida a la dieta.',
    cómo_trabajas: 'Plan personalizado + entrenamiento 3x por semana + seguimiento semanal. Sin culpa, sin restricción extrema.',
    servicios: ['Valoración gratuita', 'Entrenamiento personalizado', 'Seguimiento semanal', 'Nutrición adaptada', 'Comunidad privada'],
    resultados_clientes: ['+350 clientes transformados', 'Pérdida promedio: 8kg en 12 semanas', '92% completan el programa'],
    tono: 'directo',
    pais: 'España',
    idiomas: ['es', 'en'],
    cta_texto: 'Reservar valoración gratuita',
    cta_url: 'https://calendly.com/botgym',
    landing_hero: 'Consigue resultados sostenibles con un entrenador que adapta cada plan a tu estilo de vida',
    landing_subhero: 'No es otra dieta restrictiva. Es un sistema que funciona porque se adapta a TI.',
    landing_benefits: [
      { title: 'Entrenamiento personalizado', desc: 'Adaptado a tu nivel, lesiones y tiempo disponible' },
      { title: 'Seguimiento semanal', desc: 'Ajustes en vivo según tu progreso real' },
      { title: 'Nutrición flexible', desc: 'Sin listas de prohibidos. Come lo que te gusta, inteligentemente' },
      { title: 'Comunidad privada', desc: 'Mujeres en tu mismo camino. Soporte real, no fake' }
    ],
    landing_faq: [
      { q: '¿Cuánto tiempo lleva ver resultados?', a: 'Entre 3 y 4 semanas ves cambios. A los 3 meses ya es evidente.' },
      { q: '¿Hay que dejar de comer lo que me gusta?', a: 'No. Comemos todo, pero con estrategia. Es sostenible porque no es restrictivo.' },
      { q: '¿Cuántas sesiones por semana son?', a: '3 sesiones personalizadas. Cada una dura lo que necesites (20 a 45 min).' },
      { q: '¿Trabajas online o presencial?', a: 'Ambas. Ajustamos a tu preferencia.' }
    ],
    testimonios: [
      { name: 'María', quote: 'Perdí 12 kg en 6 meses sin dejar de disfrutar la comida. Es lo que faltaba.' },
      { name: 'Alejandra', quote: 'Después de 10 dietas fracasadas, esto fue diferente. Es ciencia, no magia.' }
    ],
    seo_title: 'Entrenadora personal fitness online | Resultados reales sin restricción',
    seo_description: 'Planes personalizados de fitness y nutrición para mujeres. Resultados sostenibles sin dietas restrictivas. Seguimiento semanal.',
    seo_keywords: ['entrenadora personal', 'fitness online', 'pérdida de peso', 'nutrición flexible', 'entrenamiento personalizado']
  },

  carrera: {
    nombre: 'Career Coach Laura',
    especialidad: 'carrera',
    qué_haces: 'Ayudo a profesionales a encontrar trabajos que les paguen 30% más en menos de 90 días',
    a_quién_ayudas: 'Profesionales de 28 a 45 años atrapados en roles que no valorizan su talento',
    problema_resuelve: 'La mayoría no sabe cómo posicionarse realmente. Envían CV genéricos a ofertas genéricas y se frustan.',
    cómo_trabajas: 'Mapeamos tu valor real, construimos tu estrategia de búsqueda y te preparamos para que la entrevista sea una negociación.',
    servicios: ['Análisis de posicionamiento', 'Estrategia de búsqueda', 'Preparación de entrevistas', 'Negociación de salario', 'LinkedIn mastery'],
    resultados_clientes: ['+180 profesionales colocados', 'Incremento promedio de salario: 32%', '85% consiguen trabajo en primera oferta'],
    tono: 'profesional',
    pais: 'Argentina',
    idiomas: ['es'],
    cta_texto: 'Agendar sesión exploratoria',
    cta_url: 'https://calendly.com/lauracareercoach',
    landing_hero: 'Encuentra un trabajo alineado con tu potencial en menos tiempo',
    landing_subhero: 'No es suerte. Es estrategia. La mayoría falla porque nadie les enseña el juego real de las entrevistas.',
    landing_benefits: [
      { title: 'Posicionamiento claro', desc: 'Descubrimos qué hace que VALES el dinero que pides' },
      { title: 'Estrategia de búsqueda', desc: 'Dónde buscar, cómo aplicar, a quién conocer' },
      { title: 'Preparación de entrevistas', desc: 'Simulaciones reales hasta que domines cada tipo de pregunta' },
      { title: 'Negociación de salario', desc: 'Hablamos de dinero sin miedo. Aumenta tu oferta promedio.' }
    ],
    landing_faq: [
      { q: '¿Cuánto tiempo toma encontrar trabajo?', a: 'Con estrategia, 30 a 60 días. Sin estrategia, pueden ser 6 meses.' },
      { q: '¿Qué pasa si no consigo trabajo?', a: 'Te devolvemos el 50% si en 90 días no tienes oferta con aumento.' },
      { q: '¿Esto es solo para directivos?', a: 'No. Funciona desde especialistas técnicos hasta directores. El principio es el mismo.' },
      { q: '¿En qué empresas nos ha colocado gente?', a: 'Google, Amazon, Mercado Libre, startups de VC. Depende de tu perfil.' }
    ],
    testimonios: [
      { name: 'Diego', quote: 'Pasé de $3.500 a $4.700 en 4 meses. La estrategia lo cambió todo.' },
      { name: 'Fernanda', quote: 'No sabía cómo hablar de mi valor. Ahora tengo 3 ofertas simultáneamente.' }
    ],
    seo_title: 'Career Coach | Encuentra trabajo con salario mayor en 90 días',
    seo_description: 'Estrategia de búsqueda laboral probada. Preparación de entrevistas y negociación de salario. +180 profesionales colocados.',
    seo_keywords: ['career coach', 'búsqueda de empleo', 'entrevistas', 'aumento de salario', 'posicionamiento profesional']
  },

  nutricion: {
    nombre: 'Marta Nutrición',
    especialidad: 'nutricion',
    qué_haces: 'Enseño a pacientes diabéticos a vivir sin angustia por la comida, con energía estable todo el día',
    a_quién_ayudas: 'Adultos diagnosticados con diabetes tipo 2 que quieren reverla o estabilizarla sin medicinas extras',
    problema_resuelve: 'Les dicen "come menos carbos" pero nadie explica POR QUÉ ni les enseña a comer rico así.',
    cómo_trabajas: 'Programa de 12 semanas: reeducación nutricional + análisis de glucosa + recetas reales + seguimiento personalizado.',
    servicios: ['Análisis de glucosa', 'Plan nutricional personalizado', 'Reeducación alimentaria', 'Recetas adaptadas', 'Seguimiento semanal'],
    resultados_clientes: ['+120 pacientes en remisión', 'Reducción de glucosa: promedio 40 mg/dL', '78% discontinúan medicamentos'],
    tono: 'inspirador',
    pais: 'Chile',
    idiomas: ['es'],
    cta_texto: 'Agendar consulta inicial',
    cta_url: 'https://calendly.com/marnutricion',
    landing_hero: 'Vive sin miedo a la comida. Tu cuerpo puede estar en balance.',
    landing_subhero: 'No es una dieta. Es reeducar tu relación con la comida desde la ciencia.',
    landing_benefits: [
      { title: 'Ciencia accesible', desc: 'Entiendes POR QUÉ cada alimento impacta tu glucosa' },
      { title: 'Comida de verdad', desc: 'Recetas deliciosas que viven tu realidad, no ficción de nutritionista' },
      { title: 'Control sin restricción', desc: 'Estabilidad de glucosa sin sacrificar lo que te gusta' },
      { title: 'Transformación en 12 semanas', desc: 'Resultados medibles. Energía real. Cambio de vida.' }
    ],
    landing_faq: [
      { q: '¿Puedo reversionar mi diabetes?', a: 'Tipo 2, sí. Tipo 1, estabilizamos y reducimos insulina. Todo es posible con datos.' },
      { q: '¿Qué pasa después de las 12 semanas?', a: 'Tienes el conocimiento. Algunos eligen seguimiento, otros vuelan solos.' },
      { q: '¿Hay que comer diferente para siempre?', a: 'Para siempre no. Aprendes el sistema y lo adaptas. Eres libre.' },
      { q: '¿Funciona si sigo tomando medicinas?', a: 'Sí. A veces reducimos dosis, a veces no. Tu doctor lo decide con tus números.' }
    ],
    testimonios: [
      { name: 'Claudia', quote: 'Me dijeron que era de por vida. En 3 meses casi normalicé. No lo puedo creer.' },
      { name: 'Roberto', quote: 'Primera vez que un profesional me explica CÓMO funciona, no solo qué comer.' }
    ],
    seo_title: 'Nutricionista especialista en diabetes | Reversión natural',
    seo_description: 'Programa de 12 semanas para estabilizar o reversionar diabetes tipo 2. Reeducación nutricional con ciencia.',
    seo_keywords: ['nutricionista diabetes', 'reversión diabetes', 'glucosa', 'nutrición personalizada']
  },

  productividad: {
    nombre: 'Automation Bot',
    especialidad: 'productividad',
    qué_haces: 'Automatizo procesos repetitivos en empresas pequeñas para que recuperen 15-20 horas semanales',
    a_quién_ayudas: 'Emprendedores y equipos pequeños que pasan el día en tareas manuales sin valor agregado',
    problema_resuelve: 'No saben qué es automatizable. Pierden tiempo en tareas que una máquina hace en segundos.',
    cómo_trabajas: 'Audit de 2 semanas → Identificamos ahorros → Build de automaciones con Zapier, Make, AI → Handoff.',
    servicios: ['Audit de procesos', 'Automatización Zapier/Make', 'Integración IA', 'Training del equipo', 'Monitoreo 30 días'],
    resultados_clientes: ['+150 procesos automatizados', 'Recuperación promedio: 18 horas/semana', 'ROI en 6 semanas'],
    tono: 'directo',
    pais: 'México',
    idiomas: ['es', 'en'],
    cta_texto: 'Agendar auditoría gratuita',
    cta_url: 'https://calendly.com/automationbot',
    landing_hero: 'Recupera 15-20 horas semanales sin contratar a nadie',
    landing_subhero: 'Tus procesos manuales son dinero tirado a la basura. Veamos cuánto.',
    landing_benefits: [
      { title: 'Audit completo', desc: 'Mapeamos cada proceso y encontramos ahorros reales' },
      { title: 'Automación inteligente', desc: 'No es "excel". Es Zapier + Make + APIs + IA trabajando juntas' },
      { title: 'ROI garantizado', desc: 'Si no recuperas al menos 8 horas, no pagas nada' },
      { title: 'Sin mantenimiento', desc: 'Nosotros monitoreamos 30 días. Tu equipo respira.' }
    ],
    landing_faq: [
      { q: '¿Requiere programación?', a: 'No. Usamos herramientas sin código como Zapier y Make. Cualquiera puede mantenerlo.' },
      { q: '¿Qué si la automatización se rompe?', a: 'Monitoreo incluido 30 días + soporte gratis. Después, plan mensual optativo.' },
      { q: '¿Cuánto cuesta?', a: 'Depende de complejidad. Promedio: $2.500-$8.000 una sola vez. Recuperas en 6 semanas.' },
      { q: '¿Cuáles procesos se automatizan?', a: 'CRM sync, emails masivos, reportes, datos entre apps, validaciones, alertas inteligentes.' }
    ],
    testimonios: [
      { name: 'Carlos', quote: 'Tenía 2 personas full-time haciendo data entry. Ahora una hace 3 trabajos. Dinero ahorrado: $8k/mes.' },
      { name: 'Valeria', quote: 'No sabía que era posible automatizar nuestros procesos así. Es magia.' }
    ],
    seo_title: 'Automatización de procesos empresariales sin código | Zapier Make',
    seo_description: 'Automatiza procesos repetitivos de tu empresa. Recupera 15-20 horas semanales. Auditoría gratuita.',
    seo_keywords: ['automatización procesos', 'Zapier', 'Make', 'automatización sin código', 'productividad']
  },

  executive: {
    nombre: 'Executive Coach',
    especialidad: 'executive',
    qué_haces: 'Transformo directores en líderes capaces de mantener equipos de alto desempeño bajo presión',
    a_quién_ayudas: 'Directores de áreas que heredaron equipos disfuncionales y necesitan ganar credibilidad rápido',
    problema_resuelve: 'La mayoría de directores no saben delegar ni manejar conflicto. Generan rotación innecesaria.',
    cómo_trabajas: 'Programa de 6 meses: sesiones 1:1 + feedback 360 + simulaciones de crisis + evaluación continua.',
    servicios: ['Sesiones coaching personalizado', 'Feedback 360 de equipo', 'Simulaciones de crisis', 'Plan de liderazgo', 'Evaluación de impacto'],
    resultados_clientes: ['+80 directores transformados', 'Retención de talento: +34%', 'Productividad: +22%'],
    tono: 'profesional',
    pais: 'Colombia',
    idiomas: ['es'],
    cta_texto: 'Agendar sesión exploratoria',
    cta_url: 'https://calendly.com/executivecoach',
    landing_hero: 'Un líder fuerte mantiene equipos juntos. Eso es rentable.',
    landing_subhero: 'La mayoría de directores no fueron preparados para liderar. Te preparamos nosotros.',
    landing_benefits: [
      { title: 'Liderazgo basado en datos', desc: 'Feedback real de tu equipo. Ves qué necesitan verdaderamente.' },
      { title: 'Crisis simulation', desc: 'Practicas decisiones difíciles en un ambiente seguro antes de que sucedan realmente' },
      { title: 'Delegación efectiva', desc: 'Tu equipo hace más, tú descansas, los resultados escalan' },
      { title: 'Transformación medible', desc: '6 meses. Equipo más fuerte. Retención. Productividad real.' }
    ],
    landing_faq: [
      { q: '¿Es para directores nuevos?', a: 'Funciona bien en ese caso, pero también con directores atrapados en patrones viejos.' },
      { q: '¿Cuántas sesiones por mes?', a: '2 sesiones 1:1 + 1 grupal si tienes tu equipo. Puedes distribuir el tiempo como prefieras.' },
      { q: '¿Hay garantía de resultados?', a: 'Sí. Si en 6 meses tu equipo no mejora métricas, continuamos sin costo.' },
      { q: '¿Cuál es el costo?', a: 'Desde $3.500/mes por 6 meses. Menos que lo que pierdes por rotación.' }
    ],
    testimonios: [
      { name: 'Javier', quote: 'Mi equipo pasó de pelear entre ellos a confiar en mí. El cambio fue en semanas.' },
      { name: 'Sofía', quote: 'Aprendí a delegar sin perder control. Ahora sí tengo fin de semana.' }
    ],
    seo_title: 'Executive coaching para directores | Liderazgo empresarial',
    seo_description: 'Coaching ejecutivo para directores. Transforma tu equipo, retiene talento, escala productividad en 6 meses.',
    seo_keywords: ['executive coaching', 'coaching directivos', 'liderazgo empresarial', 'coaching ejecutivo']
  }
};

// Generator: Toma datos parciales del form y genera outputs en vivo
function generateBusinessIdentityOutputs(formData) {
  const specialty = formData.especialidad || 'fitness';
  const example = BUSINESS_IDENTITY_EXAMPLES[specialty] || BUSINESS_IDENTITY_EXAMPLES.fitness;

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

    // Generated outputs (será Claude después, ahora ejemplo)
    landing_hero: formData.qué_haces ? generateHero(formData, specialty) : example.landing_hero,
    landing_subhero: formData.problema_resuelve ? generateSubhero(formData, specialty) : example.landing_subhero,
    landing_benefits: generateBenefits(formData, specialty, example),
    landing_services: (formData.servicios && formData.servicios.length) ? formData.servicios.map(s => ({title: s, desc: ''})) : example.landing_benefits,
    landing_faq: generateFAQ(formData, specialty, example),
    landing_cta_primary: formData.cta_texto || example.cta_texto,
    seo_title: generateSEOTitle(formData, specialty, example),
    seo_description: generateSEODescription(formData, specialty, example),
    seo_keywords: generateSEOKeywords(formData, specialty, example),
    testimonios: example.testimonios,
    ai_system_prompt: generateAIPrompt(formData, specialty, example),
    ai_opening_message: `Hola, soy el asistente de ${formData.nombre || example.nombre}. ¿En qué puedo ayudarte?`
  };
}

function generateHero(data, specialty) {
  if (data.qué_haces) {
    // Si tienen datos, generar un hero dinámico
    var heroTemplates = {
      fitness: `${data.qué_haces}`,
      carrera: `${data.qué_haces}`,
      nutricion: `${data.qué_haces}`,
      productividad: `${data.qué_haces}`,
      executive: `${data.qué_haces}`
    };
    return heroTemplates[specialty] || data.qué_haces;
  }
  const heroes = {
    fitness: `Consigue resultados sostenibles con un plan que se adapta a tu estilo de vida`,
    carrera: `Encuentra un trabajo alineado con tu potencial en menos tiempo`,
    nutricion: `Vive sin miedo a la comida. Tu cuerpo puede estar en balance.`,
    productividad: `Recupera 15-20 horas semanales sin contratar a nadie`,
    executive: `Un líder fuerte mantiene equipos juntos. Eso es rentable.`
  };
  return heroes[specialty] || heroes.fitness;
}

function generateSubhero(data, specialty) {
  if (data.problema_resuelve) {
    return data.problema_resuelve;
  }
  const subs = {
    fitness: `No es otra dieta restrictiva. Es un sistema que funciona porque se adapta a TI.`,
    carrera: `No es suerte. Es estrategia. La mayoría falla porque nadie les enseña el juego real.`,
    nutricion: `No es una dieta. Es reeducar tu relación con la comida desde la ciencia.`,
    productividad: `Tus procesos manuales son dinero tirado a la basura. Veamos cuánto.`,
    executive: `La mayoría de directores no fueron preparados para liderar. Te preparamos nosotros.`
  };
  return subs[specialty] || subs.fitness;
}

function generateBenefits(data, specialty, example) {
  if (data.servicios && data.servicios.length) {
    // Map servicios a descripciones inteligentes por especialidad
    var descByService = {
      fitness: {
        'Valoración gratuita': 'Entiende tu punto de partida sin compromiso',
        'Entrenamiento personalizado': 'Adaptado a tu nivel, cuerpo y objetivos reales',
        'Seguimiento semanal': 'Ajustes en vivo según tu progreso',
        'Nutrición adaptada': 'Come lo que te gusta, pero inteligentemente',
        'Comunidad privada': 'Soporte real de gente en tu mismo camino'
      },
      carrera: {
        'Análisis de posicionamiento': 'Descubre qué hace que VALES el dinero que pides',
        'Estrategia de búsqueda': 'Dónde buscar, cómo aplicar, a quién conocer',
        'Preparación de entrevistas': 'Simulaciones hasta que domines cada pregunta',
        'Negociación de salario': 'Hablamos de dinero sin miedo',
        'LinkedIn mastery': 'Tu perfil en la mente de reclutadores'
      },
      nutricion: {
        'Análisis de glucosa': 'Entiende cómo reacciona tu cuerpo a cada alimento',
        'Plan nutricional personalizado': 'Específico para tu diagnóstico y estilo de vida',
        'Reeducación alimentaria': 'Aprende el sistema, no solo listas de prohibidos',
        'Recetas adaptadas': 'Comida deliciosa que respeta tu salud',
        'Seguimiento semanal': 'Soporte constante en tu transformación'
      },
      productividad: {
        'Audit de procesos': 'Mapeamos cada tarea manual que gastas tiempo',
        'Automatización Zapier/Make': 'Las máquinas hacen lo repetitivo, tú lo importante',
        'Integración IA': 'Máquinas pensantes en tu flujo de trabajo',
        'Training del equipo': 'Tu gente entiende y puede mantener todo',
        'Monitoreo 30 días': 'Estabilidad garantizada post-implementación'
      },
      executive: {
        'Sesiones coaching personalizado': 'Espacio seguro para decisiones difíciles',
        'Feedback 360 de equipo': 'La verdad de cómo te ven',
        'Simulaciones de crisis': 'Practicas presión antes de que sea real',
        'Plan de liderazgo': 'Tu roadmap personal de desarrollo',
        'Evaluación de impacto': 'Medimos qué cambió realmente'
      }
    };

    var serviceDescs = descByService[specialty] || {};
    return data.servicios.map(s => ({
      title: s,
      desc: serviceDescs[s] || `${s}`
    }));
  }
  return example.landing_benefits || [];
}

function generateFAQ(data, specialty, example) {
  return example.landing_faq || [];
}

function generateSEOTitle(data, specialty, example) {
  if (data.nombre && data.qué_haces) {
    return `${data.nombre} | ${data.qué_haces.substring(0, 40)}...`;
  }
  return example.seo_title || '';
}

function generateSEODescription(data, specialty, example) {
  if (data.qué_haces && data.a_quién_ayudas) {
    return `${data.qué_haces}. ${data.a_quién_ayudas}`;
  }
  return example.seo_description || '';
}

function generateSEOKeywords(data, specialty, example) {
  const keywords = [specialty];
  if (data.nombre) keywords.push(data.nombre.toLowerCase());
  if (data.tono) keywords.push(data.tono);
  return keywords.concat(example.seo_keywords || []).slice(0, 10);
}

function generateAIPrompt(data, specialty, example) {
  return `Eres un asistente de ${data.nombre || example.nombre}. Tu tono es ${data.tono || example.tono}. Trabajas con ${data.a_quién_ayudas || example.a_quién_ayudas}. ${data.cómo_trabajas || example.cómo_trabajas}`;
}
