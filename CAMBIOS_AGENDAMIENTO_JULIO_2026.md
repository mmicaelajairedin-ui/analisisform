# Cambios en Sistema de Agendamiento — Julio 2026

**Decisión:** Sacar sala.html y Calendly. Usar Google Meet como sistema principal de videosesiones.

**Razón:** 
- sala.html tiene problemas y no es confiable
- Calendly es un tercero innecesario
- Google Meet (via Google Calendar) es más simple, confiable e integrado

---

## Qué Cambió

### ❌ REMOVIDO

1. **sala.html del flujo de agendamiento**
   - Ya no se envían links a `sala.html?room=...` 
   - Ya no hay botón "Unirse a sala" en reservas pasadas
   
2. **Calendly**
   - Removidas referencias a `RCFG.calendly_url`
   - Removido botón "Abrir agenda" de Calendly
   - Simplificado mensaje a "Conectá tu Google Calendar"

3. **Funciones deprecated** (pero se mantienen para compatibilidad):
   - `_salaClientLink()` — generaba links a sala.html
   - `_agSalaUrl()` — generaba links a sala.html para coach

### ✅ AGREGADO

1. **Nueva columna en `citas` table:**
   - `meet_link` (text) — guarda el link de Google Meet
   - Índice `citas_meet_link_idx` para búsquedas rápidas

2. **Nuevo flujo de videosesiones:**
   - Coach configura Google Calendar en Configuración
   - Cuando agenda cita → se sincroniza a su Google Calendar
   - Google genera automáticamente Meet link
   - Link se guarda en `citas.meet_link`
   - Panel muestra botón "Unirse a Meet"

### 🔄 CAMBIOS EN CÓDIGO

**panel-v2.html línea ~4666:**
```javascript
// ANTES:
var _rJoin=(!_rEnded && !_attended(r.estado) && r.estado!=="no_asistio")?_agSalaUrl(r):"";

// AHORA:
var _rJoin=(!_rEnded && !_attended(r.estado) && r.estado!=="no_asistio" && r.meet_link)?" href='...";
var _joinBtn=_rJoin?("<a"+_rJoin+" target='_blank'...Meet</a>"):"";
```

**panel-v2.html línea ~3042-3052:**
```javascript
// ANTES: referencias a Calendly + mensaje confuso

// AHORA: mensaje simple "Conectá tu Google Calendar"
```

---

## Nuevo Flujo (Visual)

```
COACH AGENDA UNA CITA:
├─ Panel: forma con cliente, tipo, fecha/hora
├─ Se guarda en Supabase (tabla citas)
├─ SE SINCRONIZA A GOOGLE CALENDAR del coach
├─ Google genera automáticamente Meet link
├─ Link se guarda en citas.meet_link
└─ Panel muestra botón "Unirse a Meet"

CLIENTE RECIBE EMAIL:
├─ Confirmación de cita (desde agendar.html o panel)
├─ NO incluye link de videosesión (viene de Google Calendar del coach)
├─ Cliente ve la sesión en su calendario
└─ Si hay Meet link, puede entrar desde ahí

DURANTE LA SESIÓN:
├─ Coach ve cita en su Google Calendar con Meet link
├─ Coach ve botón "Unirse a Meet" en panel
├─ Cliente entra desde Google Calendar o link recibido
└─ No hay sala.html involucrada
```

---

## Qué Falta Hacer

### 1. **CRÍTICO — Aplicar Migration en Supabase**

Ejecutar en SQL Editor:

```sql
ALTER TABLE citas ADD COLUMN IF NOT EXISTS meet_link text;
CREATE INDEX IF NOT EXISTS citas_meet_link_idx ON citas (meet_link);
```

### 2. **IMPORTANTE — Asegurar Google Calendar Funciona**

Verificar que:
- Los coaches pueden conectar su Google Calendar en Configuración
- Cuando se agenda una cita en panel, se sincroniza a Google Calendar
- Google Calendar automáticamente genera Meet link
- Ese link se guarda en `citas.meet_link`

Si no funciona automático, habrá que agregar un edge function que:
- Lea la cita en Supabase
- Cree evento en Google Calendar del coach
- Guarde el Meet link que Google genera

### 3. **IMPORTANTE — Sacar sala.html del Código Completamente**

Una vez que Google Meet funcione, se pueden remover completamente:
- Funciones `_salaClientLink()` y `_agSalaUrl()`
- Referencias a `sala.html` en emails
- El archivo `sala.html` mismo (o mantenerlo como fallback legacy)

### 4. **TESTING**

- [ ] Coach agenda cita → aparece en Google Calendar
- [ ] Google Calendar genera Meet link
- [ ] Meet link aparece en panel (botón "Unirse a Meet")
- [ ] Cliente puede entrar a Meet
- [ ] Email de confirmación se ve bien (sin sala.html)
- [ ] Citas antiguas (sin meet_link) se manejan correctamente

---

## Preguntas / Problemas

**P: ¿Qué pasa con las citas viejas que tenían sala.html link?**
R: Se ignoran. La columna `meet_link` estará NULL. El botón "Unirse" no aparecerá.

**P: ¿Qué si el coach no tiene Google Calendar configurado?**
R: El mensaje en el panel dice "Conectá tu Google Calendar". Sin eso, no hay videosesión automática.

**P: ¿Se puede mantener sala.html como fallback?**
R: Sí, si queda el código funciona. Pero mejor remover para no confundir.

**P: ¿Email con link de Google Meet?**
R: No. El email dice "Mirá tu Google Calendar para acceder". El link de Meet está ahí automáticamente.

---

## Referencia

- **Archivo de migración:** `supabase/migrations/citas_meet_link.sql`
- **Código modificado:** `panel-v2.html` líneas ~3040-3060 y ~4665-4680
- **Commit:** (el que acaba de pushearse)
- **Documentos relacionados:**
  - `AUDITORIA_CITAS_SEGURIDAD.md` (seguridad de links)
  - `SETUP_SEGURIDAD_CITAS.md` (RLS + tokens)
  - `RESUMEN_AUDITORIA_COMPLETA.md` (resumen ejecutivo)

---

## Resumen

**Antes (complicado):**
- Sala.html + Calendly + Google Calendar = 3 sistemas
- Links a sala.html predecibles (sin seguridad)
- Confuso para coaches

**Ahora (simple):**
- Google Calendar + Google Meet = 1 sistema
- Meet links autogenerados por Google
- Coaches solo configuran Google Calendar una vez
- Todo sincroniza automáticamente

✅ **Resultado:** Sistema más simple, confiable y seguro.
