# Auditoría iOS: Elementos de Pago a Ocultar

## 🎯 Objetivo
Diseñar una versión iOS permanente que NO incluya elementos de compra/suscripción. Los coaches YA pagaron cuando entran.

---

## 📱 PANEL-V2.HTML (Panel del Coach)

### ✅ MANTENER EN iOS
- Dashboard (resumen, clientes, actividad)
- Clientes (lista, fichas, contacto)
- Sesiones/Agenda
- Chat/Mensajes
- Documentos (CV, Carta)
- Configuración básica (email, zona horaria, contraseña)
- Web Analytics (admin only)
- Notificaciones

### ❌ OCULTAR EN iOS (Data-ios-hide)

#### 1. **Sección "Tu plan y tus pagos"** (línea ~7030)
```
Ubicación: Tab "Gestion" → opción "Tu plan"
Elementos:
  - Tarjeta de plan actual (.cp-plan-card)
  - Selector de plan Basic/Pro (.cp-psel-tiles)
  - Botones "Activar", "Cambiar de plan", "Reactivar"
  - Información de Stripe
  - Precios
  - Features por plan
Razón: Stripe es fuera de app, sin IAP alternative → Apple 4.8 violation
```

#### 2. **Stripe info row** (línea ~715-717)
```
Ubicación: Sección de métodos de pago
Elementos:
  - Logo de Stripe
  - "Gestionar tarjeta"
  - Link al portal de Stripe
```

#### 3. **Botones de pago en configuración** (línea ~7315)
```
Ubicación: Tab "Gestion" → Configuración
Botones:
  - "Ya pagué · actualizar estado"
  - "Ver facturas o cambiar tarjeta en Stripe"
```

#### 4. **Badge de estado** (línea ~227)
```
Elemento: .cp-side-plan badge
Muestra: "TRIAL 14D", "PRUEBA", "VENCIDA"
Acción: Ocultar badge completo (el estado se ve en otro lado si es crítico)
```

---

## 👤 CLIENTE.HTML (Portal del Cliente)

### ✅ MANTENER EN iOS
- Dashboard (resumen semanal)
- Documentos (CV, Carta, LinkedIn)
- Sesiones (Calendly, historial)
- Recursos (material por semana)
- Empleos (buscador, sugerencias)
- Comunidad (chat)
- Perfil
- Progreso/Medallas

### ❌ OCULTAR EN iOS

#### 1. **Aviso "Tu plan venció"** (línea ~1624)
```
Ubicación: Aviso en la parte superior
Texto: "Tu plan venció" / "Your plan expired"
Acción: Ocultar completamente
Razón: No hay renovación IN-APP, el cliente pagó fuera
```

#### 2. **Referencias a plan Pro/Basic** (línea ~2112-2115)
```
Ubicación: Sidebar, badges de featured sections
Elementos: "Sección Pro", "Feature Premium"
Acción: Mostrar todas las secciones sin restricción de plan
Razón: La lógica de restricción de plan es del panel, no del cliente
```

---

## 🔐 LOGIN.HTML

### ✅ MANTENER
- Formulario de login (email/password)
- Botones "Sign in with Apple"
- Botones "Sign in with Google"
- "¿Olvidaste tu contraseña?"

### ❌ OCULTAR EN iOS

#### 1. **Mensaje de renovación de suscripción** (línea ~478-479)
```
Ubicación: Pantalla de error post-login
Textos:
  - "Tu cuenta está pendiente de pago"
  - "Renueva tu suscripción entrando a..."
  - Link a Stripe
Acción: Cambiar por mensaje neutral
Nueva versión:
  "Tu acceso venció. Por favor, contacta al equipo de soporte a través de WhatsApp."
Razón: Sin renovación IN-APP
```

#### 2. **Plan detection logic** (línea ~471-475)
```
Ubicación: Lógica interna de ruteo
Acción: No afecta UI en iOS, pero documenta que NO se redirige a Stripe
```

---

## 🏢 MULTICOACH.HTML (Panel de Red/Owner)

### ✅ MANTENER EN iOS
- Dashboard
- Clientes
- Coaches/Equipo
- Programa/Cursos
- Agenda
- Comunidad
- Analytics

### ❌ OCULTAR EN iOS

#### 1. **Sección "Cobros"** (línea ~720)
```
Ubicación: Sidebar, navegación principal
Elemento: `<a data-s="cobros">Cobros</a>`
Acción: Ocultar completamente
Razón: No hay gestión de cobros IN-APP
```

#### 2. **Badge "Pro"** (línea ~708)
```
Ubicación: Header, ID mc-plan-badge
Texto: "Pro" (si la organización tiene plan Pro)
Acción: Ocultar
Razón: Los precios/planes no son relevantes en iOS
```

#### 3. **Gate de features por plan** (línea ~932-944)
```
Ubicación: Lógica de acceso a módulos (coaches, programas, analytics, cobros)
Acción: PERMITIR TODOS en iOS (sin gate)
Razón: Si el owner está en la app, YA pagó. Sin paywall.
```

---

## 📧 LOGIN.HTML (Email + Recovery)

### ✅ MANTENER
- Formulario de login

### ❌ OCULTAR EN iOS
Nada crítico, pero revisar mensajes de error

---

## 🎨 IMPLEMENTACIÓN: Atributo data-ios-hide

```html
<!-- panel-v2.html línea ~7030 -->
<div data-ios-hide>
  <!-- TODA la sección "Tu plan y tus pagos" -->
</div>

<!-- panel-v2.html línea ~715 -->
<div data-ios-hide class="cp-stripe-row">
  <!-- Stripe info -->
</div>

<!-- login.html línea ~478 -->
<div data-ios-hide id="payment-required-msg">
  <!-- Mensaje de renovación -->
</div>

<!-- multicoach.html línea ~720 -->
<a data-ios-hide data-s="cobros">Cobros</a>

<!-- multicoach.html línea ~708 -->
<span data-ios-hide id="mc-plan-badge">Pro</span>
```

---

## 🛡️ CSS Rule (pw-app.js)

```javascript
// En pw-app.js, expandir la sección de estilos condicionales:

if (window.PWI.app === 'ios') {
  var style = document.createElement('style');
  style.textContent = `
    [data-ios-hide] { display: none !important; }
    
    /* Remove plan gates in multicoach */
    .ios-no-plan-gates .cp-feature-gate { display: none; }
    .ios-no-plan-gates [data-needs-pro] { pointer-events: auto; }
  `;
  document.head.appendChild(style);
  document.documentElement.classList.add('ios-no-plan-gates');
}
```

---

## 📋 Checklist de Cambios

- [ ] **panel-v2.html**
  - [ ] Envolver sección "Tu plan y tus pagos" con `data-ios-hide`
  - [ ] Envolver Stripe info row con `data-ios-hide`
  - [ ] Envolver "Ya pagué" botón con `data-ios-hide`
  - [ ] Ocultar .cp-side-plan badge con `data-ios-hide`

- [ ] **cliente.html**
  - [ ] Envolver aviso "plan venció" con `data-ios-hide`
  - [ ] Remover gate de plan Pro/Basic (mostrar todo)
  - [ ] Revisar si hay otros avisos de suscripción

- [ ] **login.html**
  - [ ] Reemplazar mensaje "Tu cuenta está pendiente de pago" por versión neutral (o `data-ios-hide`)
  - [ ] Remover link a Stripe en iOS

- [ ] **multicoach.html**
  - [ ] Envolver sección "Cobros" con `data-ios-hide`
  - [ ] Envolver badge "Pro" con `data-ios-hide`
  - [ ] Permitir acceso a TODOS los módulos en iOS (no gate)

- [ ] **pw-app.js**
  - [ ] Agregar regla CSS condicional para `[data-ios-hide]`
  - [ ] Agregar clase `ios-no-plan-gates` para remover gates

- [ ] **Validación**
  - [ ] Testear en iOS: no aparecen botones de pago
  - [ ] Testear en web: todo visible
  - [ ] Ejecutar guardrails: sin regresiones

---

## 🎯 Resultado Final

**iOS App:**
- ✅ Panel limpio, sin opciones de compra
- ✅ Cliente ve todo su material, sin restricciones
- ✅ No hay conflictos con Apple Guideline 4.8
- ✅ Estable para futuras revisiones

**Web:**
- ✅ Todos los elementos de pago visibles
- ✅ Coaches pueden subscribirse/renovar
- ✅ Stripe integration completa
