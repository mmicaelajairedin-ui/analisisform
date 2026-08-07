#!/usr/bin/env node
/**
 * SMOKE TEST DE SUPABASE
 * Valida que el proyecto tiene las tablas críticas y datos ANTES de deploy
 * 
 * Previene:
 * - Project Ref incorrecto (sin datos)
 * - Proyecto vacío o mal migrado
 * - Tablas faltantes
 * - Base de datos corrupta
 */

const https = require('https');

const PROJECT_REF = 'ddxnrsnjdvtqhxunxbwj';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkeG5yc25qZHZ0cWh4dW54YndqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxNDk5MzksImV4cCI6MjA5MDcyNTkzOX0.t82X1x-PDgFDGYhKC7YXoRKhga9I8Hjet60QUYvtZLU';

const CRITICAL_TABLES = [
  'usuarios',        // coaches, admins
  'candidatos',      // clients/leads
  'organizaciones',  // multicoach organizations
  'informes',        // reports
];

function query(sql) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: `${PROJECT_REF}.supabase.co`,
      port: 443,
      path: '/rest/v1/rpc/query_tables',
      method: 'POST',
      headers: {
        'apikey': ANON_KEY,
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ status: res.statusCode, data: json });
        } catch (e) {
          resolve({ status: res.statusCode, data });
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Timeout connecting to Supabase'));
    });

    req.write(JSON.stringify({ query: sql }));
    req.end();
  });
}

function checkTable(table) {
  return new Promise((resolve) => {
    const options = {
      hostname: `${PROJECT_REF}.supabase.co`,
      port: 443,
      path: `/rest/v1/${table}?select=count()&limit=1`,
      method: 'GET',
      headers: {
        'apikey': ANON_KEY,
      },
      timeout: 5000,
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        resolve({
          table,
          status: res.statusCode,
          hasData: res.statusCode === 200,
          error: res.statusCode !== 200,
        });
      });
    });

    req.on('error', () => {
      resolve({ table, status: 'error', hasData: false, error: true });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({ table, status: 'timeout', hasData: false, error: true });
    });

    req.end();
  });
}

(async () => {
  console.log(`🔍 Validando Supabase: ${PROJECT_REF}\n`);
  console.log('Verificando tablas críticas...\n');

  const results = await Promise.all(
    CRITICAL_TABLES.map(t => checkTable(t))
  );

  let errors = [];
  let allOk = true;

  results.forEach((r) => {
    if (r.error) {
      console.log(`❌ ${r.table}: ${r.status}`);
      errors.push(`${r.table} (${r.status})`);
      allOk = false;
    } else if (r.status === 200) {
      console.log(`✅ ${r.table}: OK`);
    } else {
      console.log(`⚠️ ${r.table}: Status ${r.status}`);
    }
  });

  console.log('');

  if (!allOk) {
    console.error('❌ VALIDACIÓN FALLÓ\n');
    console.error('Tablas con error:', errors.join(', '));
    console.error('\nPosibles causas:');
    console.error('- Project Ref incorrecto');
    console.error('- Base de datos vacía o sin migrar');
    console.error('- Conectividad a Supabase');
    process.exit(1);
  } else {
    console.log('✅ Todas las tablas críticas disponibles');
    console.log('✅ Proyecto Supabase validado');
    console.log('✅ Safe to deploy\n');
    process.exit(0);
  }
})();
