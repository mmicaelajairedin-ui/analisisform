# Base de datos de Pathway — mapa y runbook

Este es el **mapa** de toda la base de Supabase (`api.pathwaycareercoach.com`):
qué tablas y buckets existen, para qué sirven, y **cómo armar todo de cero**.

> **Importante:** la fuente real de la verdad son las migraciones en
> `supabase/migrations/`. Este archivo es el **índice** para no perderse. Cuando
> agregamos una feature con SQL nuevo, se suma su migración y se anota acá abajo
> en "Pendientes de correr".

---

## ⚙️ Cómo armar la base desde cero
1. En Supabase → **SQL Editor**.
2. Crear las **tablas núcleo a mano** (se hicieron así al inicio, no tienen
   migración — ver sección "Tablas núcleo").
3. Correr **todas** las migraciones de `supabase/migrations/` (el orden entre
   ellas casi no importa: cada una usa `if not exists` / `drop policy if exists`).
4. Crear los **buckets de Storage** (los que no tengan `insert into
   storage.buckets` en su migración: `avatars`).

## ✅ Pendientes de correr (lo agregado hace poco)
Si algo "no anda", suele ser porque falta correr uno de estos:
- [ ] `dataroom_docs.sql` — data room de inversores (tabla + bucket `dataroom` + accesos)
- [ ] `docs_bucket.sql` — bucket `docs` (para que el coach suba PDF/Word a las sesiones)
- [ ] `fit_ejercicios_real.sql` — columna `fit_ejercicios_real` en `candidatos` (el cliente registra lo que hizo distinto al plan del gym; el coach lo ve tachado + el real)

---

## 🗂️ Buckets de Storage
| Bucket | Público | Contenido | Migración |
|---|---|---|---|
| `avatars` | sí | Fotos de perfil (coach y cliente) | (creado a mano en el dashboard) |
| `docs` | sí | Documentos que el coach adjunta a una sesión (PDF/Word/img) | `docs_bucket.sql` |
| `dataroom` | sí | Documentos del data room de inversores | `dataroom_docs.sql` |

---

## 🧱 Tablas núcleo (creadas a mano, sin migración)
Son las más importantes y viejas. Las columnas se fueron ampliando con las
migraciones `ALTER TABLE` de la carpeta.
| Tabla | Para qué |
|---|---|
| `candidatos` | El cliente/candidato: datos del formulario, foto, semana activa, pagos, notas del coach, `sesiones_registro`, `coach_id`, campos por nicho (fitness/finanzas) |
| `usuarios` | Login (email, `password_hash`, rol coach/empleado/admin/owner, `configuracion` JSONB, `fecha_fin_prueba`, `estado_sub`, `auth_id`) |
| `informes` | Informes generados con IA (email, data JSON) |
| `cv_publicados` | CVs publicados (email, contenido JSON, código) |
| `contactos_chat` | Leads capturados por el chatbot de la landing |

## 🧩 Tablas por dominio (con migración)
**Agenda / sesiones**
| Tabla | Migración | Para qué |
|---|---|---|
| `citas` | `citas.sql` (+ `citas_origen`, `citas_token`, `citas_respuestas`, `citas_recordatorios`) | Reservas del link de agenda del coach |

**Multi-coach / red / empresa**
| Tabla | Migración | Para qué |
|---|---|---|
| `organizaciones` | `organizaciones.sql` | La red/empresa (multicoach) como entidad |
| `coaches`, `clientes`, `evaluaciones`, `objetivos`, `habitos_log`, `mensajes` | `coaches_mvp.sql` | Modelo MVP de la red |
| `solicitudes` | `solicitudes.sql` (+ `_extender`, `_notificada`) | Solicitudes de acceso / extensión |
| `mensajes_owner_coach`, `mensajes_admin_coach`, `mensajes_red_canal` | resp. | Chats internos de la red |

**Fitness**
| Tabla | Migración | Para qué |
|---|---|---|
| `fit_rutinas`, `fit_antropometria` | `coaches_mvp.sql` | Rutinas + mediciones |
| (columnas `fit_*` en `candidatos`) | `fitness_intake_fields`, `fit_ejercicios_done`, `fit_nutri_log`, `fit_tareas`, `fit_fotos` | Hábitos, nutrición, tareas, fotos |

**Finanzas**
| Tabla | Migración | Para qué |
|---|---|---|
| `fin_cierres`, `fin_deudas`, `fin_metas` | `coaches_mvp.sql` | Cierres / deudas / metas |
| (columnas `fin_*` en `candidatos`) | `fin_previsibles` | Gastos previsibles |

**Gamificación**
| Tabla | Migración | Para qué |
|---|---|---|
| `ranking_mensual` | `ranking_mensual.sql` | Ranking de coaches |
| (columnas) | `gamificacion`, `coach_game`, `cliente_puntos` | Puntos, medallas, logros |

**Leads / marketing / pagos**
| Tabla | Migración | Para qué |
|---|---|---|
| `leads`, `lead_emails` | `leads_empleados.sql` | Leads de empresa/empleados |
| `leads_pricing` | (código) | Funnel de precios (trial/pago) |
| `prospectos` | (código) | Prospectos |
| `coach_nudges` | `coach_lifecycle_nudges.sql` | Anti-spam de emails de ciclo de vida |
| `stripe_events_processed` | (código) | Idempotencia del webhook de Stripe |
| `reviews` | `reviews_coach_slug.sql` | Reseñas de coaches |
| `suscripciones_cliente` | `suscripciones_cliente.sql` | Suscripciones del cliente |

**Notificaciones**
| Tabla | Migración | Para qué |
|---|---|---|
| `notificaciones` | `notificaciones.sql` | Notificaciones in-app |
| `push_subscriptions` | `push_subscriptions.sql` | Suscripciones push (web push) |

**Analytics / IA / soporte**
| Tabla | Migración | Para qué |
|---|---|---|
| `analytics_reports`, `site_context` | (agente de analytics) | Reportes semanales + contexto de sitio |
| `informes_guardados` | `informes_guardados.sql` | Varios informes por cliente |
| `ia_feedback` | `ia_feedback.sql` | Feedback del chat IA |
| `client_errors` | `client_errors.sql` | Observabilidad (errores reales de producción) |
| `password_resets` | `password_resets.sql` | Recuperación de contraseña |
| `repair_log` | `auto_repair.sql` | Log de auto-reparaciones |
| `email_queue` | (código) | Cola de emails |

**Data room de inversores**
| Tabla | Migración | Para qué |
|---|---|---|
| `dataroom_docs` | `dataroom_docs.sql` | Documentos del data room (auto-gestionable) |
| `dataroom_permitidos` | `dataroom_docs.sql` | Emails con acceso |
| `dataroom_accesos` | (código) | Log de accesos de inversores |

---

## 🔐 Seguridad (RLS)
El aislamiento por coach y el endurecimiento de RLS están en:
`rls_strict.sql`, `rls_close_informes_cv_leak.sql`, `rls_cleanup_open_policies.sql`,
`usuarios_hardening.sql`, `usuarios_protect_password.sql`, `informes_rls.sql`,
`prueba_rls.sql`. Ver la sección "SECURITY MODEL" del `CLAUDE.md` para el estado
y el plan de cierre del gap conocido.

---

_Última actualización de este mapa: julio 2026. Si agregás una tabla/bucket,
sumá su fila acá y su migración en `supabase/migrations/`._
