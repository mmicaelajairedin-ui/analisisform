# Brand Experience — MultiCoach
## Guía de implementación para Frontend

**Versión:** 1.0  
**Fecha:** 2026-07-30  
**Audience:** Equipo Frontend (MultiCoach)  
**Status:** En construcción — guía viva

---

## 1. Identidad de Marca — Los 6 Pilares

```
Confianza · Progreso · Profesionalidad · Cercanía · Calma · Acompañamiento
```

No buscamos parecer:
- ❌ Un videojuego
- ❌ Una app infantil
- ❌ Genérico SaaS
- ❌ Corporativo frío

Buscamos que sientas:
- ✅ Que alguien experto te acompaña
- ✅ Que hay progreso real (datos, hitos)
- ✅ Que el producto entiende tu negocio
- ✅ Que es diseñado para ti, no para todos

---

## 2. Paleta Visual

### Colores Base (Neutros por defecto)

| Token | Valor | Uso |
|-------|-------|-----|
| `--pw-niebla` | #F6F4EF | Fondos suaves, hover states |
| `--pw-niebla-2` | #EFE9DD | Cards, paneles |
| `--pw-niebla-3` | #E4DCD0 | Bordes sutiles |
| `--pw-carbon` | #1F2E26 | Texto principal (NO #000) |
| `--pw-text-soft` | #6E746F | Texto secundario |
| `--pw-text-muted` | #A8ADA7 | Metadatos, labels pequeños |
| `--pw-border` | #D8D4CA | Bordes, separadores |

### Color de Marca

| Token | Valor | Uso |
|-------|-------|-----|
| `--pw-bosque` | #2D6A4F | CTAs, acciones, progreso |
| `--pw-sendero` | #9DB2A5 | Acentos, líneas de progreso |

**Regla de oro:**  
- Chrome (encabezados, tarjetas, navegación): **100% neutro**
- CTAs, badges de progreso, alertas: **Verde Pathway cuando es acción/éxito**
- Rojo solo para peligro real (no advertencias suaves)

### Tipografía

| Uso | Font | Weight | Size | Spacing |
|-----|------|--------|------|---------|
| H1 (títulos grandes) | Fraunces | 600 | 32px | -1.4px |
| H2 (card titles) | Fraunces | 600 | 18px | -0.3px |
| Body (párrafos) | Inter | 400 | 13–14px | 1.5 |
| Labels, eyebrow | Inter | 700 | 10–11px | +0.8px (uppercase) |

**Nota:** Fraunces serif es lo que diferencia Pathway — usarlo SOLO en jerarquía (H1/H2), no en cuerpo.

---

## 3. Componentes Clave

### Tarjeta (Card)
- Background: `#fff`
- Border: `1px solid var(--pw-border)`
- Radius: `14px`
- Shadow: `var(--pw-shadow-sm)` en hover
- Transición: `box-shadow 0.2s, transform -2px 0.2s`

**Regla:** Nunca agregar color de marca al fondo. El color va en iconos, badges, CTAs.

### Botón Primario
- Background: `var(--pw-bosque)`
- Color: `#fff`
- Shadow: `0 3px 0 rgba(27,67,50,.45)` (3D subtle)
- Hover: `background #2f7254`

### Micro-interacciones
- Fade-in de secciones: `pwSecIn 0.34s`
- Dropdowns: `pwDD 0.17s`
- Entrada de mensajes: `pwMsgIn 0.32s`
- Respeta `prefers-reduced-motion`

---

## 4. Icon System — Lucide + Especificación

**Principio:** Una librería, un especificación, consistencia total.

- **Librería:** Lucide (outline style)
- **Stroke:** 2px
- **Tamaño:** 20px (18px en botones pequeños)
- **Color:** `#1F4030` (heredar `currentColor` en botones de color)
- **Fuente única:** `pw-icons.js`
- **Uso:** `PWI.svg('iconName', {sm:true})` o `<i data-ic="iconName"></i>`

### Tabla Canónica (conceptos → iconos)

| Concepto | Icono Lucide | Contexto |
|----------|-------------|----------|
| Perfil / Usuario | `user` | Headers, avatares |
| Planes / Servicios | `clipboard` | Sidebar MultiCoach |
| Entrenamientos | `dumbbell` | Fitness, rutinas |
| Medidas | `ruler` | Antropometría |
| Nutrición | `apple` | Comidas, macros |
| Calendario / Eventos | `calendar` | Agendas, sesiones |
| Dinero | `dollar` | Facturación, precios |
| Configuración | `settings` | Admin, opciones |
| Progreso / Tendencias | `trendUp` | Analytics, KPIs |
| Documentos | `fileText` | CVs, reports |
| Mensajes / Chat | `chat` | Comunicación (NO `mail`) |
| Múltiples usuarios | `users` | Equipos, clientes |
| Alertas | `alert` | Errores, atención |
| Checkmark | `check` | Completado, aprobado |
| Flecha siguiente | `chevronRight` | Navegación |

**Regla crítica:**  
- Un concepto = UN icono en TODA la plataforma
- NO mezclar Lucide con emojis en chrome
- Emojis solo en: contenido de usuario, emails, WhatsApp, medallas/logros

---

## 5. Microcopy & Tono

### Principios

1. **Lenguaje de coach, no de app**
   - ❌ "Solicitud pendiente"
   - ✅ "Esperando tu decisión"

2. **Contexto humano**
   - ❌ "Semana 2/4"
   - ✅ "Semana 2/4 — ya pasó lo difícil"

3. **Celebra progreso**
   - ❌ "CV guardado"
   - ✅ "✍️ CV listo — una pieza clave de tu historia"

4. **Empodera, no ordena**
   - ❌ "Debes conectar tu calendario"
   - ✅ "Conecta tu calendario para agendar sin fricciones"

5. **Claridad en vacío**
   - ❌ "Sin datos"
   - ✅ "Cuando agregues tu primer cliente, lo verás aquí"

### Ejemplos por Pantalla

#### Dashboard MultiCoach
- **H1:** "Tu panel de mando." (no "Dashboard")
- **Métrica:** "6 coaches activos" (no "6 usuarios")
- **Empty:** "Cero coaches, infinitas oportunidades — suma el primero"

#### Pantalla de Coaches
- **H1:** "Tu equipo en movimiento."
- **State badge (activo):** "Pagó · Semana 1" (no "Active")
- **State badge (trial):** "Prueba · Quedan 3 días"
- **Action:** "Acompañar" (no "View" o "Manage")

#### Pantalla de Clientes (by coach)
- **H1:** "Los que acompañas en [Coach]."
- **Progress:** "Semana 3/4 — ya está tocando la meta"
- **Empty:** "Este coach aún no tiene clientes — ayudalo a sumar el primero"

#### Analytics
- **Insight card:** "6 CVs listos esta semana — lo que espabila a los reclutadores"
- **Trend:** "↑ 40% más sesiones que la semana pasada — ritmo de oro"

#### Comunidad
- **H1:** "Donde los coaches se encuentran."
- **CTA:** "Comparte un logro" (no "Post update")

#### Facturación
- **H1:** "Tu negocio en números."
- **Pending:** "Esperando que 2 coaches confirmen pago"

---

## 6. La Cabra — Dónde, Cuándo, Cómo

### ✅ ÚSOS APROPIADOS

| Contexto | Dónde | Cómo |
|----------|-------|------|
| **Logo / Identidad** | Sidebar, favicon, emails | Pequeña, constante |
| **Celebración de hito** | Medalla de oro (10 coaches) | Icono 32px junto a badge |
| **Email bienvenida** | First-time welcome | Derecha, 120px, elegante |
| **Email progreso semanal** | "Esta semana en tu equipo" | Micro (32px), firma |
| **Comunidad / Mentores** | Badge de "Coach experto" | Sticker small (48px) |
| **Onboarding** | Paso 1 de setup | Ilustración contexto |

### ❌ EVITAR

- ❌ Emojis cabra en cada pantalla
- ❌ Overlay interactivo / juego en dashboard
- ❌ FAB animado de cabra "mascota"
- ❌ Cabra en notificaciones push (distrae)

---

## 7. Estados Vacíos (Empty States)

**Estructura:**

```
[Icono 64px, neutro]
"Encabezado de contexto"
"Explicación clara en 1–2 líneas"
[Botón primario con CTA]
[Opcionales: links secundarios]
```

### Ejemplo: MultiCoach sin coaches

```
🎯  [Icono clipboard]
"Tu plataforma está lista"
"Suma tu primer coach y empieza a escalar tu modelo de negocio."
[Botón: "+ Agregar primer coach"]
[Link: "Conoce cómo funciona"]
```

### Ejemplo: Coach sin clientes

```
👥 [Icono users]
"Cero clientes, infinitas oportunidades"
"Cuando agregues a alguien, verás su progreso aquí."
[Botón: "+ Sumar primer cliente"]
```

---

## 8. Aplicación a las 8 Pantallas de MultiCoach

### 1. Dashboard
- **Objetivo:** Snapshot del negocio (coaches activos, clientes, ingresos, tendencias)
- **Tono:** Calma + datos reales
- **Icono dominante:** `trendUp` (progreso)
- **Color:** Verde Pathway solo en KPIs positivos

### 2. Coaches
- **Objetivo:** Gestión de tu equipo
- **Tono:** Acompañamiento + claridad de estado
- **Estados visuales:** Pagó / Prueba (X días) / Vencida / Inactiva
- **Acción principal:** "Acompañar" no "Editar"

### 3. Clientes
- **Objetivo:** Vista agregada de clientes por coach
- **Tono:** Narrativa de progreso
- **Filtros:** Por coach, por semana, por estado
- **Microcopy:** "Semana 2/4 — ya pasó lo difícil"

### 4. Analytics
- **Objetivo:** Insights IA + datos Cloudflare
- **Tono:** Descubrimiento, no alarma
- **Visual:** Gráficos Recharts, paleta neutral
- **Insight cards:** "6 CVs listos = +40% conversiones esperadas"

### 5. Comunidad
- **Objetivo:** Coaches conectan, comparten, aprenden
- **Tono:** Celebración + apoyo
- **Cabra:** Badge pequeña para "Coach experto" o "Mentor"
- **UX:** Muro social limpio, sin ruido

### 6. Facturación
- **Objetivo:** Transparencia de ingresos y comisiones
- **Tono:** Claridad profesional
- **Estados:** Pagado / Pendiente / Rechazado
- **Microcopy:** "Esperando que 2 coaches confirmen" (no "2 overdue")

### 7. Marca (White-label)
- **Objetivo:** Personalizar identidad visual del coach
- **Tono:** Empoderamiento
- **Opciones:** Color accent, logo, bio, enlace personalizado
- **Aviso:** "Neutro por defecto — tu marca aquí"

### 8. Configuración
- **Objetivo:** Admin, permisos, integraciones
- **Tono:** Técnico pero cercano
- **Secciones:** Perfil / API / Integraciones / RLS / Seguridad

---

## 9. Flujos de Micro-interacción

### Carga de dato
- Skeleton loader con shimmer (no spinner)
- Transición `pwSecIn 0.34s`

### Éxito
- Toast con icono `check` verde
- Microcopy: "✓ Guardado" (no "Success!")

### Error
- Toast rojo + descripción clara
- CTA: "Reintentar" o "Contactar soporte"

### Progreso
- Barra visual (% o steps)
- Color: `--pw-sendero` (verde suave)
- Label: "3 de 5 coaches pagaron"

---

## 10. Palabras Vedadas

| ❌ Evitar | ✅ Usar |
|-----------|---------|
| Dashboard | Panel de mando / Tu espacio |
| User / Usuário | Persona / Coach / Cliente |
| Data | Información / Números |
| Status | Estado / Situación |
| Action | Paso / Siguiente |
| Manage | Acompañar / Gestionar |
| Feature | Herramienta |
| Submit | Enviar / Guardar |
| Error | Algo no salió bien |
| Loading | Un momento... |

---

## 11. Checklist de Implementación

- [ ] Paleta de colores en CSS (tokens)
- [ ] Tipografía Fraunces + Inter cargada (sin retrasos)
- [ ] Icon System Lucide integrado en 8 pantallas
- [ ] Micro-interacciones (fade, dropdown, shimmer)
- [ ] Empty states diseñados + copyeados
- [ ] Microcopy revisado (lenguaje de coach)
- [ ] Cabra: solo en 5 contextos permitidos
- [ ] Tonos de voz consistentes (test con 3 personas)
- [ ] Accesibilidad: labels, ARIA, contraste ≥ 4.5:1
- [ ] Mobile-first (responsive hasta 320px)
- [ ] Dark mode (si aplica): prueba con `prefers-color-scheme`
- [ ] Performance: Fraunces lazy-load, icons SVG inline

---

## 12. Referencias

- **Design tokens:** `pw-design-tokens.css`
- **Icon System:** `pw-icons.js` + `pw-icons.css`
- **Guardrails:** `scripts/check-guardrails.js`
- **Tipografía:** Google Fonts (Fraunces + Inter)
- **Color validation:** WCAG AA mínimo

---

**Preguntas?** Contacta al equipo de Brand Experience.
