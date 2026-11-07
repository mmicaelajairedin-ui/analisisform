# Sonnet 4.5 (main) contra Sonnet 5.5 (migrada)

Fecha: 2026-11-07T23:32:18.568Z · referencia: `b39f024` · repeticiones: 2

| Brazo | Llamadas | Estructura OK | ≠200 | Rechazos | Cortadas | Latencia p50 | p90 | Coste |
|---|---|---|---|---|---|---|---|---|
| sonnet-4-5 · main | 32 | 31 | 1 | 0 | 0 | 10626 ms | 45979 ms | $0.5462 |
| sonnet-5-5 · migrada | 32 | 31 | 1 | 0 | 1 | 5420 ms | 20026 ms | $0.5133 |

## Caso por caso

### informe-carrera · `generar-informe`

| Brazo | # | HTTP | Estructura | API ms | Tokens salida | Parada |
|---|---|---|---|---|---|---|
| sonnet-4-5 · main | 1 | 200 | ✓ | 49967 | 2133 | end_turn |
| sonnet-4-5 · main | 2 | 200 | ✓ | 53760 | 2185 | end_turn |
| sonnet-5-5 · migrada | 1 | 502 | ✗ status 502 | 31440 | 4000 | max_tokens |
| sonnet-5-5 · migrada | 2 | 200 | ✓ | 30019 | 3840 | end_turn |

<details><summary>sonnet-4-5 · main — salida (repetición 1)</summary>

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
</details>

<details><summary>sonnet-5-5 · migrada — salida (repetición 1)</summary>

```json
{
  "error": "No se pudo parsear informe de Claude",
  "raw": "{\n  \"resumen\": \"María tiene una base sólida: 6 años como analista de datos en finanzas, formación en Economía y un stack técnico (SQL, Python, Power BI) que ya cubre buena parte de lo que piden los roles de Data Scientist junior/semi-senior en fintech. Está empleada, lo que le da margen para buscar sin presión, con una ventana de 3-6 meses. Su principal brecha no es de capacidad sino de evidencia: tiene el dominio financiero y las herramientas, pero todavía no tiene un portafolio visible que dem"
}
```
</details>

### informe-fitness · `generar-informe`

| Brazo | # | HTTP | Estructura | API ms | Tokens salida | Parada |
|---|---|---|---|---|---|---|
| sonnet-4-5 · main | 1 | 200 | ✓ | 43710 | 1937 | end_turn |
| sonnet-4-5 · main | 2 | 200 | ✓ | 45979 | 2117 | end_turn |
| sonnet-5-5 · migrada | 1 | 200 | ✓ | 20026 | 2570 | end_turn |
| sonnet-5-5 · migrada | 2 | 200 | ✓ | 19303 | 2375 | end_turn |

<details><summary>sonnet-4-5 · main — salida (repetición 1)</summary>

```json
{
  "ok": true,
  "informe": {
    "resumen": "Juan, 38 años, trabajo sedentario de oficina, busca reducir 6 kg de peso mientras desarrolla fuerza de forma segura. Su objetivo es claro y alcanzable en 3-4 meses con adherencia consistente. El principal desafío será romper el patrón sedentario e instalar nuevos hábitos de movimiento sin generar lesiones por sobreexigencia inicial. Necesitamos construir una base de movilidad y técnica antes de progresar en cargas.",
    "fortalezas": [
      "Objetivo cuantificable y realista (6 kg en plazo razonable)",
      "Consciencia sobre prevención de lesiones desde el inicio",
      "Edad óptima para generar cambios significativos en composición corporal"
    ],
    "gaps": [
      "Ausencia de rutina de movimiento establecida por trabajo sedentario",
      "Probable déficit de movilidad articular y estabilidad por inactividad prolongada",
      "Falta definir días disponibles, equipo accesible y experiencia previa con entrenamiento"
    ],
    "estrategia": "Comenzaremos con una fase de adaptación de 3 semanas enfocada en movilidad, patrones básicos de movimiento (sentadilla, bisagra, empuje, tracción) y activación metabólica suave. Luego construiremos base de fuerza con 3 sesiones semanales de entrenamiento de resistencia progresivo, priorizando técnica sobre carga. Paralelamente, instalaremos caminatas diarias de 20-30 minutos para acelerar la pérdida de grasa sin impacto articular. La nutrición se enfocará en déficit calórico moderado (300-400 kcal) con proteína elevada (1.8-2g/kg peso objetivo) para preservar masa muscular durante la pérdida de peso. Mediremos progreso cada 3 semanas con peso, perímetros y fotos para ajustar variables.",
    "cv_acciones": [
      "Semana 1-3 ADAPTACIÓN: 3 sesiones de 30 min de movilidad + patrón básico (sentadilla al cajón, plancha, remo con banda). Objetivo: técnica perfecta sin dolor",
      "Iniciar caminatas diarias de 15 minutos post-laboral para romper sedentarismo (aumentar 5 min cada semana hasta 30 min)",
      "Establecer horarios fijos de entrenamiento compatible con agenda laboral (ej: martes/jueves/sábado 7am o lunes/miércoles/viernes 18:30)",
      "Realizar evaluación postural básica: test de sentadilla overhead, movilidad de hombro y cadera para detectar limitaciones"
    ],
    "linkedin_acciones": [
      "Semana 4-8 BASE: 3x/semana fullbody con 4 ejercicios básicos: sentadilla goblet, peso muerto rumano, press de pecho, remo. 3 series x 10-12 reps, progresión 2.5kg cada 2 semanas",
      "Integrar 2 días de cardio LISS adicional (caminata rápida o bici estática 25-30 min) para maximizar déficit calórico",
      "Establecer ingesta proteica objetivo: mínimo 120g diarios (desayuno 30g, almuerzo 40g, cena 40g, snack 10g). Registrar primeras 2 semanas para crear hábito",
      "Trabajar core 2x/semana: plancha frontal/lateral, dead bug, bird dog (3x30-45seg) para proteger zona lumbar en progresión de cargas"
    ],
    "networking_acciones": [
      "Semana 9-12 PROGRESIÓN: aumentar volumen a 4 ejercicios x 4 series, mantener rango 8-10 reps con cargas que permitan 2 RIR (repeticiones en reserva)",
      "Introducir variantes de ejercicios: sentadilla con barra, peso muerto convencional, press inclinado, dominadas asistidas o tracciones",
      "Implementar 1 día de HIIT metabólico corto (15 min: 30seg trabajo/30seg pausa x 6 ejercicios como burpees adaptados, mountain climbers, swings)",
      "Ajustar nutrición según progreso: si pérdida >0.75kg/semana reducir déficit, si <0.4kg aumentar actividad NEAT (caminar más, escaleras)",
      "Incorporar trabajo de movilidad específico 10 min pre-entrenamiento: cadera, torácica, tobillos según limitaciones detectadas"
    ],
    "preguntas": [
      "MEDICIÓN semana 3, 6, 9, 12: Peso corporal en ayunas (esperado: -0.5kg/semana = -6kg total). Circunferencia cintura (esperado: -4-6cm) y cadera",
      "Evaluar fuerza cada 3 semanas: 1RM estimado en sentadilla y peso muerto (esperado: +15-25% en 12 semanas). Repeticiones máximas en dominadas o remo",
      "Medición de composición si accesible: % grasa corporal con bioimpedancia o pliegues cutáneos (subescapular, tricipital, abdominal, suprailiaco). Objetivo: reducir 3-4% grasa manteniendo masa magra",
      "Registro semanal: días entrenados (meta: 85% adherencia = 10/12 sesiones mensuales), minutos de cardio acumulados, dolor/molestias (escala 0-10)"
    ],
    "alertas": [
      "TRABAJO SEDENTARIO: alto riesgo de acortamiento de flexores de cadera, debilidad glútea y cifosis dorsal. Incluir estiramientos de psoas, activación de glúteos pre-entrenamiento obligatorio",
      "INICIO POST-SEDENTARISMO: NO comenzar con cargas pesadas. Primeras 3 semanas son de aprendizaje motor. Respetar dolor (escala >4/10 = detener ejercicio)",
      "Si aparece dolor lumbar persistente, reducir volumen de bisagra de cadera y fortalecer core 2 semanas antes de progresar",
      "Consultar médico antes de iniciar si: hipertensión no controlada, diabetes, problemas cardiovasculares o articulares diagnosticados"
    ],
    "mensaje_candidato": "Juan, tu objetivo de bajar 6 kg ganando fuerza es totalmente alcanzable y la consciencia sobre hacerlo sin lesiones muestra madurez en el enfoque. Vamos a trabajar primero en que tu cuerpo 're-aprenda' a moverse bien después del sedentarismo, y luego construir fuerza real de forma progresiva. En 12 semanas vas a sentirte completamente diferente, con más energía en tu día laboral y resultados visibles. ¡Arrancamos con inteligencia y constancia!",
    "scores": [
      {
        "label": "Claridad de objetivo",
        "val": 85
      },
      {
        "label": "Base técnica",
        "val": 20
      },
      {
        "label": "Composición corporal",
        "val": 45
      },
      {
        "label": "Hábitos",
        "val": 30
      },
      {
        "label": "Constancia esperada",
        "val": 70
      }
    ]
  }
}
```
</details>

<details><summary>sonnet-5-5 · migrada — salida (repetición 1)</summary>

```json
{
  "ok": true,
  "informe": {
    "resumen": "Juan, 38 años, llega con un perfil clásico de oficina y sedentarismo: el punto de partida es de bajo acondicionamiento, pero con un objetivo claro y realista (bajar 6 kg y ganar fuerza sin lesionarse). No declaró lesiones ni medicación, aunque faltan datos clave (peso, altura, días disponibles, equipo) que conviene completar en la primera sesión. Bajar 6 kg a un ritmo seguro de 0,4-0,6 kg por semana implica unas 10-14 semanas, y combinarlo con entrenamiento de fuerza permite perder grasa preservando masa muscular.",
    "fortalezas": [
      "Objetivo concreto y medible (6 kg) combinado con una meta de fuerza, que es la mejor combinación para recomposición corporal",
      "Prioriza explícitamente evitar lesiones, lo que favorece una progresión paciente y técnica en lugar de apurar cargas",
      "A los 38 años y sin lesiones declaradas, tiene una excelente capacidad de adaptación al entrenamiento de fuerza si la progresión es gradual"
    ],
    "gaps": [
      "Sedentarismo y trabajo sentado: probable acortamiento de flexores de cadera y pectorales, y debilidad de glúteos y musculatura postural de espalda alta",
      "Base técnica de movimiento desconocida: hay que evaluar sentadilla, bisagra de cadera, empuje y tracción antes de cargar peso",
      "Hábitos de alimentación, sueño y nivel de actividad diaria (pasos) sin relevar, y son los que más pesan en la pérdida de grasa"
    ],
    "estrategia": "Arrancamos con una fase de adaptación de 2 semanas enfocada en técnica, movilidad y hábito, sin buscar fatiga extrema. Luego construimos una base de fuerza con 3 sesiones semanales de cuerpo completo (patrones: sentadilla, bisagra de cadera, empuje, tracción, core), con progresión de carga o repeticiones cada semana mientras la técnica sea limpia. En paralelo, sumamos caminata diaria y un déficit calórico moderado (aprox. 300-500 kcal/día) con proteína alta para perder grasa sin sacrificar músculo. Cada 2 semanas medimos y ajustamos; cada 4 semanas hacemos un día de descarga para prevenir sobrecarga y lesiones.",
    "cv_acciones": [
      "Semanas 1-2: 3 sesiones de 40-45 min de cuerpo completo con cargas livianas (RPE 5-6 sobre 10), 2 series de 10-12 repeticiones, priorizando técnica de sentadilla al cajón, bisagra de cadera, remo y flexiones inclinadas",
      "Realizar una evaluación de movimiento inicial (sentadilla, bisagra, plancha, movilidad de cadera y hombros) para detectar compensaciones antes de aumentar cargas",
      "Incorporar 8-10 min de movilidad y activación de glúteos al inicio de cada sesión, y 2 pausas activas de 3 min durante la jornada de oficina"
    ],
    "linkedin_acciones": [
      "Semanas 3-6: 3 sesiones de fuerza semanales de cuerpo completo con 3 series de 8-12 repeticiones y progresión de carga del 2-5% (o +1-2 repeticiones) cuando se completen todas las series con buena técnica",
      "Sumar una meta de actividad diaria de 7.000-8.000 pasos, aumentando 1.000 cada 2 semanas, para elevar el gasto calórico sin estrés articular",
      "Establecer una estructura nutricional base: proteína de 1,6-2 g/kg de peso corporal, 3-4 comidas ordenadas, 2-2,5 L de agua y un déficit moderado de 300-500 kcal/día, sin dietas extremas"
    ],
    "networking_acciones": [
      "Semanas 7-10: pasar a una progresión más exigente (3-4 series de 6-10 repeticiones en ejercicios principales) manteniendo 3 sesiones, e incluir 1-2 sesiones de cardio de baja intensidad de 20-30 min (caminata en pendiente o bici)",
      "Programar una semana de descarga cada 4 semanas, con 40-50% menos de volumen, para consolidar adaptaciones y prevenir lesiones por sobreuso",
      "Sumar trabajo específico de espalda alta, glúteos y core anti-rotación para contrarrestar el efecto del trabajo sentado y proteger la zona lumbar al subir cargas"
    ],
    "preguntas": [
      "Medición inicial (día 1): peso, altura, perímetro de cintura y cadera, pliegues cutáneos y % de grasa; calcular IMC e IMO (índice músculo-óseo) como línea base",
      "Control cada 2 semanas: peso corporal (promedio semanal, mismo horario y condiciones) y perímetro de cintura; ajustar calorías si la baja es menor a 0,25 kg/semana o mayor a 0,8 kg/semana",
      "Control cada 4 semanas: pliegues/% de grasa, IMO y test de fuerza submáximo (por ejemplo, repeticiones con carga fija en sentadilla y remo) para verificar que se baja grasa y se gana fuerza a la vez"
    ],
    "alertas": [
      "No declaró lesiones ni medicación; confirmar en la primera sesión si hay antecedentes de dolor lumbar, rodillas u hombros, o condiciones como hipertensión o problemas cardíacos",
      "Dado el sedentarismo, se recomienda un chequeo médico general (con control de presión y eventual electrocardiograma) antes de aumentar la intensidad, sobre todo si hay antecedentes familiares cardiovasculares",
      "Detener el ejercicio y consultar ante dolor articular agudo, mareos, dolor en el pecho o falta de aire desproporcionada; distinguir la molestia muscular normal (agujetas) del dolor punzante",
      "Evitar cargas máximas, ejercicios balísticos y rangos extremos durante las primeras 6-8 semanas; la técnica y la regularidad son prioridad sobre el peso levantado"
    ],
    "mensaje_candidato": "Juan, tu objetivo de bajar 6 kg y ganar fuerza sin lesionarte es totalmente alcanzable y, además, muy inteligente: priorizar la técnica desde el inicio es lo que separa a quienes sostienen el cambio de quienes abandonan. Vamos a ir paso a paso, empezando suave y progresando semana a semana, y vas a notar cómo tu energía en el trabajo mejora mucho antes de ver los números en la balanza. Cuento con vos, y cualquier molestia que sientas, me la contás para ajustar el plan.",
    "scores": [
      {
        "label": "Claridad de objetivo",
        "val": 75
      },
      {
        "label": "Base técnica",
        "val": 30
      },
      {
        "label": "Composición corporal",
        "val": 50
      },
      {
        "label": "Hábitos",
        "val": 35
      },
      {
        "label": "Constancia esperada",
        "val": 60
      }
    ]
  }
}
```
</details>

### informe-life · `generar-informe`

| Brazo | # | HTTP | Estructura | API ms | Tokens salida | Parada |
|---|---|---|---|---|---|---|
| sonnet-4-5 · main | 1 | 200 | ✓ | 27147 | 1207 | end_turn |
| sonnet-4-5 · main | 2 | 200 | ✓ | 25534 | 1146 | end_turn |
| sonnet-5-5 · migrada | 1 | 200 | ✓ | 22106 | 2720 | end_turn |
| sonnet-5-5 · migrada | 2 | 200 | ✓ | 18315 | 2343 | end_turn |

<details><summary>sonnet-4-5 · main — salida (repetición 1)</summary>

```json
{
  "ok": true,
  "informe": {
    "resumen": "Lucía está en un punto de inflexión importante: lidera un área, tiene dos hijos y siente que el equilibrio entre trabajo y familia se le escapa de las manos. La culpa y la dificultad para poner límites son las dos trabas principales que le impiden tomar decisiones con claridad. Este año se presenta como el momento para revisar si su ciudad actual sigue siendo el lugar donde quiere estar, pero primero necesita ganar espacio interno para pensar con calma.",
    "fortalezas": [
      "Ocupa un rol de liderazgo, lo que habla de su capacidad de gestión y responsabilidad",
      "Está identificando con claridad lo que le pasa (culpa, falta de límites), un primer paso valioso",
      "Se anima a plantear una pregunta grande (cambio de ciudad), señal de que está dispuesta a moverse"
    ],
    "gaps": [
      "Poner límites concretos en su día a día laboral y familiar",
      "Desactivar el piloto automático de la culpa cuando prioriza su bienestar",
      "Crear criterios claros para evaluar el cambio de ciudad sin presión externa ni autoexigencia"
    ],
    "estrategia": "El proceso con Lucía arranca por ganar aire: identificar dónde está poniendo energía de más y dónde puede soltar sin que se caiga nada. Trabajaremos desde preguntas que la ayuden a discernir entre lo urgente y lo importante, entre lo que elige y lo que hereda por mandato. En paralelo, vamos a mapear qué significa para ella 'equilibrio' de verdad, no en abstracto, y qué criterios le importan para decidir sobre la ciudad (trabajo, familia, calidad de vida, vínculos). El foco es que Lucía tome decisiones desde un lugar de claridad y no de agotamiento.",
    "cv_acciones": [
      "Registrar durante una semana las situaciones concretas donde sintió culpa: qué pasó, qué dijo (o no dijo), qué eligió hacer",
      "Identificar 3 límites que necesita poner (en el trabajo, en casa, consigo misma) y escribir por qué son importantes para ella",
      "Hacer una lista de las 5 cosas que más energía le consumen hoy y marcar cuáles son negociables"
    ],
    "linkedin_acciones": [
      "Definir qué significa 'equilibrio' para ella en este momento: escribir 5 características concretas de cómo sería su semana ideal",
      "Elegir UN límite de los identificados y comunicarlo a una persona específica (jefe, pareja, equipo) en los próximos 7 días",
      "Crear una lista de criterios para evaluar la decisión de cambio de ciudad: qué gana, qué pierde, qué necesita que esté presente"
    ],
    "networking_acciones": [
      "Revisar cómo resultó el límite comunicado: qué pasó, cómo se sintió, qué aprendió",
      "Conversar con 2 personas de confianza (sin pedirles que decidan por ella) sobre su situación: escuchar qué le devuelven",
      "Probar una práctica diaria de 10 minutos para desconectar del modo 'resolver' (caminar, escribir, respirar) y registrar qué nota cuando frena"
    ],
    "preguntas": [
      "¿Qué parte de vos necesita permiso para poner ese límite sin sentir culpa?",
      "Si tu decisión sobre la ciudad la tomara alguien que te quiere profundamente, ¿qué creés que elegiría para vos?",
      "¿Qué pequeña cosa podrías soltar esta semana que te daría más aire sin que nada importante se caiga?"
    ],
    "alertas": [],
    "mensaje_candidato": "Lucía, lo que estás trayendo es valiente: animarte a mirar de frente lo que no está funcionando y preguntarte si tu vida puede ser distinta. La culpa y los límites son temas que se trabajan, no son parte de tu identidad. Vamos a ir paso a paso, con preguntas que te ayuden a elegir desde vos y no desde el 'debería'.",
    "scores": [
      {
        "label": "Claridad del objetivo",
        "val": 55
      },
      {
        "label": "Compromiso con el proceso",
        "val": 70
      },
      {
        "label": "Red de apoyo",
        "val": 60
      },
      {
        "label": "Constancia",
        "val": 50
      },
      {
        "label": "Autoconocimiento",
        "val": 65
      }
    ]
  }
}
```
</details>

<details><summary>sonnet-5-5 · migrada — salida (repetición 1)</summary>

```json
{
  "ok": true,
  "informe": {
    "resumen": "Lucía, de 44 años, es directora de área y madre de dos hijos, y llega con dos preguntas grandes que se pisan entre sí: cómo recuperar el equilibrio entre trabajo y familia, y si le conviene cambiar de ciudad. Este año aparece como un momento de balance. Lo que más la frena es la dificultad para poner límites y la culpa que le genera hacerlo. Es probable que la decisión de la mudanza esté cargando con una expectativa que en realidad pertenece al tema del equilibrio: ¿cambiar de ciudad resolvería la sobrecarga, o primero hace falta ordenar cómo se reparte hoy su tiempo y su energía?",
    "fortalezas": [
      "Tiene claridad sobre qué área de su vida está desbalanceada y se anima a nombrarlo",
      "Ocupa un rol de responsabilidad, lo que indica capacidad de decisión, de gestión y de sostener compromisos complejos",
      "Reconoce con honestidad su dificultad para poner límites y la culpa asociada, un punto de partida valioso para trabajar",
      "Se plantea una decisión de fondo (cambio de ciudad) con tiempo y no desde la urgencia"
    ],
    "gaps": [
      "Dificultad para poner límites en el trabajo y en la familia, sostenida por la culpa",
      "Dos objetivos mezclados (equilibrio y mudanza) sin un orden de prioridad ni criterios propios definidos",
      "Falta de claridad sobre qué significa 'equilibrio' en concreto para ella (horas, presencia, energía, tiempo propio)",
      "Poco espacio personal visible: su agenda parece organizada alrededor de las demandas de otros",
      "Criterios de decisión sobre la mudanza aún no explicitados ni conversados"
    ],
    "estrategia": "Propongo separar los dos temas para que no se contaminen: primero trabajar el equilibrio y los límites, que es lo que hoy le pesa y lo que además le dará mejores datos para decidir sobre la ciudad; en paralelo, ir armando de forma liviana los criterios de la mudanza, sin presión de resolverla todavía. En el trabajo con los límites, la culpa no se combate sino que se explora: qué creencia la sostiene, de quién es esa vara. Conviene avanzar con experimentos pequeños y observables (un límite por semana) en lugar de grandes cambios. La decisión sobre la ciudad se tomará más adelante, con criterios claros y con la familia incluida en la conversación. El seguimiento servirá para ajustar el ritmo y mantener los acuerdos.",
    "cv_acciones": [
      "Definir juntas qué significa 'equilibrio' para Lucía en cifras y situaciones concretas (por ejemplo: horas de salida, cenas en familia por semana, tiempo propio)",
      "Hacer una 'rueda de la vida' (trabajo, familia, pareja, salud, tiempo propio, amistades, desarrollo) puntuando de 1 a 10 cada área y anotando qué haría falta para subir un punto",
      "Registrar durante una semana cómo distribuye su tiempo y su energía, marcando qué actividades la nutren y cuáles la agotan",
      "Acordar el formato del proceso: frecuencia de las sesiones, duración, confidencialidad y qué esperamos cada una del acompañamiento",
      "Identificar tres situaciones recientes donde le costó decir que no y qué sintió en el cuerpo en ese momento"
    ],
    "linkedin_acciones": [
      "Redactar en una frase su objetivo principal de los próximos tres meses, en positivo y medible (por ejemplo: 'salir del trabajo a las 18:30 al menos tres días por semana')",
      "Separar la decisión de la mudanza en un objetivo propio con fecha tentativa de decisión (por ejemplo, dentro de 6 meses) para sacarla del 'a resolver ya'",
      "Elegir un único límite para practicar la primera semana (por ejemplo, no responder mensajes de trabajo después de cierta hora) y anotar cómo lo comunica",
      "Armar una lista de criterios para evaluar el cambio de ciudad: trabajo, escuela de los chicos, red de apoyo, costo de vida, pareja, deseos personales; ordenarlos por importancia",
      "Definir un indicador simple de avance que ella misma pueda observar cada semana (por ejemplo, cuántas noches llegó a cenar con sus hijos)"
    ],
    "networking_acciones": [
      "Revisar al inicio de cada sesión el límite practicado: qué hizo, qué pasó, qué sintió y qué aprendió, sin evaluar en términos de éxito o fracaso",
      "Escribir un registro breve de los momentos en que apareció la culpa, con la frase exacta que se dijo a sí misma",
      "Tener una conversación abierta con su pareja o con quien comparta la crianza sobre cómo se reparten hoy las tareas y qué le gustaría cambiar",
      "Explorar la mudanza con datos: visitar o investigar la ciudad candidata, hablar con alguien que haya hecho un cambio similar y volcar lo aprendido en su lista de criterios",
      "Identificar a una o dos personas de confianza que puedan acompañarla en el proceso y acordar con ellas cómo apoyarla"
    ],
    "preguntas": [
      "Si dentro de un año sintieras que recuperaste el equilibrio, ¿qué estaría pasando un martes cualquiera en tu día?",
      "¿De quién es la voz que aparece cuando sentís culpa por decir que no? ¿Qué te dice exactamente?",
      "Si la mudanza no fuera la solución a nada, ¿seguirías queriéndola? ¿Qué te atrae de ella por sí misma?",
      "¿Qué estarías dispuesta a dejar de hacer, aunque nadie más lo pueda hacer como vos?",
      "¿Qué necesitás vos, en este momento, que todavía no te diste permiso de pedir?"
    ],
    "alertas": [
      "Si en el proceso aparecen señales de agotamiento sostenido, insomnio, ansiedad o ánimo muy bajo, conviene sugerirle una consulta con un profesional de la salud: el coaching no reemplaza un abordaje clínico",
      "La decisión de mudarse involucra a toda la familia: evitar tomarla en soledad o apresuradamente, y sostener el rol de acompañar sin inclinar la balanza hacia ninguna de las opciones",
      "La culpa puede estar ligada a historia personal o a mandatos familiares profundos; si se vuelve intensa o paralizante, valorar con ella la posibilidad de complementar con acompañamiento terapéutico"
    ],
    "mensaje_candidato": "Lucía, gracias por la claridad con la que contás lo que te está pasando: tener tantas responsabilidades y aun así detenerte a preguntarte cómo querés vivir dice mucho de vos. Poner límites no es quitarle nada a nadie, y la culpa que sentís es una señal para mirar con curiosidad, no un veredicto. Vamos a ir paso a paso, a tu ritmo, y la decisión sobre la ciudad va a llegar con más claridad a medida que te escuches más a vos.",
    "scores": [
      {
        "label": "Claridad del objetivo",
        "val": 55
      },
      {
        "label": "Compromiso con el proceso",
        "val": 70
      },
      {
        "label": "Red de apoyo",
        "val": 50
      },
      {
        "label": "Constancia",
        "val": 60
      },
      {
        "label": "Autoconocimiento",
        "val": 65
      }
    ]
  }
}
```
</details>

### sugerir-empleos · `generar-informe`

| Brazo | # | HTTP | Estructura | API ms | Tokens salida | Parada |
|---|---|---|---|---|---|---|
| sonnet-4-5 · main | 1 | 200 | ✓ | 17033 | 904 | end_turn |
| sonnet-4-5 · main | 2 | 200 | ✓ | 15657 | 901 | end_turn |
| sonnet-5-5 · migrada | 1 | 200 | ✓ | 9395 | 1403 | end_turn |
| sonnet-5-5 · migrada | 2 | 200 | ✓ | 9268 | 1469 | end_turn |

<details><summary>sonnet-4-5 · main — salida (repetición 1)</summary>

```json
{
  "empleos": [
    {
      "titulo": "Data Scientist - Risk Analytics",
      "empresa_tipo": "Fintech regional · Remoto LATAM",
      "relevancia": 94,
      "descripcion": "Desarrollar modelos predictivos para scoring crediticio y detección de fraude en plataforma de préstamos digitales. Trabajarás con datasets masivos de transacciones y comportamiento de usuarios para optimizar aprobaciones automáticas.",
      "requisitos": "3+ años Python/SQL, modelos ML supervisados, experiencia en scoring o riesgo crediticio, inglés avanzado",
      "salario_rango": "USD $2500-4000",
      "query_indeed": "data scientist fintech risk"
    },
    {
      "titulo": "Senior Data Analyst - Product Intelligence",
      "empresa_tipo": "Billetera digital · Buenos Aires remoto",
      "relevancia": 89,
      "descripcion": "Liderar análisis de comportamiento de usuarios en app financiera con +2M usuarios. Automatizar dashboards y reportes para product managers, identificar oportunidades de crecimiento mediante experimentación A/B.",
      "requisitos": "SQL avanzado, Python (pandas/scikit-learn), visualización (Tableau/Looker), producto digital, stakeholder management",
      "salario_rango": "ARS $800k-1.2M",
      "query_indeed": "senior data analyst fintech"
    },
    {
      "titulo": "Machine Learning Engineer - Trading Systems",
      "empresa_tipo": "Prop trading firm · Remoto global",
      "relevancia": 87,
      "descripcion": "Construir pipelines automatizados de datos para estrategias algorítmicas en crypto y mercados tradicionales. Implementar modelos de predicción de volatilidad y optimización de ejecución de órdenes.",
      "requisitos": "Python production-ready, experiencia con APIs financieras, conocimiento de mercados, deployment ML, CI/CD",
      "salario_rango": "USD $3500-5500",
      "query_indeed": "machine learning engineer trading"
    },
    {
      "titulo": "Data Scientist - Customer Insights",
      "empresa_tipo": "Banco digital · Híbrido Buenos Aires",
      "relevancia": 85,
      "descripcion": "Analizar patrones de consumo y ahorro para personalizar recomendaciones financieras. Crear modelos de segmentación y churn prediction que impacten estrategias de retención y cross-selling de productos bancarios.",
      "requisitos": "SQL + Python, CLV/churn modeling, storytelling con datos, experiencia bancaria/finanzas, español nativo",
      "salario_rango": "ARS $900k-1.4M",
      "query_indeed": "data scientist customer analytics banking"
    },
    {
      "titulo": "Analytics Engineer - Data Platform",
      "empresa_tipo": "Procesadora de pagos · Remoto Argentina",
      "relevancia": 82,
      "descripcion": "Diseñar y mantener infraestructura de datos para reportería transaccional en tiempo real. Automatizar ETLs complejos desde múltiples fuentes, garantizar calidad de datos para equipos de business intelligence y compliance.",
      "requisitos": "SQL experto, Python/Airflow, DBT o similar, experiencia con BigQuery/Snowflake, comprensión de negocio financiero",
      "salario_rango": "USD $2000-3500",
      "query_indeed": "analytics engineer data platform"
    }
  ]
}
```
</details>

<details><summary>sonnet-5-5 · migrada — salida (repetición 1)</summary>

```json
{
  "empleos": [
    {
      "titulo": "Data Scientist - Riesgo Crediticio",
      "empresa_tipo": "Fintech de préstamos digitales · Remoto Argentina/LATAM",
      "relevancia": 94,
      "descripcion": "Desarrollo y mantenimiento de modelos de scoring y probabilidad de default para originación de créditos. Trabajo con equipos de producto y riesgo para medir el impacto de los modelos en mora y aprobación.",
      "requisitos": "2+ años en data science, Python (pandas, scikit-learn), SQL avanzado, conocimientos de modelos de scoring, comunicación de resultados al negocio",
      "salario_rango": "USD 2.500-4.000 mensuales (contratación internacional)",
      "query_indeed": "data scientist riesgo crediticio fintech remoto"
    },
    {
      "titulo": "Data Scientist - Prevención de Fraude",
      "empresa_tipo": "Billetera virtual / procesador de pagos · Remoto Argentina",
      "relevancia": 91,
      "descripcion": "Construcción de modelos de detección de anomalías y reglas automatizadas para reducir fraude transaccional. Se prioriza el trabajo con grandes volúmenes de datos y la automatización de pipelines de monitoreo.",
      "requisitos": "Python, SQL, experiencia con datasets transaccionales, feature engineering, nociones de MLOps o automatización de procesos",
      "salario_rango": "USD 2.800-4.500 mensuales",
      "query_indeed": "data scientist fraude pagos remoto"
    },
    {
      "titulo": "Analytics Engineer / Data Scientist",
      "empresa_tipo": "Scaleup fintech regional · Remoto LATAM",
      "relevancia": 87,
      "descripcion": "Rol híbrido entre modelado y construcción de pipelines de datos confiables para métricas de negocio y modelos predictivos. Ideal para perfiles con fuerte base en SQL y automatización.",
      "requisitos": "SQL avanzado, Python, dbt o herramientas similares, data warehouses (BigQuery/Snowflake), orientación a impacto medible",
      "salario_rango": "USD 2.500-4.200 mensuales",
      "query_indeed": "analytics engineer data scientist fintech remoto"
    },
    {
      "titulo": "Data Scientist - Growth y Retención de Clientes",
      "empresa_tipo": "Neobanco / app financiera · Remoto Argentina",
      "relevancia": 82,
      "descripcion": "Análisis de comportamiento de usuarios, modelos de churn y propensión de compra de productos financieros. Diseño y lectura de experimentos A/B para medir el impacto de cada iniciativa.",
      "requisitos": "Python, SQL, estadística aplicada, A/B testing, visualización de datos, capacidad de traducir hallazgos en decisiones de producto",
      "salario_rango": "USD 2.200-3.800 mensuales",
      "query_indeed": "data scientist growth retención fintech remoto"
    },
    {
      "titulo": "Data Analyst Senior / Data Scientist Jr-SSr",
      "empresa_tipo": "Banco digital o compañía de seguros tech · Remoto Buenos Aires",
      "relevancia": 76,
      "descripcion": "Análisis exploratorio, automatización de reportes y desarrollo de primeros modelos predictivos para áreas comerciales y de riesgo. Buena puerta de entrada para escalar hacia data science.",
      "requisitos": "SQL sólido, Python para análisis y automatización, herramientas de BI (Looker, Power BI o Tableau), interés en modelado predictivo",
      "salario_rango": "ARS equivalente a USD 1.500-2.800 mensuales",
      "query_indeed": "data scientist semi senior banco digital remoto"
    }
  ]
}
```
</details>

### cv-express-es · `generar-informe`

| Brazo | # | HTTP | Estructura | API ms | Tokens salida | Parada |
|---|---|---|---|---|---|---|
| sonnet-4-5 · main | 1 | 200 | ✓ | 44862 | 2681 | end_turn |
| sonnet-4-5 · main | 2 | 200 | ✓ | 46576 | 2748 | end_turn |
| sonnet-5-5 · migrada | 1 | 200 | ✓ | 18264 | 2953 | end_turn |
| sonnet-5-5 · migrada | 2 | 200 | ✓ | 16618 | 2664 | end_turn |

<details><summary>sonnet-4-5 · main — salida (repetición 1)</summary>

```json
{
  "ok": true,
  "cv_optimizado": {
    "nombre": "María Ejemplo",
    "rol_objetivo": "Data Scientist — Fintech",
    "objetivo": "Data Scientist con 6 años transformando datos en decisiones de negocio mediante Python, SQL y machine learning. Especializada en automatización de procesos analíticos y modelos predictivos para optimización financiera.",
    "contacto": {
      "linkedin": "linkedin.com/in/ejemplo"
    },
    "competencias": [
      "Modelado predictivo y machine learning",
      "Análisis estadístico y financiero",
      "Automatización de procesos ETL",
      "Visualización de datos y storytelling",
      "Optimización de procesos analíticos",
      "Análisis de series temporales"
    ],
    "herramientas": [
      "Python (pandas, scikit-learn, NumPy)",
      "SQL (consultas avanzadas, optimización)",
      "Power BI",
      "Git",
      "Excel avanzado",
      "Jupyter Notebooks"
    ],
    "idiomas": [
      {
        "idioma": "Español",
        "nivel": "Nativo"
      },
      {
        "idioma": "Inglés",
        "nivel": "Avanzado"
      }
    ],
    "experiencia": [
      {
        "rol": "Analista senior",
        "empresa": "Empresa Uno",
        "fecha": "2021 — Actual",
        "ubicacion": "",
        "logros": [
          "Automaticé el pipeline completo de reportería financiera mensual usando Python y SQL, reduciendo el tiempo de cierre en 40% (de 5 a 3 días)",
          "Desarrollé scripts de análisis de datos que procesaban +500K registros diarios, mejorando la precisión de forecasts en 25%",
          "Implementé modelos de detección de anomalías en transacciones que identificaron patrones de fraude, generando ahorros de €80K anuales",
          "Lideré la migración de reportes manuales a dashboards automatizados en Power BI, alcanzando adopción del 90% en equipos de finanzas",
          "Optimicé consultas SQL críticas reduciendo tiempos de ejecución de 45 min a 8 min mediante indexación y refactorización"
        ]
      },
      {
        "rol": "Analista junior",
        "empresa": "Empresa Dos",
        "fecha": "2018 — 2021",
        "ubicacion": "",
        "logros": [
          "Diseñé y mantuve dashboards interactivos en Power BI para el equipo comercial, monitoreando KPIs de ventas en tiempo real",
          "Realicé análisis ad-hoc de segmentación de clientes que identificaron oportunidades de upselling por valor de €200K",
          "Colaboré en la limpieza y normalización de bases de datos legacy con +1M de registros usando SQL y Excel"
        ]
      }
    ],
    "educacion": [
      {
        "titulo": "Licenciatura en Economía",
        "institucion": "Universidad Ejemplo",
        "fecha": "2017",
        "descripcion": "Especialización en econometría y análisis cuantitativo. Tesis sobre modelos predictivos de comportamiento de consumo financiero."
      }
    ]
  },
  "carta": "Estimado equipo de selección,\n\nMe dirijo a ustedes para postularme al puesto de Data Scientist en su fintech. Con 6 años transformando datos en decisiones estratégicas en entornos financieros y comerciales, busco aplicar mi experiencia en modelado predictivo y automatización analítica en una organización que está redefiniendo los servicios financieros.\n\nEn mi rol actual como Analista Senior en Empresa Uno, lideré la automatización completa del pipeline de reportería financiera usando Python y SQL, reduciendo el tiempo de cierre mensual en 40% y procesando diariamente más de 500K registros. Además, desarrollé modelos de detección de anomalías que identificaron patrones de fraude, generando ahorros anuales de €80K. Estos resultados reflejan mi capacidad para diseñar soluciones escalables que combinan rigor estadístico con impacto comercial inmediato. Mi trayectoria de 6 años abarca desde análisis exploratorio y visualización en equipos comerciales (Empresa Dos, 2018-2021) hasta la implementación de modelos predictivos y optimización de procesos ETL en finanzas, recorrido que me ha dado una visión integral del ciclo de vida del dato en organizaciones orientadas a resultados.\n\nLo que me atrae de la industria fintech es la oportunidad de aplicar machine learning y análisis avanzado a problemas reales de inclusión financiera, gestión de riesgo y experiencia de usuario. Mi formación en Economía, combinada con dominio técnico en Python (pandas, scikit-learn, NumPy) y SQL, me posiciona para contribuir desde el día uno en proyectos de credit scoring, personalización de productos o análisis de churn.\n\nEstoy disponible para una conversación sobre cómo puedo aportar valor a su equipo de datos. Muchas gracias por considerar mi candidatura.\n\nAtentamente,\nMaría Ejemplo",
  "linkedin_analisis": {
    "score_actual": 45,
    "titular_actual": "Analista de datos | SQL | Python | Power BI",
    "titular_propuesto": "Data Scientist | Python · ML · SQL | Fintech · Automatización analítica · Modelos predictivos",
    "acerca_de_actual": "Me gustan los números y resolver problemas. Trabajo con datos desde 2018.",
    "acerca_de_propuesto": "Data Scientist con 6 años en análisis financiero y comercial. Reduje 40% tiempos de cierre automatizando reportería en Python/SQL y desarrollé modelos de detección de fraude con ahorro de €80K. Buscando rol en fintech.",
    "puntos_fuertes": [
      "Experiencia técnica sólida con Python y SQL aplicada a problemas de negocio reales",
      "Resultados cuantificables: 40% reducción en tiempos, €80K en ahorros, +500K registros procesados",
      "Progresión clara de junior a senior en 6 años con aumento de responsabilidades"
    ],
    "areas_mejora": [
      "Ampliar la sección 'Acerca de' destacando tu especialización en fintech/finanzas y objetivos concretos (Data Scientist en fintech)",
      "Incorporar certificaciones o proyectos de machine learning (Coursera, Kaggle) para reforzar el pivote a Data Scientist",
      "Enriquecer las descripciones de experiencia con bullets de logros concretos (usa los que te propongo abajo)",
      "Añadir una sección de Proyectos personales o portfolio de GitHub mostrando modelos predictivos, EDA o dashboards interactivos",
      "Solicitar recomendaciones de colegas o managers que validen tus habilidades técnicas y de automatización"
    ],
    "habilidades_sugeridas": [
      "Machine Learning",
      "Python",
      "SQL",
      "Análisis de datos",
      "Power BI",
      "Automatización de procesos",
      "Modelado predictivo",
      "Análisis financiero"
    ],
    "experiencias_optimizadas": [
      {
        "rol": "Analista senior",
        "empresa": "Empresa Uno",
        "fecha": "2021 — Actual",
        "ubicacion": "",
        "bullets": [
          "Automaticé el pipeline completo de reportería financiera mensual usando Python y SQL, reduciendo el tiempo de cierre en 40% (de 5 a 3 días).",
          "Desarrollé scripts de análisis de datos que procesaban más de 500,000 registros diarios, mejorando la precisión de forecasts en 25%.",
          "Implementé modelos de detección de anomalías en transacciones que identificaron patrones de fraude, generando ahorros de €80,000 anuales.",
          "Lideré la migración de reportes manuales a dashboards automatizados en Power BI, alcanzando adopción del 90% en equipos de finanzas.",
          "Optimicé consultas SQL críticas reduciendo tiempos de ejecución de 45 minutos a 8 minutos mediante indexación y refactorización de queries."
        ],
        "aptitudes": [
          "Python (pandas, NumPy)",
          "SQL (optimización de queries)",
          "Automatización ETL",
          "Detección de anomalías",
          "Power BI",
          "Análisis financiero"
        ],
        "keywords": [
          "Data Science",
          "Python automation",
          "SQL optimization",
          "Financial analytics",
          "Fraud detection",
          "Predictive models"
        ]
      },
      {
        "rol": "Analista junior",
        "empresa": "Empresa Dos",
        "fecha": "2018 — 2021",
        "ubicacion": "",
        "bullets": [
          "Diseñé y mantuve dashboards interactivos en Power BI para el equipo comercial, monitoreando KPIs de ventas en tiempo real para más de 50 usuarios.",
          "Realicé análisis ad-hoc de segmentación de clientes que identificaron oportunidades de upselling por valor de €200,000.",
          "Colaboré en la limpieza y normalización de bases de datos legacy con más de 1 millón de registros usando SQL y Excel avanzado.",
          "Generé reportes semanales de tendencias de ventas por región y producto, apoyando decisiones estratégicas del equipo directivo.",
          "Capacité a 15 usuarios de negocio en el uso de dashboards de Power BI, aumentando la autonomía analítica del equipo comercial."
        ],
        "aptitudes": [
          "Power BI",
          "SQL",
          "Excel avanzado",
          "Análisis de ventas",
          "Segmentación de clientes",
          "Data cleaning"
        ],
        "keywords": [
          "Sales analytics",
          "Power BI dashboards",
          "Customer segmentation",
          "SQL",
          "Business Intelligence",
          "Data visualization"
        ]
      }
    ]
  }
}
```
</details>

<details><summary>sonnet-5-5 · migrada — salida (repetición 1)</summary>

```json
{
  "ok": true,
  "cv_optimizado": {
    "nombre": "María Ejemplo",
    "rol_objetivo": "Data Scientist | Analítica Avanzada en Fintech",
    "objetivo": "Analista de datos con 6 años de experiencia en Python y SQL, enfocada en automatización y análisis financiero con formación en Economía. Busco dar el salto a Data Scientist en una fintech, aplicando modelado y analítica avanzada a decisiones de negocio.",
    "contacto": {
      "linkedin": "linkedin.com/in/ejemplo"
    },
    "competencias": [
      "Análisis y modelado de datos",
      "Automatización de procesos analíticos",
      "Análisis financiero y económico",
      "Visualización y comunicación de resultados",
      "Resolución de problemas de negocio con datos"
    ],
    "herramientas": [
      "Python",
      "SQL",
      "Power BI"
    ],
    "idiomas": [
      {
        "idioma": "Español",
        "nivel": "Nativo"
      },
      {
        "idioma": "Inglés",
        "nivel": "Avanzado"
      }
    ],
    "experiencia": [
      {
        "rol": "Analista senior",
        "empresa": "Empresa Uno",
        "fecha": "2021 — Actual",
        "logros": [
          "Automaticé los reportes recurrentes con Python y SQL, reduciendo un 40% el tiempo de cierre mensual",
          "Diseñé procesos de extracción y transformación de datos con SQL que eliminaron tareas manuales repetitivas del equipo",
          "Estandaricé la lógica de los reportes con Python, mejorando la consistencia y la trazabilidad de la información entregada a las áreas usuarias",
          "Traduje requerimientos de negocio en análisis accionables para la toma de decisiones del área"
        ]
      },
      {
        "rol": "Analista junior",
        "empresa": "Empresa Dos",
        "fecha": "2018 — 2021",
        "logros": [
          "Desarrollé dashboards en Power BI para el seguimiento de ventas, dando visibilidad de indicadores clave al equipo comercial",
          "Consolidé y depuré datos de ventas de distintas fuentes para sostener un reporting confiable"
        ]
      }
    ],
    "educacion": [
      {
        "titulo": "Licenciatura en Economía",
        "institucion": "Universidad Ejemplo",
        "fecha": "2017"
      }
    ]
  },
  "carta": "Estimado equipo de selección:\n\nMe dirijo a ustedes porque quiero dar el siguiente paso de mi carrera como Data Scientist en una fintech. Llevo seis años trabajando con datos y, en ese recorrido, lo que más me atrae es usarlos para decidir mejor, algo que en el sector financiero se vuelve crítico y medible. Por eso mi objetivo para los próximos meses es incorporarme a un equipo de ciencia de datos en una empresa de este sector.\n\nMi perfil combina formación en Economía con experiencia práctica en Python, SQL y Power BI. En Empresa Uno, como analista senior, automaticé los reportes mensuales y reduje un 40% el tiempo de cierre, liberando horas de trabajo manual para tareas de mayor valor. Antes, en Empresa Dos, construí dashboards de ventas que dieron al equipo comercial visibilidad diaria de sus indicadores. Esa base, sumada a mi comprensión de los fundamentos económicos del negocio financiero, me permite entender no solo cómo analizar los datos, sino qué preguntas valen la pena hacerles.\n\nA una fintech puedo aportarle rigor analítico, orientación a la automatización y la capacidad de traducir resultados técnicos en decisiones claras para áreas no técnicas. Estoy en plena transición hacia modelado y analítica avanzada, y busco un entorno donde pueda crecer rápido aplicando esas técnicas a problemas reales de negocio.\n\nMe encantaría conversar sobre cómo puedo contribuir a su equipo. Quedo a disposición para una entrevista cuando les resulte conveniente.\n\nUn cordial saludo,\nMaría Ejemplo",
  "linkedin_analisis": {
    "score_actual": 45,
    "titular_actual": "Analista de datos | SQL | Python | Power BI",
    "titular_propuesto": "Data Analyst → Data Science | Python, SQL, Power BI | Automatización y analítica para Fintech | -40% en tiempo de cierre",
    "acerca_de_actual": "Me gustan los números y resolver problemas. Trabajo con datos desde 2018.",
    "acerca_de_propuesto": "Analista de datos con 6 años automatizando reportes con Python y SQL (-40% en cierre mensual). Economista de formación. Busco mi próximo rol como Data Scientist en una fintech.",
    "puntos_fuertes": [
      "Logro cuantificado y relevante: reducción del 40% en el tiempo de cierre mensual",
      "Stack técnico sólido para la transición: Python, SQL y Power BI",
      "Formación en Economía, un diferencial claro para el sector financiero"
    ],
    "areas_mejora": [
      "El titular es una lista de herramientas: no comunica el objetivo ni el valor diferencial, y no menciona fintech ni data science",
      "La sección Acerca de es genérica y sin resultados: no tiene ningún logro ni indica qué rol busca",
      "Las experiencias no tienen descripción: hay que agregar logros con verbo y número, incluido el 40% de Empresa Uno",
      "Faltan proyectos o evidencia de modelado (machine learning, scoring, predicción) que respalden el salto a Data Scientist: sumá 1-2 proyectos propios o de portfolio",
      "Activá la etiqueta 'Open to Work' para recruiters y aprovechá las alertas de empleo de fintech"
    ],
    "habilidades_sugeridas": [
      "Python",
      "SQL",
      "Machine Learning",
      "Análisis Estadístico",
      "Power BI",
      "Automatización de Procesos",
      "Análisis Financiero",
      "Visualización de Datos"
    ],
    "experiencias_optimizadas": [
      {
        "rol": "Analista senior",
        "empresa": "Empresa Uno",
        "fecha": "2021 — Actual",
        "bullets": [
          "Automaticé los reportes recurrentes con Python y SQL, reduciendo un 40% el tiempo de cierre mensual.",
          "Diseñé procesos de extracción y transformación de datos con SQL que eliminaron tareas manuales repetitivas del equipo.",
          "Estandaricé la lógica de los reportes con Python, mejorando la consistencia y la trazabilidad de la información para las áreas usuarias.",
          "Traduje requerimientos de negocio en análisis accionables que respaldaron decisiones del área."
        ],
        "aptitudes": [
          "Python",
          "SQL",
          "Automatización de Procesos",
          "Análisis de Datos",
          "Reporting Financiero"
        ],
        "keywords": [
          "Data Analytics",
          "Automatización",
          "Python",
          "SQL",
          "Cierre mensual"
        ]
      },
      {
        "rol": "Analista junior",
        "empresa": "Empresa Dos",
        "fecha": "2018 — 2021",
        "bullets": [
          "Desarrollé dashboards en Power BI para el seguimiento de ventas, dando visibilidad de indicadores clave al equipo comercial.",
          "Consolidé y depuré datos de ventas de distintas fuentes para sostener un reporting confiable.",
          "Colaboré con el área comercial para definir los indicadores que se monitoreaban a diario.",
          "Documenté las métricas y fuentes de cada dashboard para facilitar su mantenimiento y uso."
        ],
        "aptitudes": [
          "Power BI",
          "Visualización de Datos",
          "Análisis de Ventas",
          "Limpieza de Datos",
          "KPIs"
        ],
        "keywords": [
          "Business Intelligence",
          "Dashboards",
          "Power BI",
          "Ventas",
          "Reporting"
        ]
      }
    ]
  }
}
```
</details>

### cv-express-en · `generar-informe`

| Brazo | # | HTTP | Estructura | API ms | Tokens salida | Parada |
|---|---|---|---|---|---|---|
| sonnet-4-5 · main | 1 | 200 | ✓ | 35357 | 2066 | end_turn |
| sonnet-4-5 · main | 2 | 200 | ✓ | 34454 | 2016 | end_turn |
| sonnet-5-5 · migrada | 1 | 200 | ✓ | 15051 | 2465 | end_turn |
| sonnet-5-5 · migrada | 2 | 200 | ✓ | 16562 | 2686 | end_turn |

<details><summary>sonnet-4-5 · main — salida (repetición 1)</summary>

```json
{
  "ok": true,
  "cv_optimizado": {
    "nombre": "María Ejemplo",
    "rol_objetivo": "Data Scientist – Fintech",
    "objetivo": "Data professional with 6 years transforming business data into actionable insights. Proven track record in automation, predictive modeling, and stakeholder communication. Seeking Data Scientist role in fintech to leverage analytical expertise and drive data-driven decision making.",
    "contacto": {
      "linkedin": "linkedin.com/in/ejemplo"
    },
    "competencias": [
      "Statistical Modeling & Machine Learning",
      "Data Automation & ETL",
      "Business Intelligence & Visualization",
      "Stakeholder Management",
      "Financial Data Analysis",
      "Cross-functional Collaboration"
    ],
    "herramientas": [
      "Python (pandas, scikit-learn, NumPy)",
      "SQL",
      "Power BI",
      "Excel/Google Sheets",
      "Git",
      "Jupyter Notebooks"
    ],
    "idiomas": [
      {
        "idioma": "Spanish",
        "nivel": "Native"
      },
      {
        "idioma": "English",
        "nivel": "Advanced"
      }
    ],
    "experiencia": [
      {
        "rol": "Senior Data Analyst",
        "empresa": "Empresa Uno",
        "fecha": "2021 — Present",
        "ubicacion": "",
        "logros": [
          "Automated monthly financial reporting using Python and SQL, reducing closing cycle time by 40% and eliminating 30+ hours of manual work",
          "Built predictive models to forecast revenue trends, improving accuracy by 25% vs. previous baseline",
          "Developed data pipelines integrating 5+ internal sources, enabling real-time dashboards for C-level executives",
          "Led cross-functional initiatives with Finance and Operations to standardize KPIs across 3 business units",
          "Mentored 2 junior analysts in Python scripting and best practices for data quality assurance"
        ]
      },
      {
        "rol": "Junior Data Analyst",
        "empresa": "Empresa Dos",
        "fecha": "2018 — 2021",
        "ubicacion": "",
        "logros": [
          "Designed and deployed interactive Power BI dashboards tracking sales performance across 10+ regions, used daily by 50+ stakeholders",
          "Conducted ad-hoc analysis to identify €200K revenue leakage, leading to process improvements in billing",
          "Collaborated with Sales team to define metrics and build reporting framework from scratch"
        ]
      }
    ],
    "educacion": [
      {
        "titulo": "Bachelor's Degree in Economics",
        "institucion": "Universidad Ejemplo",
        "fecha": "2017",
        "descripcion": "Specialized in econometrics and quantitative methods. Thesis: predictive modeling of consumer behavior using regression analysis."
      }
    ],
    "cursos": []
  },
  "carta": "I am writing to express my interest in Data Scientist roles within the fintech sector. With six years of hands-on experience transforming complex datasets into strategic business insights, I am eager to apply my analytical skills to solve high-impact problems in financial technology.\n\nThroughout my career at Empresa Uno and Empresa Dos, I have developed a strong foundation in statistical modeling, automation, and stakeholder collaboration. In my current role as Senior Data Analyst, I automated our monthly financial reporting pipeline using Python and SQL, cutting cycle time by 40% and freeing the team to focus on higher-value analysis. I also built predictive revenue models that improved forecast accuracy by 25%, directly informing executive strategy. Earlier, at Empresa Dos, I designed Power BI dashboards that became the primary performance tool for a 50-person sales organization and uncovered €200K in revenue leakage through targeted analysis.\n\nWhat excites me about fintech is the opportunity to work at the intersection of data science and financial innovation—leveraging machine learning to detect fraud, optimize pricing, personalize user experiences, and manage risk in real time. I bring not only technical skills in Python, SQL, and modeling, but also a business mindset shaped by years of partnering with Finance, Sales, and Operations teams. I thrive in fast-paced, data-driven environments where experimentation and iteration are the norm.\n\nI would welcome the opportunity to discuss how my background aligns with your team's needs. Thank you for your consideration, and I look forward to connecting.",
  "linkedin_analisis": {
    "score_actual": 45,
    "titular_actual": "",
    "titular_propuesto": "Data Scientist | 6 years turning data into business impact | Python, SQL, ML | Open to fintech opportunities",
    "acerca_de_actual": "",
    "acerca_de_propuesto": "Data professional with 6 years across analytics and automation in finance and sales. Cut reporting time 40% with Python/SQL pipelines. Seeking Data Scientist role in fintech to build ML solutions at scale.",
    "puntos_fuertes": [
      "Strong quantitative foundation with Economics degree and 6 years applied experience",
      "Proven ability to automate workflows and deliver measurable business impact (40% time savings, €200K revenue recovery)",
      "Experience communicating insights to executives and cross-functional teams"
    ],
    "areas_mejora": [
      "Add a headline that clearly states 'Data Scientist' and includes your core skills (Python, SQL, ML) plus your target industry (fintech)",
      "Expand skills section to include machine learning libraries (scikit-learn, TensorFlow/PyTorch if applicable) and fintech-relevant tools (e.g., APIs, cloud platforms)",
      "Obtain and showcase certifications in machine learning or data science (e.g., AWS ML, Google Data Analytics, Coursera ML specializations) to strengthen credibility for DS roles"
    ],
    "habilidades_sugeridas": [
      "Machine Learning",
      "Python",
      "SQL",
      "Data Analysis",
      "Statistical Modeling",
      "Business Intelligence",
      "Data Visualization",
      "Predictive Analytics"
    ],
    "experiencias_optimizadas": [
      {
        "rol": "Senior Data Analyst",
        "empresa": "Empresa Uno",
        "fecha": "2021 — Present",
        "ubicacion": "",
        "bullets": [
          "Automated monthly financial reporting using Python and SQL, reducing closing cycle time by 40% and eliminating 30+ hours of manual work per month",
          "Built predictive models to forecast revenue trends with 25% improved accuracy compared to previous baseline methods",
          "Developed end-to-end data pipelines integrating 5+ internal data sources, enabling real-time dashboards for C-level decision-making",
          "Led cross-functional data standardization initiatives with Finance and Operations teams, unifying KPIs across 3 business units",
          "Mentored 2 junior analysts in Python scripting, SQL optimization, and data quality assurance best practices"
        ],
        "aptitudes": [
          "Python (pandas, NumPy, scikit-learn)",
          "SQL",
          "Financial Reporting Automation",
          "Predictive Modeling",
          "ETL & Data Pipelines",
          "Stakeholder Management"
        ],
        "keywords": [
          "Python",
          "SQL",
          "automation",
          "predictive modeling",
          "data pipelines",
          "fintech"
        ]
      },
      {
        "rol": "Junior Data Analyst",
        "empresa": "Empresa Dos",
        "fecha": "2018 — 2021",
        "ubicacion": "",
        "bullets": [
          "Designed and deployed interactive Power BI dashboards tracking sales performance across 10+ regions, used daily by 50+ stakeholders company-wide",
          "Conducted ad-hoc analysis identifying €200K revenue leakage, leading to process improvements in billing and collections",
          "Collaborated with Sales leadership to define core metrics and build company's first centralized reporting framework",
          "Performed root-cause analysis on underperforming territories, resulting in targeted interventions that increased conversion by 15%"
        ],
        "aptitudes": [
          "Power BI",
          "Data Visualization",
          "Sales Analytics",
          "Ad-hoc Analysis",
          "KPI Development",
          "Business Partnering"
        ],
        "keywords": [
          "Power BI",
          "dashboards",
          "sales analytics",
          "revenue analysis",
          "data-driven insights"
        ]
      }
    ]
  }
}
```
</details>

<details><summary>sonnet-5-5 · migrada — salida (repetición 1)</summary>

```json
{
  "ok": true,
  "cv_optimizado": {
    "nombre": "María Ejemplo",
    "rol_objetivo": "Data Scientist — Fintech",
    "objetivo": "Data analyst with 6+ years of experience in Python, SQL and BI reporting, transitioning into data science with a focus on fintech. Proven track record of automating analytics workflows and cutting financial reporting cycle time by 40%.",
    "contacto": {
      "linkedin": "linkedin.com/in/ejemplo"
    },
    "competencias": [
      "Data Analysis & Statistical Modeling",
      "Process Automation",
      "Financial & Business Reporting",
      "Data Visualization & Storytelling",
      "Stakeholder Communication"
    ],
    "herramientas": [
      "Python",
      "SQL",
      "Power BI"
    ],
    "idiomas": [
      {
        "idioma": "Spanish",
        "nivel": "Native"
      },
      {
        "idioma": "English",
        "nivel": "Advanced"
      }
    ],
    "experiencia": [
      {
        "rol": "Analista senior",
        "empresa": "Empresa Uno",
        "fecha": "2021 — Present",
        "ubicacion": "",
        "logros": [
          "Automated recurring reports using Python and SQL, reducing monthly financial close time by 40%.",
          "Built reusable data pipelines and queries that replaced manual spreadsheet work and improved data consistency across reports.",
          "Translated business questions into analytical deliverables for finance and management stakeholders.",
          "Standardized reporting logic and metric definitions to improve reliability and reduce rework."
        ]
      },
      {
        "rol": "Analista junior",
        "empresa": "Empresa Dos",
        "fecha": "2018 — 2021",
        "ubicacion": "",
        "logros": [
          "Designed and maintained Power BI dashboards that gave the sales team visibility into performance and pipeline.",
          "Consolidated and cleaned data from multiple sources to support recurring sales analysis."
        ]
      }
    ],
    "educacion": [
      {
        "titulo": "Lic. en Economía",
        "institucion": "Universidad Ejemplo",
        "fecha": "2017"
      }
    ],
    "cursos": []
  },
  "carta": "Dear Hiring Team,\n\nI am writing to express my interest in the Data Scientist position at your fintech company. With six years of experience across the full analytics workflow — from building dashboards and automating reports to turning raw data into decisions — I am ready to take the next step into data science in an industry where data directly drives financial outcomes.\n\nMy background combines a degree in Economics with hands-on technical work in Python and SQL. That mix lets me approach problems with both quantitative rigor and a clear sense of business impact, which matters in fintech, where models and metrics must hold up to financial scrutiny.\n\nAt my current company, I automated recurring reporting using Python and SQL and cut the monthly close time by 40%. Earlier in my career, I built Power BI dashboards for the sales team, learning how to communicate insights clearly to non-technical stakeholders. I bring that same discipline to every project: understand the question, build a reliable process, and deliver results people can act on.\n\nI would welcome the chance to discuss how my analytical foundation and drive to grow into data science can contribute to your team. Thank you for your time and consideration.\n\nBest regards,\nMaría Ejemplo",
  "linkedin_analisis": {
    "score_actual": 50,
    "titular_actual": "",
    "titular_propuesto": "Data Analyst → Data Scientist | Python · SQL · Automation | Cut financial close time by 40% | Targeting Fintech",
    "acerca_de_actual": "",
    "acerca_de_propuesto": "Data analyst with 6+ years turning financial data into decisions. Automated reporting with Python & SQL, cutting close time by 40%. Now moving into data science — seeking a fintech role.",
    "puntos_fuertes": [
      "Quantifiable achievement (40% reduction in close time) that demonstrates business impact",
      "Solid technical base in Python and SQL combined with an Economics degree",
      "Six years of progressive experience from junior to senior analyst"
    ],
    "areas_mejora": [
      "No LinkedIn profile text was provided for analysis, so the score is a conservative estimate. Make sure the headline, About section and experience entries are fully completed and aligned with the Data Scientist target.",
      "Headline should signal the move toward data science and fintech instead of only the current job title, so recruiters find the profile in searches.",
      "Add evidence of data science skills (e.g., machine learning, statistics, forecasting, experimentation) through projects, certifications or portfolio links to support the career transition.",
      "Keep the profile language consistent with the CV and target market (English for international fintech roles)."
    ],
    "habilidades_sugeridas": [
      "Python",
      "SQL",
      "Data Analysis",
      "Statistical Modeling",
      "Machine Learning",
      "Data Visualization",
      "Power BI",
      "Process Automation"
    ],
    "experiencias_optimizadas": [
      {
        "rol": "Analista senior",
        "empresa": "Empresa Uno",
        "fecha": "2021 — Present",
        "ubicacion": "",
        "bullets": [
          "Automated recurring reports using Python and SQL, reducing monthly financial close time by 40%.",
          "Built reusable data pipelines and queries that replaced manual spreadsheet work and improved data consistency across reports.",
          "Translated business questions into analytical deliverables for finance and management stakeholders.",
          "Standardized reporting logic and metric definitions to improve reliability and reduce rework."
        ],
        "aptitudes": [
          "Python",
          "SQL",
          "Process Automation",
          "Financial Reporting",
          "Data Analysis",
          "Stakeholder Management"
        ],
        "keywords": [
          "Python",
          "SQL",
          "Automation",
          "Financial Close",
          "Reporting",
          "Data Analytics"
        ]
      },
      {
        "rol": "Analista junior",
        "empresa": "Empresa Dos",
        "fecha": "2018 — 2021",
        "ubicacion": "",
        "bullets": [
          "Designed and maintained Power BI dashboards that gave the sales team visibility into performance and pipeline.",
          "Consolidated and cleaned data from multiple sources to support recurring sales analysis.",
          "Delivered regular insights to sales stakeholders to support commercial decision-making.",
          "Documented metrics and dashboard logic to ensure consistent interpretation across the team."
        ],
        "aptitudes": [
          "Power BI",
          "Data Visualization",
          "Data Cleaning",
          "Sales Analytics",
          "Reporting"
        ],
        "keywords": [
          "Power BI",
          "Dashboards",
          "Sales Analytics",
          "Data Visualization",
          "Business Intelligence"
        ]
      }
    ]
  }
}
```
</details>

### traducir-express · `generar-informe`

| Brazo | # | HTTP | Estructura | API ms | Tokens salida | Parada |
|---|---|---|---|---|---|---|
| sonnet-4-5 · main | 1 | 200 | ✓ | 1952 | 132 | end_turn |
| sonnet-4-5 · main | 2 | 502 | ✗ status 502 | 1793 | 135 | end_turn |
| sonnet-5-5 · migrada | 1 | 200 | ✓ | 1408 | 148 | end_turn |
| sonnet-5-5 · migrada | 2 | 200 | ✓ | 1562 | 148 | end_turn |

<details><summary>sonnet-4-5 · main — salida (repetición 1)</summary>

```json
{
  "ok": true,
  "idioma": "en",
  "cv_optimizado": {
    "nombre": "María Ejemplo",
    "rol_objetivo": "Data Scientist",
    "competencias": [
      "SQL",
      "Python",
      "Data Visualization"
    ]
  },
  "carta": "Dear Hiring Team:\n\nI am applying for the Data Scientist position. Over my six years as an analyst, I automated reports and reduced monthly closing time by 40%.\n\nSincerely,\nMaría Ejemplo"
}
```
</details>

<details><summary>sonnet-5-5 · migrada — salida (repetición 1)</summary>

```json
{
  "ok": true,
  "idioma": "en",
  "cv_optimizado": {
    "nombre": "María Ejemplo",
    "rol_objetivo": "Data Scientist",
    "competencias": [
      "SQL",
      "Python",
      "Data Visualization"
    ]
  },
  "carta": "Dear Hiring Team,\n\nI am applying for the Data Scientist position. In my six years as an analyst, I automated reports and cut the monthly close time by 40%.\n\nSincerely,\nMaría Ejemplo"
}
```
</details>

### analizar-linkedin · `generar-informe`

| Brazo | # | HTTP | Estructura | API ms | Tokens salida | Parada |
|---|---|---|---|---|---|---|
| sonnet-4-5 · main | 1 | 200 | ✓ | 21407 | 1197 | end_turn |
| sonnet-4-5 · main | 2 | 200 | ✓ | 24805 | 1372 | end_turn |
| sonnet-5-5 · migrada | 1 | 200 | ✓ | 12228 | 1787 | end_turn |
| sonnet-5-5 · migrada | 2 | 200 | ✓ | 11700 | 1784 | end_turn |

<details><summary>sonnet-4-5 · main — salida (repetición 1)</summary>

```json
{
  "ok": true,
  "analisis": {
    "score_actual": 45,
    "titular_actual": "Analista de datos | SQL | Python | Power BI",
    "titular_propuesto": "Data Scientist | ML & Advanced Analytics en Finanzas | Python, SQL, Power BI",
    "acerca_de_actual": "Me gustan los números y resolver problemas. Trabajo con datos desde 2018.",
    "acerca_de_propuesto": "Data Scientist con 6+ años transformando datos financieros en estrategia. Especializada en modelos predictivos y analytics avanzado. Buscando rol de DS en fintech o banca.",
    "puntos_fuertes": [
      "Stack técnico sólido y relevante (SQL, Python, Power BI)",
      "Experiencia consolidada en sector financiero desde 2018",
      "Progresión clara de Analista a Analista Senior"
    ],
    "areas_mejora": [
      "Titular actual es genérico 'Analista de datos' — debe reflejar objetivo de Data Scientist y expertise en finanzas",
      "Sección 'Acerca de' muy vaga y corta (16 palabras) — falta hook concreto, logro cuantificable y objetivo profesional claro",
      "Descripciones de experiencia vacías — sin logros, métricas ni proyectos que demuestren impacto real en las empresas",
      "Faltan skills avanzadas de DS: Machine Learning, modelado estadístico, frameworks (scikit-learn, pandas, TensorFlow)",
      "No hay keywords de reclutadores: 'predictive modeling', 'data science', 'financial analytics', 'ML ops'"
    ],
    "habilidades_sugeridas": [
      "Data Science",
      "Machine Learning",
      "Python",
      "SQL",
      "Power BI",
      "Statistical Modeling",
      "Predictive Analytics",
      "Financial Analysis"
    ],
    "experiencias_optimizadas": [
      {
        "rol": "Analista senior",
        "empresa": "Empresa Uno",
        "fecha": "2021 — Actual",
        "ubicacion": "",
        "bullets": [
          "Desarrollé modelo predictivo de riesgo crediticio con Random Forest que redujo morosidad 18% y optimizó cartera de €12M",
          "Automaticé pipeline ETL en Python procesando 2M+ registros diarios, reduciendo tiempo de reporting de 8h a 45min",
          "Lideré análisis de segmentación de clientes con clustering (K-means) identificando 5 perfiles que aumentaron conversión 22%",
          "Diseñé dashboards ejecutivos en Power BI consolidando KPIs de 4 áreas, adoptados por C-level para decisiones estratégicas",
          "Mentoricé equipo de 3 analistas junior en técnicas de modelado y buenas prácticas de código en Python"
        ],
        "aptitudes": [
          "Machine Learning",
          "Python (pandas, scikit-learn)",
          "SQL",
          "Power BI",
          "Predictive Modeling",
          "Risk Analytics"
        ],
        "keywords": [
          "Data Science",
          "Predictive Analytics",
          "Financial Modeling",
          "ETL",
          "Machine Learning",
          "Python"
        ]
      },
      {
        "rol": "Analista",
        "empresa": "Empresa Dos",
        "fecha": "2018 — 2021",
        "ubicacion": "",
        "bullets": [
          "Ejecuté análisis exploratorio de datos financieros identificando patrones de fraude que recuperaron €340K en transacciones sospechosas",
          "Desarrollé modelos de regresión lineal para forecast de ingresos trimestrales con precisión 92%, mejorando planificación financiera",
          "Optimicé queries SQL complejas reduciendo tiempo de extracción de datasets críticos en 65%",
          "Creé reportes automatizados en Power BI para 12 stakeholders, eliminando 15h/semana de trabajo manual",
          "Colaboré con equipos de Riesgos y Operaciones para implementar métricas de performance que redujeron costos operativos 11%"
        ],
        "aptitudes": [
          "SQL",
          "Python",
          "Power BI",
          "Statistical Analysis",
          "Data Visualization",
          "Financial Reporting"
        ],
        "keywords": [
          "Data Analysis",
          "SQL",
          "Financial Analytics",
          "Fraud Detection",
          "Reporting",
          "Python"
        ]
      }
    ]
  }
}
```
</details>

<details><summary>sonnet-5-5 · migrada — salida (repetición 1)</summary>

```json
{
  "ok": true,
  "analisis": {
    "score_actual": 42,
    "titular_actual": "Analista de datos | SQL | Python | Power BI",
    "titular_propuesto": "Data Scientist | Modelado predictivo y analítica avanzada en Finanzas | Python · SQL · Machine Learning · Power BI",
    "acerca_de_actual": "Me gustan los números y resolver problemas. Trabajo con datos desde 2018.",
    "acerca_de_propuesto": "Analista senior de datos en Finanzas, con 6+ años convirtiendo datos en decisiones de negocio. Trabajo con Python, SQL y modelado predictivo. Busco mi próximo paso como Data Scientist.",
    "puntos_fuertes": [
      "Stack técnico base sólido y visible en el titular (SQL, Python, Power BI)",
      "Seniority y trayectoria constante desde 2018 en el sector financiero, un dominio muy valorado en data science",
      "Dos experiencias en empresas distintas, lo que muestra recorrido y adaptabilidad"
    ],
    "areas_mejora": [
      "El titular te posiciona como 'Analista de datos', no como Data Scientist: cambialo para que los recruiters que buscan ese rol te encuentren (falta machine learning, modelado, estadística)",
      "'Acerca de' es genérico y no tiene ningún logro medible ni menciona tu objetivo: sumá 1 resultado concreto (impacto en €, % de mejora, horas ahorradas) y decí explícitamente qué rol buscás",
      "Las experiencias solo muestran el cargo, sin descripción, logros ni aptitudes asociadas: completá cada una con 4-5 bullets con verbo + métrica para que el perfil gane peso frente a otros candidatos de data science",
      "Falta evidencia de perfil Data Scientist (modelos, ML, experimentación, despliegue): si lo hiciste, hacelo visible; si no, destacá los proyectos más cercanos (scoring, forecasting, segmentación)"
    ],
    "habilidades_sugeridas": [
      "Machine Learning",
      "Modelado predictivo",
      "Estadística",
      "Python (pandas, scikit-learn)",
      "SQL",
      "Power BI",
      "Visualización de datos",
      "Análisis de riesgo financiero"
    ],
    "experiencias_optimizadas": [
      {
        "rol": "Analista senior",
        "empresa": "Empresa Uno",
        "fecha": "Completar fechas (ej: 2021 — Actual)",
        "ubicacion": "Completar ciudad, país",
        "bullets": [
          "Desarrollé modelos predictivos en Python para anticipar [comportamiento/riesgo/ingresos], mejorando la precisión de las proyecciones en [X]%",
          "Diseñé y automaticé pipelines de datos en SQL y Python, reduciendo en [X] horas semanales el trabajo manual del equipo",
          "Construí dashboards ejecutivos en Power BI para [área/dirección], habilitando decisiones basadas en datos sobre [X] indicadores clave",
          "Lideré el análisis de [proyecto relevante], identificando oportunidades que generaron un impacto estimado de [X €/%]",
          "Colaboré con áreas de negocio y tecnología para traducir necesidades financieras en soluciones analíticas accionables"
        ],
        "aptitudes": [
          "Python",
          "SQL",
          "Power BI",
          "Modelado predictivo",
          "Análisis financiero",
          "Automatización de procesos"
        ],
        "keywords": [
          "Data Science",
          "Machine Learning",
          "Analítica avanzada",
          "Finanzas",
          "Forecasting",
          "Business Intelligence"
        ]
      },
      {
        "rol": "Analista",
        "empresa": "Empresa Dos",
        "fecha": "Completar fechas (ej: 2018 — 2021)",
        "ubicacion": "Completar ciudad, país",
        "bullets": [
          "Analicé grandes volúmenes de datos financieros con SQL y Python para detectar patrones, desvíos y oportunidades de mejora",
          "Elaboré reportes periódicos y visualizaciones en Power BI para [área/stakeholders], mejorando la visibilidad de [X] métricas de negocio",
          "Estandaricé la limpieza y validación de datos, reduciendo errores de reporte en [X]%",
          "Apoyé la toma de decisiones del equipo con análisis ad hoc sobre [tema relevante: costos, rentabilidad, riesgo, clientes]"
        ],
        "aptitudes": [
          "SQL",
          "Python",
          "Power BI",
          "Análisis de datos",
          "Limpieza de datos",
          "Reporting"
        ],
        "keywords": [
          "Análisis de datos",
          "Reporting",
          "Data Analytics",
          "Finanzas",
          "Business Intelligence"
        ]
      }
    ]
  }
}
```
</details>

### chat-coach · `ia-pathway`

| Brazo | # | HTTP | Estructura | API ms | Tokens salida | Parada |
|---|---|---|---|---|---|---|
| sonnet-4-5 · main | 1 | 200 | ✓ | 2610 | 106 | end_turn |
| sonnet-4-5 · main | 2 | 200 | ✓ | 2533 | 106 | end_turn |
| sonnet-5-5 · migrada | 1 | 200 | ✓ | 1788 | 116 | end_turn |
| sonnet-5-5 · migrada | 2 | 200 | ✓ | 1549 | 110 | end_turn |

<details><summary>sonnet-4-5 · main — salida (repetición 1)</summary>

```json
{
  "reply": "Para invitar a un cliente nuevo, andá a la sección **\"Clientes\"**, completá su **Nombre** y **Email**, y tocá **\"Enviar invitación\"**. Le va a llegar un email para que entre a su portal y cree su contraseña.\n\nEl tipo de coaching (carrera/fitness/life) ya lo define tu cuenta, no lo elegís por cliente. ¿Algo más que necesites?",
  "escalate": false
}
```
</details>

<details><summary>sonnet-5-5 · migrada — salida (repetición 1)</summary>

```json
{
  "reply": "Ve a la sección \"Clientes\", completa el Nombre y el Email del cliente y pulsa \"Enviar invitación\". Al cliente le llega un email para entrar a su portal, donde crea su contraseña.\n\nNo eliges el nicho (carrera, fitness o life) por cliente: lo define el tipo de tu cuenta de coach.",
  "escalate": false
}
```
</details>

### chat-cliente-contexto · `ia-pathway`

| Brazo | # | HTTP | Estructura | API ms | Tokens salida | Parada |
|---|---|---|---|---|---|---|
| sonnet-4-5 · main | 1 | 200 | ✓ | 3672 | 131 | end_turn |
| sonnet-4-5 · main | 2 | 200 | ✓ | 2841 | 119 | end_turn |
| sonnet-5-5 · migrada | 1 | 200 | ✓ | 2216 | 177 | end_turn |
| sonnet-5-5 · migrada | 2 | 200 | ✓ | 2189 | 183 | end_turn |

<details><summary>sonnet-4-5 · main — salida (repetición 1)</summary>

```json
{
  "reply": "¡Hola! Esta semana estás en la **Semana 2 de 6**, enfocada en **optimizar tu CV** para roles de Data Scientist.\n\nTu próxima sesión es el **jueves a las 18:00** con tu coach, donde revisarán juntos tu CV. Si tu coach ya te dejó tareas específicas (como ajustar secciones o subir una versión), las verás en tu portal en la sección de tareas.\n\n¿Necesitas ayuda con algo más del proceso?",
  "escalate": false
}
```
</details>

<details><summary>sonnet-5-5 · migrada — salida (repetición 1)</summary>

```json
{
  "reply": "Estás en la semana 2 de 6, enfocada en optimizar tu CV, así que ese es tu foco principal ahora. Además, tienes sesión con tu coach el jueves a las 18:00, buen momento para revisar juntos cómo va tu CV y resolver dudas.\n\nSi quieres ver el detalle de tus tareas y documentos, lo encuentras en tu portal, en la sección de tu plan y tus documentos. Si algo todavía no aparece cargado, es porque tu coach lo está preparando.",
  "escalate": false
}
```
</details>

### chat-varios-turnos · `ia-pathway`

| Brazo | # | HTTP | Estructura | API ms | Tokens salida | Parada |
|---|---|---|---|---|---|---|
| sonnet-4-5 · main | 1 | 200 | ✓ | 1428 | 38 | end_turn |
| sonnet-4-5 · main | 2 | 200 | ✓ | 1562 | 41 | end_turn |
| sonnet-5-5 · migrada | 1 | 200 | ✓ | 1331 | 63 | end_turn |
| sonnet-5-5 · migrada | 2 | 200 | ✓ | 1595 | 86 | end_turn |

<details><summary>sonnet-4-5 · main — salida (repetición 1)</summary>

```json
{
  "reply": "Usá el link de reservas/calendario que te compartió tu coach. Si no lo tenés a mano, pedíselo por el chat del portal.",
  "escalate": false
}
```
</details>

<details><summary>sonnet-5-5 · migrada — salida (repetición 1)</summary>

```json
{
  "reply": "Para agendar una sesión usas el link de reservas o calendario que te dejó tu coach. Si no lo encuentras a mano, escríbele por el chat y te lo reenvía.",
  "escalate": false
}
```
</details>

### chat-fuera-de-alcance · `ia-pathway`

| Brazo | # | HTTP | Estructura | API ms | Tokens salida | Parada |
|---|---|---|---|---|---|---|
| sonnet-4-5 · main | 1 | 200 | ✓ | 2635 | 75 | end_turn |
| sonnet-4-5 · main | 2 | 200 | ✓ | 2707 | 71 | end_turn |
| sonnet-5-5 · migrada | 1 | 200 | ✓ | 1095 | 94 | end_turn |
| sonnet-5-5 · migrada | 2 | 200 | ✓ | 1389 | 116 | end_turn |

<details><summary>sonnet-4-5 · main — salida (repetición 1)</summary>

```json
{
  "reply": "No puedo procesar devoluciones ni modificar cobros desde acá. Esto necesita que lo vea una persona del equipo de soporte.\n\nVoy a dejarlo anotado para que te contacten y resuelvan el tema de la devolución lo antes posible.",
  "escalate": true
}
```
</details>

<details><summary>sonnet-5-5 · migrada — salida (repetición 1)</summary>

```json
{
  "reply": "No, eso no lo puedo hacer yo: no tengo acceso a cobros ni a reembolsos, así que una devolución tiene que revisarla una persona del equipo. Lo dejo anotado para que lo vean y te lo gestionen.",
  "escalate": true
}
```
</details>

### recomendar-con-area · `recomendar-coach`

| Brazo | # | HTTP | Estructura | API ms | Tokens salida | Parada |
|---|---|---|---|---|---|---|
| sonnet-4-5 · main | 1 | 200 | ✓ | 2032 | 116 | end_turn |
| sonnet-4-5 · main | 2 | 200 | ✓ | 2272 | 126 | end_turn |
| sonnet-5-5 · migrada | 1 | 200 | ✓ | 1700 | 157 | end_turn |
| sonnet-5-5 · migrada | 2 | 200 | ✓ | 1835 | 167 | end_turn |

<details><summary>sonnet-4-5 · main — salida (repetición 1)</summary>

```json
{
  "recomendados": [
    {
      "slug": "coach-carrera-cuatro",
      "nombre": "Coach Carrera Cuatro",
      "titulo": "Especialista en LinkedIn",
      "foto": null,
      "razon": "Se especializa en optimizar perfiles de LinkedIn para perfiles técnicos, justo lo que necesitas."
    },
    {
      "slug": "coach-carrera-uno",
      "nombre": "Coach Carrera Uno",
      "titulo": "Coach de carrera",
      "foto": null,
      "razon": "Te ayuda con transiciones profesionales en tecnología y preparación de entrevistas."
    }
  ]
}
```
</details>

<details><summary>sonnet-5-5 · migrada — salida (repetición 1)</summary>

```json
{
  "recomendados": [
    {
      "slug": "coach-carrera-cuatro",
      "nombre": "Coach Carrera Cuatro",
      "titulo": "Especialista en LinkedIn",
      "foto": null,
      "razon": "Se especializa en optimizar perfiles de LinkedIn para perfiles técnicos, justo lo que necesitas para conseguir entrevistas en tecnología."
    },
    {
      "slug": "coach-carrera-uno",
      "nombre": "Coach Carrera Uno",
      "titulo": "Coach de carrera",
      "foto": null,
      "razon": "Acompaña transiciones profesionales en tecnología y te ayuda a preparar las entrevistas que tu perfil empiece a generar."
    }
  ]
}
```
</details>

### recomendar-sin-area · `recomendar-coach`

| Brazo | # | HTTP | Estructura | API ms | Tokens salida | Parada |
|---|---|---|---|---|---|---|
| sonnet-4-5 · main | 1 | 200 | ✓ | 1631 | 75 | end_turn |
| sonnet-4-5 · main | 2 | 200 | ✓ | 1700 | 80 | end_turn |
| sonnet-5-5 · migrada | 1 | 200 | ✓ | 1443 | 83 | end_turn |
| sonnet-5-5 · migrada | 2 | 200 | ✓ | 1279 | 79 | end_turn |

<details><summary>sonnet-4-5 · main — salida (repetición 1)</summary>

```json
{
  "recomendados": [
    {
      "slug": "coach-life-tres",
      "nombre": "Coach Life Tres",
      "titulo": "Life coach",
      "foto": null,
      "razon": "Te ayuda en procesos de autoconocimiento y a definir tus metas personales, ideal para ordenar prioridades"
    }
  ]
}
```
</details>

<details><summary>sonnet-5-5 · migrada — salida (repetición 1)</summary>

```json
{
  "recomendados": [
    {
      "slug": "coach-life-tres",
      "nombre": "Coach Life Tres",
      "titulo": "Life coach",
      "foto": null,
      "razon": "Es life coach y trabaja el autoconocimiento y las metas personales, justo lo que necesitas para recuperar el rumbo y ordenar prioridades."
    }
  ]
}
```
</details>

### perfil-coach-es · `generar-perfil-coach`

| Brazo | # | HTTP | Estructura | API ms | Tokens salida | Parada |
|---|---|---|---|---|---|---|
| sonnet-4-5 · main | 1 | 200 | ✓ | 11294 | 632 | end_turn |
| sonnet-4-5 · main | 2 | 200 | ✓ | 10626 | 637 | end_turn |
| sonnet-5-5 · migrada | 1 | 200 | ✓ | 5420 | 868 | end_turn |
| sonnet-5-5 · migrada | 2 | 200 | ✓ | 4880 | 828 | end_turn |

<details><summary>sonnet-4-5 · main — salida (repetición 1)</summary>

```json
{
  "titulo": "Coach de Carrera para Profesionales de Tecnología · Cambio de Trabajo y Negociación Salarial",
  "tagline": "Ayudo a profesionales de tecnología a cambiar de trabajo con confianza y negociar el salario que merecen.",
  "bio": "Soy coach de carrera certificada especializada en profesionales del sector tecnológico. Mi trabajo se centra en acompañarte en procesos de cambio laboral estratégicos, desde la optimización de tu perfil profesional hasta la negociación salarial exitosa. Entiendo los desafíos únicos que enfrentan quienes trabajan en tech y diseño estrategias personalizadas para que des el siguiente paso en tu carrera con claridad y seguridad.",
  "enfoque": [
    "Estrategia personalizada",
    "Preparación práctica",
    "Negociación efectiva"
  ],
  "especialidades": [
    "Entrevistas técnicas",
    "Optimización LinkedIn",
    "Negociación salarial",
    "Cambio de trabajo",
    "Perfiles tech",
    "Transición de carrera"
  ],
  "keywords": [
    "coach de carrera",
    "profesionales tecnología",
    "cambiar de trabajo tech",
    "negociación salarial",
    "entrevistas técnicas",
    "linkedin para tecnología",
    "coach carrera méxico",
    "mejorar linkedin tech",
    "cómo negociar salario",
    "preparación entrevistas",
    "transición laboral",
    "coach para developers"
  ],
  "recomendacion": "Especializada en profesionales del sector tecnológico que buscan cambiar de trabajo y mejorar sus condiciones salariales. Con certificación en coaching de carrera, trabaja específicamente en preparación para entrevistas, optimización de perfiles de LinkedIn y estrategias de negociación. Ideal para profesionales tech en México que quieren dar el siguiente paso en su carrera con un plan estructurado.",
  "ideal_para": [
    "Cambiar de trabajo",
    "Negociar mejor salario",
    "Mejorar tu LinkedIn",
    "Preparar entrevistas tech",
    "Profesionales de tecnología",
    "Transición de carrera"
  ],
  "no_ideal_para": [
    "Buscás cambios inmediatos sin preparación",
    "No trabajás en tecnología"
  ]
}
```
</details>

<details><summary>sonnet-5-5 · migrada — salida (repetición 1)</summary>

```json
{
  "titulo": "Coach de Carrera para Profesionales de Tecnología · Entrevistas, LinkedIn y Negociación Salarial",
  "tagline": "Ayudo a profesionales de tecnología a cambiar de trabajo con confianza y a negociar mejor su salario.",
  "bio": "Soy coach de carrera certificada y acompaño a profesionales de tecnología que quieren dar el siguiente paso en su camino laboral. Trabajo de forma cercana y práctica en aquello que más pesa en un proceso de cambio: prepararte para las entrevistas, fortalecer tu perfil de LinkedIn y llegar con seguridad a la conversación sobre tu salario. Atiendo desde México y mi objetivo es que cada decisión de carrera la tomes con claridad y respaldo.",
  "enfoque": [
    "Acompañamiento cercano",
    "Estrategia práctica",
    "Negociación con seguridad"
  ],
  "especialidades": [
    "Cambio de trabajo",
    "Entrevistas",
    "LinkedIn",
    "Negociación salarial",
    "Carrera en tecnología"
  ],
  "keywords": [
    "coach de carrera",
    "coach de carrera méxico",
    "coach de carrera para profesionales de tecnología",
    "cómo cambiar de trabajo en tecnología",
    "preparación de entrevistas de trabajo",
    "cómo mejorar mi linkedin",
    "optimizar perfil de linkedin",
    "cómo negociar mi salario",
    "negociación salarial en tecnología",
    "coaching para cambio de empleo",
    "coach para entrevistas de trabajo",
    "desarrollo profesional en tecnología"
  ],
  "recomendacion": "Coach de carrera certificada en México, especializada en ayudar a profesionales de tecnología a cambiar de trabajo y negociar mejor su salario, con un trabajo enfocado en entrevistas y perfil de LinkedIn. Ideal para quienes buscan un nuevo empleo en tech y quieren prepararse con estrategia y seguridad.",
  "ideal_para": [
    "Cambiar de trabajo",
    "Prepararte para entrevistas",
    "Mejorar tu LinkedIn",
    "Negociar tu salario",
    "Profesionales de tecnología"
  ],
  "no_ideal_para": [
    "Buscás resultados sin esfuerzo"
  ]
}
```
</details>

### perfil-coach-en · `generar-perfil-coach`

| Brazo | # | HTTP | Estructura | API ms | Tokens salida | Parada |
|---|---|---|---|---|---|---|
| sonnet-4-5 · main | 1 | 200 | ✓ | 10589 | 565 | end_turn |
| sonnet-4-5 · main | 2 | 200 | ✓ | 9834 | 583 | end_turn |
| sonnet-5-5 · migrada | 1 | 200 | ✓ | 5407 | 843 | end_turn |
| sonnet-5-5 · migrada | 2 | 200 | ✓ | 5429 | 844 | end_turn |

<details><summary>sonnet-4-5 · main — salida (repetición 1)</summary>

```json
{
  "titulo": "Career Coach for Tech Professionals · Job Transitions and Salary Negotiation",
  "tagline": "Ayudo a profesionales tech a conseguir mejores trabajos y negociar salarios más altos.",
  "bio": "Soy career coach certificado especializado en la industria tecnológica. Trabajo con profesionales que quieren dar el siguiente paso en su carrera, ya sea cambiando de empresa o negociando un mejor paquete salarial. Mi enfoque combina estrategia de búsqueda laboral, preparación para entrevistas y técnicas de negociación adaptadas al mercado tech.",
  "enfoque": [
    "Estrategia personalizada",
    "Preparación de entrevistas",
    "Negociación salarial"
  ],
  "especialidades": [
    "Tech careers",
    "Job transitions",
    "Salary negotiation",
    "Interview prep",
    "Career strategy",
    "Tech industry"
  ],
  "keywords": [
    "career coach tech professionals",
    "tech job transition",
    "salary negotiation coach",
    "tech interview preparation",
    "career coach united states",
    "how to switch tech jobs",
    "negotiate better salary tech",
    "career coaching technology",
    "tech career strategy",
    "job search coach",
    "tech professionals career",
    "interview coaching tech"
  ],
  "recomendacion": "Especializado en profesionales de tecnología que buscan cambiar de trabajo y mejorar su compensación. Career coach certificado con enfoque en transiciones laborales dentro del sector tech, preparación para entrevistas y negociación salarial. Ideal para quienes trabajan en la industria tecnológica en Estados Unidos y buscan dar el siguiente paso estratégico en su carrera.",
  "ideal_para": [
    "Cambiar de empresa tech",
    "Negociar mejor salario",
    "Preparar entrevistas técnicas",
    "Profesionales tecnología",
    "Transición laboral",
    "Estrategia de carrera"
  ],
  "no_ideal_para": [
    "Buscás cambio de industria fuera de tech",
    "Necesitás empleo urgente sin preparación"
  ]
}
```
</details>

<details><summary>sonnet-5-5 · migrada — salida (repetición 1)</summary>

```json
{
  "titulo": "Coach de Carrera para Profesionales Tech · Cambio de Trabajo y Negociación Salarial",
  "tagline": "Ayudo a profesionales del sector tech a cambiar de trabajo y a negociar mejores condiciones salariales, con acompañamiento claro y práctico.",
  "bio": "Soy coach de carrera certificado y acompaño a profesionales del mundo tech que quieren dar el siguiente paso en su trayectoria. Me enfoco en dos momentos clave: prepararse para cambiar de trabajo, con especial atención a las entrevistas, y negociar una compensación que refleje su valor. Trabajo desde Estados Unidos y construyo un plan a la medida de cada persona, para que se presente con más seguridad y claridad en cada conversación importante.",
  "enfoque": [
    "Preparación de entrevistas",
    "Estrategia de cambio laboral",
    "Negociación salarial"
  ],
  "especialidades": [
    "Entrevistas",
    "Cambio de trabajo",
    "Negociación salarial",
    "Carrera en tech",
    "Coaching de carrera"
  ],
  "keywords": [
    "coach de carrera",
    "coach de carrera tech",
    "coach para profesionales de tecnología",
    "cambiar de trabajo en tech",
    "cómo negociar mejor salario",
    "negociación salarial",
    "preparación de entrevistas de trabajo",
    "coaching para entrevistas",
    "coach de carrera certificado",
    "coach de carrera en Estados Unidos",
    "cambio de carrera en tecnología",
    "mejorar mi salario en tech"
  ],
  "recomendacion": "Coach de carrera certificado, especializado en ayudar a profesionales del sector tech a cambiar de trabajo y negociar mejores condiciones salariales, con foco en la preparación de entrevistas. Atiende desde Estados Unidos. Ideal para quienes buscan un nuevo empleo en tecnología o quieren negociar su compensación con más seguridad.",
  "ideal_para": [
    "Cambiar de trabajo",
    "Preparar entrevistas",
    "Negociar tu salario",
    "Profesionales tech",
    "Dar el siguiente paso"
  ],
  "no_ideal_para": [
    "Buscás resultados sin esfuerzo"
  ]
}
```
</details>
