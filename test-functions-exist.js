const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage();

  console.log('🧪 VERIFICACIÓN DE FUNCIONES\n');
  console.log('📄 Abriendo multicoach.html...');

  await page.goto('http://localhost:8000/multicoach.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  // Verificar funciones globales
  const functions = await page.evaluate(() => {
    return {
      _idGuardar: typeof window._idGuardar === 'function',
      _saveBrand: typeof window._saveBrand === 'function',
      _goCfg: typeof window._goCfg === 'function',
      __go: typeof window.__go === 'function',
      _sbw: typeof window._sbw === 'function',
      MC_OWNER: typeof window.MC_OWNER === 'object',
    };
  });

  console.log('\n✅ Funciones disponibles:');
  for (const [fn, exists] of Object.entries(functions)) {
    console.log(`  ${exists ? '✅' : '❌'} ${fn}`);
  }

  // Verificar que edge function sea alcanzable
  console.log('\n🔍 Verificando acceso a edge function...');
  try {
    const response = await page.evaluate(async () => {
      // Intenta hacer un request a la edge function
      const resp = await fetch('https://[PROJECT_URL]/functions/v1/coach-self-save', {
        method: 'POST',
        body: JSON.stringify({
          id: 'test',
          email: 'test@test.com',
          fields: {}
        })
      }).catch(e => ({ error: e.message }));

      return {
        status: resp.status || 'error',
        statusText: resp.statusText || 'Network error'
      };
    });
    console.log(`  📤 Response: ${response.status} ${response.statusText}`);
  } catch (e) {
    console.log(`  ⚠️  Edge function check: ${e.message}`);
  }

  // Verificar estructura de datos
  console.log('\n📊 Estructura de datos esperada:');
  const structure = await page.evaluate(() => {
    return {
      MC_OWNER: window.MC_OWNER ? {
        id: typeof window.MC_OWNER.id,
        email: typeof window.MC_OWNER.email,
        configuracion: typeof window.MC_OWNER.configuracion,
      } : null,
    };
  });

  console.log('  MC_OWNER:', structure.MC_OWNER ? '✅ Presente' : '❌ No presente');

  // Listar todas las funciones globales que comienzan con _
  const globalFns = await page.evaluate(() => {
    const fns = [];
    for (const key in window) {
      if (key.startsWith('_') && typeof window[key] === 'function') {
        fns.push(key);
      }
    }
    return fns.sort();
  });

  console.log('\n📌 Funciones internas del panel (_* pattern):');
  globalFns.forEach(fn => {
    if (['_idGuardar', '_saveBrand', '_goCfg', '_sbw'].includes(fn)) {
      console.log(`  ✅ ${fn}`);
    }
  });

  console.log('\n' + '='.repeat(60));
  console.log('✅ TEST COMPLETADO');
  console.log('='.repeat(60));

  await browser.close();
})();
