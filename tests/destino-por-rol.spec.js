// A DONDE VA CADA PERSONA DESPUES DE AUTENTICARSE — el contrato, ejercido.
//
// Existe por P0-5. El defecto que cierra estaba medido, no supuesto:
// `registro.html` terminaba SIEMPRE en `panel-v2.html` sin mirar el rol, asi
// que el unico trabajo que hacia falta para que un colaborador aterrizara en
// MultiCoach —`agregar-coach-red` guarda `member_role`, `registrar-coach` v24
// lo conserva— no lo ejercia nadie: ese camino se salta el login, que era el
// unico que enrutaba.
//
// Y habia un segundo defecto debajo, que hacia que la regla fallara TAMBIEN en
// el login. Medido contra produccion el 2026-09-15:
//
//   rol='colaborador'                                ->  0 filas
//   rol='coach' + configuracion.member_role='colab'  ->  2 filas, las dos con org
//
// O sea que la rama `usuario.rol === 'colaborador'` de los dos login no
// matcheaba a nadie. El colaborador se reconoce por la BANDERA.
//
// Se ejerce el modulo de verdad en el navegador, no se leen cadenas del fuente:
// un enrutador es justo lo que no se puede dar por bueno mirandolo.
const { test, expect } = require('@playwright/test');

/** Carga `pw-destino.js` en una pagina en blanco y devuelve esa pagina. */
async function conModulo(page) {
  await page.goto('/login.html');
  await page.waitForFunction(() => typeof window.PWDEST !== 'undefined', { timeout: 15000 });
  return page;
}

const evaluar = (page, usuario, opts) =>
  page.evaluate(([u, o]) => window.PWDEST.destino(u, o || {}), [usuario, opts || {}]);

const rolDe = (page, usuario) => page.evaluate((u) => window.PWDEST.rolEfectivo(u), usuario);

test.describe('destino por rol — una sola fuente', () => {
  test('el modulo se carga en las CUATRO puertas', async ({ page }) => {
    // Si una de ellas deja de cargarlo, esa puerta vuelve a decidir por su
    // cuenta, que es exactamente como se separaron las reglas la vez anterior.
    for (const p of ['/login.html', '/login-en.html', '/registro.html', '/registro-en.html']) {
      await page.goto(p);
      const hay = await page.evaluate(() => typeof window.PWDEST !== 'undefined');
      expect(hay, `${p} no carga pw-destino.js`).toBe(true);
    }
  });

  test('owner → multicoach.html', async ({ page }) => {
    await conModulo(page);
    const d = await evaluar(page, { rol: 'owner', org_id: 'org-1', email: 'o@x.com' });
    expect(d.url).toContain('/multicoach.html');
  });

  test('coach → panel-v2.html', async ({ page }) => {
    await conModulo(page);
    const d = await evaluar(page, { rol: 'coach', org_id: 'org-1', email: 'c@x.com' });
    expect(d.url).toContain('/panel-v2.html');
    expect(d.url).not.toContain('multicoach');
  });

  test('COLABORADOR POR BANDERA → multicoach.html (el caso que fallaba)', async ({ page }) => {
    await conModulo(page);
    // Esta es la forma REAL en produccion: rol='coach' + member_role.
    const usuario = {
      rol: 'coach',
      org_id: 'org-1',
      email: 'k@x.com',
      configuracion: { member_role: 'colaborador', es_coach_red: true },
    };
    expect(await rolDe(page, usuario)).toBe('colaborador');
    const d = await evaluar(page, usuario);
    expect(d.url).toContain('/multicoach.html');
  });

  test('…y tambien sin org_id, por la marca que deja el alta de la red', async ({ page }) => {
    await conModulo(page);
    // `registrar-coach` no devuelve `org_id` en su respuesta (su `safeRow` no
    // lo incluye), asi que el aterrizaje no puede depender de el.
    const d = await evaluar(page, {
      rol: 'coach',
      email: 'k@x.com',
      configuracion: { member_role: 'colaborador', es_coach_red: true },
    });
    expect(d.url).toContain('/multicoach.html');
  });

  test('colaborador con rol heredado → multicoach.html', async ({ page }) => {
    await conModulo(page);
    const d = await evaluar(page, { rol: 'colaborador', org_id: 'org-1', email: 'v@x.com' });
    expect(d.url).toContain('/multicoach.html');
  });

  test('un coach NO se convierte en colaborador por tener la marca de red', async ({ page }) => {
    await conModulo(page);
    const usuario = {
      rol: 'coach',
      org_id: 'org-1',
      email: 'c@x.com',
      configuracion: { member_role: 'coach', es_coach_red: true },
    };
    expect(await rolDe(page, usuario)).toBe('coach');
    expect((await evaluar(page, usuario)).url).toContain('/panel-v2.html');
  });

  test('empleado → empleado.html · admin → panel-v2.html', async ({ page }) => {
    await conModulo(page);
    expect((await evaluar(page, { rol: 'empleado', email: 'e@x.com' })).url).toContain('/empleado.html');
    expect((await evaluar(page, { rol: 'admin', email: 'a@x.com' })).url).toContain('/panel-v2.html');
  });

  test('cliente: cada nicho a su portal, y el email viaja con el', async ({ page }) => {
    await conModulo(page);
    const fit = await evaluar(page, { rol: 'cliente', email: 'F@X.com', configuracion: { coach_type: 'fitness' } });
    expect(fit.url).toContain('/pathway-fit-cliente.html');
    expect(fit.url).toContain('email=f%40x.com');

    const life = await evaluar(page, { rol: 'cliente', email: 'l@x.com', configuracion: { coach_type: 'life' } });
    expect(life.url).toContain('/pathway-life-cliente.html');

    // Sin nicho declarado hay que preguntarlo: la url todavia no es definitiva.
    const carrera = await evaluar(page, { rol: 'cliente', email: 'c@x.com', configuracion: {} });
    expect(carrera.nicho).toBe('?');
  });

  test('sin nicho declarado, el portal sale de lo que responda la busqueda', async ({ page }) => {
    await conModulo(page);
    const urls = await page.evaluate(async () => {
      const u = { rol: 'cliente', email: 'c@x.com', configuracion: {} };
      return {
        fit: await window.PWDEST.destinoAsync(u, { buscarNicho: async () => 'fitness' }),
        nada: await window.PWDEST.destinoAsync(u, { buscarNicho: async () => null }),
        // Si la consulta revienta, no se deja a nadie sin destino.
        rota: await window.PWDEST.destinoAsync(u, { buscarNicho: async () => { throw new Error('x'); } }),
      };
    });
    expect(urls.fit).toContain('/pathway-fit-cliente.html');
    expect(urls.nada).toContain('/cliente.html');
    expect(urls.rota).toContain('/cliente.html');
  });

  test('un colaborador SIN ninguna seccion no acaba en un MultiCoach vacio', async ({ page }) => {
    await conModulo(page);
    const usuario = {
      rol: 'coach',
      org_id: 'org-1',
      email: 'k@x.com',
      configuracion: { member_role: 'colaborador', es_coach_red: true, mc_permisos: { v: 1, org_id: 'org-1', grants: [] } },
    };
    // Su fila es rol='coach', asi que el panel del coach si le sirve. Dejarlo
    // fuera del producto seria peor que llevarlo a algo que funciona.
    expect((await evaluar(page, usuario)).url).toContain('/panel-v2.html');
  });

  test('sin lista guardada, el colaborador entra: acotar es un acto del dueno', async ({ page }) => {
    await conModulo(page);
    // Misma regla que ya aplicaban login.html y panel-v2: `null` = acceso
    // completo. Un alta recien activada no tiene `mc_permisos` todavia.
    const d = await evaluar(page, {
      rol: 'coach',
      email: 'k@x.com',
      configuracion: { member_role: 'colaborador', es_coach_red: true },
    });
    expect(d.url).toContain('/multicoach.html');
  });

  test('la bienvenida del alta solo va donde existe esa pantalla', async ({ page }) => {
    await conModulo(page);
    const coach = await evaluar(page, { rol: 'coach', email: 'c@x.com' }, { extra: 'welcome=1' });
    expect(coach.url).toContain('welcome=1');

    const colab = await evaluar(
      page,
      { rol: 'coach', email: 'k@x.com', configuracion: { member_role: 'colaborador', es_coach_red: true } },
      { extra: 'welcome=1' },
    );
    expect(colab.url).toContain('/multicoach.html');
    expect(colab.url, 'MultiCoach no tiene pantalla de bienvenida del alta').not.toContain('welcome=1');
  });

  test('toda url lleva el cache-bust, que es lo que evita servir el bundle viejo', async ({ page }) => {
    await conModulo(page);
    for (const u of [
      { rol: 'owner', email: 'o@x.com' },
      { rol: 'coach', email: 'c@x.com' },
      { rol: 'empleado', email: 'e@x.com' },
      { rol: 'cliente', email: 'l@x.com', configuracion: { coach_type: 'life' } },
    ]) {
      expect((await evaluar(page, u)).url).toMatch(/[?&]v=\d+/);
    }
  });
});
