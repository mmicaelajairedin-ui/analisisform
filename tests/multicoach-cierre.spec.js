// @ts-check
/**
 * MultiCoach — recorrido del cierre del Carril A.
 *
 * POR QUE ESTE TEST. La suite que ya existia comprobaba que cada handler
 * apuntara a una funcion existente y que los assets estuvieran en disco. Eso
 * daba verde a pantallas que no se podian abrir (Programas caia en un toast),
 * a botones que confirmaban sin guardar y a secciones sin ninguna puerta en
 * movil. Este recorrido comprueba lo otro: que se pueda LLEGAR, que la accion
 * HAGA algo y que no aparezcan datos inventados.
 *
 * Corre en modo demo (?demo=1), que no toca la base: es el unico modo que se
 * puede recorrer entero sin una sesion real de dueno. Lo que depende de una red
 * real —persistencia contra Supabase— se verifica aparte, con sesion.
 *
 *   BASE_URL=http://127.0.0.1:8099/ npx playwright test tests/multicoach-cierre.spec.js
 */
const { test, expect } = require('@playwright/test');

const BASE = process.env.BASE_URL;
const MC = (h) => `${BASE}multicoach.html?demo=1${h || ''}`;

// Las secciones que forman el producto. Si una entra al menu, entra aqui.
const SECCIONES = ['dashboard','clientes','coaches','programas','agenda','comunidad','analytics','cobros','config'];

/** Navega por el router y devuelve en que quedo, mas el toast si lo hubo. */
async function ir(page, sec) {
  return page.evaluate(async (s) => {
    const t = document.getElementById('toast');
    if (t) { t.textContent = ''; t.classList.remove('on'); }
    window.__go(s);
    await new Promise(r => setTimeout(r, 320));
    return { sec: window._sec, toast: ((t && t.textContent) || '').trim(), hash: location.hash };
  }, sec);
}

test.describe('MultiCoach · entrada y navegacion', () => {
  test('ninguna seccion del menu termina en "proximamente"', async ({ page }) => {
    await page.goto(MC(), { waitUntil: 'load' });
    await page.waitForTimeout(900);
    const menu = await page.$$eval('#nav a', a => a.map(x => x.getAttribute('data-s')));
    expect(menu, 'Clientes tiene que estar en el menu lateral').toContain('clientes');
    expect(menu, 'Programas tiene que estar en el menu lateral').toContain('programas');
    for (const s of menu) {
      const r = await ir(page, s);
      expect(r.sec, `__go('${s}') no llego a la seccion`).toBe(s);
      expect(r.toast, `__go('${s}') cayo en un aviso de "etapa proxima"`).not.toMatch(/Etapa próxima|próximamente|en desarrollo/i);
    }
  });

  test('Configuracion abre desde el menu de cuenta', async ({ page }) => {
    await page.goto(MC(), { waitUntil: 'load' });
    await page.waitForTimeout(900);
    const r = await page.evaluate(async () => {
      window.pwCfgGo('brand');
      await new Promise(r => setTimeout(r, 320));
      return { sec: window._sec, h1: (document.querySelector('#vscroll h1') || {}).textContent || '' };
    });
    expect(r.sec).toBe('config');
    expect(r.h1).toContain('Configuración');
  });

  test('los enlaces profundos abren su seccion y el boton atras funciona', async ({ page }) => {
    await page.goto(MC('#analytics'), { waitUntil: 'load' });
    await page.waitForTimeout(1000);
    expect(await page.evaluate(() => window._sec)).toBe('analytics');
    await ir(page, 'agenda');
    expect(await page.evaluate(() => location.hash)).toBe('#agenda');
    await page.goBack();
    await page.waitForTimeout(350);
    expect(await page.evaluate(() => window._sec)).toBe('analytics');
  });
});

test.describe('MultiCoach · movil', () => {
  test.use({ viewport: { width: 390, height: 780 } });

  test('toda seccion es alcanzable con el menu lateral oculto', async ({ page }) => {
    await page.goto(MC(), { waitUntil: 'load' });
    await page.waitForTimeout(900);
    await expect(page.locator('.side')).toBeHidden();
    await expect(page.locator('#mc-bnav')).toBeVisible();

    const barra = await page.$$eval('#mc-bnav a', a => a.map(x => x.getAttribute('data-s') || 'mas'));
    await page.click('#mc-bnav a[data-more]');
    await expect(page.locator('#mc-msheet')).toBeVisible();
    const hoja = await page.$$eval('#mc-msheet a', a => a.map(x => x.getAttribute('data-s')));

    const alcanzable = new Set([...barra.filter(x => x !== 'mas'), ...hoja]);
    for (const s of [...SECCIONES, 'canal']) {
      expect(alcanzable.has(s), `"${s}" no tiene ninguna puerta en movil`).toBe(true);
    }
    await page.click('#mc-msheet a[data-s="analytics"]');
    await page.waitForTimeout(350);
    expect(await page.evaluate(() => window._sec)).toBe('analytics');
    await expect(page.locator('#mc-msheet')).toBeHidden();
  });
});

test.describe('MultiCoach · Programas', () => {
  test('crear, abrir la ficha, editar y eliminar', async ({ page }) => {
    await page.goto(MC('#programas'), { waitUntil: 'load' });
    await page.waitForTimeout(1000);

    expect(await page.evaluate(() => typeof window.MOCK_PROGRAMS),
      'MOCK_PROGRAMS volvio: una red sin programas es una lista vacia, no una de ejemplo').toBe('undefined');

    const n0 = await page.evaluate(() => (window.MC_PROGS || []).length);
    await page.evaluate(() => window._progNuevo());
    await page.waitForTimeout(250);
    await page.fill('#pg-n', 'Programa de prueba');
    await page.fill('#pg-d', '6');
    await page.click('#__mo');
    await page.waitForTimeout(350);
    expect(await page.evaluate(() => (window.MC_PROGS || []).length)).toBe(n0 + 1);
    await expect(page.locator('#plist')).toContainText('Programa de prueba');

    await page.evaluate(() => window._progAbrir((window.MC_PROGS || []).find(p => p.nombre === 'Programa de prueba').id));
    await page.waitForTimeout(300);
    const ficha = page.locator('#vscroll');
    await expect(ficha, '"Ver detalles" tiene que abrir la ficha, no un aviso').toContainText('Datos del programa');
    await expect(ficha, 'la duracion se guarda en semanas (entero), no como texto libre').toContainText('6 semanas');
    await expect(ficha, 'la ficha lista los coaches del programa').toContainText('Coaches del programa');
    await expect(ficha).toContainText('Volver a Programas');

    await page.evaluate(() => window._progEditar((window.MC_PROGS || []).find(p => p.nombre === 'Programa de prueba').id));
    await page.waitForTimeout(250);
    await page.fill('#pg-n', 'Programa editado');
    await page.click('#__mo');
    await page.waitForTimeout(350);
    await expect(ficha).toContainText('Programa editado');

    await page.evaluate(() => window._progBorrar((window.MC_PROGS || []).find(p => p.nombre === 'Programa editado').id));
    await page.waitForTimeout(250);
    await page.click('#__mo');
    await page.waitForTimeout(350);
    expect(await page.evaluate(() => (window.MC_PROGS || []).length)).toBe(n0);
  });

  test('las escrituras van acotadas por org_id ademas de por la RLS', async ({ page }) => {
    await page.goto(MC(), { waitUntil: 'load' });
    await page.waitForTimeout(600);
    for (const fn of ['_progEditar', '_progBorrar', '_progQuitarCoach']) {
      const src = await page.evaluate((f) => window[f].toString().replace(/\s/g, ''), fn);
      expect(src, `${fn} perdio el filtro por org_id`).toContain("org_id=eq.'+encodeURIComponent(MC_ORG.id)");
    }
  });

  // E · F · G — el esquema real, y solo ese.
  test('Programas habla con mc_programas y mc_programa_coaches, nunca con `programs`', async ({ page }) => {
    await page.goto(MC(), { waitUntil: 'load' });
    await page.waitForTimeout(600);
    const fuentes = await page.evaluate(() => ({
      url: window._progUrl(''),
      urlCoach: window._progCoachUrl(''),
      cargar: window.loadPrograms.toString(),
      sumar: window._progSumarCoach.toString(),
      form: window._progLeerForm.toString(),
    }));
    // E
    expect(fuentes.url, 'Programas tiene que leer/escribir en mc_programas').toContain('/rest/v1/mc_programas');
    // F
    expect(fuentes.urlCoach, 'la asignacion de coaches vive en mc_programa_coaches').toContain('/rest/v1/mc_programa_coaches');
    expect(fuentes.sumar).toContain('programa_id');
    expect(fuentes.sumar).toContain('usuario_id');
    // G — el diseno muerto no vuelve
    for (const [k, v] of Object.entries(fuentes)) {
      expect(v, `${k} vuelve a apuntar a la tabla \`programs\`, que no existe en produccion`).not.toMatch(/rest\/v1\/programs\b/);
    }
    // Nombres reales de columna, sin inventos
    expect(fuentes.form, 'el alta usa `nombre`, no `name`').toContain('nombre:');
    expect(fuentes.form, 'la duracion es duracion_semanas (entero)').toContain('duracion_semanas');
    expect(fuentes.form, 'mc_programas no tiene `completion`').not.toContain('completion');
    expect(fuentes.form, 'mc_programas no tiene `clients`').not.toContain('clients:');
  });
});

test.describe('MultiCoach · permisos del colaborador', () => {
  test('la pestana Acceso escribe mc_permisos y el menu la obedece', async ({ page }) => {
    await page.goto(MC('#coaches'), { waitUntil: 'load' });
    await page.waitForTimeout(1000);
    await page.evaluate(() => {
      window._curCoach = (window.DB.coaches.find(c => !c.esOwner) || window.DB.coaches[0]).id;
      window._goCoachTab('acceso');
    });
    await page.waitForTimeout(300);

    await expect(page.locator('#vscroll')).toContainText('Acceso a MultiCoach');
    expect(await page.$$eval('#vscroll .cp-switch[data-g]', e => e.length),
      'tienen que estar los 7 modulos').toBe(7);

    // El contrato que se manda es el que valida editar-coach-red.
    const src = await page.evaluate(() => window._mcAccSave.toString().replace(/\s/g, ''));
    expect(src).toContain('functions/v1/editar-coach-red');
    expect(src).toContain('mc_permisos:{v:1,org_id:');
    expect(src, 'la tabla colaborador_permisos ya no es fuente de verdad').not.toContain('colaborador_permisos');

    // Quitar uno deja una lista concreta, no "todo".
    await page.click('#vscroll .cp-switch[data-g="cobros"]');
    await page.waitForTimeout(250);
    const sel = await page.evaluate(() => window._mcAccSel);
    expect(Array.isArray(sel)).toBe(true);
    expect(sel).not.toContain('cobros');
    expect(sel.length).toBe(6);

    // Y el menu, en escritorio y en movil, obedece esa lista.
    await page.evaluate(() => { window.MC_USER_PERMISOS = ['clientes', 'agenda']; window._mcUpdateNavPermisos(); });
    await page.waitForTimeout(200);
    const lateral = await page.$$eval('#nav a', a => a.filter(x => x.style.display !== 'none').map(x => x.getAttribute('data-s')));
    expect(lateral).toContain('clientes');
    expect(lateral).toContain('agenda');
    expect(lateral).not.toContain('cobros');
    const hoja = await page.$$eval('#mc-msheet a', a => a.filter(x => x.style.display !== 'none').map(x => x.getAttribute('data-s')));
    expect(hoja, 'la hoja movil tiene que filtrar igual que el menu').not.toContain('analytics');
  });
});

test.describe('MultiCoach · honestidad de la interfaz', () => {
  test('los adjuntos no dicen "guardado" cuando solo estan en memoria', async ({ page }) => {
    await page.goto(MC(), { waitUntil: 'load' });
    await page.waitForTimeout(600);
    const src = await page.evaluate(() => window._mcAdjToast.toString());
    expect(src, 'en una red real el aviso tiene que decir que es una vista previa').toContain('vista previa');
  });

  test('las notas del cliente van a una edge function que existe', async ({ page }) => {
    await page.goto(MC(), { waitUntil: 'load' });
    await page.waitForTimeout(600);
    // Sin comentarios: el codigo explica en un comentario a que funcion llamaba
    // antes, y eso no es una llamada. Se mira lo que se ejecuta.
    const src = await page.evaluate(() =>
      window._cliSaveNotas.toString().replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, ''));
    expect(src).toContain('functions/v1/editar-cliente-red');
    expect(src, 'guardar-notas-cliente no existe en supabase/functions').not.toContain('functions/v1/guardar-notas-cliente');
  });

  test('no hay errores de JS al recorrer todas las secciones', async ({ page }) => {
    const errores = [];
    page.on('pageerror', e => errores.push(e.message));
    await page.goto(MC(), { waitUntil: 'load' });
    await page.waitForTimeout(900);
    for (const s of SECCIONES) await ir(page, s);
    expect(errores, errores.join(' | ')).toHaveLength(0);
  });
});

/**
 * El nicho financiero se reconvirtio a Life en main (sep-2026): `pathway-fin-cliente.html`
 * dejo de existir. MultiCoach no estaba en la lista de archivos que se revisaron al
 * renombrarlo, asi que su router de nicho seguia mandando al portal borrado y su
 * `mcNichoKey` no reconocia `life` (caia en `carrera` sin avisar). Esto lo fija.
 */
test.describe('MultiCoach · nicho Life', () => {
  test('mcNichoKey reconoce life y no queda ninguna ruta al portal borrado', async ({ page }) => {
    await page.goto(MC(), { waitUntil: 'load' });
    await page.waitForTimeout(900);
    const r = await page.evaluate(() => ({
      life: window.mcNichoKey('life'),
      fitness: window.mcNichoKey('fitness'),
      carrera: window.mcNichoKey('carrera'),
      vacio: window.mcNichoKey(''),
      financieroViejo: window.mcNichoKey('financiero'),
      hayPlantilla: !!(window.MCN && window.MCN.life) && !!(window.MCDET && window.MCDET.life),
      hayFinanzas: !!(window.MCN && window.MCN.finanzas),
    }));
    expect(r.life).toBe('life');
    expect(r.fitness).toBe('fitness');
    expect(r.carrera).toBe('carrera');
    expect(r.vacio).toBe('carrera');
    // main borro el nicho 'financiero': ya no se le inventa compatibilidad.
    expect(r.financieroViejo).toBe('carrera');
    // Sin la clave `life`, NM()/DET() devuelven undefined y el panel del dueno no arranca.
    expect(r.hayPlantilla).toBe(true);
    expect(r.hayFinanzas).toBe(false);

    const src = await (await fetch(`${BASE}multicoach.html`)).text();
    expect(src).not.toMatch(/pathway-fin-cliente\.html/);
    expect(src).toMatch(/pathway-life-cliente\.html/);
  });

  test('el portal del cliente Life abre /pathway-life-cliente.html', async ({ page }) => {
    await page.goto(MC(), { waitUntil: 'load' });
    await page.waitForTimeout(900);
    const urls = await page.evaluate(() => {
      const k = { email: 'ana@example.com' }, prev = window.MC_N, out = {};
      ['fitness', 'carrera', 'life'].forEach(n => { window.MC_N = n; out[n] = window._mcPortalUrl(k); });
      window.MC_N = prev;
      return out;
    });
    expect(urls.life).toContain('/pathway-life-cliente.html');
    expect(urls.life).toContain('coach_view=ana%40example.com');
    // Los otros dos nichos no se rompieron al cambiar la rama del medio.
    expect(urls.fitness).toContain('/pathway-fit-cliente.html');
    expect(urls.carrera).toContain('/cliente.html');
  });

  test('la red Life no habla de asesores ni de finanzas en ninguna seccion', async ({ page }) => {
    const errores = [];
    page.on('pageerror', e => errores.push(e.message));
    await page.goto(MC('&nicho=life'), { waitUntil: 'load' });
    await page.waitForTimeout(900);
    expect(await page.evaluate(() => window.MC_N)).toBe('life');
    for (const s of SECCIONES) await ir(page, s);
    expect(errores, errores.join(' | ')).toHaveLength(0);
    const txt = await page.evaluate(() => document.body.innerText);
    expect(txt).not.toMatch(/asesor/i);
    expect(txt).not.toMatch(/presupuesto|deuda|invers/i);
  });
});

/**
 * FASE 2 — los permisos existian pero solo dentro de Equipo > (abrir persona) >
 * pestana Acceso. En Configuracion, que es donde se los busca, no habia nada:
 * de ahi el "no me deja cambiar los permisos". Ahora Configuracion tiene su
 * propia seccion, sobre el MISMO `mc_permisos` (no una tabla nueva).
 */
test.describe('MultiCoach · permisos desde Configuracion', () => {
  test('Configuracion tiene una seccion Permisos y edita el acceso real', async ({ page }) => {
    const errores = [];
    page.on('pageerror', e => errores.push(e.message));
    await page.goto(MC(), { waitUntil: 'load' });
    await page.waitForTimeout(900);
    await ir(page, 'config');

    const secciones = await page.$$eval('.cp-cfg-nav-item', els => els.map(e => e.innerText.trim().split('\n')[0]));
    expect(secciones, secciones.join('|')).toContain('Permisos');

    await page.evaluate(() => window._goCfg('permisos'));
    await page.waitForTimeout(350);

    // Lista a las personas de la red (nunca al propio dueno: no se autolimita).
    const miembros = await page.$$eval('.mc-perm-grid nav .cp-cfg-nav-item', els => els.map(e => e.dataset.id));
    expect(miembros.length).toBeGreaterThan(0);
    const owner = await page.evaluate(() => (window.DB.coaches || []).filter(c => c.esOwner).map(c => c.id));
    owner.forEach(id => expect(miembros).not.toContain(id));

    // El toggle responde y NO saca al dueno de la pantalla.
    const antes = await page.$$eval('.cp-toggle .cp-switch', els => els.map(e => e.dataset.g + '=' + e.classList.contains('is-on')));
    await page.click('.cp-toggle .cp-switch[data-g="cobros"]');
    await page.waitForTimeout(300);
    const despues = await page.$$eval('.cp-toggle .cp-switch', els => els.map(e => e.dataset.g + '=' + e.classList.contains('is-on')));
    expect(despues).not.toEqual(antes);
    expect(await page.evaluate(() => window._cfgSec)).toBe('permisos');

    // Cambiar de persona reengancha la seleccion a ESA persona.
    if (miembros[1]) {
      await page.click(`.mc-perm-grid nav .cp-cfg-nav-item[data-id="${miembros[1]}"]`);
      await page.waitForTimeout(300);
      expect(await page.evaluate(() => window._mcAccFor)).toBe(miembros[1]);
    }
    expect(errores, errores.join(' | ')).toHaveLength(0);
  });

  test('la pantalla escribe mc_permisos, no una tabla nueva', async ({ page }) => {
    const src = await (await fetch(`${BASE}multicoach.html`)).text();
    const sinComentarios = src.replace(/^\s*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
    expect(sinComentarios).toMatch(/_cfgPermisos/);
    expect(sinComentarios).toMatch(/mc_permisos/);
    // Las capacidades de Pathway del lateral son OTRA cosa y ya no se anuncian
    // como si fueran el acceso a MultiCoach.
    expect(sinComentarios).not.toMatch(/A qué le das acceso/);
    expect(sinComentarios).toMatch(/Capacidades en Pathway/);
    expect(sinComentarios).not.toMatch(/colaborador_permisos/);
  });
});

/**
 * FASE 2 — rendimiento. La tipografia se cargaba con @import dentro del <style>:
 * el navegador no la descubria hasta parsear el CSS inline y hasta que no
 * resolvia NO pintaba nada. Medido con el CDN de fuentes lento: 12,8 s en blanco.
 */
test.describe('MultiCoach · rendimiento', () => {
  test('la tipografia no bloquea el primer render', async ({ page }) => {
    const src = await (await fetch(`${BASE}multicoach.html`)).text();
    expect(src).not.toMatch(/@import url\("https:\/\/fonts\.googleapis/);
    expect(src).toMatch(/rel="preconnect" href="https:\/\/fonts\.googleapis\.com"/);
    expect(src).toMatch(/media="print" onload="this\.media='all'/);
  });

  test('el dashboard del dueno tiene estilo propio (no queda markup sin CSS)', async ({ page }) => {
    await page.goto(MC(), { waitUntil: 'load' });
    await page.waitForTimeout(900);
    // Un <button> sin CSS no es flex y no tiene padding: asi se salia el
    // subtitulo de su caja en los cuatro atajos del dashboard.
    const btn = await page.evaluate(() => {
      const b = document.querySelector('.action-btn');
      if (!b) return null;
      const cs = getComputedStyle(b);
      const d = b.getBoundingClientRect(), t = b.querySelector('.action-btn-desc').getBoundingClientRect();
      return { display: cs.display, pad: parseInt(cs.paddingTop, 10), desbordado: t.bottom > d.bottom + 1 };
    });
    expect(btn).not.toBeNull();
    expect(btn.display).toBe('flex');
    expect(btn.pad).toBeGreaterThan(0);
    expect(btn.desbordado, 'el subtitulo se sale del boton').toBe(false);
    // Los recuadros de cabecera dejaron de tener fondo pintado a mano.
    const tinte = await page.evaluate(() => {
      const t = document.querySelector('.mc-hero-tile');
      return t ? getComputedStyle(t).backgroundColor : null;
    });
    expect(tinte).not.toMatch(/82,\s*183,\s*136/);
  });
});

/**
 * FASE 2 — Comunidad. El titulo del post existia en el formulario y en la base
 * (`posts_red.titulo`), pero al publicar se metia dentro del cuerpo como
 * '<b>…</b><br>' y nunca se enviaba en su campo: el feed no podia darle
 * jerarquia y todo se leia como un bloque plano.
 */
test.describe('MultiCoach · Comunidad visual', () => {
  test('el post publica titulo y destacado en sus propios campos', async ({ page }) => {
    // OJO: aqui NO se quitan comentarios. Un `/*` de CSS emparejaba con un `*/`
    // muy posterior y el filtro se llevaba por delante el 20% del fichero, este
    // bloque incluido. Estos patrones son de codigo y no aparecen en prosa.
    const src = await (await fetch(`${BASE}multicoach.html`)).text();
    // Se envia `titulo` aparte y `destacado` dentro de `data` (jsonb que ya existe).
    expect(src).toMatch(/action:'publish',titulo:ti/);
    expect(src).toMatch(/data:\{destacado:dest\}/);
    // Y ya no se incrusta en el cuerpo al publicar.
    expect(src).not.toMatch(/body\+='<b>'\+_mcEsc\(ti\)/);
    // Ninguna tabla nueva: sigue siendo posts_red via comunidad-red.
    expect(src).not.toMatch(/rest\/v1\/posts_red/);
    expect(src).toMatch(/functions\/v1\/comunidad-red/);
  });

  test('el feed da jerarquia al titulo y destaca a ancho completo', async ({ page }) => {
    await page.goto(MC(), { waitUntil: 'load' });
    await page.waitForTimeout(900);
    await ir(page, 'comunidad');
    await page.waitForTimeout(500);
    const cards = await page.$$eval('.revista .post', els => els.map(e => ({
      ti: (e.querySelector('.post-ti') || {}).textContent || '',
      dest: e.classList.contains('is-dest'),
      badge: !!e.querySelector('.post-dest'),
    })));
    expect(cards.length).toBeGreaterThan(0);
    expect(cards.some(c => c.ti.trim().length > 0), 'ningun post muestra titulo').toBe(true);
    const d = cards.filter(c => c.dest);
    expect(d.length, 'no hay ningun destacado').toBeGreaterThan(0);
    d.forEach(c => expect(c.badge).toBe(true));
    // El destacado ocupa toda la fila.
    const ancho = await page.evaluate(() => {
      const g = document.querySelector('.revista'), d = document.querySelector('.revista .post.is-dest');
      if (!g || !d) return null;
      return Math.round(d.getBoundingClientRect().width) >= Math.round(g.getBoundingClientRect().width) - 2;
    });
    expect(ancho).toBe(true);
    // El titulo se lee en la serif, no en el mismo cuerpo que el texto.
    const fuente = await page.evaluate(() => {
      const t = document.querySelector('.revista .post-ti');
      return t ? getComputedStyle(t).fontFamily : '';
    });
    expect(fuente.toLowerCase()).toMatch(/fraunces|georgia|serif/);
  });
});

/**
 * FASE 2 — decision 8: `owner-settings.html` es del carril C retirado y ofrecia
 * "Conectar" para Calendly, Stripe y Zapier sin ningun backend. Sale de
 * circulacion sin borrar el fichero.
 */
test.describe('MultiCoach · integraciones honestas', () => {
  test('owner-settings no es alcanzable y no ofrece conexiones falsas', async ({ page }) => {
    const redirects = await (await fetch(`${BASE}_redirects`)).text();
    expect(redirects).toMatch(/\/owner-settings\.html\s+\/multicoach\.html#config\s+301/);
    const src = await (await fetch(`${BASE}owner-settings.html`)).text();
    expect(src).toMatch(/CARRIL C RETIRADO/);
    expect(src).toMatch(/location\.replace\('\/multicoach\.html#config'\)/);
    expect(src).toMatch(/name="robots" content="noindex/);
  });

  test('MultiCoach no promete integraciones que no existen', async ({ page }) => {
    const src = await (await fetch(`${BASE}multicoach.html`)).text();
    const sinComentarios = src.replace(/^\s*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
    for (const falsa of ['Zapier', 'Mailchimp', 'HubSpot']) {
      expect(sinComentarios, `MultiCoach anuncia ${falsa}`).not.toContain(falsa);
    }
  });
});
