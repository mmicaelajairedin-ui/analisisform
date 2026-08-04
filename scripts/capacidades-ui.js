/**
 * Capacidades UI Component
 * Renders and manages capability checkboxes in the Equipo drawer.
 */

/**
 * Capability groups for organization
 */
const CAPACIDADES_GRUPOS = {
  'Clientes': [
    { id: 'clientes.read', label: 'Ver' },
    { id: 'clientes.create', label: 'Crear' },
    { id: 'clientes.edit', label: 'Editar' },
    { id: 'clientes.assign', label: 'Reasignar' },
    { id: 'clientes.archive', label: 'Archivar' },
    { id: 'clientes.notes', label: 'Notas' }
  ],
  'Agenda': [
    { id: 'agenda.view_own', label: 'Ver propias' },
    { id: 'agenda.view_team', label: 'Ver equipo' },
    { id: 'agenda.create', label: 'Crear' },
    { id: 'agenda.edit', label: 'Editar' },
    { id: 'agenda.cancel', label: 'Cancelar' }
  ],
  'Programas': [
    { id: 'programas.create', label: 'Crear' },
    { id: 'programas.edit', label: 'Editar' },
    { id: 'programas.publish', label: 'Publicar' },
    { id: 'programas.delete', label: 'Eliminar' }
  ],
  'Recursos': [
    { id: 'recursos.create', label: 'Crear' },
    { id: 'recursos.share', label: 'Compartir' },
    { id: 'recursos.edit', label: 'Editar' },
    { id: 'recursos.delete', label: 'Eliminar' }
  ],
  'Biblioteca': [
    { id: 'biblioteca.manage', label: 'Gestionar' },
    { id: 'biblioteca.publish', label: 'Publicar' }
  ],
  'Mensajes': [
    { id: 'mensajes.send', label: 'Enviar' },
    { id: 'mensajes.view', label: 'Ver' },
    { id: 'mensajes.archive', label: 'Archivar' }
  ],
  'IA': [
    { id: 'ia.use', label: 'Usar IA' },
    { id: 'ia.crear_prompts', label: 'Crear prompts' }
  ],
  'Comunidad': [
    { id: 'comunidad.publicar', label: 'Publicar' },
    { id: 'comunidad.moderar', label: 'Moderar' },
    { id: 'comunidad.ver', label: 'Ver' }
  ],
  'Marketplace': [
    { id: 'marketplace.perfil', label: 'Perfil público' },
    { id: 'marketplace.recibir', label: 'Recibir clientes' },
    { id: 'marketplace.reviews', label: 'Gestionar reseñas' }
  ],
  'Analytics': [
    { id: 'analytics.view_own', label: 'Ver propios' },
    { id: 'analytics.view_org', label: 'Ver organización' },
    { id: 'analytics.export', label: 'Exportar' }
  ],
  'Cobros': [
    { id: 'billing.view_own', label: 'Ver ingresos propios' },
    { id: 'billing.view_org', label: 'Ver ingresos org' },
    { id: 'billing.manage_invoice', label: 'Gestionar facturas' },
    { id: 'billing.receive_payment', label: 'Recibir pagos' },
    { id: 'billing.export', label: 'Exportar' }
  ],
  'Configuración': [
    { id: 'config.usuarios', label: 'Usuarios' },
    { id: 'config.branding', label: 'Branding' },
    { id: 'config.especialidades', label: 'Especialidades' }
  ],
  'Colaboración': [
    { id: 'collab.compartir_cliente', label: 'Compartir cliente' },
    { id: 'collab.delegar', label: 'Delegar' }
  ]
};

/**
 * Current capacities being edited (user_id -> Set of capacidad IDs)
 */
let _currentEditingCapacidades = new Set();

/**
 * Load user capabilities into the editing set.
 * @param {string} userId - UUID of user to load capacities for
 */
async function loadCapacidadesForEdit(userId) {
  try {
    const res = await fetch(`/rest/v1/user_capacidades?user_id=eq.${userId}&enabled=eq.true&select=capacidad`, {
      headers: {
        'Authorization': `Bearer ${_sbToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!res.ok) {
      console.error('Failed to load capacidades:', res.statusText);
      _currentEditingCapacidades = new Set();
      return;
    }

    const rows = await res.json();
    _currentEditingCapacidades = new Set(rows.map(r => r.capacidad));
  } catch (err) {
    console.error('Error loading capacidades:', err);
    _currentEditingCapacidades = new Set();
  }
}

/**
 * Generate HTML for capability management UI.
 * Grouped by entity (Clientes, Agenda, etc.)
 *
 * @param {string} userId - UUID of user
 * @returns {string} HTML for capabilities section
 */
function renderCapacidadesUI(userId) {
  let html = '<div class="drawer-section">'
    + '<div class="drawer-section-title">Capacidades</div>'
    + '<div style="font-size:12px;color:var(--db-text-muted);margin-bottom:16px;">'
    + '⚙️ Gestiona qué puede hacer esta persona.'
    + '</div>';

  // Preset buttons
  html += '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px;">'
    + '<button class="btn-capacidad-preset" onclick="_applyCapacidadPreset(\'' + userId + '\', \'Coach Estándar\')">Coach Estándar</button>'
    + '<button class="btn-capacidad-preset" onclick="_applyCapacidadPreset(\'' + userId + '\', \'Coach Senior\')">Coach Senior</button>'
    + '<button class="btn-capacidad-preset" onclick="_applyCapacidadPreset(\'' + userId + '\', \'Recruiter\')">Recruiter</button>'
    + '<button class="btn-capacidad-preset" onclick="_applyCapacidadPreset(\'' + userId + '\', \'Asistente\')">Asistente</button>'
    + '</div>';

  // Capability groups
  for (const [grupo, caps] of Object.entries(CAPACIDADES_GRUPOS)) {
    html += '<div style="margin-bottom:16px;">'
      + '<div style="font-size:11px;font-weight:600;color:var(--db-text-muted);text-transform:uppercase;letter-spacing:0.3px;margin-bottom:8px;">'
      + grupo
      + '</div>'
      + '<div style="display:grid;grid-template-columns:1fr;gap:6px;">';

    for (const cap of caps) {
      const isChecked = _currentEditingCapacidades.has(cap.id);
      html += '<label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:12px;user-select:none;">'
        + '<input type="checkbox" '
        + (isChecked ? 'checked' : '')
        + ' onchange="_toggleCapacidad(\'' + userId + '\', \'' + cap.id + '\', this.checked)"'
        + ' style="cursor:pointer;width:16px;height:16px;">'
        + '<span>' + cap.label + '</span>'
        + '</label>';
    }

    html += '</div></div>';
  }

  html += '</div>';
  return html;
}

/**
 * Toggle a single capability on/off.
 * Updates local set and DB.
 *
 * @param {string} userId - UUID
 * @param {string} capacidad - e.g., 'clientes.read'
 * @param {boolean} enabled - true or false
 */
async function _toggleCapacidad(userId, capacidad, enabled) {
  if (enabled) {
    _currentEditingCapacidades.add(capacidad);
  } else {
    _currentEditingCapacidades.delete(capacidad);
  }

  // Save to DB
  const ok = await updateCapability(userId, MC_ORG, capacidad, enabled);
  if (!ok) {
    console.error('Failed to save capability');
    __toast('Error al guardar capacidad');
    // Revert local change
    if (enabled) {
      _currentEditingCapacidades.delete(capacidad);
    } else {
      _currentEditingCapacidades.add(capacidad);
    }
  } else {
    __toast('✓ ' + (enabled ? 'Habilitada' : 'Deshabilitada') + ' ' + capacidad);
  }
}

/**
 * Apply a preset to a user.
 * Replaces all capabilities with the preset's set.
 *
 * @param {string} userId - UUID
 * @param {string} presetName - e.g., 'Coach Estándar'
 */
async function _applyCapacidadPreset(userId, presetName) {
  if (!confirm('¿Aplicar preset "' + presetName + '"? Reemplazará todas las capacidades.')) {
    return;
  }

  const ok = await applyPreset(userId, MC_ORG, presetName);
  if (ok) {
    await loadCapacidadesForEdit(userId);
    // Refresh drawer content
    const content = document.getElementById('equipoDrawerContent');
    if (content && _equipoSelected) {
      content.innerHTML = _equipoDrawerHtml();
    }
    __toast('✓ Preset "' + presetName + '" aplicado');
  } else {
    __toast('Error al aplicar preset');
  }
}

/* CSS for capability UI (embed in multicoach.html <style>) */
const CAPACIDADES_CSS = `
.btn-capacidad-preset {
  padding: 6px 12px;
  font-size: 11px;
  font-weight: 500;
  border: 1px solid var(--db-border-light);
  background: #fff;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s;
  color: var(--db-text-primary);
}

.btn-capacidad-preset:hover {
  background: var(--db-bg-light);
  border-color: var(--db-text-muted);
}

.btn-capacidad-preset.active {
  background: var(--pw-bosque);
  color: #fff;
  border-color: var(--pw-bosque);
}

.capacidad-checkbox {
  cursor: pointer;
  width: 16px;
  height: 16px;
}

.capacidad-label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-size: 12px;
  user-select: none;
}
`;
