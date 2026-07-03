# Proyecto — Agenda nativa de Pathway (reemplazar Calendly)

> **Objetivo:** que las sesiones se agenden, vean y sincronicen **dentro de Pathway**,
> con el Google Calendar del coach, sin depender de Calendly. Diseño integrado
> (misma tipografía y colores del panel), arriba en Resumen, con las fotos de la gente.
>
> **Estado:** documento de proyecto para evaluar ANTES de tocar código.
> **Regla de oro:** todo detrás de un interruptor (solo admin/Micaela hasta aprobar),
> aditivo (no rompe el Resumen ni las Sesiones actuales), y por fases reversibles.

---

## 1. Qué pidió la coach (alcance)

1. Agenda linda **arriba en Resumen**, con la tipografía del panel y las **fotos** de la gente. *(mockup ya aprobado)*
2. Poder **pinchar el calendario y poner disponibilidad**.
3. Obtener un **link para compartir** con el cliente (como el de Calendly).
4. Que el **cliente vea los mismos datos** (su sesión en su portal).
5. Que la sesión agendada **aparezca en "Sesiones"**.
6. **Integrar Google Calendar ↔ Pathway**: que la sesión salga en **ambos lados**.
7. **Email** cuando alguien agenda.
8. **Notificaciones** a los dos (coach y cliente).

---

## 2. Lo que YA existe en Pathway (se reutiliza, no se crea)

| Pieza | Qué hace hoy | Cómo se reusa |
|-------|--------------|----------------|
| `supabase/functions/calendar` | **Lee** el Google Calendar del coach (iCal) y devuelve los próximos eventos | Alimenta la agenda de Resumen (Fase 1) |
| `candidatos.sesiones_registro` | Guarda las sesiones en Supabase (fecha, tema, tareas) | Es donde caen las reservas nuevas |
| `send-email` (Brevo) | Envío de emails con diseño | Mail de confirmación al agendar |
| `send-push` + `pw-push.js` | Notificaciones push | Aviso a coach y cliente |
| Portal del cliente + sección "Sesiones" | El cliente ya ve sus sesiones | Ahí aparece la reserva |
| `usuarios.configuracion` | Config por coach (ya guarda `calendly_url`) | Guardará disponibilidad + iCal + sala de video |

> Conclusión: **el 60-70% de las piezas ya están**. Esto es conectar y rediseñar,
> no construir de cero.

---

## 3. La realidad técnica honesta (dónde está el trabajo)

- **Leer tu calendario → FÁCIL, sin permisos raros.** Google Calendar da una
  dirección "iCal" secreta. La pegás una vez y la función que ya tenés la lee.
  Read-only, cero OAuth. **Con esto ves tus sesiones reales enseguida.**
- **Reservar sin choques → MEDIO (es el corazón).** Mostrar tu disponibilidad,
  que el cliente elija un hueco y que **no se agenden dos en el mismo horario**,
  respetando **zonas horarias**. Esto es lo que hace valioso a Calendly; se puede,
  pero es el trabajo real.
- **Que la reserva también aparezca en TU Google Calendar (sync de ida) → necesita
  OAuth.** Para *escribir* en tu Google (y para el link de Meet automático por
  sesión) hay que **conectar tu cuenta de Google una vez**. 
  - *Atajo sin OAuth:* la reserva vive en Pathway (y se ve en ambos portales) y el
    video usa tu **sala fija** de Meet/Zoom. La "ida a Google" se suma después.
- **Emails y push → YA resuelto.** Se dispara con lo que ya existe.

---

## 4. Fases (chicas, reversibles, detrás del interruptor)

| # | Fase | Qué entrega | Necesita | Riesgo |
|---|------|-------------|----------|--------|
| 0 | Mockup aprobado + este doc | plan | — | nulo |
| 1 | **Agenda linda en Resumen con datos REALES** (solo lectura del Google Calendar) | Ves tus sesiones reales arriba, con fotos de tus clientes | tu dirección iCal | bajo |
| 2 | **Disponibilidad + link para compartir + reserva** → crea la sesión en Pathway, aparece en "Sesiones" del coach y del cliente | Reemplaza el "agendar" de Calendly | — | medio |
| 3 | **Email + notificaciones** al agendar (a coach y cliente) | Confirmaciones automáticas | — | bajo |
| 4 | **Sync de ida a Google + Meet automático por sesión** | La reserva sale también en tu Google; link único por reunión | conectar Google (OAuth) | medio-alto |
| 5 | Apagar Calendly (interruptor) tras QA en real | Pathway 100% propio | — | bajo |

Cada fase corre `check-syntax` + `check-smoke` + `check-guardrails` antes de commitear.

---

## 5. Qué NO se toca
- El Resumen actual sigue funcionando; la agenda se **suma arriba**, no reemplaza lo de abajo.
- Las Sesiones actuales (`sesiones_registro`) no cambian de formato; la reserva
  escribe en la misma estructura.
- Mientras no se apague (Fase 5), **Calendly sigue disponible** como estaba.
- Los coaches que no configuren disponibilidad ven todo **igual que hoy**.

---

## 6. Qué necesito de vos
- **Fase 1:** la **dirección iCal secreta** de tu Google Calendar (Google Calendar →
  Configuración → "Dirección secreta en formato iCal"). Con eso ves tus datos reales.
- **Fase 4:** conectar tu cuenta de Google (un clic de permiso), solo cuando lleguemos ahí.
- Tu **sala fija de Meet o Zoom** (para el atajo del video sin OAuth).

---

## 7. QA (antes de prender)
- [ ] La agenda muestra las sesiones reales del Google Calendar del coach.
- [ ] Las fotos se cruzan bien con los clientes de Pathway (y caen a iniciales si no es cliente).
- [ ] Reservar dos veces el mismo hueco → **se bloquea** (no doble-booking).
- [ ] Zonas horarias correctas (coach y cliente en distintos países).
- [ ] La reserva aparece en "Sesiones" del coach y del cliente.
- [ ] Llega el email de confirmación a ambos; llegan las push.
- [ ] Desktop y móvil se ven bien; misma tipografía del panel.
- [ ] Coach sin configurar disponibilidad → ve todo como hoy (nada roto).
- [ ] `check-syntax` + `check-smoke` + `check-guardrails` en verde.

---

## 8. Próximo paso sugerido
Construir la **Fase 1** (agenda real de solo lectura): es de bajo riesgo, aditiva y
te deja **ver tus datos reales** enseguida. Si te gusta cómo se siente con lo tuyo,
avanzamos a la Fase 2 (disponibilidad + reserva).
