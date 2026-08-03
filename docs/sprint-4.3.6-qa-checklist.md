# Sprint 4.3.6 — QA + Congelación del Módulo Equipo

**Estado**: En Progress  
**Objetivo**: Validar exhaustivamente antes de LOCK v1.0  
**Deadline**: Antes de Sprint 5

---

## 1. QA Funcional

### 1.1 Tabla — Búsqueda
- [ ] Buscar por nombre (1+ resultado)
- [ ] Buscar por email (1+ resultado)
- [ ] Buscar inexistente (empty state)
- [ ] Buscar case-insensitive
- [ ] Buscar substring (ej: "carlos" → "Carlos Pérez")
- [ ] Limpiar búsqueda

### 1.2 Tabla — Filtros simples
- [ ] Filtro estado: Todos
- [ ] Filtro estado: Activos
- [ ] Filtro estado: Invitados
- [ ] Filtro estado: Vacaciones
- [ ] Filtro estado: Suspendidos
- [ ] Filtro estado: Desactivados
- [ ] Filtro rol: Todos
- [ ] Filtro rol: Coach
- [ ] Filtro rol: Colaborador
- [ ] Filtro especialidad: Todos
- [ ] Filtro especialidad: Carrera
- [ ] Filtro especialidad: Fitness
- [ ] Filtro especialidad: Finanzas

### 1.3 Tabla — Combinaciones complejas
- [ ] Búsqueda + filtro estado (AND logic)
- [ ] Búsqueda + filtro rol (AND logic)
- [ ] Búsqueda + filtro especialidad (AND logic)
- [ ] Filtro estado + rol (AND logic)
- [ ] Filtro estado + especialidad (AND logic)
- [ ] Filtro rol + especialidad (AND logic)
- [ ] Búsqueda + filtro estado + rol + especialidad (4x AND)

### 1.4 Tabla — Ordenación
- [ ] Ordenar por: Nombre (A-Z)
- [ ] Ordenar por: Clientes (más primero)
- [ ] Ordenar por: Retención (mejor)
- [ ] Ordenar por: Sesiones (más)
- [ ] Ordenar sin cambiar filtros
- [ ] Ordenar sin cambiar búsqueda

### 1.5 Tabla — Edge cases
- [ ] 1 resultado total
- [ ] 0 resultados (empty state correcto)
- [ ] 100+ personas (sin congelación)
- [ ] 250+ personas (sin congelación)
- [ ] 500 personas (sin congelación)

### 1.6 Drawer — Abrir
- [ ] Abrir drawer (coach activo)
- [ ] Abrir drawer (colaborador activo)
- [ ] Abrir drawer (persona invitada)
- [ ] Abrir drawer (persona inactiva)
- [ ] Drawer se anima desde derecha
- [ ] Backdrop se oscurece

### 1.7 Drawer — Cerrar
- [ ] Cerrar con ✕ botón
- [ ] Cerrar con ESC key
- [ ] Cerrar con click en backdrop
- [ ] NO queda información anterior
- [ ] Animación suave

### 1.8 Drawer — Cambiar de persona
- [ ] Abrir persona A
- [ ] Cambiar a persona B sin cerrar
- [ ] Verificar nombre B, email B, métricas B
- [ ] NO ve datos de persona A
- [ ] NO hay duplicado de información

### 1.9 Drawer — Contenido (Coach)
- [ ] Foto (dicebear o real)
- [ ] Nombre: correctamente escapado
- [ ] Rol: "Coach" con badge
- [ ] Email: correctamente escapado
- [ ] Estado: badge correcto (Activo, Invitado, etc.)
- [ ] Especialidad: correctamente escapada
- [ ] Teléfono: correctamente escapado
- [ ] Timezone: correctamente escapado
- [ ] Idioma: correctamente escapado
- [ ] Incorporado: correctamente escapado
- [ ] Última actividad: correctamente escapada
- [ ] Clientes: valor numérico correcto
- [ ] Sesiones: valor numérico correcto
- [ ] Retención: % correcto
- [ ] Programas: valor numérico correcto
- [ ] Horas: valor + "h" correcto
- [ ] Próximas sesiones: 3+ sesiones mostradas
- [ ] Botón "Ver agenda completa" funciona
- [ ] Permisos: lectura solo (sin edición)

### 1.10 Drawer — Contenido (Colaborador)
- [ ] Sin sección de Métricas
- [ ] Sin columnas vacías
- [ ] Resto de contenido igual a Coach
- [ ] NO se rompe layout

### 1.11 Drawer — CRUD: Editar
- [ ] Botón "Editar" visible
- [ ] Click abre prompt
- [ ] Cancelar cancela (no guarda)
- [ ] Guardar nombre vacío cancela
- [ ] Guardar mismo nombre cancela
- [ ] Editar a nombre nuevo: toast "Guardando..."
- [ ] Toast "✓ Cambios guardados"
- [ ] Drawer se redibuja con nombre nuevo
- [ ] BD actualizada

### 1.12 Drawer — CRUD: Ver Agenda
- [ ] Botón "Ver agenda" visible
- [ ] Click abre modal/alert
- [ ] Muestra próximas 5 sesiones
- [ ] Muestra fecha, hora, cliente, tipo
- [ ] Placeholder correcto (Sprint 4.3.6)

### 1.13 Drawer — CRUD: Enviar Mensaje
- [ ] Botón "Enviar mensaje" visible
- [ ] Click abre prompt
- [ ] Cancelar cancela
- [ ] Enviar vacío cancela
- [ ] Enviar mensaje: toast "✓ Mensaje enviado"

### 1.14 Drawer — CRUD: Reasignar Clientes
- [ ] Botón solo visible para Coaches
- [ ] Colaborador NO ve botón
- [ ] Click abre confirmación
- [ ] Cancelar cancela
- [ ] Confirmar: toast "Abriendo modal..."
- [ ] Placeholder correcto (Sprint 4.3.6)

### 1.15 Drawer — CRUD: Desactivar/Reactivar
- [ ] Coach activo: botón "Desactivar"
- [ ] Coach inactivo: botón "Reactivar"
- [ ] Colaborador activo: botón "Desactivar"
- [ ] Click abre confirmación
- [ ] Cancelar cancela
- [ ] Confirmar desactivación: toast "Guardando..."
- [ ] Toast "✓ [Nombre] desactivado"
- [ ] Drawer se redibuja
- [ ] BD actualizada (estado = inactivo)
- [ ] Reactivar lo vuelve a activo
- [ ] BD actualizada

### 1.16 Toasts y Feedback
- [ ] Toast aparece en esquina
- [ ] Toast desaparece auto después 3s
- [ ] Toast con errores visible
- [ ] "Guardando..." mientras se guarda
- [ ] "✓ Cambios guardados" en éxito
- [ ] "✗ Error al guardar" en fallo
- [ ] Sin conexión maneja gracefully

---

## 2. Responsive

### 2.1 Desktop (1920px)
- [ ] Tabla visible completa
- [ ] 10 columnas sin cortar
- [ ] Drawer 440px (derecha)
- [ ] KPIs en 4 columnas
- [ ] Filtros en 1 fila
- [ ] Sin scroll horizontal

### 2.2 Laptop (1366px)
- [ ] Tabla visible completa
- [ ] Drawer 440px (derecha)
- [ ] Sin scroll horizontal
- [ ] Columnas legibles

### 2.3 iPad (768px)
- [ ] Drawer 360px (media query)
- [ ] Tabla con scroll horizontal permitido
- [ ] KPIs en 2x2
- [ ] Filtros se adaptan
- [ ] Sin overlap

### 2.4 Tablet (600px)
- [ ] Drawer 100% width, 60vh
- [ ] Tabla responsiva (menos columnas)
- [ ] KPIs en 2 columnas
- [ ] Filtros stackeados
- [ ] Sin scroll horizontal body

### 2.5 Móvil (375px)
- [ ] Drawer full screen (bottom sheet)
- [ ] Tabla minimal (nombre + estado)
- [ ] KPIs en 2 columnas o 1
- [ ] Filtros dropdowns
- [ ] Sin scroll horizontal

### 2.6 Orientación (landscape)
- [ ] iPad landscape: drawer 360px
- [ ] Móvil landscape: drawer 60vh desde abajo
- [ ] Tabla adaptada

---

## 3. Visual QA

### 3.1 Comparar con Dashboard
- [ ] Mismos border-radius (12px, 8px, 6px)
- [ ] Mismos shadows (.db-shadow-xs, .db-shadow-sm)
- [ ] Mismo padding (16px, 20px, 24px)
- [ ] Misma tipografía (17px h1, 13px body, 11px labels)
- [ ] Mismo spacing (gap 14px, 16px, 27px)
- [ ] Mismo ancho máximo (1360px)
- [ ] Colores consistency: --pw-bosque, --db-text-primary, etc.

### 3.2 Tabla
- [ ] Headers: 11px, uppercase, letter-spacing 0.3px
- [ ] Rows: 13px, line-height 1.4
- [ ] Hover effect sutil
- [ ] Borders consistent
- [ ] Avatar circles (40px)
- [ ] Badges styled correcto

### 3.3 Drawer
- [ ] Header centered (avatar 120px)
- [ ] Sections con spacing correcto
- [ ] Badges como en tabla
- [ ] Buttons full width, 10px 14px padding
- [ ] Primary button: --pw-bosque
- [ ] Danger button: #C0756E

### 3.4 KPIs
- [ ] Cards 20px padding
- [ ] Values 28px, bold
- [ ] Labels 11px, uppercase
- [ ] Hover lift effect

### 3.5 Filtros
- [ ] Search input: 13px, placeholder muted
- [ ] Dropdowns: 13px, hover bg-light
- [ ] Flex layout con gap 12px
- [ ] Responsive stacking en mobile

---

## 4. Performance

### 4.1 50 personas
- [ ] Load time < 500ms
- [ ] Filtro instantáneo
- [ ] Ordenación instantánea
- [ ] Drawer abre < 100ms
- [ ] No congelación UI
- [ ] Memory < 50MB

### 4.2 100 personas
- [ ] Load time < 800ms
- [ ] Operaciones suave (< 200ms)
- [ ] Drawer ágil
- [ ] No lag en búsqueda
- [ ] Memory < 100MB

### 4.3 250 personas
- [ ] Load time < 1.5s
- [ ] Filtros notables pero responsivos
- [ ] Drawer < 300ms
- [ ] Memory < 200MB

### 4.4 500 personas
- [ ] Load time < 3s
- [ ] Operaciones tolerables (< 500ms)
- [ ] Drawer < 500ms
- [ ] Memory < 400MB
- [ ] Console sin warnings

### 4.5 Renders
- [ ] renderEquipo() NO se llama innecesariamente
- [ ] _equipoList() calcula UNA sola vez por render
- [ ] Filtros no recalculan toda la tabla
- [ ] Ordenación no recalcula búsqueda

---

## 5. Accesibilidad

### 5.1 Keyboard Navigation
- [ ] Tab: navega tabla
- [ ] Enter: abre drawer
- [ ] Escape: cierra drawer
- [ ] Tab: dentro de drawer alcanza botones
- [ ] Focus: visible en todos elementos

### 5.2 Focus States
- [ ] Botones: outline 2px sólido
- [ ] Inputs: outline visible
- [ ] Focus order lógico (top → bottom)
- [ ] NO focus trap

### 5.3 Contrast
- [ ] Body text: > 4.5:1 (AA)
- [ ] Labels: > 3:1 (AAA)
- [ ] Badges: legible fondo + text
- [ ] Links (si aplica): > 4.5:1

### 5.4 Alt Text
- [ ] Avatars: alt="[nombre completo]"
- [ ] Icons: aria-label correcto
- [ ] Imágenes: sin alt="img" genérico

### 5.5 Semantic HTML
- [ ] Headers: <h1>, <h2>, <h3>
- [ ] Buttons: <button>, no <div onclick>
- [ ] Forms: <input>, <select>, <label>
- [ ] ARIA: role, aria-label donde aplica

---

## 6. Arquitectura

### 6.1 Sin Duplicados
- [ ] CSS: no .equipo-* duplicado en otros archivos
- [ ] Funciones: no _equipo*() definida 2+ veces
- [ ] HTML: estructura única en renderEquipo()
- [ ] Listeners: addEventListener UNA vez

### 6.2 Variables Globales
- [ ] _equipoState: única
- [ ] _equipoSelected: única
- [ ] _equipoDrawerFeedback: única (si existe)
- [ ] NO nuevas globales (MC_*, DB.*, etc.)

### 6.3 Consultas Supabase
- [ ] _equipoList() sin queries innecesarias
- [ ] CRUD: usa _sbw() correctamente
- [ ] No SELECT * (usa ?select=id,nombre,...)
- [ ] Manejo de errores (404, 403, timeout)

### 6.4 Estado Inmutable
- [ ] _equipoSelected es referencia a fullList
- [ ] Cambios a _equipoSelected actualizan visual
- [ ] render() no corrompe estado
- [ ] Cierre drawer no pierde _equipoSelected

---

## 7. Merge & Lock

### 7.1 Pre-Merge
- [ ] Todas las validaciones PASS
- [ ] Sin console.errors
- [ ] Sin console.warnings
- [ ] Commit message siguiendo formato
- [ ] Branch actualizado con main

### 7.2 Merge
```bash
git checkout main
git merge feature/equipo
git tag v1.0-equipo-module
git push origin main --tags
```

### 7.3 Post-Merge
- [ ] Tag v1.0-equipo-module creado
- [ ] CLAUDE.md: sección LOCKED añadida
- [ ] README.md: módulo documentado
- [ ] Notificación: "Equipo Module CONGELADO"

---

## Sign-Off

**QA Engineer**: ________________  
**Date**: ________________

**Product Owner**: ________________  
**Date**: ________________

---

## Notas

- [ ] Ninguna tarea pendiente sin anotar aquí
- [ ] Todos los tests pasan en CI
- [ ] Documentación completa
- [ ] Arquitectura validada por técnico principal
