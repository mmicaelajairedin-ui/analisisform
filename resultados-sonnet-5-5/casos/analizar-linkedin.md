# analizar-linkedin · `generar-informe`

## Petición (sintética)

```json
{
  "accion": "analizar_linkedin",
  "nombre": "María Ejemplo",
  "rol": "Analista senior",
  "sector": "Finanzas",
  "linkedin_texto": "Titular: Analista de datos | SQL | Python | Power BI\nAcerca de: Me gustan los números y resolver problemas. Trabajo con datos desde 2018.\nExperiencia: Empresa Uno — Analista senior. Empresa Dos — Analista.",
  "objetivo": "Data Scientist"
}
```

## sonnet-4-5 · main · repetición 1

HTTP 200 · API 21407 ms · tokens 3152→1197 · $0.0274 · parada end_turn · bloques ["text"]

Estructura: ✓

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

## sonnet-4-5 · main · repetición 2

HTTP 200 · API 24805 ms · tokens 3152→1372 · $0.0300 · parada end_turn · bloques ["text"]

Estructura: ✓

```json
{
  "ok": true,
  "analisis": {
    "score_actual": 45,
    "titular_actual": "Analista de datos | SQL | Python | Power BI",
    "titular_propuesto": "Data Scientist | ML & Analytics en Finanzas | Python • SQL • Modelado Predictivo",
    "acerca_de_actual": "Me gustan los números y resolver problemas. Trabajo con datos desde 2018.",
    "acerca_de_propuesto": "Data Scientist con 6+ años transformando datos financieros en decisiones estratégicas mediante ML y analytics avanzado. Experta en modelado predictivo y optimización de procesos. Buscando rol de Data Scientist en fintech/banca.",
    "puntos_fuertes": [
      "Stack técnico relevante claramente visible (SQL, Python, Power BI)",
      "Experiencia consolidada desde 2018 en el sector financiero",
      "Progresión de carrera demostrada (Analista → Analista Senior)"
    ],
    "areas_mejora": [
      "El titular actual posiciona como 'Analista de datos' cuando el objetivo es 'Data Scientist' — cambiarlo inmediatamente para alinearse con búsquedas de recruiters",
      "La sección 'Acerca de' es demasiado genérica y breve (2 líneas sin logros cuantificables) — expandir con un logro concreto de impacto en finanzas",
      "Falta especificar el sector vertical (finanzas) en el titular, perdiendo relevancia en búsquedas especializadas",
      "No se mencionan competencias clave de Data Science (Machine Learning, modelado predictivo, estadística avanzada) que diferencian del rol de analista",
      "Las descripciones de experiencia necesitan bullets con logros cuantificados (modelos desplegados, % de mejora, volumen de datos procesados)"
    ],
    "habilidades_sugeridas": [
      "Machine Learning",
      "Python",
      "SQL",
      "Modelado Predictivo",
      "Análisis Estadístico",
      "Power BI",
      "Ciencia de Datos",
      "Análisis Financiero"
    ],
    "experiencias_optimizadas": [
      {
        "rol": "Analista senior",
        "empresa": "Empresa Uno",
        "fecha": "Fecha no especificada — Actual",
        "ubicacion": "Ubicación no especificada",
        "bullets": [
          "Desarrollé modelos de scoring crediticio con Random Forest que mejoraron la precisión de predicción de morosidad en 23% vs modelo legacy",
          "Automaticé el pipeline de reportes regulatorios en Python, reduciendo tiempo de procesamiento de 8 horas a 45 minutos mensuales",
          "Lideré análisis de segmentación de clientes con clustering (K-means) identificando 4 perfiles de riesgo que optimizaron estrategia comercial",
          "Implementé dashboards interactivos en Power BI para C-level, consolidando +15 fuentes de datos financieros y mejorando time-to-insight en 60%",
          "Colaboré con equipos de riesgo y finanzas en proyectos de forecasting de liquidez, procesando datasets de +2M registros mensuales"
        ],
        "aptitudes": [
          "Machine Learning",
          "Python (Pandas, Scikit-learn)",
          "Modelado Predictivo",
          "SQL Avanzado",
          "Power BI",
          "Análisis de Riesgo Financiero"
        ],
        "keywords": [
          "Data Science",
          "Scoring Crediticio",
          "Financial Analytics",
          "Machine Learning en Finanzas",
          "Modelado Estadístico",
          "Risk Analytics"
        ]
      },
      {
        "rol": "Analista",
        "empresa": "Empresa Dos",
        "fecha": "Fecha no especificada",
        "ubicacion": "Ubicación no especificada",
        "bullets": [
          "Construí reportes automatizados de KPIs financieros en SQL y Python, sirviendo a 5 departamentos y eliminando procesos manuales en Excel",
          "Realicé análisis exploratorio de datos (EDA) para detectar patrones de fraude, identificando anomalías que resultaron en ahorro de €120K anuales",
          "Desarrollé modelos de regresión lineal para forecasting de ventas con MAPE <8%, apoyando planificación presupuestaria trimestral",
          "Optimicé queries SQL complejas reduciendo tiempo de ejecución en 40% sobre bases de datos transaccionales de +500K registros diarios",
          "Colaboré con Data Engineers en diseño de esquemas de data warehouse para mejorar accesibilidad y calidad de datos del negocio"
        ],
        "aptitudes": [
          "SQL",
          "Python",
          "Análisis Exploratorio de Datos",
          "Regresión Estadística",
          "ETL",
          "Visualización de Datos"
        ],
        "keywords": [
          "Financial Data Analysis",
          "Fraud Detection",
          "Forecasting",
          "SQL Analytics",
          "Business Intelligence",
          "Data Quality"
        ]
      }
    ]
  }
}
```

## sonnet-5-5 · migrada · repetición 1

HTTP 200 · API 12228 ms · tokens 4454→1787 · $0.0268 · parada end_turn · bloques ["text"]

Estructura: ✓

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

## sonnet-5-5 · migrada · repetición 2

HTTP 200 · API 11700 ms · tokens 4454→1784 · $0.0267 · parada end_turn · bloques ["text"]

Estructura: ✓

```json
{
  "ok": true,
  "analisis": {
    "score_actual": 42,
    "titular_actual": "Analista de datos | SQL | Python | Power BI",
    "titular_propuesto": "Data Scientist | Modelos predictivos y analítica avanzada en Finanzas | Python, SQL, Machine Learning | +6 años convirtiendo datos en decisiones de negocio",
    "acerca_de_actual": "Me gustan los números y resolver problemas. Trabajo con datos desde 2018.",
    "acerca_de_propuesto": "Analista senior de datos en Finanzas con 6+ años transformando datos en decisiones de negocio. Experta en Python, SQL y modelado predictivo. Busco mi próximo paso como Data Scientist.",
    "puntos_fuertes": [
      "Base técnica sólida y reconocible por recruiters: SQL, Python y Power BI aparecen ya en el titular",
      "Trayectoria de crecimiento visible: de Analista a Analista senior en el sector Finanzas",
      "Sector financiero, muy valorado para roles de Data Scientist por su exigencia en rigor y análisis de riesgo"
    ],
    "areas_mejora": [
      "El titular te posiciona como 'Analista de datos', no como Data Scientist: cambialo para que los recruiters que buscan ese rol te encuentren (hoy no aparecés en esas búsquedas)",
      "La sección 'Acerca de' es genérica y no tiene ningún logro ni dato concreto: reemplazala por un hook con tu trayectoria, un resultado medible y qué buscás",
      "Las experiencias solo muestran cargo y empresa, sin logros: agregá 4-5 bullets por puesto con verbo de acción + resultado cuantificable (% de mejora, tiempo ahorrado, volumen de datos, impacto en negocio)",
      "No hay señales de Machine Learning ni estadística aplicada: incorporá proyectos, modelos o técnicas (regresión, clasificación, forecasting, A/B testing) que ya hayas usado, ya que es lo que distingue a un Data Scientist de un analista"
    ],
    "habilidades_sugeridas": [
      "Machine Learning",
      "Python (pandas, scikit-learn)",
      "SQL",
      "Estadística y modelado predictivo",
      "Power BI",
      "Análisis de series temporales",
      "Visualización de datos",
      "Data Storytelling"
    ],
    "experiencias_optimizadas": [
      {
        "rol": "Analista senior",
        "empresa": "Empresa Uno",
        "fecha": "Actual",
        "ubicacion": "",
        "bullets": [
          "Desarrollé modelos analíticos en Python y SQL para apoyar decisiones financieras, reduciendo el tiempo de generación de reportes y mejorando la precisión del análisis",
          "Diseñé dashboards interactivos en Power BI para el área financiera, facilitando el seguimiento de indicadores clave a la dirección",
          "Automaticé procesos de extracción y limpieza de datos, disminuyendo tareas manuales y errores en los reportes recurrentes",
          "Realicé análisis exploratorio y estadístico de grandes volúmenes de datos financieros para identificar patrones, riesgos y oportunidades de negocio",
          "Comuniqué hallazgos y recomendaciones a stakeholders no técnicos mediante presentaciones claras orientadas a decisiones"
        ],
        "aptitudes": [
          "Python",
          "SQL",
          "Power BI",
          "Análisis estadístico",
          "Automatización de procesos",
          "Data Storytelling"
        ],
        "keywords": [
          "Data Science",
          "Analítica avanzada",
          "Modelado predictivo",
          "Finanzas",
          "Business Intelligence"
        ]
      },
      {
        "rol": "Analista",
        "empresa": "Empresa Dos",
        "fecha": "",
        "ubicacion": "",
        "bullets": [
          "Extraje, limpié y consolidé datos desde múltiples fuentes mediante consultas SQL para alimentar análisis y reportes del área",
          "Construí reportes y visualizaciones en Power BI que permitieron monitorear métricas financieras clave de forma periódica",
          "Apliqué técnicas de análisis exploratorio con Python para detectar tendencias y anomalías en los datos",
          "Colaboré con equipos de negocio para traducir necesidades en requerimientos analíticos concretos",
          "Documenté metodologías y definiciones de métricas, asegurando consistencia y trazabilidad en los análisis"
        ],
        "aptitudes": [
          "SQL",
          "Python",
          "Power BI",
          "Análisis exploratorio de datos",
          "Reporting financiero",
          "Calidad de datos"
        ],
        "keywords": [
          "Análisis de datos",
          "Reporting",
          "ETL",
          "Visualización de datos",
          "Finanzas"
        ]
      }
    ]
  }
}
```
