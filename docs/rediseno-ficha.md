# Rediseño de la ficha del cliente — plan, decisiones y QA

> Documento vivo. Referencia visual: `mockup-panel-simple.html` (preview interactivo).
> Modo de trabajo: **Opción A** — se trabaja en la rama `claude/optimistic-goodall-9thkjb`
> y se prueba con el **cliente de ejemplo** (María). Nada a `main` hasta aprobar.
> Todo el panel nuevo va **detrás de un interruptor** atado a la cuenta de Micaela
> (admin / su email): cualquier otro coach sigue viendo el panel actual.

## Objetivo
Que un coach **entienda y use** el panel: menos pestañas, un flujo claro
(generar → editar → publicar), y nada que abrume. Sin perder datos de ningún coach.

---

## Etapas (chicas, probadas y reversibles)

| # | Etapa | Qué toca | Riesgo | Datos |
|---|-------|----------|--------|-------|
| 0 | Red de seguridad | flag + backup + este doc | nulo | — |
| 1 | Reorganización visual de la ficha | solo UI de `panel-v2.html` | bajo | **no toca** |
| 2 | Flujo claro | próximo paso, estado vacío, publicar | bajo | no toca |
| 3 | Prompt / IA | edge function `generar-informe` | medio | mantiene forma del JSON |
| 4 | Integración form ↔ perfil | `formulario.html` upsert | **alto** | merge (cuidado) |
| 5 | Gamificación + notificaciones | cliente + coach + push | medio | aditivo |
| 6 | White-label color + QA final | acento por coach | bajo | no toca |

Solo al cerrar la 6 se prende el interruptor para el resto de los coaches.

---

## Decisiones tomadas (con su porqué) — para validar

- **4 pestañas** (Perfil · Análisis · Sesiones · Documentos), antes 7.
  *Porqué:* menos carga; "Avance" era casi igual a "Análisis"; "Gestión" se repartió.
- **Avance fusionado en Análisis** (editar acciones + marcarlas en el mismo lugar).
  *Porqué:* eran dos pestañas sobre los mismos datos (`*_acciones` + `acciones_progreso`).
- **Etapas opcionales** y con nombres que pone el coach (la plataforma no inventa).
  *Porqué:* no todo coach trabaja por fases; el prompt no debe imponer el método de Micaela.
- **Configuración eliminada** → acceso/estado/notas a Perfil; visibilidad de docs en Documentos.
  *Porqué:* quedaba casi vacía; una sola fuente de verdad por dato.
- **Mensajes fuera de las pestañas** → acceso directo (botón) + ventana con plantillas; chat en el 💬.
  *Porqué:* es comunicación, no una sección de trabajo; ocupaba una pestaña para poco.
- **Generar por documento** (CV pide solo CV; LinkedIn pide solo LinkedIn).
  *Porqué:* pedir CV+LinkedIn juntos confundía (parecía generar los dos).
- **La IA lee TEXTO pegado, no PDF** (hoy). PDF directo = mejora futura.
- **Email**: reply-to al coach + firma/foto; Pro = su marca / Basic = "Powered by Pathway" (se sabe por el plan, no se elige). Envío por Brevo.
- **Gamificación** = las acciones que carga el coach son los logros del cliente
  (carrera/finanzas por hitos; fitness por constancia diaria). Medallas reales de Pathway.
- **"Próximo paso"** guía la única acción urgente y suma al progreso del coach.
- **Jerarquía de botones**: el verde sólido solo para lo urgente; el resto, suave.

### Decisiones abiertas (faltan definir)
- Gamificación del cliente: ¿100% acciones del coach o híbrido (unos fijos + las del coach)?
- ¿El cliente puede crear tareas propias o solo marca las del coach?

---

## El interruptor (feature flag)
Helper en `panel-v2.html`: el panel nuevo se muestra solo si
`ME.rol==='admin'` **o** `ME.email` es el de Micaela. Cualquier otro coach
ve el panel actual, sin un solo cambio. Apagarlo = rollback instantáneo.

---

## Red de seguridad (qué nos avisa si algo se rompe)
- **`pw-observe.js` → tabla `client_errors`**: registra errores reales de producción,
  incluso guardados que fallan en silencio. Revisar después de cada deploy:
  `SELECT ts,kind,email,page,detail FROM client_errors ORDER BY ts DESC LIMIT 100;`
- **CI**: `check-syntax` + `check-smoke` + `check-guardrails`. Sumar una regla de
  guardrail por cada bug que arreglemos.
- **Backup automático diario** de Supabase + export manual antes de tocar datos (Etapa 4).
- **Interruptor** = rollback inmediato sin tocar código.

---

## Checklist de QA (tildar antes de prender cada etapa)
- [ ] El panel **guarda** y al recargar persiste.
- [ ] El **cliente ve** lo correcto en su portal (abrir "Ver en su portal").
- [ ] Un coach **de fitness y de finanzas** sigue viendo su panel **igual** (no se mezcló nada).
- [ ] Ningún **botón/handler roto** (`node scripts/check-smoke.js`).
- [ ] JS válido (`node scripts/check-syntax.js`) y guardrails (`node scripts/check-guardrails.js`).
- [ ] Otro coach (no Micaela) ve el **panel viejo** sin cambios.
- [ ] `client_errors` sin errores nuevos tras el deploy.
- [ ] (Etapa 4) Coach crea cliente → cliente completa el form → **no se pisan** los datos.
