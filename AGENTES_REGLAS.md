# Reglas para Todos los Agentes — Pathway Career Coach

**Última actualización:** 3 de agosto de 2026  
**Autoridad:** Micaela Jairedin

---

## 🚫 Regla 1: No crear páginas nuevas

Salvo aprobación expresa del Product Owner.

### ❌ Prohibido:
- Crear `empresa-identidad.html`
- Crear `configuracion-organizacion.html`
- Crear nuevas pantallas "porque encajaría mejor"

### ✅ Permitido:
- Reutilizar pantallas existentes
- Ejemplo: `multicoach.html → Mi Empresa → Branding` (no crear `branding.html`)

---

## 🚫 Regla 2: No cambiar navegación cerrada

El sidebar y menú son **contrato inmutable**. Si algo no existe:

### ❌ Prohibido:
- Inventar rutas nuevas
- Agregar items al sidebar sin aprobación

### ✅ Permitido:
- Mostrar "Próximamente" si la feature aún no existe
- Pedir aprobación ANTES de cambiar estructura de menú

---

## 🚫 Regla 3: Un sprint = un cambio visible

No refactors grandes.

### ❌ Prohibido:
- 5 engines en paralelo
- 8 archivos modificados de una vez
- 20 abstracciones nuevas por sprint

### ✅ Permitido:
- Pensar en términos de usuario: "Cuando entro aquí pasa esto"
- Ejemplo Sprint B.6.2: "Owner cambia color en Mi Empresa y lo ve aplicado"

---

## 🚫 Regla 4: Archivos sensibles = aprobación obligatoria

Estos archivos son el **corazón del sistema**. NO tocar sin permiso explícito:

- ❤️ `multicoach.html` (centro de empresa)
- ❤️ `panel-v2.html` (panel del coach)
- ❤️ `cliente.html` (portal del cliente)
- ❤️ sidebar / navegación
- ❤️ login / autenticación
- ❤️ arquitectura Supabase (migrations, RLS, edge functions)

**Antes de editar:** Pedir aprobación en el mensaje del sprint.

---

## 📋 Sprint B.6.2 — Versión Reducida (ACTUAL)

### ⚠️ NO hacer:
- Cambiar 27 colores en `panel-v2.html`
- Refactor de estilos globales
- Modificar `cliente.html`
- Landing pages dinámicas aún

**Riesgo:** Romper estilos aprobados, mezclar branding con componentes.

### ✅ Hacer:

**Objetivo:** Validar que el Owner ve valor en cambiar identidad.

**Alcance:** Solo `multicoach.html → Mi Empresa → Branding`

**Funcionalidad requerida:**
- ✅ Cambiar logo (upload + preview)
- ✅ Cambiar color primario/secundario (color picker + preview)
- ✅ Cambiar tipografía (dropdown 3 fonts + preview)
- ✅ Guardar en Supabase
- ✅ Recargar página y mantener cambios
- ✅ Preview instantáneo mientras edita

**Escopo cerrado:**
- ❌ NO tocar panel-v2
- ❌ NO tocar cliente.html
- ❌ NO tocar landing
- ❌ NO tocar sidebar
- ❌ NO tocar menú

### Orden posterior (después de validación):

1. **B.6.3** — Realtime sync (2 tabs, cambio automático sin reload)
2. **B.6.4** — Landing pública con branding dinámico
3. **B.6.5** — Eliminar hardcoded colors (`#8C7B80` → `var(--org-*)`)

---

## 🎯 Filosofía

```
Funcional y visible > Arquitectura perfecta

No es mejor:
- 20 abstracciones sin cambio visual
- Refactor global que "prepara" para el futuro
- Cambios en archivos sensibles "por si acaso"

Es mejor:
- 1 cambio que el usuario ve y aprueba
- Pequeños pasos donde cada uno suma valor
- Archivos sensibles tocados solo si es inevitable
```

---

## ✍️ Checklist antes de cada commit

- [ ] ¿Creé una página nueva? → Pedir aprobación
- [ ] ¿Modifiqué sidebar/menú? → Pedir aprobación
- [ ] ¿Toqué multicoach/panel-v2/cliente? → Documenté por qué
- [ ] ¿El cambio es visible para el usuario? → Describir
- [ ] ¿Probé que no rompe nada? → Smoke test
- [ ] ¿Es el mínimo necesario? → Eliminé lo extra

---

**Vigencia:** Indefinida hasta que el PO diga "estas reglas cambian".

