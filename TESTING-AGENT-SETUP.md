# 🧪 Testing Agent Diario — Plataforma MJ

Agente automatizado que testea la plataforma de mentoría de Micaela Jairedin todos los días a las 10:00 AM y envía un reporte por email.

## Qué testea

| Área | Tests | Descripción |
|------|-------|-------------|
| Carga de páginas | 8 tests | Todas las páginas (index, login, panel, cliente, cv, carta, links, hub) |
| Formulario | 8 tests | Navegación multi-paso, consentimiento, radio/checkboxes, barra de progreso |
| Cambio de idioma | 2 tests | ES ↔ EN con verificación de textos |
| Login | 5 tests | Validaciones, errores, branding |
| Panel del coach | 6 tests | Layout, sidebar, estadísticas, tabs |
| APIs | 6 tests | Supabase (candidatos, informes, usuarios), Netlify AI function |
| Responsivo | 4 tests | Móvil (375px), Tablet (768px), Desktop (1440px) |
| Recursos | 3 tests | Google Fonts, EmailJS, errores de consola |

## Configuración (una sola vez)

### 1. Secrets de GitHub

Ve a tu repo → **Settings → Secrets and variables → Actions** y agrega:

| Secret | Valor | Descripción |
|--------|-------|-------------|
| `GMAIL_USER` | tu-email@gmail.com | Email desde donde se envía el reporte |
| `GMAIL_APP_PASSWORD` | xxxx xxxx xxxx xxxx | App Password de Google (no tu contraseña normal) |

#### Cómo crear un App Password de Google:
1. Ve a https://myaccount.google.com/apppasswords
2. Selecciona "Otro" → escribe "Testing Agent MJ"
3. Copia la contraseña de 16 caracteres
4. Pégala en el secret `GMAIL_APP_PASSWORD`

### 2. Activar GitHub Actions

El workflow se ejecuta automáticamente con el cron schedule. Para probarlo manualmente:
1. Ve a tu repo → **Actions**
2. Selecciona **"🧪 Testing Agent Diario — Plataforma MJ"**
3. Click en **"Run workflow"**

## Ejecución local

```bash
# Instalar dependencias
npm install
npx playwright install chromium

# Ejecutar todos los tests
npx playwright test

# Ejecutar y generar reporte
npx playwright test --reporter=json > tests/results/test-results.json
node tests/generate-report.js
```

## Estructura

```
tests/
├── pages-load.spec.js       # Carga de todas las páginas
├── form-flow.spec.js         # Formulario multi-paso
├── login-flow.spec.js        # Autenticación
├── panel-dashboard.spec.js   # Panel del coach
├── api-connectivity.spec.js  # Supabase + AI endpoint
├── responsive-design.spec.js # Diseño responsivo
├── generate-report.js        # Generador de reportes
└── results/                  # Resultados (gitignored)
    ├── report.html           # Reporte en HTML (para email)
    ├── report.txt            # Reporte en texto plano
    └── summary.json          # Resumen en JSON
```

## Reporte de email

El reporte incluye:
- **Estado general**: Saludable / Atención necesaria / Problemas críticos
- **Resumen numérico**: Total, pasaron, fallaron, tasa de éxito
- **Problemas detallados**: Nombre del test, suite, error exacto
- **Cambios recomendados**: Acción sugerida para cada fallo
- **Funcionalidades verificadas**: Lista de tests exitosos

## Horario

- **10:00 AM hora de España** (CEST/CET)
- Configurable en `.github/workflows/daily-testing-agent.yml` (cron)
- También ejecutable manualmente desde GitHub Actions
