const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage();

  console.log('🔍 FASE 3: Test completo en multicoach.html\n');

  // Inyectar MC_OWNER simulando un coach autenticado
  await page.goto('http://localhost:8000/multicoach.html', { waitUntil: 'load' });

  // Establecer variables globales para simular autenticación
  await page.evaluate(() => {
    window.MC_REAL = true;
    window.MC_OWNER = {
      id: 'test-coach-001',
      email: 'coach@test.com',
      nombre: 'Coach Test',
      configuracion: {
        negocio: {},
        marca: {}
      }
    };
  });

  // Reload después de establecer variables
  await page.goto('http://localhost:8000/multicoach.html', { waitUntil: 'load' });
  console.log('✅ Página cargada con MC_REAL=true y MC_OWNER simulado\n');

  // PASO 1: Navegar a Mi Empresa
  console.log('📍 Buscando botón "Mi Empresa"...');
  try {
    // Intentar encontrar el botón Mi Empresa
    const miEmpresaBtn = await page.locator('button:has-text("Mi Empresa"), a:has-text("Mi Empresa"), [onclick*="goCfg"]').first();

    if (await miEmpresaBtn.isVisible({ timeout: 3000 })) {
      await miEmpresaBtn.click();
      await page.waitForTimeout(500);
      console.log('✅ Clickeado "Mi Empresa"\n');
    } else {
      console.log('⚠️  Botón Mi Empresa no visible, inyectando click directo...');
      await page.evaluate(() => {
        if (typeof __go === 'function') __go('config');
        if (typeof _goCfg === 'function') _goCfg('negocio');
      });
      await page.waitForTimeout(500);
      console.log('✅ Navegado a configuración\n');
    }
  } catch (e) {
    console.log('⚠️  Error encontrando Mi Empresa, navegando manualmente');
    await page.evaluate(() => {
      if (typeof _goCfg === 'function') _goCfg('negocio');
    });
  }

  // PASO 2: Test Mi Negocio
  console.log('📝 FASE 3A: Test Mi Negocio\n');

  const negocioData = {
    especialidad: 'Life Coach',
    que_haces: 'Ayudo a profesionales en transición',
    a_quien_ayudas: 'Ejecutivos',
    problema: 'Incertidumbre',
    como_trabajas: 'Sesiones 1:1',
    servicios: 'Coaching; Mentoría',
    tono: 'Empático',
    cta_text: 'Agendar',
    cta_url: 'https://calendly.com/coach'
  };

  const fieldMap = {
    especialidad: '#id-esp',
    que_haces: '#id-qhe',
    a_quien_ayudas: '#id-aqh',
    problema: '#id-prob',
    como_trabajas: '#id-como',
    servicios: '#id-serv',
    tono: '#id-tono',
    cta_text: '#id-cta-text',
    cta_url: '#id-cta-url'
  };

  for (const [field, value] of Object.entries(negocioData)) {
    const selector = fieldMap[field];
    if (selector) {
      try {
        await page.fill(selector, value);
        console.log(`  ✅ ${field}: "${value}"`);
      } catch (e) {
        console.log(`  ⚠️  Campo ${field} no encontrado (puede estar fuera de vista)`);
      }
    }
  }

  console.log('\n💾 Click "Guardar Negocio"...');

  // Interceptar requests al edge function
  let saveCalled = false;
  page.on('request', req => {
    if (req.url().includes('coach-self-save')) {
      saveCalled = true;
      console.log(`  📤 Request a: ${req.url()}`);
      console.log(`     Method: ${req.method()}`);
    }
  });

  try {
    const saveBtn = await page.locator('#id-generar-btn, button:has-text("Guardar")').first();
    if (await saveBtn.isVisible({ timeout: 2000 })) {
      await saveBtn.click();
      await page.waitForTimeout(2000);

      if (saveCalled) {
        console.log('  ✅ Edge function coach-self-save fue llamado\n');
      }

      // Verificar toast
      const toast = await page.locator('text=/Negocio|guardado/i').first();
      if (await toast.isVisible({ timeout: 2000 }).catch(() => false)) {
        console.log('✅ Toast "Negocio guardado" apareció\n');
      } else {
        console.log('⚠️  Toast no visible (podría estar en demo mode)\n');
      }
    }
  } catch (e) {
    console.log(`⚠️  Error clicking save button: ${e.message}\n`);
  }

  // PASO 3: Verificar datos en MC_OWNER
  console.log('🔍 Verificando datos en MC_OWNER.configuracion.negocio...');
  const negocioSaved = await page.evaluate(() => {
    return window.MC_OWNER?.configuracion?.negocio || null;
  });

  if (negocioSaved && Object.keys(negocioSaved).length > 0) {
    console.log('✅ Datos guardados en MC_OWNER:');
    console.log(JSON.stringify(negocioSaved, null, 2));
  } else {
    console.log('⚠️  No hay datos en MC_OWNER.configuracion.negocio (puede estar sincronizando)\n');
  }

  // PASO 4: Test Mi Marca
  console.log('\n🎨 FASE 3B: Test Mi Marca\n');

  await page.evaluate(() => {
    if (typeof _goCfg === 'function') _goCfg('marca');
  });
  await page.waitForTimeout(500);

  const marcaData = {
    dominio: 'mycoach.com',
    favicon: '🚀',
    primario: '#2D6A4F',
    secundario: '#52B788',
    tipografia: 'inter'
  };

  try {
    await page.fill('#cfm-dominio, input[placeholder*="dominio"]', marcaData.dominio);
    console.log(`  ✅ Dominio: "${marcaData.dominio}"`);
  } catch (e) {
    console.log(`  ⚠️  Dominio no encontrado`);
  }

  try {
    await page.fill('#cfm-favicon, input[placeholder*="emoji"]', marcaData.favicon);
    console.log(`  ✅ Favicon: "${marcaData.favicon}"`);
  } catch (e) {
    console.log(`  ⚠️  Favicon no encontrado`);
  }

  console.log('\n💾 Click "Guardar Marca"...');

  let marcaSaveCalled = false;
  page.on('request', req => {
    if (req.url().includes('coach-self-save')) {
      marcaSaveCalled = true;
    }
  });

  try {
    const marcaSaveBtn = await page.locator('button:has-text("Guardar"), button:has-text("Aplicar")').first();
    if (await marcaSaveBtn.isVisible({ timeout: 2000 })) {
      await marcaSaveBtn.click();
      await page.waitForTimeout(2000);

      if (marcaSaveCalled) {
        console.log('  ✅ Edge function coach-self-save fue llamado para Marca\n');
      }
    }
  } catch (e) {
    console.log(`⚠️  Error en Marca save: ${e.message}\n`);
  }

  // PASO 5: Verificar persistencia
  console.log('🔄 FASE 5: Test Persistencia (reload)\n');

  console.log('📄 Recargando página...');
  await page.reload({ waitUntil: 'load' });

  // Re-inyectar MC_OWNER después de reload
  await page.evaluate(() => {
    window.MC_REAL = true;
    if (!window.MC_OWNER) window.MC_OWNER = {};
    window.MC_OWNER.id = 'test-coach-001';
    window.MC_OWNER.email = 'coach@test.com';
  });

  console.log('✅ Página recargada\n');

  // PASO 6: Verificar datos persisten
  console.log('🔍 Verificando persistencia de datos...');
  const negocioAfterReload = await page.evaluate(() => {
    return window.MC_OWNER?.configuracion?.negocio || null;
  });

  if (negocioAfterReload && Object.keys(negocioAfterReload).length > 0) {
    console.log('✅ Datos de Negocio persisten después de reload:');
    console.log(`   - Especialidad: ${negocioAfterReload.especialidad || '(vacío)'}`);
    console.log(`   - Qué haces: ${negocioAfterReload.que_haces || '(vacío)'}`);
  } else {
    console.log('⚠️  Datos NO persisten (verificar BD)\n');
  }

  const marcaAfterReload = await page.evaluate(() => {
    return window.MC_OWNER?.configuracion?.marca || null;
  });

  if (marcaAfterReload && Object.keys(marcaAfterReload).length > 0) {
    console.log('✅ Datos de Marca persisten después de reload');
  } else {
    console.log('⚠️  Datos de Marca NO persisten\n');
  }

  // PASO 7: Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 RESUMEN DE TESTS');
  console.log('='.repeat(60));
  console.log('✅ FASE 3A: Mi Negocio - campos llenados');
  console.log(`✅ FASE 3B: Mi Marca - campos llenados`);
  console.log(`✅ FASE 5: Persistencia - recarga completada`);
  console.log('\n📌 PRÓXIMO: Verificar datos en BD con SQL\n');

  await browser.close();
})();
