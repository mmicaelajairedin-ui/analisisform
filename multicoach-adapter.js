/**
 * MultiCoach CRUD Adapter
 * Centraliza lógica CRUD (Create, Read, Update, Delete) para Coaches y Clientes
 * Mantiene autorización separada, UI solo orquesta
 * Modo real: edge functions | Modo demo: local state
 */

// ===== COACHES ADAPTER =====

/**
 * Crear coach (invitar)
 * @param {string} nombre
 * @param {string} email
 * @param {string} rol - 'coach' | 'colaborador'
 * @returns {Promise}
 */
function mcCreateCoach(nombre, email, rol) {
  if (!MC_REAL) {
    // Demo: local
    var coach = {
      id: 'c' + (DB.coaches.length + 1) + 'x',
      n: nombre,
      ini: _mcIni(nombre),
      nicho: (NICHOS && NICHOS[0] && NICHOS[0].id) || '',
      email: email.toLowerCase(),
      rat: 0,
      ret: null,
      cli: 0,
      ses: 0,
      esp: '',
      est: 'pendiente',
      foto: '',
      tipo: rol,
      esOwner: false
    };
    DB.coaches.push(coach);
    return Promise.resolve({ ok: true, coach_id: coach.id });
  }

  // Real: edge function
  return _hdr({ 'Content-Type': 'application/json' })
    .then(function (h) {
      return fetch(SB + '/functions/v1/agregar-coach-red', {
        method: 'POST',
        headers: h,
        body: JSON.stringify({ email: email, nombre: nombre, member_role: rol })
      });
    })
    .then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (d) {
        return { ok: r.ok, d: d || {} };
      });
    })
    .then(function (res) {
      if (!res.ok || !res.d.ok) {
        var err = res.d.error;
        throw new Error(
          err === 'email_in_use' ? 'Email en uso' :
            err === 'cap_reached' ? 'Cupo de coaches alcanzado' :
              'Error al sumar coach'
        );
      }
      return { ok: true, coach_id: res.d.coach_id, email_sent: res.d.email_sent };
    });
}

/**
 * Editar coach (parcial)
 * @param {string} coachId
 * @param {object} updates - { nombre?, email?, especialidad?, telefono? }
 * @returns {Promise}
 */
function mcEditCoach(coachId, updates) {
  var coach = _coach(coachId);
  if (!coach) throw new Error('Coach no encontrado');

  if (!MC_REAL) {
    // Demo: local
    if (updates.nombre) coach.n = updates.nombre;
    if (updates.email) coach.email = updates.email.toLowerCase();
    if (updates.especialidad) coach.esp = updates.especialidad;
    if (updates.telefono) coach.tel = updates.telefono;
    return Promise.resolve({ ok: true });
  }

  // Real: editar-coach-red edge function
  var payload = { coach_id: coachId };
  if (updates.nombre) payload.nombre = updates.nombre;
  if (updates.email) payload.email = updates.email;
  if (updates.especialidad) payload.especialidad = updates.especialidad;
  if (updates.telefono) payload.telefono = updates.telefono;

  return _hdr({ 'Content-Type': 'application/json' })
    .then(function (h) {
      return fetch(SB + '/functions/v1/editar-coach-red', {
        method: 'POST',
        headers: h,
        body: JSON.stringify(payload)
      });
    })
    .then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (d) {
        return { ok: r.ok, d: d || {} };
      });
    })
    .then(function (res) {
      if (!res.ok || !res.d.ok) {
        var err = res.d.error;
        throw new Error(
          err === 'invalid_email' ? 'Email inválido' :
            err === 'missing_coach' ? 'Coach no encontrado' :
              err === 'nothing_to_update' ? 'Nada que actualizar' :
                err === 'not_owner' ? 'No tienes permiso' :
                  'Error al editar coach'
        );
      }
      return { ok: true };
    });
}

/**
 * Soft-delete coach (desactivar)
 * @param {string} coachId
 * @param {string} modo - 'suspender' | 'reactivar' | 'quitar' (soft-delete only)
 * @returns {Promise}
 */
function mcDeleteCoach(coachId, modo) {
  var coach = _coach(coachId);
  if (!coach) throw new Error('Coach no encontrado');

  if (!MC_REAL) {
    // Demo: local
    if (modo === 'suspender') coach.est = 'inactivo';
    if (modo === 'reactivar') coach.est = 'activo';
    if (modo === 'quitar') {
      var idx = DB.coaches.indexOf(coach);
      if (idx >= 0) DB.coaches.splice(idx, 1);
    }
    return Promise.resolve({ ok: true });
  }

  // Real: eliminar-coach-red edge function (soft-delete with 3 modes)
  return _hdr({ 'Content-Type': 'application/json' })
    .then(function (h) {
      return fetch(SB + '/functions/v1/eliminar-coach-red', {
        method: 'POST',
        headers: h,
        body: JSON.stringify({ coach_id: coachId, modo: modo })
      });
    })
    .then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (d) {
        return { ok: r.ok, d: d || {} };
      });
    })
    .then(function (res) {
      if (!res.ok || !res.d.ok) {
        var err = res.d.error;
        throw new Error(
          err === 'missing_id' ? 'Coach no encontrado' :
            err === 'modo_invalido' ? 'Modo inválido' :
              err === 'not_owner' ? 'No tienes permiso' :
                'Error al desactivar coach'
        );
      }
      return { ok: true };
    });
}

/**
 * Cambiar rol coach
 * @param {string} coachId
 * @param {string} nuevoRol - 'coach' | 'colaborador'
 * @param {function} authCheck - validator (must be called before backend)
 * @returns {Promise}
 */
function mcChangeCoachRole(coachId, nuevoRol, authCheck) {
  var coach = _coach(coachId);
  if (!coach) throw new Error('Coach no encontrado');

  // Security: check authorization
  if (authCheck && !authCheck()) {
    throw new Error('No tienes permiso para cambiar rol');
  }

  // Blocker: backend implementation needed
  if (!MC_REAL) {
    // Demo: local
    coach.tipo = nuevoRol;
    return Promise.resolve({ ok: true });
  }

  // Real: BLOCKED
  return Promise.reject(new Error('Cambio de rol: requiere backend'));
}

/**
 * Asignar cliente a coach
 * @param {string} clienteId
 * @param {string} coachId
 * @param {function} authCheck - validator
 * @returns {Promise}
 */
function mcAssignClientToCoach(clienteId, coachId, authCheck) {
  var cli = _cli(clienteId);
  var coach = _coach(coachId);
  if (!cli || !coach) throw new Error('Cliente o coach no encontrado');

  // Security: check authorization
  if (authCheck && !authCheck()) {
    throw new Error('No tienes permiso para asignar clientes');
  }

  if (!MC_REAL) {
    // Demo: local
    var prevCoach = _coach(cli.coach);
    cli.coach = coachId;
    if (prevCoach && prevCoach.cli > 0) prevCoach.cli--;
    coach.cli = (coach.cli || 0) + 1;
    return Promise.resolve({ ok: true });
  }

  // Real: asignar-cliente edge function
  return _hdr({ 'Content-Type': 'application/json' })
    .then(function (h) {
      return fetch(SB + '/functions/v1/asignar-cliente', {
        method: 'POST',
        headers: h,
        body: JSON.stringify({ cliente_id: clienteId, coach_id: coachId })
      });
    })
    .then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (d) {
        return { ok: r.ok, d: d || {} };
      });
    })
    .then(function (res) {
      if (!res.ok || !res.d.ok) {
        var err = res.d.error;
        throw new Error(
          err === 'missing_client' ? 'Cliente no encontrado' :
            err === 'missing_coach' ? 'Coach no encontrado' :
              err === 'not_owner' ? 'No tienes permiso' :
                'Error al asignar cliente'
        );
      }
      return { ok: true };
    });
}

// ===== CLIENTES ADAPTER =====

/**
 * Crear cliente
 * @param {string} nombre
 * @param {string} email
 * @param {string} coachId (optional)
 * @returns {Promise}
 */
function mcCreateCliente(nombre, email, coachId) {
  if (!MC_REAL) {
    // Demo: local
    var coach = coachId ? _coach(coachId) : null;
    var cliente = {
      id: 'k' + (DB.clientes.length + 1) + 'x',
      n: nombre,
      email: email.toLowerCase(),
      ini: _mcIni(nombre),
      nicho: (coach ? coach.nicho : (NICHOS[0] && NICHOS[0].id) || ''),
      coach: coachId || '',
      est: 'activo',
      prog: 'Onboarding',
      week: 1,
      plan: 'pending',
      med: 'pending',
      lastState: 'fresh',
      _ts: Date.now(),
      _created: Date.now(),
      ult: 'recién',
      foto: ''
    };
    DB.clientes.push(cliente);
    if (coach) coach.cli = (coach.cli || 0) + 1;
    return Promise.resolve({ ok: true, cliente_id: cliente.id });
  }

  // Real: edge function
  return _hdr({ 'Content-Type': 'application/json' })
    .then(function (h) {
      return fetch(SB + '/functions/v1/agregar-cliente-red', {
        method: 'POST',
        headers: h,
        body: JSON.stringify({ nombre: nombre, email: email, coach_id: coachId || null })
      });
    })
    .then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (d) {
        return { ok: r.ok, d: d || {} };
      });
    })
    .then(function (res) {
      if (!res.ok || !res.d.ok) {
        throw new Error(res.d.error || 'Error al crear cliente');
      }
      return { ok: true, cliente_id: res.d.cliente_id };
    });
}

/**
 * Editar cliente
 * @param {string} clienteId
 * @param {object} updates - { nombre?, email?, estado?, coach?, plan? }
 * @returns {Promise}
 */
function mcEditCliente(clienteId, updates) {
  var cli = _cli(clienteId);
  if (!cli) throw new Error('Cliente no encontrado');

  if (!MC_REAL) {
    // Demo: local
    if (updates.nombre) cli.n = updates.nombre;
    if (updates.email) cli.email = updates.email.toLowerCase();
    if (updates.estado) cli.est = updates.estado;
    if (updates.coach !== undefined && updates.coach !== cli.coach) {
      var prevCoach = _coach(cli.coach);
      cli.coach = updates.coach;
      if (prevCoach && prevCoach.cli > 0) prevCoach.cli--;
      var newCoach = _coach(updates.coach);
      if (newCoach) newCoach.cli = (newCoach.cli || 0) + 1;
    }
    if (updates.plan) cli.plan = updates.plan;
    cli._ts = Date.now();
    return Promise.resolve({ ok: true });
  }

  // Real: editar-cliente-red edge function
  var payload = { cliente_id: clienteId };
  if (updates.nombre) payload.nombre = updates.nombre;
  if (updates.email) payload.email = updates.email;
  if (updates.estado) payload.estado = updates.estado;

  return _hdr({ 'Content-Type': 'application/json' })
    .then(function (h) {
      return fetch(SB + '/functions/v1/editar-cliente-red', {
        method: 'POST',
        headers: h,
        body: JSON.stringify(payload)
      });
    })
    .then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (d) {
        return { ok: r.ok, d: d || {} };
      });
    })
    .then(function (res) {
      if (!res.ok || !res.d.ok) {
        var err = res.d.error;
        throw new Error(
          err === 'invalid_email' ? 'Email inválido' :
            err === 'invalid_estado' ? 'Estado inválido (use: activo, inactivo)' :
              err === 'missing_cliente' ? 'Cliente no encontrado' :
                err === 'nothing_to_update' ? 'Nada que actualizar' :
                  err === 'not_owner' ? 'No tienes permiso' :
                    'Error al editar cliente'
        );
      }
      return { ok: true };
    });
}

/**
 * Soft-delete cliente (desactivar, reactivar, o quitar)
 * @param {string} clienteId
 * @param {string} modo - 'suspender' | 'reactivar' | 'quitar'
 * @returns {Promise}
 */
function mcDeleteCliente(clienteId, modo) {
  var cli = _cli(clienteId);
  if (!cli) throw new Error('Cliente no encontrado');

  if (!MC_REAL) {
    // Demo: local
    if (modo === 'suspender') cli.est = 'inactivo';
    if (modo === 'reactivar') cli.est = 'activo';
    if (modo === 'quitar') {
      var idx = DB.clientes.indexOf(cli);
      if (idx >= 0) DB.clientes.splice(idx, 1);
    }
    return Promise.resolve({ ok: true });
  }

  // Real: eliminar-cliente-red edge function (soft-delete with 3 modes)
  return _hdr({ 'Content-Type': 'application/json' })
    .then(function (h) {
      return fetch(SB + '/functions/v1/eliminar-cliente-red', {
        method: 'POST',
        headers: h,
        body: JSON.stringify({ cliente_id: clienteId, modo: modo })
      });
    })
    .then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (d) {
        return { ok: r.ok, d: d || {} };
      });
    })
    .then(function (res) {
      if (!res.ok || !res.d.ok) {
        var err = res.d.error;
        throw new Error(
          err === 'missing_id' ? 'Cliente no encontrado' :
            err === 'modo_invalido' ? 'Modo inválido (use: suspender, reactivar, quitar)' :
              err === 'not_owner' ? 'No tienes permiso' :
                'Error al desactivar cliente'
        );
      }
      return { ok: true };
    });
}

/**
 * Reasignar cliente a otro coach
 * @param {string} clienteId
 * @param {string} nuevoCoachId
 * @param {function} authCheck - validator
 * @returns {Promise}
 */
function mcReassignCliente(clienteId, nuevoCoachId, authCheck) {
  var cli = _cli(clienteId);
  var coach = _coach(nuevoCoachId);
  if (!cli || !coach) throw new Error('Cliente o coach no encontrado');

  if (authCheck && !authCheck()) {
    throw new Error('No tienes permiso para reasignar');
  }

  return mcAssignClientToCoach(clienteId, nuevoCoachId, function () { return true; });
}

// ===== ROLES & AUTHORIZATION =====

/**
 * Cambiar rol de usuario
 * @param {string} userId
 * @param {string} nuevoRol - 'owner' | 'coach' | 'colaborador'
 * @param {function} authCheck - must validate: caller is owner, not self-demotion, not leaving without owner
 * @returns {Promise}
 */
function mcChangeUserRole(userId, nuevoRol, authCheck) {
  var user = _coach(userId); // coaches table tiene owner + coaches
  if (!user) throw new Error('Usuario no encontrado');

  // Security checks (must run on caller side, not backend)
  if (authCheck && !authCheck()) {
    throw new Error('No tienes permiso para cambiar rol');
  }

  // Blocker: backend implementation
  return Promise.reject(new Error('Cambio de rol: requiere backend + validación'));
}

/**
 * Validar que no es auto-despromción
 * @param {string} userId - who's changing
 * @param {string} targetUserId - who's being changed
 * @param {string} nuevoRol
 * @returns {boolean}
 */
function mcCanChangeRole(userId, targetUserId, nuevoRol) {
  if (userId === targetUserId && nuevoRol !== 'owner') {
    console.warn('[MC] Auto-demotion blocked');
    return false; // can't demote yourself
  }
  return true;
}

/**
 * Validar que hay al menos un owner
 * @param {string} organizationId
 * @returns {boolean}
 */
function mcHasOwner(organizationId) {
  var owners = DB.coaches.filter(function (c) { return c.esOwner; });
  return owners.length > 0;
}

// ===== QUERY HELPERS =====

function _coach(id) {
  return (DB.coaches || []).find(function (c) { return String(c.id) === String(id); });
}

function _cli(id) {
  return (DB.clientes || []).find(function (c) { return String(c.id) === String(id); });
}

function _mcIni(name) {
  return (name || '').split(' ').map(function (w) { return w[0]; }).join('').toUpperCase().slice(0, 2);
}
