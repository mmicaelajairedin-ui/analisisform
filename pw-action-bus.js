/**
 * Action Bus — Pub/Sub centralizado para MultiCoach
 * Versión: 1.0 (Intermedia)
 *
 * Objetivo: Eliminar dependencias directas entre módulos
 * Restricción: Sin event sourcing, CQRS, persistencia o middleware sofisticado
 */

class ActionBus {
  constructor() {
    this.subscriptions = new Map(); // Map<action, Set<handlers>>
    this.history = []; // Para debugging
  }

  /**
   * Registrar un listener para una acción
   * @param {string} action - Nombre de la acción (ej: 'coach.created')
   * @param {function} handler - Función que recibe el payload
   */
  subscribe(action, handler) {
    if (typeof handler !== 'function') {
      console.error(`[ActionBus] handler debe ser una función para acción '${action}'`);
      return;
    }

    if (!this.subscriptions.has(action)) {
      this.subscriptions.set(action, new Set());
    }

    this.subscriptions.get(action).add(handler);

    // Retornar función para unsubscribe fácil
    return () => this.unsubscribe(action, handler);
  }

  /**
   * Desregistrar un listener
   * @param {string} action
   * @param {function} handler
   */
  unsubscribe(action, handler) {
    if (this.subscriptions.has(action)) {
      this.subscriptions.get(action).delete(handler);
    }
  }

  /**
   * Disparar una acción
   * @param {string} action - Nombre de la acción
   * @param {*} payload - Datos asociados
   */
  dispatch(action, payload = {}) {
    // Debugging: guardar en history (últimas 100)
    this.history.push({ action, payload, timestamp: Date.now() });
    if (this.history.length > 100) this.history.shift();

    // Ejecutar todos los handlers registrados para esta acción
    if (this.subscriptions.has(action)) {
      const handlers = this.subscriptions.get(action);
      handlers.forEach(handler => {
        try {
          handler(payload);
        } catch (error) {
          console.error(`[ActionBus] Error en handler para '${action}':`, error);
        }
      });
    }
  }

  /**
   * Debugging: ver últimas acciones
   */
  getHistory(limit = 10) {
    return this.history.slice(-limit);
  }

  /**
   * Debugging: ver subscripciones activas
   */
  getSubscriptions() {
    const result = {};
    this.subscriptions.forEach((handlers, action) => {
      result[action] = handlers.size;
    });
    return result;
  }
}

// Instancia global única
window.bus = new ActionBus();

// Acciones conocidas (documentación)
window.bus.ACTIONS = {
  // Coach
  'coach.created': 'Coach creado',
  'coach.updated': 'Coach editado',
  'coach.deleted': 'Coach eliminado',
  'coach.toggled': 'Coach activado/desactivado',

  // Cliente
  'client.created': 'Cliente creado',
  'client.updated': 'Cliente editado/actualizado',
  'client.deleted': 'Cliente eliminado',
  'client.reassigned': 'Cliente reasignado a otro coach',

  // Organización
  'org.updated': 'Organización actualizada',

  // Configuración
  'config.saved': 'Configuración guardada',

  // UI (auxiliares)
  'ui.drawer.close': 'Cerrar drawer genérico',
  'ui.modal.close': 'Cerrar modal genérico',
  'ui.toast': 'Mostrar toast/notificación',
};
