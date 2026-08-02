/**
 * Capacidades Initialization
 * Initialize capabilities for users when they're created or invited.
 *
 * Usage:
 *   await initUserCapabilities(userId, organizationId, 'Coach', 'Coach Estándar')
 *   await applyPreset(userId, organizationId, 'Recruiter')
 */

/**
 * Default presets mapping (must match capacidades_presets table).
 */
const PRESETS = {
  'Coach Estándar': [
    'clientes.read',
    'clientes.edit',
    'clientes.notes',
    'agenda.view_own',
    'agenda.create',
    'agenda.edit',
    'programas.create',
    'programas.edit',
    'recursos.create',
    'recursos.share',
    'mensajes.send',
    'ia.use',
    'analytics.view_own'
  ],
  'Coach Senior': [
    'clientes.read',
    'clientes.create',
    'clientes.edit',
    'clientes.assign',
    'clientes.notes',
    'agenda.view_own',
    'agenda.view_team',
    'agenda.create',
    'agenda.edit',
    'programas.create',
    'programas.edit',
    'recursos.create',
    'recursos.share',
    'mensajes.send',
    'ia.use',
    'analytics.view_own',
    'collab.compartir_cliente'
  ],
  'Recruiter': [
    'clientes.read',
    'clientes.create',
    'clientes.assign',
    'agenda.view_own',
    'mensajes.send',
    'analytics.view_own'
  ],
  'Asistente': [
    'agenda.create',
    'agenda.edit',
    'agenda.view_own',
    'mensajes.send',
    'clientes.read'
  ],
  'Admin Recursos': [
    'recursos.create',
    'recursos.share',
    'recursos.edit',
    'recursos.delete',
    'biblioteca.manage',
    'biblioteca.publish',
    'analytics.view_org'
  ],
  'RRHH': [
    'clientes.read',
    'analytics.view_org',
    'analytics.export'
  ],
  'Owner': [
    'clientes.read',
    'clientes.create',
    'clientes.edit',
    'clientes.assign',
    'clientes.archive',
    'clientes.notes',
    'agenda.view_own',
    'agenda.view_team',
    'agenda.create',
    'agenda.edit',
    'agenda.cancel',
    'programas.create',
    'programas.edit',
    'programas.publish',
    'programas.delete',
    'recursos.create',
    'recursos.share',
    'recursos.edit',
    'recursos.delete',
    'biblioteca.manage',
    'biblioteca.publish',
    'mensajes.send',
    'mensajes.view',
    'mensajes.archive',
    'ia.use',
    'ia.crear_prompts',
    'comunidad.publicar',
    'comunidad.moderar',
    'comunidad.ver',
    'marketplace.perfil',
    'marketplace.recibir',
    'marketplace.reviews',
    'analytics.view_own',
    'analytics.view_org',
    'analytics.export',
    'billing.view_own',
    'billing.view_org',
    'billing.manage_invoice',
    'billing.receive_payment',
    'billing.export',
    'config.usuarios',
    'config.branding',
    'config.especialidades',
    'collab.compartir_cliente',
    'collab.delegar'
  ]
};

/**
 * Map tipo_persona to default preset.
 */
function getDefaultPreset(tipoPersona) {
  const presetMap = {
    'Owner': 'Owner',
    'Coach': 'Coach Estándar',
    'Colaborador': 'Asistente'
  };
  return presetMap[tipoPersona] || 'Asistente';
}

/**
 * Initialize capabilities for a new user.
 * Calls applyPreset() with the default preset for their tipo.
 *
 * @param {string} userId - UUID of the user
 * @param {string} organizationId - UUID of the organization
 * @param {string} tipoPersona - 'Owner', 'Coach', or 'Colaborador'
 */
async function initUserCapabilities(userId, organizationId, tipoPersona) {
  const defaultPreset = getDefaultPreset(tipoPersona);
  await applyPreset(userId, organizationId, defaultPreset);
}

/**
 * Apply a preset to a user.
 * Inserts/updates all capacidades in user_capacidades.
 *
 * @param {string} userId - UUID of the user
 * @param {string} organizationId - UUID of the organization
 * @param {string} presetName - e.g., 'Coach Estándar', 'Recruiter'
 */
async function applyPreset(userId, organizationId, presetName) {
  const capacidades = PRESETS[presetName];
  if (!capacidades) {
    console.error(`Unknown preset: ${presetName}`);
    return false;
  }

  try {
    // Delete existing capacidades for this user
    await _sbw('user_capacidades', 'DELETE', {
      user_id: `eq.${userId}`,
      organization_id: `eq.${organizationId}`
    });

    // Insert new capacidades
    const rows = capacidades.map(cap => ({
      user_id: userId,
      organization_id: organizationId,
      capacidad: cap,
      enabled: true
    }));

    const res = await fetch('/rest/v1/user_capacidades', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${_sbToken}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify(rows)
    });

    if (!res.ok) {
      console.error('Failed to apply preset:', res.statusText);
      return false;
    }

    console.log(`✓ Applied preset "${presetName}" to ${userId}`);
    return true;
  } catch (err) {
    console.error('Error applying preset:', err);
    return false;
  }
}

/**
 * Update a single capability for a user.
 *
 * @param {string} userId - UUID
 * @param {string} organizationId - UUID
 * @param {string} capacidad - e.g., 'clientes.read'
 * @param {boolean} enabled - true or false
 */
async function updateCapability(userId, organizationId, capacidad, enabled) {
  try {
    const res = await fetch(`/rest/v1/user_capacidades?user_id=eq.${userId}&capacidad=eq.${encodeURIComponent(capacidad)}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${_sbToken}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({ enabled })
    });

    if (res.status === 404) {
      // Doesn't exist, create it
      const createRes = await fetch('/rest/v1/user_capacidades', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${_sbToken}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({
          user_id: userId,
          organization_id: organizationId,
          capacidad,
          enabled
        })
      });
      if (!createRes.ok) {
        console.error('Failed to create capability:', createRes.statusText);
        return false;
      }
    } else if (!res.ok) {
      console.error('Failed to update capability:', res.statusText);
      return false;
    }

    console.log(`✓ ${enabled ? 'Enabled' : 'Disabled'} ${capacidad} for ${userId}`);
    return true;
  } catch (err) {
    console.error('Error updating capability:', err);
    return false;
  }
}

/**
 * Get all capabilities for a user.
 * Can use this server-side or in admin panels.
 */
async function getUserCapabilities(userId) {
  try {
    const res = await fetch(`/rest/v1/user_capacidades?user_id=eq.${userId}&select=capacidad`, {
      headers: {
        'Authorization': `Bearer ${_sbToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!res.ok) {
      console.error('Failed to get capabilities:', res.statusText);
      return [];
    }

    const rows = await res.json();
    return rows.map(r => r.capacidad);
  } catch (err) {
    console.error('Error getting capabilities:', err);
    return [];
  }
}
