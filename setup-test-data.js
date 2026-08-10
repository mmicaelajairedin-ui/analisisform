/**
 * Setup Test Data for Sprint Equipo
 * Creates organizations, users, and clients for automated testing
 */

const { createClient } = require('@supabase/supabase-js');

// Decode JWT to get project ref: ref: "ddxnrsnjdvtqhxunxnwj"
const SB_URL = 'https://ddxnrsnjdvtqhxunxnwj.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkeG5yc25qZHZ0cWh4dW54bndsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjM5ODAwMDAsImV4cCI6MTg4MTc0NjAwMH0.t82X1x-PDgFDGYhKC7YXoRKhga9I8Hjet60QUYvtZLU';

const sb = createClient(SB_URL, SB_KEY);

async function setupTestData() {
  console.log('🔧 Setting up test data for Sprint Equipo...\n');

  try {
    // 1. Create Test Organizations
    console.log('📦 Creating test organizations...');

    const { data: orgA, error: orgAError } = await sb
      .from('organizaciones')
      .insert([{
        nombre: 'Test Org A - ' + Date.now(),
        descripcion: 'Test organization A for Sprint Equipo'
      }])
      .select();

    if (orgAError) throw orgAError;
    const ORG_A_ID = orgA[0].id;
    console.log(`✅ Org A created: ${ORG_A_ID}`);

    const { data: orgB, error: orgBError } = await sb
      .from('organizaciones')
      .insert([{
        nombre: 'Test Org B - ' + Date.now(),
        descripcion: 'Test organization B for Sprint Equipo'
      }])
      .select();

    if (orgBError) throw orgBError;
    const ORG_B_ID = orgB[0].id;
    console.log(`✅ Org B created: ${ORG_B_ID}`);

    // 2. Create Test Users for Org A
    console.log('\n👥 Creating test users for Org A...');

    const timestamp = Date.now();
    const usersOrgA = [
      {
        email: `owner.a.${timestamp}@test.com`,
        nombre: 'Owner A',
        rol: 'owner',
        org_id: ORG_A_ID,
        activo: true
      },
      {
        email: `coach.a1.${timestamp}@test.com`,
        nombre: 'Coach A1',
        rol: 'coach',
        org_id: ORG_A_ID,
        activo: true
      },
      {
        email: `coach.a2.${timestamp}@test.com`,
        nombre: 'Coach A2',
        rol: 'coach',
        org_id: ORG_A_ID,
        activo: true
      },
      {
        email: `colab.a.${timestamp}@test.com`,
        nombre: 'Colaborador A',
        rol: 'colaborador',
        org_id: ORG_A_ID,
        activo: true
      },
      {
        email: `user.unaffiliated.${timestamp}@test.com`,
        nombre: 'User Unaffiliated',
        rol: 'coach',
        org_id: null,
        activo: true
      }
    ];

    const { data: insertedUsersA, error: usersAError } = await sb
      .from('usuarios')
      .insert(usersOrgA)
      .select();

    if (usersAError) throw usersAError;
    console.log(`✅ Created ${insertedUsersA.length} users for Org A`);

    const ownerA = insertedUsersA.find(u => u.rol === 'owner');
    const coachA1 = insertedUsersA.find(u => u.nombre === 'Coach A1');
    const coachA2 = insertedUsersA.find(u => u.nombre === 'Coach A2');
    const unaffiliatedUser = insertedUsersA.find(u => !u.org_id);

    // 3. Create Test Users for Org B
    console.log('👥 Creating test users for Org B...');

    const usersOrgB = [
      {
        email: `owner.b.${timestamp}@test.com`,
        nombre: 'Owner B',
        rol: 'owner',
        org_id: ORG_B_ID,
        activo: true
      },
      {
        email: `coach.b1.${timestamp}@test.com`,
        nombre: 'Coach B1',
        rol: 'coach',
        org_id: ORG_B_ID,
        activo: true
      },
      {
        email: `user.org.b.${timestamp}@test.com`,
        nombre: 'User Already in Org B',
        rol: 'coach',
        org_id: ORG_B_ID,
        activo: true
      }
    ];

    const { data: insertedUsersB, error: usersBError } = await sb
      .from('usuarios')
      .insert(usersOrgB)
      .select();

    if (usersBError) throw usersBError;
    console.log(`✅ Created ${insertedUsersB.length} users for Org B`);

    const userAlreadyInOrgB = insertedUsersB.find(u => u.nombre === 'User Already in Org B');

    // 4. Create Test Clients for Org A
    console.log('\n👤 Creating test clients for Org A...');

    const clientsOrgA = [
      {
        nombre: 'Client A1',
        email: `client.a1.${timestamp}@test.com`,
        coach_id: coachA1.id,
        org_id: ORG_A_ID,
        activo: true
      },
      {
        nombre: 'Client A2',
        email: `client.a2.${timestamp}@test.com`,
        coach_id: coachA1.id,
        org_id: ORG_A_ID,
        activo: true
      },
      {
        nombre: 'Client A3',
        email: `client.a3.${timestamp}@test.com`,
        coach_id: coachA1.id,
        org_id: ORG_A_ID,
        activo: true
      },
      {
        nombre: 'Client A4',
        email: `client.a4.${timestamp}@test.com`,
        coach_id: coachA2.id,
        org_id: ORG_A_ID,
        activo: true
      }
    ];

    const { data: insertedClientsA, error: clientsAError } = await sb
      .from('candidatos')
      .insert(clientsOrgA)
      .select();

    if (clientsAError) throw clientsAError;
    console.log(`✅ Created ${insertedClientsA.length} clients for Org A`);

    // 5. Create Test Clients for Org B
    console.log('👤 Creating test clients for Org B...');

    const coachB1 = insertedUsersB.find(u => u.nombre === 'Coach B1');
    const clientsOrgB = [
      {
        nombre: 'Client B1',
        email: `client.b1.${timestamp}@test.com`,
        coach_id: coachB1.id,
        org_id: ORG_B_ID,
        activo: true
      },
      {
        nombre: 'Client B2',
        email: `client.b2.${timestamp}@test.com`,
        coach_id: coachB1.id,
        org_id: ORG_B_ID,
        activo: true
      }
    ];

    const { data: insertedClientsB, error: clientsBError } = await sb
      .from('candidatos')
      .insert(clientsOrgB)
      .select();

    if (clientsBError) throw clientsBError;
    console.log(`✅ Created ${insertedClientsB.length} clients for Org B`);

    // 6. Save test data to file for Playwright
    const testData = {
      ORG_A_ID,
      ORG_B_ID,
      ownerA: { id: ownerA.id, email: ownerA.email, nombre: ownerA.nombre },
      coachA1: { id: coachA1.id, email: coachA1.email, nombre: coachA1.nombre },
      coachA2: { id: coachA2.id, email: coachA2.email, nombre: coachA2.nombre },
      colaboradorA: { id: insertedUsersA.find(u => u.rol === 'colaborador').id },
      unaffiliatedUser: { id: unaffiliatedUser.id, email: unaffiliatedUser.email },
      userAlreadyInOrgB: { id: userAlreadyInOrgB.id, email: userAlreadyInOrgB.email },
      clientsOrgA: insertedClientsA.map(c => ({ id: c.id, nombre: c.nombre })),
      clientsOrgB: insertedClientsB.map(c => ({ id: c.id, nombre: c.nombre }))
    };

    const fs = require('fs');
    fs.writeFileSync('/tmp/test-data.json', JSON.stringify(testData, null, 2));

    console.log('\n✅ Test data setup complete!\n');
    console.log('📋 Test Data Summary:');
    console.log(`   ORG_A_ID: ${ORG_A_ID}`);
    console.log(`   ORG_B_ID: ${ORG_B_ID}`);
    console.log(`   Users Org A: 4 (1 owner, 2 coaches, 1 colaborador)`);
    console.log(`   Users Org B: 3 (1 owner, 1 coach, 1 for cross-org test)`);
    console.log(`   Clients Org A: 4 (all assigned to coaches)`);
    console.log(`   Clients Org B: 2 (all assigned to coaches)`);
    console.log(`   Unaffiliated user: 1 (for add-person test)`);
    console.log('\n📁 Test data saved to: /tmp/test-data.json\n');

    return testData;

  } catch (error) {
    console.error('❌ Error setting up test data:', error.message);
    process.exit(1);
  }
}

setupTestData();
