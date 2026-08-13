# FASE 1 — FRONTEND CHANGES EXACTAS

**Propósito:** Actualizar UI para mostrar provider status sin tocar V1.  
**Principio:** Frontend lee/muestra, backend decide/actúa.

---

## ARCHIVO 1: `reservar-v2.html` (NUEVA)

### Ubicación: `reservar-v2.html`

Copia de `reservar.html` con cambios mínimos:

```html
<!DOCTYPE html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Nueva Cita — Coaching de Carrera</title>
    <style>
      body {
        font-family: Poppins, sans-serif;
        max-width: 600px;
        margin: 0 auto;
        padding: 20px;
        background: #f9f9f9;
      }
      .form-group {
        margin-bottom: 20px;
      }
      label {
        display: block;
        margin-bottom: 5px;
        font-weight: 500;
      }
      input,
      select,
      textarea {
        width: 100%;
        padding: 8px;
        border: 1px solid #ddd;
        border-radius: 4px;
        font-family: inherit;
      }
      button {
        background: #2d5016;
        color: white;
        padding: 12px 24px;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 1rem;
      }
      button:hover {
        background: #1f3811;
      }
      .status {
        padding: 12px;
        margin-top: 20px;
        border-radius: 4px;
      }
      .status.success {
        background: #e8f5e9;
        color: #2e7d32;
        border-left: 4px solid #2e7d32;
      }
      .status.error {
        background: #ffebee;
        color: #c62828;
        border-left: 4px solid #c62828;
      }
      .status.info {
        background: #e3f2fd;
        color: #1565c0;
        border-left: 4px solid #1565c0;
      }
    </style>
  </head>
  <body>
    <h1>Nueva Cita de Coaching</h1>
    <p>Completa el formulario para programar una cita. La videoconferencia se preparará automáticamente.</p>

    <form id="form_reserva">
      <div class="form-group">
        <label for="titulo">Título de la sesión</label>
        <input
          type="text"
          id="titulo"
          name="titulo"
          placeholder="ej: 1:1 Coaching"
          required
        />
      </div>

      <div class="form-group">
        <label for="fecha">Fecha y hora</label>
        <input type="datetime-local" id="fecha" name="fecha" required />
      </div>

      <div class="form-group">
        <label for="cliente_email">Email del cliente</label>
        <input type="email" id="cliente_email" name="cliente_email" required />
      </div>

      <div class="form-group">
        <label for="cliente_nombre">Nombre del cliente</label>
        <input
          type="text"
          id="cliente_nombre"
          name="cliente_nombre"
          placeholder="Nombre completo"
        />
      </div>

      <div class="form-group">
        <label for="descripcion">Descripción (opcional)</label>
        <textarea id="descripcion" name="descripcion" rows="4"></textarea>
      </div>

      <button type="submit">Crear Cita</button>
      <div id="status"></div>
    </form>

    <script>
      // ======================================================================
      // CONFIGURACIÓN
      // ======================================================================
      const SUPABASE_URL = "https://api.pathwaycareercoach.com"; // custom domain
      const SUPABASE_KEY = localStorage.getItem("sb_auth_token"); // bearer token
      const STATUS_EL = document.getElementById("status");

      // ======================================================================
      // FLUJO FASE 1 V2
      // ======================================================================
      // 1. Frontend: INSERT cita con provider='none' (SOLO esto)
      // 2. Backend: select-provider → decide provider
      // 3. Backend: sync-provider-v2 → obtiene URL
      // 4. Backend: send-email-v2 → envía email
      // ======================================================================

      document.getElementById("form_reserva").addEventListener("submit", async (e) => {
        e.preventDefault();

        const titulo = document.getElementById("titulo").value.trim();
        const fecha = document.getElementById("fecha").value;
        const cliente_email = document.getElementById("cliente_email").value.trim();
        const cliente_nombre = document.getElementById("cliente_nombre").value.trim();
        const descripcion = document.getElementById("descripcion").value.trim();

        // Validar
        if (!titulo || !fecha || !cliente_email) {
          showStatus("error", "Completa todos los campos requeridos");
          return;
        }

        showStatus("info", "Creando cita...");

        try {
          // ================================================================
          // PASO 1: INSERT CITA (V2)
          // ================================================================
          // CRÍTICO: NO decidir provider en frontend
          // CRÍTICO: NO llamar a APIs de provider (Google, Zoom)
          // CRÍTICO: NO construir URL de videoconferencia
          // SOLO: INSERT con provider='none'
          // ================================================================

          const citaData = {
            titulo,
            fecha: new Date(fecha).toISOString(),
            cliente_email,
            cliente_nombre,
            descripcion,
            coach_id: localStorage.getItem("coach_id"),
            estado: "confirmada", // V2: estado inmediato, provider después
            provider: "none", // Backend decirá qué provider usar
          };

          const insertResponse = await fetch(
            `${SUPABASE_URL}/rest/v1/citas?select=id`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${SUPABASE_KEY}`,
                Prefer: "return=representation",
              },
              body: JSON.stringify(citaData),
            }
          );

          if (!insertResponse.ok) {
            const error = await insertResponse.json();
            throw new Error(error.message || "Failed to create cita");
          }

          const [cita] = await insertResponse.json();
          const citaId = cita.id;

          showStatus(
            "success",
            `✅ Cita creada. ID: ${citaId}. La videoconferencia se está preparando...`
          );

          // Limpiar form
          document.getElementById("form_reserva").reset();

          // ================================================================
          // PASO 2 (Opcional): Redirigir al panel del coach
          // ================================================================
          setTimeout(() => {
            window.location.href = `panel-v2.html?cita=${citaId}`;
          }, 2000);
        } catch (error) {
          showStatus("error", `Error: ${error.message}`);
        }
      });

      function showStatus(type, message) {
        STATUS_EL.className = `status ${type}`;
        STATUS_EL.textContent = message;
      }
    </script>
  </body>
</html>
```

**Cambios clave:**

- ✅ INSERT con `provider='none'` (backend decide)
- ✅ NO llamadas a Google/Zoom APIs
- ✅ NO construcción de URL de meeting
- ✅ NO email enviado desde frontend
- ✅ Estado `confirmada` inmediato (no esperar sync)

---

## ARCHIVO 2: `panel-v2.html` (MODIFICADA)

### Cambios en la sección de Clientes/Citas

Agregar visualización de provider status en la lista de citas:

```html
<!-- EN LA SECCIÓN DE CITAS/CLIENTES: Agregar columna provider -->

<div id="citas_list">
  <!-- Iteración sobre citas -->
  <!-- Para cada cita: -->
  <div class="cita_card">
    <div class="cita_header">
      <h3 id="cita_titulo_${cita.id}">${cita.titulo}</h3>
      <p id="cita_fecha_${cita.id}">${formatDate(cita.fecha)}</p>
    </div>

    <!-- NUEVA: Provider Status -->
    <div id="provider_status_${cita.id}" class="provider_status">
      <!-- Dinámico, actualizado por JS abajo -->
    </div>

    <!-- Link a la sala / URL -->
    <div id="meeting_link_${cita.id}" class="meeting_link">
      <!-- Dinámico -->
    </div>
  </div>
</div>
```

### JavaScript en panel-v2.html

```javascript
// ========================================================================
// NUEVA FUNCIÓN: Mostrar provider status y link
// ========================================================================

async function updateProviderStatus(citaId) {
  const statusEl = document.getElementById(`provider_status_${citaId}`);
  const linkEl = document.getElementById(`meeting_link_${citaId}`);

  if (!statusEl) return; // Cita no en vista actual

  try {
    // Fetch cita del DB
    const response = await fetch(
      `https://api.pathwaycareercoach.com/rest/v1/citas?id=eq.${citaId}&select=provider,provider_url,provider_error,provider_ready_at`,
      {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("sb_auth_token")}`,
        },
      }
    );

    if (!response.ok) return;

    const [cita] = await response.json();

    if (!cita) return;

    // ====================================================================
    // MOSTRAR STATUS SEGÚN ESTADO DEL PROVIDER
    // ====================================================================

    if (cita.provider_ready_at) {
      // ✅ READY: URL disponible
      statusEl.innerHTML = `✅ Listo (${formatProviderName(cita.provider)})`;
      statusEl.className = "provider_status ready";

      if (cita.provider_url) {
        linkEl.innerHTML = `
          <a href="${cita.provider_url}" target="_blank" class="btn btn_primary">
            ${formatProviderName(cita.provider) === "Sala Pathway" ? "🚪 Entrar a la Sala" : "🎥 Entrar a la Videoconferencia"}
          </a>
        `;
      }
    } else if (cita.provider_error) {
      // ❌ ERROR: Mostrar error + botón reintentar
      statusEl.innerHTML = `❌ Error: ${cita.provider_error}`;
      statusEl.className = "provider_status error";

      linkEl.innerHTML = `
        <button onclick="retryProviderSync('${citaId}')" class="btn btn_warning">
          🔄 Reintentar Sincronización
        </button>
      `;
    } else {
      // ⏳ PENDING: Esperando
      statusEl.innerHTML = `⏳ Preparando videoconferencia...`;
      statusEl.className = "provider_status pending";

      // Reintentar en 5 segundos
      setTimeout(() => updateProviderStatus(citaId), 5000);
    }
  } catch (error) {
    console.error(`[updateProviderStatus] ${error.message}`);
  }
}

// ========================================================================
// BOTÓN REINTENTAR (en caso de error)
// ========================================================================

async function retryProviderSync(citaId) {
  try {
    const response = await fetch(
      "https://api.pathwaycareercoach.com/functions/v1/sync-provider-v2",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("sb_auth_token")}`,
        },
        body: JSON.stringify({
          cita_id: citaId,
          coach_id: localStorage.getItem("coach_id"),
          provider: (await getCitaProvider(citaId)) || "pathway_room",
        }),
      }
    );

    if (response.ok) {
      // Actualizar status inmediatamente
      setTimeout(() => updateProviderStatus(citaId), 1000);
    }
  } catch (error) {
    alert(`Error al reintentar: ${error.message}`);
  }
}

async function getCitaProvider(citaId) {
  const response = await fetch(
    `https://api.pathwaycareercoach.com/rest/v1/citas?id=eq.${citaId}&select=provider`,
    {
      headers: {
        Authorization: `Bearer ${localStorage.getItem("sb_auth_token")}`,
      },
    }
  );

  if (response.ok) {
    const [cita] = await response.json();
    return cita?.provider;
  }
  return null;
}

function formatProviderName(provider) {
  const map = {
    google_meet: "Google Meet",
    zoom: "Zoom",
    pathway_room: "Sala Pathway",
    none: "Pendiente",
  };
  return map[provider] || provider;
}

// ========================================================================
// LLAMAR updateProviderStatus AL RENDERIZAR CADA CITA
// ========================================================================
// (Cambio en función existente de renderizado de citas)

function renderCitasList() {
  // ... código existente ...

  // DESPUÉS de insertar cita en DOM:
  citas.forEach((cita) => {
    updateProviderStatus(cita.id); // Mostrar status
  });
}
```

### CSS en panel-v2.html

```css
.provider_status {
  padding: 8px 12px;
  margin: 10px 0;
  border-radius: 4px;
  font-size: 0.9rem;
  font-weight: 500;
}

.provider_status.ready {
  background: #e8f5e9;
  color: #2e7d32;
  border-left: 4px solid #2e7d32;
}

.provider_status.pending {
  background: #e3f2fd;
  color: #1565c0;
  border-left: 4px solid #1565c0;
}

.provider_status.error {
  background: #ffebee;
  color: #c62828;
  border-left: 4px solid #c62828;
}

.meeting_link {
  margin-top: 10px;
}

.meeting_link a,
.meeting_link button {
  padding: 10px 16px;
  text-decoration: none;
  border-radius: 4px;
  cursor: pointer;
  display: inline-block;
  font-size: 0.9rem;
}

.btn_primary {
  background: #2d5016;
  color: white;
}

.btn_primary:hover {
  background: #1f3811;
}

.btn_warning {
  background: #f57c00;
  color: white;
}

.btn_warning:hover {
  background: #e65100;
}
```

---

## ARCHIVO 3: `cliente.html` (MODIFICADA)

### Cambios en la sección Sesiones

```html
<!-- EN CLIENTE.HTML: Sección de próximas sesiones -->

<section id="sesiones_section">
  <h2>Tus Próximas Sesiones</h2>
  <div id="sesiones_list">
    <!-- Para cada cita confirmada -->
    <!-- Dinámicamente renderizado abajo -->
  </div>
</section>
```

### JavaScript en cliente.html

```javascript
// ========================================================================
// RENDERIZAR SESIONES CON PROVIDER STATUS
// ========================================================================

async function renderSesiones() {
  const clienteEmail = localStorage.getItem("cliente_email");

  try {
    // Obtener citas del cliente
    const response = await fetch(
      `https://api.pathwaycareercoach.com/rest/v1/citas?cliente_email=eq.${clienteEmail}&estado=eq.confirmada&select=*&order=fecha.asc`,
      {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("sb_auth_token")}`,
        },
      }
    );

    if (!response.ok) return;

    const citas = await response.json();

    const listEl = document.getElementById("sesiones_list");
    listEl.innerHTML = "";

    citas.forEach((cita) => {
      const sessionEl = document.createElement("div");
      sessionEl.className = "session_card";
      sessionEl.id = `session_${cita.id}`;

      const statusClass = cita.provider_ready_at ? "ready" : cita.provider_error ? "error" : "pending";

      sessionEl.innerHTML = `
        <div class="session_header">
          <h3>${cita.titulo}</h3>
          <p class="session_time">${new Date(cita.fecha).toLocaleString("es-ES")}</p>
        </div>

        <div class="session_provider ${statusClass}">
          ${
            cita.provider_ready_at
              ? `
            <p>✅ Videoconferencia lista (${formatProviderName(cita.provider)})</p>
            <a href="${cita.provider_url}" target="_blank" class="btn btn_join">
              ${cita.provider === "pathway_room" ? "🚪 Entrar a la Sala" : "🎥 Entrar"}
            </a>
          `
              : cita.provider_error
                ? `
            <p>❌ Error: ${cita.provider_error}</p>
            <small>Contacta a tu coach para resolver esto.</small>
          `
                : `
            <p>⏳ Estamos preparando tu enlace de videoconferencia...</p>
            <small>Si no recibes en 5 minutos, refresca la página.</small>
          `
          }
        </div>
      `;

      listEl.appendChild(sessionEl);
    });

    // Refrescar status cada 10s (mientras haya citas pending)
    if (citas.some((c) => !c.provider_ready_at && !c.provider_error)) {
      setTimeout(renderSesiones, 10000);
    }
  } catch (error) {
    console.error(`[renderSesiones] ${error.message}`);
  }
}

// Llamar al cargar la página
document.addEventListener("DOMContentLoaded", () => {
  renderSesiones();
});

function formatProviderName(provider) {
  const map = {
    google_meet: "Google Meet",
    zoom: "Zoom",
    pathway_room: "Sala Pathway",
    none: "Pendiente",
  };
  return map[provider] || provider;
}
```

### CSS en cliente.html

```css
.session_card {
  padding: 16px;
  margin-bottom: 12px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.session_header {
  margin-bottom: 12px;
}

.session_header h3 {
  margin: 0;
  font-size: 1.1rem;
}

.session_time {
  margin: 4px 0 0;
  color: #666;
  font-size: 0.9rem;
}

.session_provider {
  padding: 10px;
  border-radius: 4px;
}

.session_provider.ready {
  background: #e8f5e9;
  color: #2e7d32;
}

.session_provider.pending {
  background: #e3f2fd;
  color: #1565c0;
}

.session_provider.error {
  background: #ffebee;
  color: #c62828;
}

.btn_join {
  display: inline-block;
  margin-top: 8px;
  padding: 10px 16px;
  background: #2d5016;
  color: white;
  text-decoration: none;
  border-radius: 4px;
  cursor: pointer;
}

.btn_join:hover {
  background: #1f3811;
}
```

---

## NO MODIFICAR

- ❌ `reservar.html` (V1 frozen)
- ❌ `sala.html` (code audit OK, no changes needed)
- ❌ `sync-cita-to-gcal` (legacy edge function, untouched)
- ❌ RLS policies (no cambios necesarios)

---

## RESUMEN FRONTEND

| Archivo | Cambio | Tipo |
|---------|--------|------|
| `reservar-v2.html` | NUEVA (copia de reservar.html con cambios mínimos) | INSERT con provider='none' |
| `panel-v2.html` | MODIFICADA (agregar visualización de provider) | Lee provider_url, muestra status |
| `cliente.html` | MODIFICADA (agregar sesiones con provider) | Lee provider_url, polling |

**Principio:** Frontend lee/muestra provider status, backend decide/obtiene provider_url.

**Siguiente:** Plan de ejecución FASE 1A
