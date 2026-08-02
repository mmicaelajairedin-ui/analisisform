/**
 * Capacidades (Capabilities) Helper
 * Manages capability-based permissions for users.
 *
 * Usage:
 *   await loadCapabilities(user_id)
 *   hasCapability('clientes.read')
 *   hasAllCapabilities(['clientes.read', 'clientes.edit'])
 */

let _userCapabilities = new Set();
let _cachedUserId = null;

/**
 * Load capabilities for a user from Supabase.
 * Caches in memory; call at login.
 */
async function loadCapabilities(userId) {
  if (!userId) return;

  try {
    const res = await fetch(`/rest/v1/user_capacidades?user_id=eq.${userId}&enabled=eq.true&select=capacidad`, {
      headers: {
        'Authorization': `Bearer ${_sbToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!res.ok) {
      console.error('Failed to load capabilities:', res.statusText);
      return;
    }

    const capacidades = await res.json();
    _userCapabilities = new Set(capacidades.map(c => c.capacidad));
    _cachedUserId = userId;
  } catch (err) {
    console.error('Error loading capabilities:', err);
  }
}

/**
 * Check if user has a specific capability.
 * @param {string} capacidad - e.g., 'clientes.read', 'agenda.edit'
 * @returns {boolean}
 */
function hasCapability(capacidad) {
  return _userCapabilities.has(capacidad);
}

/**
 * Check if user has ALL capabilities in the array.
 * @param {string[]} capacidades - e.g., ['clientes.read', 'clientes.edit']
 * @returns {boolean}
 */
function hasAllCapabilities(capacidades) {
  return capacidades.every(c => _userCapabilities.has(c));
}

/**
 * Check if user has ANY capability in the array.
 * @param {string[]} capacidades - e.g., ['config.usuarios', 'config.branding']
 * @returns {boolean}
 */
function hasAnyCapability(capacidades) {
  return capacidades.some(c => _userCapabilities.has(c));
}

/**
 * Get all capabilities for current user.
 * @returns {Set<string>}
 */
function getCapabilities() {
  return new Set(_userCapabilities);
}

/**
 * Clear cached capabilities (logout).
 */
function clearCapabilities() {
  _userCapabilities.clear();
  _cachedUserId = null;
}

/**
 * Utility: Show/hide element based on capability.
 * Usage: <div id="btn-clientes-edit" data-cap="clientes.edit">Edit</div>
 * Call: applyCapabilityVisibility()
 */
function applyCapabilityVisibility() {
  document.querySelectorAll('[data-cap]').forEach(el => {
    const cap = el.getAttribute('data-cap');
    if (hasCapability(cap)) {
      el.style.display = '';
    } else {
      el.style.display = 'none';
    }
  });
}

/**
 * Guard: Prevent action if user lacks capability.
 * Usage: if (!guardCapability('clientes.edit')) return;
 */
function guardCapability(capacidad) {
  if (!hasCapability(capacidad)) {
    console.warn(`User lacks capability: ${capacidad}`);
    return false;
  }
  return true;
}
