# EPIC 2.1: Diseño de Navegación — MultiCoach Owner Experience

**Objetivo:** Especificar la experiencia de navegación del Owner ANTES de escribir código  
**Alcance:** UX/navegación pura, sin implementación técnica  
**Audiencia:** Frontend, Product Design, Micaela para aprobación

---

## 1. Sitemap Jerárquico Completo

```
MultiCoach (Root)
│
├── 🏠 Dashboard
│   └── Overview de la organización
│
├── 👥 Coaches
│   ├── Lista de coaches
│   └── Coach Detail
│       ├── Perfil
│       ├── Clientes asignados
│       ├── Actividad
│       └── Acción: Editar / Desactivar
│
├── 👤 Clientes
│   ├── Lista de clientes
│   └── Client Detail
│       ├── Perfil
│       ├── Coach asignado
│       ├── Progreso de programa
│       ├── Documentos (referencias a Pathway)
│       └── Acción: Reasignar / Desactivar
│
├── 📚 Programas
│   ├── Lista de programas activos
│   └── Program Detail
│       ├── Clientes en este programa
│       ├── Estado agregado (semana 1/2/3/4)
│       ├── Métricas de completitud
│       └── Acción: Ver reportes
│
├── 📈 Analytics
│   ├── Dashboard de métricas
│   ├── Filtros por período/coach/sector
│   └── Reportes descargables
│
├── 💬 Comunidad
│   ├── Avisos internos
│   ├── Revista de la empresa
│   └── Foro de coaches (read-only)
│
├── 💳 Facturación
│   ├── Plan actual
│   ├── Histórico de pagos
│   ├── Cambiar plan
│   └── Descargar recibos
│
├── 🎨 Marca
│   ├── Logo
│   ├── Colores
│   ├── Fuente
│   └── Preview en vivo
│
└── ⚙️ Configuración
    ├── Organización
    ├── Usuarios
    ├── Permisos
    ├── Notificaciones
    ├── Integraciones
    └── Seguridad
```

---

## 2. Menú Lateral Definitivo

**Ubicación:** Lado izquierdo, fijo  
**Activos:** Logo org + nombre en header  
**Items:** 8 secciones principales + info de usuario

```
┌─────────────────────────┐
│   [LOGO] ACME CORP      │  ← Header con logo y nombre de org
├─────────────────────────┤
│                         │
│  🏠 Dashboard           │  ← Enlace
│  👥 Coaches             │  ← Enlace
│  👤 Clientes            │  ← Enlace
│  📚 Programas           │  ← Enlace
│  📈 Analytics           │  ← Enlace
│  💬 Comunidad           │  ← Enlace
│  💳 Facturación         │  ← Enlace
│  🎨 Marca               │  ← Enlace
│  ⚙️  Configuración      │  ← Enlace
│                         │
├─────────────────────────┤
│  👤 owner@acme.com      │  ← Usuario actual
│  📴 Salir               │  ← Logout
└─────────────────────────┘
```

**Notas de diseño:**
- Menú colapsable en mobile (hamburger)
- Indicador visual de página activa (highlight)
- Un avatar o inicial del usuario en footer
- Botón de logout siempre visible
- Sin notificaciones o alerts en el menú (van en header)

---

## 3. Especificación de Pantallas

### 3.1 🏠 DASHBOARD

**Propósito:** Vista de una línea de la salud de la organización  
**Acceso:** Owner (siempre)  
**Permanencia:** 3-5 segundos de carga esperada

#### Contenido

**Header del Dashboard**
- Nombre de la organización
- Período actual (semana/mes selector)
- Botón "Exportar reporte"

**Cards de Resumen (KPIs)**
- **Clientes Totales:** N (activos/inactivos toggle)
- **Coaches:** N (activos/inactivos toggle)
- **Programas en Curso:** N clientes en semana 1, M en semana 2, etc.
- **Tasa de Completitud:** X% (CV, carta, LinkedIn, sesión)
- **Próximas Sesiones:** N sesiones en los próximos 7 días

**Gráficos Agregados**
- **Distribución por Semana:** Barras: semana 1 (N clientes), semana 2 (M), etc.
- **Progreso de Documentos:** Barras apiladas: CV ✓, Carta ✓, LinkedIn ○
- **Tasa de Retención:** Línea: semana a semana

**Tabla: Top Issues (si aplica)**
- Clientes sin asignar
- Coaches sin clientes
- Programas que llevan >4 semanas
- Suscripción por vencer

#### NO Contiene
❌ Edición de clientes  
❌ Chat o mensajes  
❌ Detalle de sesiones  
❌ Documentos individuales del cliente  
❌ Funcionalidad de coaching  

#### Navegación
- Click en card "Coaches" → va a Coaches
- Click en card "Clientes" → va a Clientes
- Click en "Ver detalles" de un gráfico → abre Analytics

---

### 3.2 👥 COACHES

**Propósito:** Administrar la lista de coaches de la organización  
**Acceso:** Owner  

#### Contenido

**Barra de Herramientas**
- Búsqueda por nombre/email
- Filtro: Activos / Inactivos / Todos
- Botón "+ Invitar Coach"
- Orden: por nombre, por activos/inactivos, por fecha de unión

**Lista de Coaches (Tabla o Tarjetas)**
- Foto (o inicial)
- Nombre
- Email
- Clientes asignados (N)
- Estado (Activo/Inactivo)
- Acciones: Ver detalles, Editar, Desactivar

**Columna Oculta (Expandible)**
- Fecha de unión a la org
- Última actividad
- Email personal (si es distinto del de la org)

#### NO Contiene
❌ Panel del coach (editar clientes individuales)  
❌ Calificación de desempeño  
❌ Acceso a documentos del cliente  
❌ Historial de chatbot  

#### Navegación
- Click en coach → Coach Detail
- Click "+ Invitar Coach" → Modal de invitación (email, rol)

---

### 3.3 👥 COACHES → Coach Detail

**Propósito:** Ver perfil completo de un coach y sus clientes  
**Acceso:** Owner  

#### Contenido

**Cabecera**
- Foto del coach
- Nombre, email, fecha de unión
- Estado (Activo/Inactivo) con toggle
- Botones: Editar, Más opciones (menú)

**Tabs / Secciones**

**Tab 1: Perfil**
- Nombre
- Email
- Rol (Coach, Coordinador, etc.) — si aplica
- Zona horaria (si la org usa múltiples)
- Especialidad (libre)
- Estado: Activo/Inactivo

**Tab 2: Clientes (Tabla)**
- Nombre cliente
- Email
- Programa (semana actual)
- Progreso (%)
- Fecha de inicio
- Botón: Abrir perfil cliente

**Tab 3: Actividad (Timeline)**
- "Coach iniciada sesión"
- "Cliente 'John Doe' subió CV"
- "Coach agregó nota: 'Perfil completado'"
- Filtro por tipo: Sesiones, Documentos, Notas

**Tab 4: Acciones**
- Enviar email al coach
- Reasignar cliente (si aplica)
- Desactivar coach
- Eliminar de la org (si nunca tuvo clientes)

#### NO Contiene
❌ Editar detalles de clientes del coach  
❌ Acceder a sesiones privadas  
❌ Ver documentos (solo que existen)  
❌ Calificar al coach  

#### Navegación
- Click en cliente en Tab 2 → Client Detail
- Atrás → vuelve a Coaches

---

### 3.4 👤 CLIENTES

**Propósito:** Administrar la lista de clientes de la organización  
**Acceso:** Owner  

#### Contenido

**Barra de Herramientas**
- Búsqueda por nombre/email
- Filtro: Por Coach, Por Estado (activo/inactivo/completado), Por Semana
- Botón "+ Importar Clientes" (CSV) o "+ Agregar Cliente"
- Orden: por nombre, por fecha inicio, por progreso

**Lista de Clientes (Tabla o Tarjetas)**
- Foto (o inicial)
- Nombre
- Email
- Coach asignado
- Programa (semana actual: 1/2/3/4/completado)
- Progreso (%)
- Acciones: Ver detalles, Reasignar, Desactivar

#### NO Contiene
❌ Editor de perfil (edición completa)  
❌ Chat con cliente  
❌ Documentos (links solamente)  
❌ Sesiones (solo estado: agendada sí/no)  

#### Navegación
- Click en cliente → Client Detail
- Click "+ Importar Clientes" → Modal/formulario de bulk upload

---

### 3.5 👤 CLIENTES → Client Detail

**Propósito:** Ver perfil completo de un cliente y su progreso  
**Acceso:** Owner  

#### Contenido

**Cabecera**
- Foto del cliente
- Nombre, email, fecha de inicio
- Coach asignado (con link a Coach Detail)
- Programa actual (semana 1/2/3/4)
- Barra de progreso visual (%)

**Tabs / Secciones**

**Tab 1: Perfil**
- Nombre
- Email
- Cargo (actual/aspirado)
- Sector
- País/Ubicación
- Fecha de inicio en programa
- Fecha estimada de fin
- Notas internas (Owner solo)

**Tab 2: Programa**
- Semana actual (visual 1 → 2 → 3 → 4)
- Checklist de cada semana:
  - ✓ Formulario completado
  - ✓ Análisis recibido
  - ○ CV (enlace a Pathway)
  - ○ Carta (enlace a Pathway)
  - ○ Sesión agendada
  - ○ LinkedIn (enlace a Pathway)
- Estado general: En curso / Completado / Pausado

**Tab 3: Documentos (Referencias)**
- CV (disponible sí/no, enlace a Pathway)
- Carta de presentación (disponible sí/no, enlace a Pathway)
- Análisis IA (disponible sí/no, enlace a Pathway)
- *No descargas aquí; todo en Pathway*

**Tab 4: Asignación**
- Coach actual (selector para cambiar)
- Historia de coaches anteriores (si hubo reasignaciones)
- Botón: Reasignar Coach (modal)

**Tab 5: Acciones**
- Enviar email al cliente
- Cambiar de programa (si aplica)
- Pausar programa (motivo)
- Desactivar/Completar
- Notas internas (add)

#### NO Contiene
❌ Editor inline de campos  
❌ Chat (ir a Pathway)  
❌ Descarga de documentos  
❌ Calificación del cliente  
❌ Sesiones privadas  

#### Navegación
- Click en Coach → Coach Detail
- Click "CV" (en Tab 2) → abre Pathway en nueva pestaña
- Atrás → vuelve a Clientes

---

### 3.6 📚 PROGRAMAS

**Propósito:** Ver estado agregado de programas en ejecución  
**Acceso:** Owner  

#### Contenido

**Barra de Herramientas**
- Filtro: Por período (semana actual, mes, custom)
- Orden: por estado, por clientes, por coach

**Cards de Programas (1 por semana activa)**

Para cada semana activa (semana 1, 2, 3, 4):
- Título: "Semana 2 (15 clientes)"
- Progreso visual: N clientes completos / M totales
- Distribución: "3 formularios pendientes, 2 CVs pendientes"
- Botón: "Ver detalles"

**Tabla: Clientes en Programa (Expandible)**
- Nombre cliente
- Coach asignado
- Semana actual
- Progreso (%)
- Última actualización
- Acciones: Ver perfil

#### NO Contiene
❌ Crear nuevos programas (eso es de Pathway)  
❌ Editar fechas de programa  
❌ Acceso a contenido del programa  
❌ Asignar clientes (se hace en Clientes)  

#### Navegación
- Click en cliente en tabla → Client Detail
- Click "Ver detalles" en card de semana → Analytics (filtrado)

---

### 3.7 📈 ANALYTICS

**Propósito:** Reportes y análisis profundos de la organización  
**Acceso:** Owner  

#### Contenido

**Controles Superiores**
- Selector de período (última semana, mes, trimestre, custom)
- Filtro: por coach, por sector, por estado
- Botones: Exportar PDF, Exportar CSV

**Sección 1: Resumen Ejecutivo**
- Clientes iniciados / completados / en pausa
- Tasa de completitud general (%)
- Progreso promedio (semana actual)

**Sección 2: Gráficos Detallados**
- **Línea:** Progreso semana a semana (% completitud)
- **Barra apilada:** Documentos por tipo (CV sí/no, Carta sí/no, etc.)
- **Pie:** Clientes por estado (activo/completado/pausado)
- **Calor:** Desempeño por coach (matriz: coach vs % de completitud)

**Sección 3: Tabla de Cohortes (por período)**
- Clientes iniciados en enero: N
  - Completados: M
  - Tasa de completitud: X%
  - Duración promedio: Y semanas

**Sección 4: Tabla de Coaches**
- Nombre coach
- Clientes asignados
- Clientes completados
- Tasa de completitud
- Sesiones agendadas (total)
- Última actividad

#### NO Contiene
❌ Datos de Pathway (sesiones privadas, CV exacto)  
❌ Análisis individual de cliente (va a Client Detail)  
❌ Predicciones ML (futuro)  

#### Navegación
- Click en coach en tabla → Coach Detail
- Click en período en cohortes → Filtro Analytics actualizado

---

### 3.8 💬 COMUNIDAD

**Propósito:** Comunicación interna entre owner y coaches, comunidad de la empresa  
**Acceso:** Owner (escribe todo), Coaches (read-only)  

#### Contenido

**Tab 1: Avisos**
- Editor simple (texto, formato básico)
- Botón: "+ Nuevo Aviso"
- Lista: Avisos recientes (fecha, autor, vista previa)
- Acción: Editar, Borrar, Archivar

**Tab 2: Revista**
- Editor similar a Avisos
- Estructura: Título, portada (imagen), contenido
- Publicar fecha (programar futura si aplica)
- Estadísticas: vistas, compartido

**Tab 3: Foro (Read-only para Owner)**
- Temas que los coaches ven
- Opción para Owner: crear tema, sticky, moderar

#### NO Contiene
❌ Chat privado (va a Pathway)  
❌ Documentos de coaching  
❌ Recursos personales de clientes  

#### Navegación
- Click en tema → expande replies
- Volver → cierra

---

### 3.9 💳 FACTURACIÓN

**Propósito:** Gestionar suscripción, plan y pagos de la organización  
**Acceso:** Owner  

#### Contenido

**Sección 1: Plan Actual**
- Nombre plan (Basic, Pro, Custom)
- Precio mensual
- Número de coaches incluidos
- Próxima fecha de renovación
- Estado: Activo, Por vencer, Vencido, Cancelado

**Sección 2: Historial de Pagos (Tabla)**
- Fecha
- Descripción (ej. "Plan Pro - Mes de Enero")
- Monto
- Método de pago (Stripe, etc.)
- Estado: Pagado, Pendiente, Fallido
- Acción: Descargar recibo

**Sección 3: Cambiar Plan**
- Cards de planes disponibles (Basic, Pro, Custom)
- Comparativa: coaches, features, precio
- Botón: Cambiar (confirmar y redirigir a checkout)

**Sección 4: Método de Pago**
- Tarjeta registrada (últimos 4 dígitos)
- Fecha de expiración
- Botón: Actualizar tarjeta
- Botón: Agregar método alternativo

#### NO Contiene
❌ Facturas detalladas (generadas por Stripe)  
❌ Historial de descuentos (gestión manual)  
❌ Auditoría de cambios de plan (va a Configuración > Seguridad)  

#### Navegación
- Click "Cambiar plan" → Checkout (Stripe)
- Click "Descargar recibo" → PDF abre en nueva pestaña

---

### 3.10 🎨 MARCA

**Propósito:** Personalizar la experiencia visual de la organización  
**Acceso:** Owner  

#### Contenido

**Sección 1: Logo**
- Upload de logo (PNG, SVG, JPG; máx 2MB)
- Preview en vivo (cómo se ve en header de multicoach.html)
- Botón: Cambiar, Resetear a default

**Sección 2: Colores**
- Color primario (selector + código hex)
- Color secundario (opcional)
- Preview en vivo: botones, links, acciones
- Sugerencias de paleta (presets)

**Sección 3: Fuente**
- Selector: Sistema (default) o custom (si se integra)
- Preview en vivo con distintos tamaños

**Sección 4: Preview en Vivo**
- Mock de dashboard con brand personalizado
- Regenera en tiempo real al cambiar valores

**Sección 5: Dominio Custom (si aplica)**
- Input: ejemplo.com
- Instrucciones para DNS
- Estado: No configurado, Pendiente, Activo, Error

#### NO Contiene
❌ Edición de contenido de Pathway  
❌ Cambio de templates de sesiones  
❌ Branding de emails (va a Configuración)  

#### Navegación
- Cambios guardan automáticamente
- Atrás sin confirmar (cambios ya guardados)

---

### 3.11 ⚙️ CONFIGURACIÓN

**Propósito:** Administración técnica y operativa de la organización  
**Acceso:** Owner  

#### Contenido

**Tab 1: Organización**
- Nombre de org
- Sector (selector)
- País
- Teléfono
- Email de contacto
- Zona horaria (selector)
- Idioma por defecto (ES, EN, etc.)
- Botón: Guardar

**Tab 2: Usuarios**
- Tabla: Owners y Colaboradores (si aplica)
- Nombre, Email, Rol, Fecha de unión
- Acciones: Cambiar rol, Revocar acceso
- Botón: "+ Invitar Usuario"

**Tab 3: Permisos (Roles)**
- Matriz: Rol vs Acciones
- Rol "Owner": todas las acciones
- Rol "Coordinador" (si aplica): coaches, clientes (read-only)
- Rol "Analista" (si aplica): analytics (read-only)
- *No editar permisos predefinidos en MVP*

**Tab 4: Notificaciones**
- Toggle: Email cuando nuevo coach se une
- Toggle: Email cuando cliente completado
- Toggle: Email resumen semanal
- Toggle: Push notifications (si aplica)
- Selector: Frecuencia de resumen (diario, semanal, mensual)

**Tab 5: Integraciones**
- Calendly: Conectar, Desconectar, Status
- Zoom: Conectar, Status
- Google Workspace: Conectar, Status
- Stripe: Ver (conectado en facturación)
- *Futuros: Slack, Microsoft Teams, etc.*

**Tab 6: Seguridad**
- 2FA: Activar/Desactivar
- Sesiones activas: Lista de dispositivos + hora last seen
- Botón: Cerrar todas las sesiones excepto esta
- API Keys (futuro): Listar, crear, revocar
- Botón: Cambiar contraseña

#### NO Contiene
❌ Configuración de coaching (va a Pathway)  
❌ Configuración de clientes individuales  
❌ Auditoría de acciones (futuro en Seguridad)  

#### Navegación
- Cambios guardan automáticamente en la mayoría de tabs
- Confirmación explícita para cambios críticos (2FA, revocar acceso)

---

## 4. Límites Explícitos por Pantalla

### Qué Pertenece a Pathway (NO va en MultiCoach)

❌ **Dashboard del Cliente**  
❌ **Editor de CV**  
❌ **Editor de Carta**  
❌ **Análisis LinkedIn**  
❌ **Sesiones y Calendly**  
❌ **Recursos y Materiales**  
❌ **Chat privado Coach-Cliente**  
❌ **Medallas y Logros del Cliente**  
❌ **Formulario de Intake**  

### Qué Pertenece a MultiCoach (SÍ va aquí)

✅ **Vista de Organización**  
✅ **Administración de Coaches**  
✅ **Administración de Clientes**  
✅ **Asignaciones**  
✅ **Reportes Agregados**  
✅ **Facturación de la Org**  
✅ **Marca de la Org**  
✅ **Permisos y Seguridad**  
✅ **Comunicación Interna (Avisos)**  
✅ **Estado de Progreso (read-only)**  

---

## 5. Relaciones y Flujos de Navegación

### Flujo 1: Owner Quiere Ver Salud de su Org
```
Dashboard (KPIs)
    ↓
Click en "Coaches" → Coaches (lista)
    ↓
Click en coach → Coach Detail
    ↓
Click en cliente → Client Detail
    ↓
Click "Ver en Pathway" → abre en nueva pestaña
```

### Flujo 2: Owner Quiere Importar Clientes
```
Clientes
    ↓
Click "+ Importar"
    ↓
Modal: Cargar CSV
    ↓
Vista previa de datos
    ↓
Botón: Confirmar importación
    ↓
Mensaje de éxito, tabla actualizada
```

### Flujo 3: Owner Quiere Reasignar Cliente
```
Clientes
    ↓
Click en cliente → Client Detail
    ↓
Tab "Asignación"
    ↓
Click "Reasignar Coach"
    ↓
Modal: Selector de coach
    ↓
Botón: Guardar
    ↓
Mensaje de éxito, coach actualizado
```

### Flujo 4: Owner Quiere Ver Analytics
```
Analytics
    ↓
Selector: Período (custom 01/01 - 31/01)
    ↓
Filtro: Por coach "Maria"
    ↓
Gráficos se actualizan
    ↓
Click "Exportar" → PDF genera y descarga
```

### Flujo 5: Owner Quiere Cambiar Plan
```
Facturación
    ↓
Sección "Cambiar Plan"
    ↓
Click "Pro" → highlight plan seleccionado
    ↓
Click "Cambiar" → Modal de confirmación
    ↓
Redirigir a Stripe (nueva pestaña)
    ↓
Completar pago
    ↓
Vuelve a Facturación, plan actualizado
```

### Flujo 6: Owner Quiere Personalizar Marca
```
Marca
    ↓
Click "Upload Logo"
    ↓
Carga archivo
    ↓
Preview en vivo actualiza
    ↓
Cambios guardan automáticamente
    ↓
Cierra tab, logo persiste
```

---

## 6. Responsividad y Adaptaciones

### Mobile (< 768px)

**Cambios:**
- Menú sidebar → Hamburger menu en header
- Tablas → Tarjetas (stack vertical)
- Gráficos → Versiones simplificadas o tablas
- Modals → Full-screen en mobile
- Acciones → Botón de contexto (⋯)

**Pantallas prioritarias (MVP mobile):**
1. Dashboard (resumen)
2. Clientes (búsqueda + lista)
3. Coaches (búsqueda + lista)
4. Analytics (tabla principal)

---

## 7. Estados y Transiciones

### Estados de Carga
- Esqueleto / shimmer mientras carga
- Mensaje "Cargando..." si tarda > 2s
- Retry automático si falla (hasta 3 intentos)

### Estados de Error
- Mensaje amigable: "No pudimos cargar los coaches. Por favor recarga."
- Botón: "Reintentar"
- Si persiste: Contactar soporte

### Estados Vacíos
- **Coaches:** "No hay coaches aún. ¿Quieres invitar uno?" + Botón "+ Invitar"
- **Clientes:** "No hay clientes. ¿Importar desde CSV?" + Botón
- **Analytics:** "Sin datos en el período seleccionado."

### Estados de Guardado
- Optimistic update (UI cambia inmediatamente)
- Spinner de confirmación
- Toast: "Cambio guardado" (2s, auto-cierra)
- Si falla: Toast de error + UI revierten

---

## 8. Componentes Reutilizables (Referencias)

*Nota: No implementar aún; solo listar para Frontend*

- **Card de resumen (KPI)**
- **Tabla con búsqueda y filtros**
- **Modal (confirmación, agregar, editar)**
- **Breadcrumb (navegación)**
- **Tab panel**
- **Avatar + nombre**
- **Badge de estado (activo/inactivo)**
- **Selector de período (date range)**
- **Gráfico: barra, línea, pie, heatmap**
- **Toast (notificación)**
- **Skeleton loader**

---

## 9. Checklist de Aprobación de Navegación

**Este documento está APROBADO cuando:**

✅ **Sitemap**
- [ ] 8 pantallas principales + 2 detalles identificadas
- [ ] Jerarquía clara (qué es padre, qué es hijo)
- [ ] Todas las relaciones mapeadas

✅ **Menú Lateral**
- [ ] 8 items principales + info de usuario
- [ ] Iconos asignados (o placeholders)
- [ ] Layout responsive considerado

✅ **Especificación de Pantallas**
- [ ] Cada pantalla tiene: Propósito, Contenido, NO Contiene, Navegación
- [ ] Límites explícitos con Pathway
- [ ] Estados (carga, error, vacío) considerados

✅ **Flujos**
- [ ] 6 flujos principales documentados
- [ ] Rutas intuitivas (owner no se pierde)

✅ **Límites Funcionales**
- [ ] Está claro qué viene de Pathway (referencias solamente)
- [ ] Está claro qué es administración pura

**Aprobado por:** Micaela Jairedin  
**Fecha:** 2026-07-30  
**Estado:** ✅ OFICIAL - Referencia de navegación vinculante  
**Política:** Ninguna pantalla nueva ni cambio funcional sin revisión previa de este documento  
**Próximo:** Diseño visual (wireframes/mockups) respetando esta especificación
