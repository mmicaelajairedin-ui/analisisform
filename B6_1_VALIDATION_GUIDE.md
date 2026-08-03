# Sprint B.6.1 — Brand Identity End-to-End Validation Guide

## Objetivo
Validar que un Owner puede cambiar su identidad de marca (logo, colores, tipografía) y que:
1. Los cambios se guardan en Supabase
2. Se aplican mediante Theme Engine
3. Persisten al recargar
4. Están aislados por organización (Org 1 NO afecta a Org 2)

---

## Pre-requisitos

✅ **Base de datos**: La migración `0200_organization_branding_update.sql` debe estar aplicada en Supabase:
```sql
-- En Supabase SQL Editor, correr:
-- supabase/migrations/0200_organization_branding_update.sql
```

✅ **Datos de prueba**: Necesitas:
- 2 organizaciones (con IDs diferentes)
- 1 usuario Owner en cada organización
- Acceso a `multicoach.html`

---

## Caso A: Single Organization Edit

### 1️⃣ **Setup inicial**

```
1. Abre navegador → http://localhost:8000/multicoach.html
   (o la URL de tu deploy)

2. Login como Owner de Org 1
   - Email: [tu email de owner]
   - Contraseña: [tu password]

3. Navega a: Sidebar → Empresa → Identidad
```

### 2️⃣ **Cambiar Color Primario**

```
1. En la tarjeta "Identidad Visual" → sección "Paleta de colores"
   Haz clic en el cuadrado "Primario" (#2D5016)

2. Esperado: Se abre MODAL (no prompt)
   - Color picker (input type="color")
   - Hex text input
   - Preview en tiempo real
   - Botones: Cancelar, Guardar

3. Cambia el color:
   - Click en el color picker → elige ROJO (#FF0000)
   - O escribe manualmente en hex input

4. Verifica:
   ✓ Preview actualiza instantáneamente
   ✓ Gradiente en "Paleta de colores" cambia
   ✓ Preview panel derecha se actualiza

5. Haz clic en "Guardar"
   - Esperado: Toast verde "✓ Color actualizado"
   - Esperado: Color guardado persiste en preview
```

### 3️⃣ **Cambiar Color Secundario**

```
1. Haz clic en "Secundario" (#8C7B80)

2. Abre modal, elige AZUL (#0000FF)

3. Verifica:
   ✓ Gradiente cambia
   ✓ Preview se actualiza

4. Guarda
   - Toast: "✓ Color actualizado"
```

### 4️⃣ **Cambiar Tipografía**

```
1. Sección "Tipografía" → haz clic en la caja

2. Esperado: Modal con 3 opciones de font
   - Poppins (actual ✓)
   - Inter
   - Manrope
   
   Cada una muestra preview: "La identidad de tu marca"

3. Selecciona "Inter"

4. Verifica:
   ✓ Font cambia inmediatamente
   ✓ Toast: "✓ Tipografía actualizada"
```

### 5️⃣ **Subir Logo**

```
1. Sección "Activos visuales" → haz clic en "Logo" (🖼️)

2. Esperado: File picker (dialog del SO)
   - Acepta: PNG, SVG, JPEG
   - Máximo: 5MB

3. Selecciona una imagen

4. Verifica:
   ✓ Toast: "✓ Logo actualizado"
   (El preview es básico en esta versión)
```

### 6️⃣ **Verificar Persistencia (Reload)**

```
1. Presiona F5 para recargar la página

2. Verifica:
   ✓ Color primario sigue siendo ROJO
   ✓ Color secundario sigue siendo AZUL
   ✓ Tipografía sigue siendo Inter
   ✓ Preview mantiene los cambios

3. Consola del navegador (F12 → Console):
   - Esperado: "[BrandEngine] ✓ Loaded org { branding: {...} }"
   - Verificar que los valores match con lo que guardaste
```

---

## Caso B: Organization Isolation

### 1️⃣ **Abre dos pestañas**

```
Tab A: Org 1 (Owner)
  - Cambié a: Rojo + Azul + Inter

Tab B: Org 2 (Owner diferente)
  - Presiona F5 en esta pestaña para asegurar carga fresca
```

### 2️⃣ **Verifica que Org 2 es diferente**

```
En Tab B (Org 2):
1. Navega a Empresa → Identidad

2. Verifica:
   ✓ Color primario es #2D5016 (por defecto, NO rojo)
   ✓ Color secundario es #8C7B80 (por defecto, NO azul)
   ✓ Tipografía es Poppins (por defecto, NO Inter)

3. No se ven los cambios de Org 1
   → ✓ Aislamiento correcto
```

### 3️⃣ **Cambia Org 2 sin afectar Org 1**

```
En Tab B (Org 2):
1. Cambia color a VERDE (#00FF00)

2. Verifica:
   ✓ Solo Org 2 muestra VERDE
   ✓ Tab A (Org 1) sigue mostrando ROJO

3. Recarga Tab A (F5)
   ✓ Org 1 sigue en ROJO
   ✓ Cambio de Org 2 NO contaminó Org 1
```

---

## Validación Realtime (Opcional)

### Abre Developer Tools → Network

```
1. Haz un cambio (ej: color primario)

2. Observa las requests:
   ✓ POST /rest/v1/organization_branding
   ✓ Status: 200 o 204
   ✓ Body: { primary_color: "#FF0000", ... }

3. Verifica Supabase (SQL Editor):
   SELECT * FROM organization_branding
   WHERE organization_id = '[tu org id]'
   
   ✓ primary_color está actualizado a #FF0000
```

---

## Checklist de Validación

### ✅ Cambios Guardados
- [ ] Color primario se guarda en Supabase
- [ ] Color secundario se guarda en Supabase
- [ ] Tipografía se guarda en Supabase
- [ ] Logo se guarda (como data URL o URL en Supabase)

### ✅ Preview en Tiempo Real
- [ ] Color picker muestra cambio inmediato
- [ ] Gradiente en tarjeta se actualiza
- [ ] Panel preview derecho se actualiza
- [ ] Tipografía se aplica en preview

### ✅ Persistencia
- [ ] Reload mantiene los cambios
- [ ] Los datos en Supabase match con lo mostrado en UI

### ✅ Aislamiento por Organización
- [ ] Org 2 NO ve cambios de Org 1
- [ ] Cambio en Org 2 NO afecta a Org 1
- [ ] Cada org tiene su propia row en `organization_branding`

### ✅ Error Handling
- [ ] Color inválido muestra error
- [ ] File size > 5MB muestra error
- [ ] File type no permitido muestra error
- [ ] Toast notifications funcionan

---

## Troubleshooting

### "Modal no abre"
→ Verifica que `_oidShowColorPicker()` existe en multicoach.html (línea ~5613)

### "Color no se guarda"
→ Verifica en Console (F12):
```javascript
window.BrandEngine.getBranding()  // ¿Los valores están actualizados?
```

### "Org 2 ve cambios de Org 1"
→ Problema de aislamiento. Verifica:
- Cada organización tiene su propio `organization_id`
- Las queries filtran por `organization_id=eq.[orgId]`

### "Reload pierde cambios"
→ Verifica en SQL Editor que los datos se guardaron en Supabase

---

## Métricas de Éxito

✅ **Completado cuando:**
1. Un owner puede cambiar todos los 4 elementos (logo, color primario, color secundario, tipografía)
2. Los cambios se guardan en Supabase (`organization_branding`)
3. Los cambios persisten después de reload (F5)
4. Org 1 y Org 2 están completamente aisladas
5. No hay errores en Console (F12)
6. Toast notifications confirman cada acción

---

## Next: Sprint B.6.2

Una vez validado end-to-end:

1. **Priority 2**: Eliminar hardcoded colors (panel-v2, cliente.html, multicoach.html)
   → Reemplazar con `var(--org-primary)`, etc.

2. **Priority 3**: Realtime verification con 2 tabs abiertos
   → Cambiar en Tab A, ver update automático en Tab B sin reload

3. **Priority 4**: Connect landing pública a Landing Engine
