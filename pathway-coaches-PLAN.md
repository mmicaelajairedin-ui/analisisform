# Pathway Coaches — Plan y decisiones (memoria del proyecto)

> Expansión de Pathway (career) a una plataforma multi-nicho para coaches.
> Mismo "cascarón", distinto contenido por nicho. Reusa el ~85% de career.
> Prototipos standalone en la rama (no tocan career): `pathway-fit-*`, `pathway-fin-*`, `pathway-base.css`.

## Nichos
Carrera (existe) · 💰 Financiero · 🧘 Fitness · 🌱 Vida · 📈 Negocios · 👔 Ejecutivo.
**Foco de construcción ahora: Fitness + Financiero.**

## Marketplace de 2 lados (el corazón)
- El cliente entra y **busca coach por área** ("buscá tu coach del área que sea").
- Directorio filtrado por `coach_type`. Reusa `listar-coaches-publicos` + `obtener-perfil-coach`.
- Pathway **trae clientes** → diferencial que la competencia (Harbiz, Coach Pilot) no tiene.

## Modelo económico (cerrado)
- **Suscripción del coach** €58 Sencillo / €89 Pro = ingreso recurrente. White-label solo en Pro.
- **Comisión de presentación 20%** SOLO la primera vez que Pathway trae un cliente (finder's fee). Después 0% — el cliente es 100% del coach.
- **Clientes propios del coach**: 0% comisión, siempre.
- Carril Stripe Connect ya existe (`connect-onboard`, `connect-checkout`, `stripe-webhook`).

## Comunicación + anti-fuga
- **Todo dentro de Pathway** (chat in-app). **Sin WhatsApp.**
- Primer paso gratis: chat/llamada antes de pagar (pago con hold, no se cobra hasta aceptar).
- **Moderación única, siempre activa, en todo Pathway:**
  1. Filtro de datos de contacto (teléfono, email, IBAN, dirección, redes).
  2. Filtro de contenido abusivo/insultos. Lista + botón reportar (IA después).
- Pathway provee el canal: chat permanente, videollamada con link propio, agenda, archivos, notificaciones.

## Estructura común (todos los nichos)
- **Panel del coach = 3 pestañas**: Resumen · Clientes(Alumnos) · Configuración.
  - Resumen: medallas del coach + "Empezá en Pathway" (onboarding) + notificaciones/actividad.
  - Clientes: lista **activos/inactivos + ALERTAS para contactar** (resuelve "se me quedan sin contactar").
  - Entrás al cliente → **ficha con sub-pestañas** (cambian por nicho).
- **Portal del cliente = bottom-nav** (5 tabs), marca del coach (white-label), medallas + confeti.
- **Módulos genéricos reutilizables**: plan (semana/mes), metas con número, seguimiento con gráfico, tareas/checklist, biblioteca, objetivos semanales (→ confeti + medalla).

## ⭐ Módulos activables/desactivables por coach (IMPORTANTE)
Cada coach **prende/apaga los módulos que usa** (como esconder CV/empleos en career).
Ej: Gon usa antropometría + entrenamiento + nutrición, pero otro coach quizás no.
Los módulos que apaga **no aparecen** ni en su panel ni en el portal del cliente.

## Nicho FITNESS (detalle)
- Ritmo **semanal**.
- **Rutina** (modo gym): días → ejercicios (series×reps), check al hacer, 👁 ver foto + pasos (base `free-exercise-db` embebida, offline).
- **Antropometría**: el coach carga muchos datos numéricos; el **cliente ve GRÁFICOS** (composición corporal donut + comparativa de masas por mes, colores). Medición ~1 vez por mes / mes y medio. Read-only para el cliente.
- **Hábitos diarios** + rachas.
- **Alimentación**: ligera (el coach sube su guía). G usa Athlevo (solo nutrición) → Pathway no compite por nutrición, ofrece el "todo junto".
- **Objetivos de la semana** que pone el coach → confeti + medalla al cliente.
- Futuro: contador de calorías (Open Food Facts + escáner), wearables (Fitbit/Garmin/Strava; Apple Watch necesita app nativa).

## Nicho FINANCIERO (detalle)
- Ritmo **mensual**.
- **Presupuesto Nivel B**: cierre mensual por categorías (~9) → dona + evolución por categoría + regla 50/30/20.
- El **cliente carga** sus gastos; el **coach fija** el presupuesto recomendado (real vs. recomendado).
- **Metas de ahorro** (barras) + **salida de deudas** (bola de nieve).
- **Salud financiera** (score) + plan por meses con tareas.

## Form de intake + análisis IA
- El coach invita → cliente llena **form de evaluación** → IA (`generar-informe`, cambia el prompt) arma diagnóstico/plan → coach ajusta → se activa el portal.
- Fitness: incluir **lesiones**, objetivo, nivel, días/semana, equipo, peso/altura.
- Financiero: ingresos/gastos/deudas/objetivo.

## Reuso desde career (~85%)
Backend: `generar-informe`, Stripe Connect, directorio, `calendar`, `send-push`/`notif-*`, `send-email`, `migrate-user-to-auth`.
Frontend/PWA: `pw-auth.js`, `pw-push.js`, `sw.js` (offline), `perfil-publico-editor.js`, `testimonios.js`, medallas/confeti/onboarding/feed.
Net-new: las 2 herramientas-firma + prompts/preguntas por nicho + el chat con filtro.

## Seguridad (pendiente importante)
Con datos financieros y chats privados, cerrar el **gap de RLS/auth** (Sprint B) ANTES de lanzar estos nichos.

## Estado de los prototipos
- `pathway-fit-cliente.html` — portal fitness (rutina, composición corporal en gráficos, hábitos, plan).
- `pathway-fin-cliente.html` — portal financiero (presupuesto, evolución, objetivos, plan).
- `pathway-fit-coach.html` — panel fitness (3 tabs, alumnos+alertas, ficha: plan/antropometría/fotos/objetivos/chat, resumen con medallas+onboarding+notifs).
- `pathway-fin-coach.html` — panel financiero (gemelo).
- `pathway-base.css` — hoja de estilos compartida (en proceso de conexión).

## Pendientes / próximos
- [ ] Conectar los 4 archivos a `pathway-base.css` (dejar de duplicar CSS).
- [ ] Módulos activables/desactivables por coach (en Configuración).
- [ ] Form de intake + análisis IA (con lesiones en fitness).
- [ ] Chat in-app con filtro de contacto/abuso.
- [ ] Resumen y Configuración con contenido real en ambos paneles.
