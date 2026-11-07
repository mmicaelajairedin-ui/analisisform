# sugerir-empleos · `generar-informe`

## Petición (sintética)

```json
{
  "accion": "sugerir_empleos",
  "objetivo": "Data Scientist en fintech",
  "sector": "Finanzas",
  "ubicacion": "Buenos Aires",
  "modalidad": "Remoto",
  "fortalezas": "SQL, Python, automatización",
  "estrategia": "Mostrar proyectos con impacto medible"
}
```

## sonnet-4-5 · main · repetición 1

HTTP 200 · API 17033 ms · tokens 404→904 · $0.0148 · parada end_turn · bloques ["text"]

Estructura: ✓

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

## sonnet-4-5 · main · repetición 2

HTTP 200 · API 15657 ms · tokens 404→901 · $0.0147 · parada end_turn · bloques ["text"]

Estructura: ✓

```json
{
  "empleos": [
    {
      "titulo": "Data Scientist - Risk Analytics",
      "empresa_tipo": "Fintech regional · Remoto LATAM",
      "relevancia": 94,
      "descripcion": "Diseñar modelos de scoring crediticio y detección de fraude para plataforma de préstamos digitales. Automatización de pipelines de datos y reportes para equipos de riesgo. Stack moderno con fuerte foco en impact metrics.",
      "requisitos": "Python (pandas, scikit-learn), SQL avanzado, experiencia con datos financieros, portfolios con métricas de negocio",
      "salario_rango": "$800k-1.2M ARS",
      "query_indeed": "data scientist fintech"
    },
    {
      "titulo": "Analista Quantitativo Senior",
      "empresa_tipo": "Broker digital · Buenos Aires remoto",
      "relevancia": 89,
      "descripcion": "Desarrollar estrategias algorítmicas de trading y modelos predictivos para mercados financieros. Automatizar análisis de portfolios y backtesting. Trabajo directo con stakeholders de inversiones.",
      "requisitos": "Python, SQL, estadística financiera, experiencia con series temporales, proyectos demostrables",
      "salario_rango": "$900k-1.4M ARS",
      "query_indeed": "quantitative analyst python"
    },
    {
      "titulo": "Data Analyst - Business Intelligence",
      "empresa_tipo": "Startup de pagos · Remote-first",
      "relevancia": 87,
      "descripcion": "Construir dashboards ejecutivos y automatizar reporting financiero para decisiones de producto. Análisis de comportamiento de usuarios y optimización de conversión en flujos de pago.",
      "requisitos": "SQL experto, Python para ETL, herramientas BI (Looker/Tableau), pensamiento analítico con foco en ROI",
      "salario_rango": "$700k-1M ARS",
      "query_indeed": "data analyst fintech remote"
    },
    {
      "titulo": "Machine Learning Engineer - Fraud Detection",
      "empresa_tipo": "Billetera digital · LATAM híbrido",
      "relevancia": 91,
      "descripcion": "Implementar y optimizar sistemas de ML para prevención de fraude en transacciones. Pipelines automatizados en producción, A/B testing de modelos, monitoreo de performance con impacto directo en pérdidas.",
      "requisitos": "Python (TensorFlow/PyTorch), SQL, MLOps básico, experiencia en fraude/riesgo, portfolio con KPIs",
      "salario_rango": "$1M-1.5M ARS",
      "query_indeed": "machine learning engineer fraud"
    },
    {
      "titulo": "Data Science Lead - Credit Scoring",
      "empresa_tipo": "Plataforma de inversiones · Remoto Argentina",
      "relevancia": 85,
      "descripcion": "Liderar desarrollo de modelos de evaluación crediticia para productos de inversión retail. Automatización de pipelines de feature engineering y validación de modelos bajo normativa BCRA.",
      "requisitos": "4+ años en data science financiero, Python/SQL, conocimiento regulatorio, proyectos con impacto cuantificable en aprobación/default",
      "salario_rango": "$1.1M-1.6M ARS",
      "query_indeed": "data science credit scoring"
    }
  ]
}
```

## sonnet-5-5 · migrada · repetición 1

HTTP 200 · API 9395 ms · tokens 545→1403 · $0.0151 · parada end_turn · bloques ["text"]

Estructura: ✓

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

## sonnet-5-5 · migrada · repetición 2

HTTP 200 · API 9268 ms · tokens 545→1469 · $0.0158 · parada end_turn · bloques ["text"]

Estructura: ✓

```json
{
  "empleos": [
    {
      "titulo": "Data Scientist - Riesgo Crediticio",
      "empresa_tipo": "Fintech de préstamos digitales · Remoto Argentina",
      "relevancia": 94,
      "descripcion": "Desarrolla y mantiene modelos de scoring y propensión de pago para originación de préstamos. Trabaja con equipos de producto y riesgo para llevar los modelos a producción y medir su impacto en mora y aprobación.",
      "requisitos": "2-4 años en data science, Python (pandas, scikit-learn, XGBoost), SQL avanzado, conocimiento de métricas de riesgo (KS, Gini), experiencia previa en finanzas o fintech valorada",
      "salario_rango": "USD 3.000-4.500/mes",
      "query_indeed": "data scientist riesgo crediticio fintech remoto"
    },
    {
      "titulo": "Data Scientist - Prevención de Fraude",
      "empresa_tipo": "Billetera virtual / Procesador de pagos · Remoto LATAM",
      "relevancia": 91,
      "descripcion": "Diseña modelos de detección de anomalías y reglas de fraude sobre transacciones en tiempo casi real. Colabora con ingeniería para automatizar alertas y reducir falsos positivos sin afectar la conversión.",
      "requisitos": "Python, SQL, modelos supervisados y de detección de anomalías, manejo de datasets desbalanceados, experiencia con pipelines automatizados, inglés intermedio-avanzado",
      "salario_rango": "USD 3.500-5.000/mes",
      "query_indeed": "data scientist fraude pagos remoto"
    },
    {
      "titulo": "Analytics Engineer / Data Scientist",
      "empresa_tipo": "Neobanco regional · Remoto desde Argentina",
      "relevancia": 87,
      "descripcion": "Construye y automatiza modelos de datos y métricas de negocio en el data warehouse, y desarrolla análisis predictivos sobre comportamiento de clientes. Rol híbrido entre analítica avanzada e ingeniería de datos.",
      "requisitos": "SQL avanzado, Python, dbt o herramientas similares, data warehouses cloud (BigQuery/Snowflake), orquestación (Airflow), foco en automatización de reportes y procesos",
      "salario_rango": "USD 2.800-4.200/mes",
      "query_indeed": "analytics engineer data scientist fintech remoto"
    },
    {
      "titulo": "Data Scientist - Customer Analytics y Retención",
      "empresa_tipo": "Plataforma de pagos y servicios financieros · Remoto Argentina",
      "relevancia": 83,
      "descripcion": "Modela churn, lifetime value y segmentación de clientes para optimizar campañas y productos financieros. Diseña experimentos y mide el impacto incremental de cada iniciativa sobre ingresos y retención.",
      "requisitos": "Python, SQL, estadística aplicada, A/B testing, visualización (Looker/Tableau/Power BI), capacidad de comunicar resultados a áreas de negocio",
      "salario_rango": "USD 2.500-3.800/mes",
      "query_indeed": "data scientist customer analytics churn fintech"
    },
    {
      "titulo": "Data Scientist - Inversiones y Analítica de Mercado",
      "empresa_tipo": "Broker / Plataforma de inversiones digital · Remoto Buenos Aires",
      "relevancia": 78,
      "descripcion": "Desarrolla análisis cuantitativos y modelos de recomendación y segmentación de inversores. Automatiza la generación de indicadores y dashboards para equipos comerciales y de producto.",
      "requisitos": "Python, SQL, nociones de mercados de capitales y finanzas, series temporales, automatización de reportes, portfolio de proyectos con impacto medible",
      "salario_rango": "USD 2.200-3.500/mes",
      "query_indeed": "data scientist inversiones mercado de capitales remoto"
    }
  ]
}
```
