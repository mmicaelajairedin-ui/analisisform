const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage();

  console.log('🧪 TEST: Verificar payload de guardado\n');

  // Interceptar requests a edge function
  const requests = [];
  page.on('request', req => {
    if (req.url().includes('coach-self-save')) {
      requests.push({
        url: req.url(),
        method: req.method(),
        headers: Object.fromEntries(req.allHeaders()),
        postData: req.postData()
      });
      console.log(`📤 REQUEST INTERCEPTADO: ${req.method()} ${req.url()}`);
    }
  });

  console.log('📄 Abriendo multicoach.html...');
  await page.goto('http://localhost:8000/multicoach.html', { waitUntil: 'load' });

  // Inyectar MC_OWNER simulando coach autenticado
  console.log('\n🔐 Inyectando MC_OWNER...');
  await page.evaluate(() => {
    window.MC_REAL = true;
    window.MC_OWNER = {
      id: 'coach-test-12345',
      email: 'coach@example.com',
      nombre: 'Coach Test',
      configuracion: {
        negocio: {},
        marca: {}
      }
    };
    console.log('✅ MC_OWNER establecido');
  });

  // Navegar a configuración
  console.log('\n📍 Navegando a Mi Negocio...');
  await page.evaluate(() => {
    if (typeof _goCfg === 'function') {
      _goCfg('negocio');
    }
  });

  await page.waitForTimeout(1000);

  // Preparar datos de negocio
  const negocioPayload = {
    especialidad: 'Life Coach',
    que_haces: 'Ayudo a profesionales en transición',
    a_quien_ayudas: 'Ejecutivos',
    problema: 'Incertidumbre',
    como_trabajas: 'Sesiones 1:1',
    servicios: ['Coaching', 'Mentoría'],
    tono: 'Empático',
    resultados: [],
    cta: {
      texto: 'Agendar sesión',
      url: 'https://calendly.com/coach'
    }
  };

  console.log('\n💾 Inyectando datos en formulario de Negocio...');

  // Inyectar datos directamente y simular guardado
  const saved = await page.evaluate((payload) => {
    // Simular lo que hace _idGuardar
    window.MC_OWNER.configuracion.negocio = payload;

    // Llamar a _idGuardar si existe
    if (typeof _idGuardar === 'function') {
      try {
        _idGuardar();
        return { success: true, method: '_idGuardar' };
      } catch (e) {
        return { success: false, error: e.message, method: '_idGuardar' };
      }
    }

    return { success: false, error: 'Función no encontrada' };
  }, negocioPayload);

  console.log(`  Resultado: ${saved.success ? '✅' : '❌'} ${saved.method}`);
  if (!saved.success) {
    console.log(`  Error: ${saved.error}`);
  }

  // Esperar a que se haga el request
  await page.waitForTimeout(3000);

  // Verificar requests
  console.log('\n📊 RESULTADO DE REQUESTS:\n');

  if (requests.length > 0) {
    console.log(`✅ ${requests.length} request(s) interceptado(s):\n`);

    requests.forEach((req, i) => {
      console.log(`📤 Request ${i + 1}:`);
      console.log(`   URL: ${req.url}`);
      console.log(`   Method: ${req.method}`);

      if (req.postData) {
        try {
          const payload = JSON.parse(req.postData);
          console.log(`   Payload:`);
          console.log(`     - id: ${payload.id || 'N/A'}`);
          console.log(`     - email: ${payload.email || 'N/A'}`);
          console.log(`     - fields: ${Object.keys(payload.fields || {}).join(', ')}`);

          if (payload.fields?.configuracion?.negocio) {
            console.log(`     - Negocio guardado: ✅`);
            console.log(`       - especialidad: ${payload.fields.configuracion.negocio.especialidad}`);
            console.log(`       - que_haces: ${payload.fields.configuracion.negocio.que_haces}`);
          }
        } catch (e) {
          console.log(`   Payload (raw): ${req.postData.substring(0, 200)}`);
        }
      }
      console.log();
    });
  } else {
    console.log('⚠️  No se interceptaron requests a coach-self-save');
    console.log('   Esto puede significar:');
    console.log('   1. Edge function no está deployado');
    console.log('   2. Demo mode está activo (MC_REAL = false)');
    console.log('   3. La función está usando un endpoint diferente');
  }

  // Verificar estado final
  console.log('🔍 Estado final de MC_OWNER:');
  const finalState = await page.evaluate(() => {
    return {
      id: window.MC_OWNER?.id,
      email: window.MC_OWNER?.email,
      negocio: window.MC_OWNER?.configuracion?.negocio || {}
    };
  });

  console.log(`  ID: ${finalState.id}`);
  console.log(`  Email: ${finalState.email}`);
  console.log(`  Negocio campos: ${Object.keys(finalState.negocio).length}`);

  console.log('\n' + '='.repeat(60));
  console.log('✅ TEST COMPLETADO');
  console.log('='.repeat(60));

  await browser.close();
})();
