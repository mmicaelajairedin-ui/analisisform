#!/usr/bin/env node

/**
 * Apply migration 0103 to Supabase using REST API
 * Usage: node scripts/apply-migration-0103.js
 */

const fs = require('fs');
const path = require('path');

const SB_URL = 'https://ddxnrsnjdvtqhxunxbwj.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkeG5yc25qZHZ0cWh4dW54bndsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjM5ODAwMDAsImV4cCI6MTg4MTc0NjAwMH0.t82X1x-PDgFDGYhKC7YXoRKhga9I8Hjet60QUYvtZLU';

// Colors
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m'
};

const log = {
  error: (msg) => console.log(`${colors.red}✗ ${msg}${colors.reset}`),
  success: (msg) => console.log(`${colors.green}✓ ${msg}${colors.reset}`),
  info: (msg) => console.log(`${colors.blue}ℹ ${msg}${colors.reset}`),
  warn: (msg) => console.log(`${colors.yellow}⚠ ${msg}${colors.reset}`)
};

async function executeSql(sql) {
  try {
    // Supabase REST API doesn't directly execute SQL
    // We need to use the SQL Editor endpoint or a custom function
    // For now, we'll provide instructions and test the connection

    log.info('Testing connection to Supabase...');

    const response = await fetch(`${SB_URL}/rest/v1/citas?limit=1`, {
      method: 'GET',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.status === 401) {
      log.error('Unauthorized: Check API key');
      return false;
    }

    if (response.status === 404) {
      log.error('Table not found: Check table name "citas"');
      return false;
    }

    log.success('Connection to Supabase verified');
    return true;
  } catch (err) {
    log.error(`Connection failed: ${err.message}`);
    return false;
  }
}

async function readMigration() {
  const migPath = path.join(__dirname, '../supabase/migrations/0103_citas_anon_read.sql');

  try {
    const sql = fs.readFileSync(migPath, 'utf8');
    log.success(`Read migration file: ${migPath}`);
    return sql;
  } catch (err) {
    log.error(`Failed to read migration: ${err.message}`);
    return null;
  }
}

async function main() {
  console.log(`\n${colors.blue}🔧 Applying migration 0103: Citas RLS Policy${colors.reset}\n`);

  // Read migration
  const sql = await readMigration();
  if (!sql) {
    process.exit(1);
  }

  // Test connection
  const connected = await executeSql(sql);
  if (!connected) {
    log.warn('Could not connect to Supabase');
    log.info('⚠️  Supabase REST API does not support direct SQL execution');
    console.log(`\n${colors.yellow}Please apply the migration manually:${colors.reset}\n`);
    console.log(`1. Open: https://supabase.com/dashboard/project/ddxnrsnjdvtqhxunxbwj`);
    console.log(`2. Go to: SQL Editor → + New Query`);
    console.log(`3. Paste this SQL:\n`);
    console.log(sql);
    console.log(`\n4. Execute: Ctrl+Enter\n`);
    process.exit(1);
  }

  console.log(`\n${colors.yellow}⚠️  Important: REST API cannot execute arbitrary SQL${colors.reset}\n`);
  console.log(`${colors.yellow}Please apply the migration manually in Supabase Dashboard:${colors.reset}\n`);
  console.log(`1. Open: https://supabase.com/dashboard/project/ddxnrsnjdvtqhxunxbwj`);
  console.log(`2. Go to: SQL Editor → + New Query`);
  console.log(`3. Paste this SQL:\n`);
  console.log(`───────────────────────────────────────────\n`);
  console.log(sql);
  console.log(`───────────────────────────────────────────\n`);
  console.log(`4. Execute: Ctrl+Enter or click Run\n`);
  console.log(`${colors.green}After applying:${colors.reset}`);
  console.log(`- Test in browser: https://pathwaycareercoach.com/reservar.html`);
  console.log(`- DevTools Network: Look for 'citas' query (should be 200, not 401)\n`);
}

main().catch(err => {
  log.error(err.message);
  process.exit(1);
});
