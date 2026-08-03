# Sprint B.6.2 Reducido — Validación Visual

**Objetivo:** Owner puede cambiar su identidad de empresa y verla aplicada en MultiCoach.

**Alcance:** Solo `multicoach.html → Mi Empresa → Branding`

**Responsable:** Validación manual (no hay tests automatizados)

---

## Pre-requisitos

- [ ] Main branch tiene PR #1247 mergeado
- [ ] Acceso a https://pathwaycareercoach.com/multicoach.html
- [ ] DevTools (F12) abierto para ver logs
- [ ] 1 organización con permisos de Owner
- [ ] Supabase accesible para verificar datos

---

## Test Case 1: Cambiar Color Primario

### Setup
1. Login como Owner en multicoach.html
2. Navega: Sidebar → ADMINISTRACIÓN → Empresa → Mi Empresa dropdown → Branding

### Acciones
1. En tarjeta "Identidad Visual" → sección "Paleta de colores"
2. Click en cuadrado "Primario" (color actual)
3. Debe abrirse modal (NO prompt)

### Validaciones
- [ ] Modal abre sin errores
- [ ] Input color picker visible
- [ ] Hex text input visible
- [ ] Botones "Cancelar" y "Guardar" presentes
- [ ] Color picker funciona (cambiar color)
- [ ] Preview del gradiente actualiza en tiempo real
- [ ] Click "Guardar" → Toast verde "✓ Color actualizado"
- [ ] Supabase: `SELECT * FROM organization_branding WHERE organization_id = '[tu org]'` muestra `primary_color` actualizado
- [ ] F5 reload → Color persiste

**Esperado:** Verde ✅  
**Bloqueador:** Rojo ❌

---

## Test Case 2: Cambiar Color Secundario

### Setup
Usar mismo estado que TC1

### Acciones
1. Click en cuadrado "Secundario"
2. Elige AZUL (#0000FF)

### Validaciones
- [ ] Modal abre
- [ ] Color actualiza en preview
- [ ] Toast: "✓ Color actualizado"
- [ ] Supabase: `secondary_color` actualizado
- [ ] F5 → Persiste

---

## Test Case 3: Cambiar Tipografía

### Setup
Usar mismo estado

### Acciones
1. Sección "Tipografía" → click en caja
2. Debe mostrar modal con 3 opciones:
   - Poppins ✓
   - Inter
   - Manrope

### Validaciones
- [ ] Modal abre con 3 opciones
- [ ] Cada opción muestra preview "La identidad de tu marca"
- [ ] Seleccionar "Inter"
- [ ] Font cambia inmediatamente en toda la UI
- [ ] Toast: "✓ Tipografía actualizada"
- [ ] Supabase: `brand_font = 'inter'`
- [ ] F5 → Persiste

---

## Test Case 4: Subir Logo

### Setup
Usar mismo estado

### Acciones
1. Sección "Activos visuales" → click en "Logo" (🖼️)
2. Selecciona una imagen (PNG, SVG o JPEG, <5MB)

### Validaciones
- [ ] File picker abre (diálogo del SO)
- [ ] Acepta PNG/SVG/JPEG
- [ ] Rechaza archivos >5MB con error
- [ ] Toast: "✓ Logo actualizado"
- [ ] Preview muestra logo
- [ ] Supabase: logo guardado (URL o data)
- [ ] F5 → Logo persiste

---

## Test Case 5: Validación de Entrada

### Setup
Usar mismo estado

### Acciones
1. Intenta guardar color inválido (ej: "ROJO" en lugar de hex)
2. Intenta subir archivo >5MB
3. Intenta subir formato no permitido (.exe, .pdf)

### Validaciones
- [ ] Color inválido: Toast de error
- [ ] Archivo grande: Error "Máximo 5MB"
- [ ] Formato inválido: Error "Solo PNG, SVG, JPEG"
- [ ] No se guarda nada en Supabase
- [ ] UI sigue funcional (no rompe)

---

## Test Case 6: Realtime Preview (Dentro de la misma sesión)

### Setup
Mi Empresa → Branding abierto

### Acciones
1. Cambiar color primario a #FF0000
2. Click "Guardar"
3. Observar UI de MultiCoach

### Validaciones
- [ ] Color rojo aplica INMEDIATAMENTE en:
  - [ ] Header de MultiCoach (si aplica)
  - [ ] Botones primarios
  - [ ] Acentos de marca
  - [ ] Cualquier elemento que use `var(--org-primary)`
- [ ] Tipografía cambia instantáneamente en:
  - [ ] Todo el texto (si se aplica `brand_font`)
  - [ ] Labels
  - [ ] Títulos

**Nota:** Este test valida que el Theme Engine funciona. Si no ve cambios visuales fuera de la tarjeta, puede ser que CSS variables no estén aplicadas aún en multicoach.html → OK para B.6.2 reducido.

---

## Test Case 7: Aislamiento por Org (2 pestañas)

### Setup
- Tab A: Org 1 (Owner) con cambios guardados (Rojo + Azul + Inter)
- Tab B: Org 2 (Owner diferente) nueva pestaña

### Acciones (Tab B)
1. Login como Owner de Org 2
2. Navega: Mi Empresa → Branding
3. Observa colores y tipografía

### Validaciones
- [ ] Org 2 muestra colores por DEFECTO (#2D5016 + #8C7B80), NO los de Org 1
- [ ] Tipografía es Poppins, NO Inter
- [ ] Org 2 está completamente aislada de Org 1
- [ ] Cambiar color en Org 2 → No afecta Tab A

---

## Checklist de Éxito

Marcar cuando TODO esté ✅:

- [ ] TC1: Color primario funciona
- [ ] TC2: Color secundario funciona
- [ ] TC3: Tipografía funciona
- [ ] TC4: Logo upload funciona
- [ ] TC5: Validación de entrada funciona
- [ ] TC6: Preview realtime funciona (o está documentado que viene en B.6.3)
- [ ] TC7: Aislamiento por org funciona
- [ ] Console (F12) sin errores rojo
- [ ] Supabase datos correctos
- [ ] Reload persiste cambios

---

## Notas

### Limitaciones esperadas (OK):
- Logo preview es básico (B.6.2 reducido)
- CSS variables No aplicadas globalmente a panel-v2/cliente todavía (viene en B.6.5)
- Realtime en 2 tabs sin reload viene en B.6.3

### Bugs a reportar:
- Cualquier modal que no abre
- Toast que no aparece
- Datos que no se guardan en Supabase
- Reload pierde cambios
- Errores en Console

---

## Resultado Final

**Después de pasar todos los tests:**
- B.6.2 reducido: ✅ Aprobado
- Siguiente: B.6.3 (Realtime sync)

