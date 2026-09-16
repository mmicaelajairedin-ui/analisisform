// pw-multicoach.js — LA puerta del DUEÑO a MultiCoach, y la única.
//
// POR QUÉ EXISTE. El destino del owner estaba decidido en SIETE sitios y los
// siete no coincidían:
//
//   login.html / login-en.html · entrar()                → /multicoach.html
//   login.html / login-en.html · Google nativo           → /multicoach.html
//   auth-callback.html (Google/Apple web)                → SIN RAMA → panel-v2
//   registro.html / registro-en.html (activación)        → SIEMPRE panel-v2
//
// O sea que quien entra con Google —que es la mayoría— nunca llegó a
// MultiCoach: caía en el panel del coach. Siete puertas al mismo sitio se
// comprueban las siete, y la regla vive en UN solo fichero: replicarla es cómo
// se desalinean (el mismo motivo por el que `registrar-coach` tuvo que
// rescatar `member_role` a mano después de perderlo).
//
// EL HANDOFF NO ES OPCIONAL. MultiCoach vive en OTRO ORIGEN. La sesión de
// Supabase se guarda en `localStorage`, que está acotado al origen, así que
// NO viaja con el usuario. Por eso hay un código de un solo uso:
// `pathway-handoff` lo emite aquí y `multicoach-exchange-handoff` lo canjea
// allí por una sesión real. Mandar al dueño al otro dominio sin él lo deja
// mirando una pantalla de acceso.
//
// Incluir antes de usarlo:
//   <script src="/pw-multicoach.js"></script>
(function (global) {
  'use strict';

  // EL destino del dueño. Un solo sitio: si esto cambia, cambian las siete
  // puertas a la vez. Ninguna página escribe esta URL a mano.
  var ORIGIN = 'https://pathwayplatforms.com';

  // Quién va a MultiCoach. Copiado TAL CUAL de la condición que login.html ya
  // usaba, para no cambiar de paso quién entra:
  //   rol='owner'                    → siempre.
  //   rol='colaborador' con acceso   → hoy INALCANZABLE: el CHECK de
  //     `usuarios.rol` solo admite admin|coach|cliente|empleado|owner, así que
  //     esa rama no puede darse. Se conserva porque quitarla es una decisión
  //     propia, no un efecto lateral de mover el destino.
  function esDueno(rol, multicoachAccess) {
    var r = String(rol || '').toLowerCase();
    return r === 'owner' || (r === 'colaborador' && !!multicoachAccess);
  }

  // La URL a la que mandar al dueño. Pide el código de handoff; si no lo
  // consigue, manda igual a MultiCoach, donde verá SU pantalla de acceso —
  // dejarlo en Pathway sería dejarlo donde ya sabemos que no va.
  //
  // El fallo NO es silencioso aunque no se pinte: queda en consola con su
  // motivo, que es lo único que tendrá quien lo mire después. Una rama que
  // devuelve algo peor sin registrar nada es un fallo invisible esperando.
  function urlDeEntrada(sbUrl, jwt) {
    var sinSesion = ORIGIN + '/?v=' + Date.now();
    if (!sbUrl || !jwt) {
      console.warn('[multicoach] sin JWT para el handoff: se entra sin sesión');
      return Promise.resolve(sinSesion);
    }
    return fetch(sbUrl + '/functions/v1/pathway-handoff', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + jwt }
    }).then(function (r) {
      if (!r.ok) {
        console.warn('[multicoach] pathway-handoff respondió ' + r.status);
        return sinSesion;
      }
      return r.json().then(function (d) {
        if (d && d.code) return ORIGIN + '/?handoff=' + encodeURIComponent(d.code);
        console.warn('[multicoach] pathway-handoff no devolvió código');
        return sinSesion;
      });
    }).catch(function (e) {
      console.warn('[multicoach] pathway-handoff no respondió:', (e && e.message) || e);
      return sinSesion;
    });
  }

  global.PW_MULTICOACH = {
    ORIGIN: ORIGIN,
    esDueno: esDueno,
    urlDeEntrada: urlDeEntrada
  };
})(window);
