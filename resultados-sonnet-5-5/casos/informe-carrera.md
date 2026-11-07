# informe-carrera · `generar-informe`

## Petición (sintética)

```json
{
  "nombre": "María Ejemplo",
  "edad": "31",
  "experiencia": "6 años como analista de datos",
  "sector": "Finanzas",
  "rol": "Analista senior",
  "educacion": "Lic. en Economía",
  "habilidades": "SQL, Python, Power BI",
  "objetivo": "Pasar a un rol de Data Scientist en una fintech",
  "idiomas": "Español nativo, inglés avanzado",
  "ubicacion": "Buenos Aires",
  "situacion": "Empleada",
  "urgencia": "3-6 meses",
  "modalidad": "Remoto",
  "obstaculos": "No sé cómo mostrar proyectos de ML sin experiencia formal"
}
```

## sonnet-4-5 · main · repetición 1

HTTP 200 · API 49967 ms · tokens 1005→2133 · $0.0350 · parada end_turn · bloques ["text"]

Estructura: ✓

```json
{
  "ok": true,
  "informe": {
    "resumen": "María tiene un perfil sólido como analista senior con 6 años de experiencia en finanzas y un stack técnico valioso (SQL, Python, Power BI). Su transición a Data Scientist en fintech es viable y estratégica, aprovechando su background financiero como diferenciador. El principal desafío es demostrar capacidades de ML sin experiencia formal, pero su combinación de dominio financiero + habilidades técnicas la posiciona competitivamente en el mercado fintech argentino.",
    "fortalezas": [
      "Experiencia de 6 años en finanzas combinada con Python y SQL, un perfil muy demandado en fintechs que buscan científicos de datos con entendimiento del negocio financiero",
      "Inglés avanzado y ubicación en Buenos Aires, ciudad con ecosistema fintech en crecimiento y muchas posiciones remotas internacionales",
      "Claridad de objetivo profesional con plazo realista de 3-6 meses, permitiendo una transición estratégica sin presión extrema"
    ],
    "gaps": [
      "Ausencia de portfolio público con proyectos de Machine Learning que valide capacidades más allá del análisis descriptivo tradicional",
      "Falta de experiencia demostrable en modelos predictivos, algoritmos de ML o deployment de modelos, competencias core para roles de Data Scientist",
      "Red de contactos limitada en el ecosistema fintech y comunidad de data science, reduciendo visibilidad y acceso a oportunidades no publicadas"
    ],
    "estrategia": "Tu transición debe posicionarte como 'analista financiera evolucionando a científica de datos' en lugar de junior. Construí un portfolio de 3-4 proyectos de ML aplicados a finanzas (credit scoring, detección de fraude, predicción de churn) usando datasets públicos, documentados en GitHub con notebooks Jupyter. Apuntá a roles de 'Data Scientist Jr' o 'ML Engineer' en fintechs Series A-C que valoren el conocimiento del dominio financiero. Participá activamente en comunidades como Data Science Argentina y eventos de fintech para construir red. Tu ventaja competitiva es traducir problemas de negocio financiero a soluciones de ML, algo que ingenieros junior sin tu background no pueden hacer.",
    "mercado": "El mercado fintech argentino está en expansión con empresas como Ualá, Naranja X, Brubank y Mercado Pago contratando constantemente científicos de datos. Hay alta demanda de profesionales que combinen entendimiento financiero con ML, especialmente para scoring crediticio, análisis de riesgo y personalización. Las posiciones remotas para empresas internacionales (LATAM, US) están creciendo, con salarios 50-100% superiores a roles locales. Tu timing es excelente: las empresas buscan perfiles híbridos que reduzcan la brecha entre negocio y tecnología.",
    "nicho": "Data Scientist especializada en Credit Analytics y Risk Modeling para fintechs early-stage (Series A-B) que necesitan construir sus primeros modelos predictivos con conocimiento del negocio financiero incorporado",
    "cv_acciones": [
      "Completar el Diagnóstico de Orientación Profesional esta semana para mapear tus motivadores y validar el objetivo de Data Scientist en fintech",
      "Crear un inventario de 15-20 proyectos realizados en tu rol actual identificando cuáles involucraron análisis predictivo, segmentación avanzada o automatización con Python",
      "Diseñar tu propuesta de valor en una frase: 'Analista Financiera con 6 años transformando datos en decisiones estratégicas, migrando hacia Data Science aplicado a credit risk y fraud detection'",
      "Autoevaluar tu nivel actual en ML completando un assessment online (ej: Kaggle Learn) y documentar qué frameworks necesitás aprender (scikit-learn, TensorFlow básico)"
    ],
    "linkedin_acciones": [
      "Reescribir las 3 experiencias más recientes en tu CV usando la fórmula 'Acción + Resultado Cuantificado + Herramienta', ej: 'Desarrollé modelo de forecasting en Python que redujo error de predicción 23% versus método manual en Excel'",
      "Crear sección 'Proyectos Técnicos' en tu CV listando 2-3 análisis complejos con Python donde aplicaste pandas, visualización o estadística avanzada, aunque sean internos",
      "Agregar certificaciones completadas o en curso: priorizar DataCamp/Coursera ML track, AWS Cloud Practitioner o similares orientados a ciencia de datos",
      "Eliminar descripción genérica de responsabilidades tipo 'análisis de reportes' y reemplazar con logros específicos: 'Automaticé 12 reportes mensuales con Power BI reduciendo 40 horas/mes de trabajo manual'"
    ],
    "networking_acciones": [
      "Optimizar tu titular de LinkedIn a: 'Senior Financial Analyst → Transitioning to Data Science | Python, ML & Credit Analytics | Open to Fintech Opportunities'",
      "Publicar tu primer proyecto de ML en GitHub esta semana: tomar dataset de Kaggle sobre credit default, crear modelo de clasificación con scikit-learn y documentar proceso en README detallado",
      "Unirte a 5 comunidades específicas: Data Science Argentina (Slack), PyData Buenos Aires (Meetup), r/datascience (Reddit), fintechAR (LinkedIn) y Women in Data Science LATAM",
      "Escribir tu primer post de LinkedIn contando tu decisión de transicionar a Data Science, qué te motiva y tu primer proyecto de ML (vincular GitHub), pidiendo feedback de la comunidad"
    ],
    "preguntas": [
      "Identificar 20 fintechs objetivo en Argentina y LATAM usando fuentes como Finnovista, Endeavor, AngelList y clasificarlas por etapa (Seed/A/B/C) y área de negocio",
      "Preparar 3 proyectos de portfolio adicionales orientados a casos de uso fintech: modelo de credit scoring con LightGBM, detección de transacciones fraudulentas con anomaly detection, predicción de churn con random forest",
      "Diseñar respuesta a 'no tengo experiencia en ML': preparar storytelling donde muestres cómo resolviste problemas de negocio financiero con análisis de datos y cómo ahora agregás capa predictiva con ML",
      "Crear script para contactar 15 Data Scientists/ML Engineers de fintechs vía LinkedIn solicitando charlas informativas de 20 minutos sobre cómo hicieron su transición y qué buscan en candidatos",
      "Practicar casos de entrevista técnica: resolver 2 challenges semanales en Kaggle, estudiar preguntas de ML en Glassdoor de Ualá/MercadoLibre, preparar explicación de proyectos en formato STAR"
    ],
    "alertas": [
      "No pospongas la creación de portfolio esperando 'aprender todo primero': tus proyectos pueden ser simples pero deben estar públicos en GitHub esta semana, la visibilidad es crítica",
      "Cuidado con síndrome del impostor paralizante: tu experiencia financiera es TU ventaja competitiva sobre ingenieros puros, las fintechs pagan premium por ese conocimiento de dominio"
    ],
    "mensaje_candidato": "María, tu combinación de 6 años en finanzas + Python es exactamente lo que las fintechs buscan pero pocos encuentran. El obstáculo que percibís sobre 'no tener experiencia en ML' se resuelve con acción inmediata: un proyecto público vale más que 10 cursos en tu CV. Arrancamos esta semana construyendo tu portfolio y posicionando tu marca. ¡Vamos con todo! 🚀",
    "scores": [
      {
        "label": "CV y marca personal",
        "val": 58
      },
      {
        "label": "LinkedIn",
        "val": 45
      },
      {
        "label": "Claridad de objetivo",
        "val": 82
      },
      {
        "label": "Red de contactos",
        "val": 38
      },
      {
        "label": "Propuesta de valor",
        "val": 72
      }
    ]
  }
}
```

## sonnet-4-5 · main · repetición 2

HTTP 200 · API 53760 ms · tokens 1005→2185 · $0.0358 · parada end_turn · bloques ["text"]

Estructura: ✓

```json
{
  "ok": true,
  "informe": {
    "resumen": "María está en un punto de inflexión estratégico: con 6 años de experiencia en análisis de datos en finanzas y habilidades técnicas sólidas (SQL, Python, Power BI), tiene bases fuertes para la transición a Data Science. Sin embargo, necesita posicionarse competitivamente en el mercado fintech porteño, donde la demanda de Data Scientists con background financiero es alta pero requiere evidencia tangible de capacidades en ML. Su ventana de 3-6 meses le permite ejecutar una transición planificada sin apuros.",
    "fortalezas": [
      "Combinación valiosa de 6 años en finanzas + stack técnico (Python, SQL) que las fintechs argentinas buscan activamente para roles de ciencia de datos aplicada",
      "Inglés avanzado en Buenos Aires la posiciona para roles remotos internacionales en fintechs LATAM o globales con hubs en Argentina",
      "Situación empleada le permite ser selectiva y construir portafolio sin presión económica inmediata"
    ],
    "gaps": [
      "Ausencia de evidencia pública de proyectos ML: su GitHub/portafolio no muestra casos de uso de machine learning aplicado a finanzas (modelos de scoring, predicción de churn, detección de fraude)",
      "CV y LinkedIn probablemente presentan su rol actual como 'analista' en vez de destacar capacidades de modelado predictivo y proyectos con impacto de negocio cuantificado",
      "Red profesional limitada en el ecosistema fintech: no tiene conexiones visibles con Data Scientists o líderes de analytics en Mercado Libre, Ualá, Naranja X u otras fintechs objetivo"
    ],
    "estrategia": "María debe ejecutar una transición de 'analista con Python' a 'científica de datos con expertise financiera' mediante tres pilares simultáneos: (1) Reposicionar su narrativa profesional mostrando los 2-3 proyectos más complejos de su rol actual como iniciativas de data science (aunque no tengan ese nombre formal), cuantificando impacto en métricas de negocio. (2) Crear 2 proyectos públicos de ML aplicados a finanzas (ej: modelo de credit scoring con dataset público, predicción de precios de activos) y publicarlos en GitHub con documentación profesional. (3) Activar networking estratégico en el ecosistema fintech porteño: asistir a meetups de PyData/Data Science BA, conectar con 15-20 Data Scientists en sus empresas objetivo, y conseguir 3 conversaciones informacionales antes de aplicar formalmente. Su perfil tiene alta empleabilidad si ejecuta este posicionamiento correctamente.",
    "mercado": "El mercado de Data Science en fintechs argentinas está en expansión acelerada (Mercado Pago, Ualá, Naranja X, Brubank contratan activamente). Buscan perfiles con background financiero que entiendan el negocio, no solo ML puro. Salarios para DS con 4-6 años: USD 3.500-5.500 mensuales remoto LATAM. La competencia viene de ingenieros en sistemas con bootcamps de DS pero sin expertise de dominio financiero, donde María tiene ventaja. Modalidad remota es estándar en 80% de posiciones.",
    "nicho": "Data Scientist con especialización en analytics financiero para fintechs argentinas/LATAM en etapa de escalamiento (Series A/B), enfocado en modelos de riesgo crediticio, anti-fraude o customer analytics. Aprovechar su ventaja competitiva: combinar conocimiento profundo del negocio financiero + capacidades técnicas de ML.",
    "cv_acciones": [
      "Completar autoevaluación de Semana 1 identificando los 3 proyectos más complejos de tus 6 años donde usaste Python para análisis predictivo o automatización, aunque no se llamaran 'data science'",
      "Revisar 10 ofertas de Data Scientist en fintechs argentinas (LinkedIn/Bumeran) y hacer lista de 15 keywords/habilidades que se repiten (ej: scikit-learn, A/B testing, feature engineering, SQL avanzado)",
      "Mapear tu experiencia actual contra esas keywords: marcar en verde lo que ya hiciste, en amarillo lo que hiciste parcialmente, en rojo lo que falta evidenciar"
    ],
    "linkedin_acciones": [
      "Reescribir las 3 experiencias laborales principales del CV usando formato CAR (Contexto-Acción-Resultado), priorizando proyectos donde aplicaste Python/análisis de datos con impacto cuantificado (ej: 'Desarrollé modelo predictivo en Python que redujo 23% el tiempo de aprobación crediticia procesando 15K solicitudes mensuales')",
      "Crear sección de Proyectos en CV con 2 casos: (1) proyecto de tu trabajo actual reenmarcado como iniciativa de data science, (2) proyecto personal de ML aplicado a finanzas que vas a desarrollar en Semana 2",
      "Ajustar título profesional de 'Analista Senior' a 'Data Analyst transitioning to Data Science | Python, ML, Finance' para reflejar dirección sin mentir sobre situación actual"
    ],
    "networking_acciones": [
      "Optimizar perfil LinkedIn: cambiar headline a 'Data Analyst → Data Scientist | Python, ML & Financial Analytics | Building portfolio in credit risk modeling', agregar banner personalizado, foto profesional actualizada",
      "Publicar primer post en LinkedIn compartiendo aprendizaje sobre un proyecto de ML aplicado a finanzas (aunque sea tutorial que seguiste): demostrar expertise + posicionarte en el tema. Etiquetar 3-5 hashtags relevantes: #DataScience #Fintech #MachineLearning #Python",
      "Identificar 20 Data Scientists trabajando en Mercado Libre, Ualá, Naranja X, Brubank (LinkedIn search) y enviar 5 solicitudes de conexión personalizadas esta semana mencionando interés genuino en su trabajo específico"
    ],
    "preguntas": [
      "Desarrollar y publicar en GitHub proyecto #1 de portafolio: modelo de credit scoring usando dataset público (Kaggle 'Give Me Some Credit'), documentar todo el pipeline (EDA, feature engineering, 3 modelos comparados, métricas), README profesional en inglés",
      "Registrarte y asistir a próximo meetup de PyData Buenos Aires o Data Science BA (meetup.com), preparar elevator pitch de 30 segundos sobre tu transición, intercambiar contactos con mínimo 3 personas",
      "Practicar respuesta a pregunta clave de entrevistas: '¿Por qué querés pasar de analista a data scientist?' usando estructura: (1) evolución natural de tu carrera aplicando ML a problemas financieros, (2) ejemplo concreto de proyecto donde viste oportunidad de ML, (3) pasos que tomaste para prepararte (proyectos, aprendizaje). Grabar video de 2 min y autoevaluar"
    ],
    "alertas": [
      "Tu ventana de 3-6 meses es realista SOLO si empezás el portafolio de proyectos ML en las próximas 2 semanas. Sin evidencia pública de ML, tu CV competirá en desventaja contra perfiles con portfolios visibles",
      "No subestimes el valor de tu experiencia financiera: en entrevistas fintech, tu conocimiento de métricas de negocio, regulación y procesos vale tanto o más que hacer un RandomForest perfecto. Preparate para demostrar expertise de dominio"
    ],
    "mensaje_candidato": "María, tu combinación de 6 años en finanzas + Python te pone en una posición más fuerte de lo que quizás percibís. El mercado fintech porteño valora muchísimo perfiles que entienden el negocio financiero Y pueden buildear modelos. Tu 'obstáculo' de mostrar proyectos ML sin experiencia formal lo resolvemos en 4-6 semanas con un portafolio estratégico. Arrancamos.",
    "scores": [
      {
        "label": "CV y marca personal",
        "val": 55
      },
      {
        "label": "LinkedIn",
        "val": 45
      },
      {
        "label": "Claridad de objetivo",
        "val": 75
      },
      {
        "label": "Red de contactos",
        "val": 40
      },
      {
        "label": "Propuesta de valor",
        "val": 70
      }
    ]
  }
}
```

## sonnet-5-5 · migrada · repetición 1

HTTP 502 · API 31440 ms · tokens 1344→4000 · $0.0427 · parada max_tokens · bloques ["text"]

Estructura: ✗ status 502

Avisos:
```
[generar-informe] Claude cortó la respuesta por max_tokens
```

```json
{
  "error": "No se pudo parsear informe de Claude",
  "raw": "{\n  \"resumen\": \"María tiene una base sólida: 6 años como analista de datos en finanzas, formación en Economía y un stack técnico (SQL, Python, Power BI) que ya cubre buena parte de lo que piden los roles de Data Scientist junior/semi-senior en fintech. Está empleada, lo que le da margen para buscar sin presión, con una ventana de 3-6 meses. Su principal brecha no es de capacidad sino de evidencia: tiene el dominio financiero y las herramientas, pero todavía no tiene un portafolio visible que dem"
}
```

## sonnet-5-5 · migrada · repetición 2

HTTP 200 · API 30019 ms · tokens 1344→3840 · $0.0411 · parada end_turn · bloques ["text"]

Estructura: ✓

```json
{
  "ok": true,
  "informe": {
    "resumen": "María tiene una base sólida: 6 años como analista de datos en finanzas, Lic. en Economía y un stack técnico (SQL, Python, Power BI) que ya cubre buena parte de lo que piden los roles de Data Scientist en fintech. Está empleada, lo cual le da margen para buscar sin presión y negociar mejor. Su desafío principal no es la falta de capacidad sino la falta de evidencia visible de ML: hoy su perfil se lee como 'analista senior' y necesita reposicionarse como 'analista en transición a Data Science' con proyectos que lo demuestren. Con 3-6 meses de horizonte, el plan es realista si arranca ya a construir portfolio y a activar su red en el ecosistema fintech.",
    "fortalezas": [
      "Dominio del negocio financiero: 6 años en finanzas es un diferenciador fuerte frente a candidatos de perfil puramente técnico, ya que las fintechs valoran quien entiende riesgo, crédito, pagos y métricas de producto",
      "Stack técnico ya alineado: SQL y Python son la base de cualquier rol de Data Science, y Power BI demuestra capacidad de comunicar insights a stakeholders no técnicos",
      "Formación en Economía: aporta rigor en estadística, econometría y pensamiento causal, muy valorado en modelos de scoring, pricing y detección de fraude",
      "Inglés avanzado y disponibilidad para trabajar remoto: abre el acceso a fintechs de LATAM y a empresas del exterior que contratan desde Buenos Aires, con mejores rangos salariales"
    ],
    "gaps": [
      "Sin portfolio de ML visible: no tiene proyectos publicados (GitHub, Kaggle, blog) que demuestren modelado predictivo, lo que hoy la deja fuera de los filtros de muchos reclutadores técnicos",
      "Falta de experiencia formal en ML en producción: nunca desplegó un modelo, por lo que necesita proyectos que muestren el ciclo completo (datos, features, modelo, evaluación, interpretación de resultados)",
      "Posicionamiento ambiguo: su título actual ('Analista senior') no comunica su objetivo de Data Scientist; recruiters que buscan DS no la van a encontrar con las keywords actuales",
      "Posible gap en herramientas del stack DS moderno (scikit-learn, XGBoost, Git, Docker, cloud) que suelen aparecer en las job descriptions de fintechs"
    ],
    "estrategia": "La estrategia es reposicionarse en lugar de empezar de cero: María debe aprovechar su ventaja de dominio financiero y construir 2-3 proyectos de ML aplicados a problemas reales de fintech (scoring crediticio, detección de fraude, churn, segmentación de clientes) usando datasets públicos como Kaggle o Home Credit. Estos proyectos van a resolver su principal obstáculo, porque funcionan como experiencia demostrable. En paralelo, debe volver visible su transición: CV y LinkedIn orientados a Data Science, con logros cuantificados de su rol actual. Por último, debe apuntar a posiciones puente (Data Scientist Jr/Semi-Senior, Analytics Engineer o DS en equipos de riesgo) y activar networking directo con Data Scientists y hiring managers de fintechs, porque el mercado de transición se mueve más por referidos que por postulaciones frías.",
    "mercado": "El ecosistema fintech de LATAM (Mercado Pago, Ualá, Nubank, Naranja X, Brubank y startups de crédito y pagos) contrata activamente perfiles de Data Science, y muchas posiciones son remotas o híbridas con apertura a Argentina. Además, fintechs de EE.UU. y Europa contratan talento argentino en USD, con inglés avanzado como requisito clave. La competencia es alta en roles junior puros, pero los perfiles que combinan dominio financiero con habilidades técnicas tienen ventaja en equipos de riesgo, crédito y fraude.",
    "nicho": "Data Science aplicada a riesgo crediticio y detección de fraude en fintechs: es el segmento donde su experiencia en finanzas pesa más, la demanda es sostenida y los proyectos de portfolio (scoring, default prediction) son fáciles de construir con datos públicos y de explicar en entrevistas.",
    "cv_acciones": [
      "Definir por escrito el rol objetivo exacto (ej: 'Data Scientist en riesgo crediticio, fintech, remoto') y listar 10 job descriptions reales de LinkedIn para identificar las 8-10 skills que más se repiten",
      "Hacer un inventario de tus últimos 6 años: anotar 8-10 proyectos o análisis donde hayas usado SQL/Python y registrar el impacto en números (ahorro, % de mejora, tiempo reducido, decisiones influenciadas)",
      "Completar una autoevaluación de skills contra esas 10 job descriptions: marcar qué dominás, qué tenés a medias (ej: estadística aplicada, scikit-learn) y qué te falta (ej: Git, cloud, despliegue de modelos)",
      "Elegir 2 ideas de proyectos de ML orientados a fintech (ej: scoring crediticio con Home Credit, detección de fraude con dataset de tarjetas) y definir alcance y fecha de entrega de cada uno",
      "Armar un plan de estudio de 3-6 meses con bloques fijos de 5 horas semanales para cerrar los gaps técnicos detectados, priorizando scikit-learn, evaluación de modelos y Git"
    ],
    "linkedin_acciones": [
      "Reescribir el CV a una página orientado a Data Science: mover SQL, Python y Power BI al inicio y reformular 4-5 logros con la estructura 'verbo + qué hiciste + resultado medible' (ej: 'Automaticé el reporte mensual con Python, reduciendo 12 horas de trabajo manual a 1')",
      "Agregar una sección 'Proyectos' al CV con los 2 proyectos de ML planificados (aunque estén en curso), incluyendo el link al repositorio de GitHub y 1 línea con el resultado o métrica clave",
      "Redactar un resumen profesional de 3 líneas que conecte finanzas + datos + ML (ej: 'Analista de datos con 6 años en finanzas, especializada en SQL y Python, enfocada en modelos de riesgo y analítica predictiva para fintech')",
      "Crear una versión del CV en inglés con las mismas keywords y adaptarla para postulaciones a empresas del exterior",
      "Pedir feedback del CV a 2 personas que trabajen como Data Scientists y ajustar según sus comentarios antes de enviarlo a cualquier postulación"
    ],
    "networking_acciones": [
      "Actualizar el titular de LinkedIn con keywords de Data Science (ej: 'Data Analyst → Data Scientist | SQL, Python, ML | Finanzas & Riesgo') y cambiar la ubicación/preferencias para recibir ofertas remotas",
      "Subir el primer proyecto de ML terminado a GitHub con un README claro (problema, datos, metodología, resultados, conclusiones de negocio) y publicarlo en la sección 'Destacados' de LinkedIn",
      "Escribir y publicar 1 post por semana durante 4 semanas contando lo que aprendés en tu transición (ej: 'Cómo construí un modelo de scoring crediticio con XGBoost y qué aprendí sobre el desbalance de clases')",
      "Completar la sección de habilidades con las 10 skills clave de las job descriptions y conseguir al menos 5 validaciones de colegas actuales o anteriores",
      "Seguir y empezar a interactuar (comentarios sustanciosos, no solo likes) con 15 Data Scientists y 10 hiring managers de fintechs como Mercado Pago, Ualá, Naranja X y Nubank"
    ],
    "preguntas": [
      "Armar una lista de 30 empresas objetivo (fintechs de LATAM y empresas del exterior que contraten en Argentina) y activar alertas de empleo en LinkedIn con 3 búsquedas: 'Data Scientist remoto', 'Data Scientist fintech' y 'Risk Data Scientist'",
      "Enviar 5 mensajes personalizados por semana a Data Scientists de esas empresas pidiendo una charla informativa de 15 minutos (no pidiendo trabajo), con un mensaje corto que mencione algo específico de su trayectoria",
      "Postularte a 5-8 posiciones por semana, priorizando las que tengan referido o contacto interno, y registrar cada postulación en una planilla con fecha, empresa, contacto y estado",
      "Preparar 5 historias en formato STAR basadas en tus proyectos (3 de tu trabajo actual y 2 de tus proyectos de ML) y practicar la explicación de cada modelo en lenguaje no técnico",
      "Practicar entrevistas técnicas: resolver 2 ejercicios de SQL y 1 de Python/estadística por semana (StrataScratch, LeetCode o DataLemur) y hacer al menos 2 simulacros de entrevista con colegas o en plataformas como Pramp"
    ],
    "alertas": [
      "Al estar empleada, cuidá la confidencialidad: no publiques ni subas a GitHub datos, código o métricas reales de tu empresa actual; usá solo datasets públicos para tus proyectos",
      "Evitá postularte masivamente sin personalizar: con tu perfil en transición, 10 postulaciones bien dirigidas con referido rinden más que 50 genéricas",
      "Si una oferta pide 4+ años de experiencia exclusiva en ML, no la descartes automáticamente: tus 6 años en datos + proyectos de ML pueden compensar, pero priorizá primero las posiciones semi-senior abiertas a perfiles en transición"
    ],
    "mensaje_candidato": "María, tenés algo que a muchos aspirantes a Data Scientist les falta: seis años de experiencia real en finanzas y un stack técnico que ya funciona. Tu obstáculo con los proyectos de ML tiene solución concreta: dos buenos proyectos aplicados a fintech pueden cambiar por completo cómo te ve el mercado en pocas semanas. Estás en una posición muy buena para hacer esta transición con tranquilidad y estrategia.",
    "scores": [
      {
        "label": "CV y marca personal",
        "val": 55
      },
      {
        "label": "LinkedIn",
        "val": 50
      },
      {
        "label": "Claridad de objetivo",
        "val": 80
      },
      {
        "label": "Red de contactos",
        "val": 40
      },
      {
        "label": "Propuesta de valor",
        "val": 60
      }
    ]
  }
}
```
