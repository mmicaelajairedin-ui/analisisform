/* ===================================================================
   pw-destino.js — A DONDE VA UNA PERSONA DESPUES DE AUTENTICARSE.
   UNA sola fuente de verdad. No hay otra, y no debe haberla.

   POR QUE EXISTE
   --------------
   La misma decision estaba escrita CUATRO veces: login.html, login-en.html,
   registro.html y registro-en.html. Y no decian lo mismo:

     · Los dos login enrutaban por rol (owner -> multicoach, coach -> panel...).
     · Los dos registro terminaban SIEMPRE en panel-v2.html, sin mirar nada.

   Consecuencia real, comprobada: `agregar-coach-red` guarda el tipo de miembro
   y `registrar-coach` v24 lo CONSERVA al activar la cuenta — justo para que a
   un colaborador se le mande a MultiCoach. Pero el camino de activacion se
   salta el login, que es el unico que enruta, asi que ese trabajo no llegaba a
   ejercerse nunca. Es el patron de `_slugify`: la misma regla copiada en
   varios sitios acaba diciendo cosas distintas.

   EL COLABORADOR NO SE RECONOCE POR `usuarios.rol`
   ------------------------------------------------
   Esto es lo que hacia que la regla fallara incluso en el login. Medido contra
   produccion (2026-09-15):

     rol='colaborador'                               ->  0 filas
     rol='coach' + configuracion.member_role='colab' ->  2 filas, las dos con org

   O sea que HOY todo colaborador lo es por la BANDERA, y la rama
   `usuario.rol === 'colaborador'` de los login no matchea a nadie. Se miran
   las dos: la bandera, que es la convencion viva, y el rol, que se conserva
   por si alguna cuenta antigua lo usa.

   CONTRATO
   --------
     owner        -> /multicoach.html
     colaborador  -> /multicoach.html   (si tiene algun modulo; ver abajo)
     coach, admin -> /panel-v2.html
     empleado     -> /empleado.html
     cliente      -> su portal segun nicho (fitness / life / carrera)

   Sin acceso a MultiCoach, un colaborador cae a /panel-v2.html en vez de
   quedarse fuera: su fila es `rol='coach'`, asi que el panel funciona para el.
   Mandarlo a un MultiCoach sin una sola seccion seria peor.
   =================================================================== */
(function () {
  'use strict';

  /** Los siete modulos de MultiCoach. Espejo de MC_GRANT_DEFS (multicoach.html). */
  var MODULOS = ['clientes', 'coaches', 'programas', 'agenda', 'comunidad', 'analytics', 'cobros'];

  function cfgDe(u) {
    var c = u && u.configuracion;
    return c && typeof c === 'object' && !Array.isArray(c) ? c : {};
  }

  /**
   * Los modulos concedidos, o `null` si el dueno todavia no ha acotado nada.
   * MISMA regla que ya aplicaban login.html y panel-v2: `null` = acceso
   * completo, `[]` = ningun modulo. (MultiCoach en React parte de lo contrario
   * —cero por defecto— porque su contrato de permisos dice eso; aqui se
   * conserva la regla de esta plataforma, que es la que la gente ya tiene.)
   */
  function grantsDe(u) {
    var mp = cfgDe(u).mc_permisos;
    if (!mp || typeof mp !== 'object' || Object.prototype.toString.call(mp.grants) !== '[object Array]') return null;
    return mp.grants.filter(function (g) { return MODULOS.indexOf(g) >= 0; });
  }

  /** Si esta persona entra a MultiCoach. Sin lista guardada, si. */
  function tieneMulticoach(u) {
    var g = grantsDe(u);
    return g === null ? true : g.length > 0;
  }

  /**
   * Pertenece a una red. `org_id` es la senal buena, pero la respuesta de
   * `registrar-coach` no lo trae (su `safeRow` no lo incluye), asi que se
   * acepta tambien la marca que deja `agregar-coach-red` al invitar.
   */
  function enRed(u) {
    if (!u) return false;
    return !!(u.org_id || cfgDe(u).es_coach_red === true);
  }

  /** Colaborador: por la bandera (convencion viva) o por el rol (heredado). */
  function esColaborador(u) {
    if (!u) return false;
    if (('' + (u.rol || '')).toLowerCase() === 'colaborador') return true;
    return cfgDe(u).member_role === 'colaborador' && enRed(u);
  }

  /** El rol con el que se decide el destino. */
  function rolEfectivo(u) {
    var rol = ('' + ((u && u.rol) || '')).toLowerCase();
    if (rol === 'owner') return 'owner';
    if (esColaborador(u)) return 'colaborador';
    if (rol === 'admin') return 'admin';
    if (rol === 'coach') return 'coach';
    if (rol === 'empleado') return 'empleado';
    return 'cliente';
  }

  function qs(base, extra) {
    var v = 'v=' + Date.now();
    return base + '?' + (extra ? extra + '&' : '') + v;
  }

  /**
   * El destino, SIN resolver el nicho del cliente.
   *
   * Devuelve `{ url, nicho }`. Si `nicho` es `'?'`, hay que averiguarlo antes
   * de usar la url: para eso esta `destinoAsync`.
   *
   * opts:
   *   base        · origen ('' = relativo). Los login usan BASE.
   *   extra       · query extra para el panel del coach ('welcome=1' en el alta).
   *   multicoach  · fuerza el acceso a MultiCoach en vez de deducirlo.
   */
  function destino(u, opts) {
    opts = opts || {};
    var base = opts.base || '';
    var rol = rolEfectivo(u);

    if (rol === 'owner') return { url: qs(base + '/multicoach.html'), nicho: null };
    if (rol === 'colaborador') {
      var entra = (opts.multicoach !== undefined) ? !!opts.multicoach : tieneMulticoach(u);
      // Sin ninguna seccion no se le manda a un producto vacio: su fila es
      // rol='coach', asi que el panel del coach si le sirve.
      return { url: qs(base + (entra ? '/multicoach.html' : '/panel-v2.html'), entra ? '' : opts.extra), nicho: null };
    }
    if (rol === 'coach' || rol === 'admin') return { url: qs(base + '/panel-v2.html', opts.extra), nicho: null };
    if (rol === 'empleado') return { url: qs(base + '/empleado.html'), nicho: null };

    // Cliente. El nicho decide el portal, y puede no estar en su configuracion.
    var ct = ('' + (cfgDe(u).coach_type || '')).toLowerCase();
    if (!ct || ct === 'carrera') return { url: urlCliente(base, u, ''), nicho: '?' };
    return { url: urlCliente(base, u, ct), nicho: ct };
  }

  function urlCliente(base, u, nicho) {
    var em = '&email=' + encodeURIComponent(('' + ((u && u.email) || '')).toLowerCase().trim());
    if (nicho === 'fitness') return qs(base + '/pathway-fit-cliente.html') + em;
    if (nicho === 'life') return qs(base + '/pathway-life-cliente.html') + em;
    return qs(base + '/cliente.html');
  }

  /**
   * El destino definitivo. Si es un cliente sin nicho declarado, lo pregunta
   * con `opts.buscarNicho(email)` — que devuelve el nicho o algo falsy.
   *
   * La busqueda va con callback y no con el cliente de Supabase a proposito:
   * este fichero no debe depender de como cada pagina crea su cliente.
   */
  function destinoAsync(u, opts) {
    opts = opts || {};
    var d = destino(u, opts);
    if (d.nicho !== '?' || typeof opts.buscarNicho !== 'function') {
      return Promise.resolve(d.url);
    }
    var email = ('' + ((u && u.email) || '')).toLowerCase().trim();
    return Promise.resolve()
      .then(function () { return opts.buscarNicho(email); })
      .catch(function () { return null; })
      .then(function (n) {
        var ct = ('' + (n || 'carrera')).toLowerCase();
        return urlCliente(opts.base || '', u, ct === 'fitness' || ct === 'life' ? ct : '');
      });
  }

  window.PWDEST = {
    MODULOS: MODULOS,
    grantsDe: grantsDe,
    tieneMulticoach: tieneMulticoach,
    esColaborador: esColaborador,
    rolEfectivo: rolEfectivo,
    destino: destino,
    destinoAsync: destinoAsync,
  };
})();
