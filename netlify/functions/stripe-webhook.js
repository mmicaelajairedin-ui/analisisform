// Netlify Function — recibe webhooks de Stripe y marca pagos en Supabase
// Eventos manejados: checkout.session.completed (pago one-off del candidato).
//
// Env vars requeridos:
//   STRIPE_WEBHOOK_SECRET  (desde Dashboard → Developers → Webhooks → tu endpoint)
//   SUPABASE_URL
//   SUPABASE_ANON_KEY
//
// SQL requerido en Supabase (correr una vez):
//   ALTER TABLE candidatos ADD COLUMN IF NOT EXISTS pago_recibido BOOLEAN DEFAULT FALSE;
//   ALTER TABLE candidatos ADD COLUMN IF NOT EXISTS pago_fecha TIMESTAMPTZ;
//   ALTER TABLE candidatos ADD COLUMN IF NOT EXISTS stripe_session_id TEXT;

const crypto = require('crypto');

// Verifica firma Stripe-Signature: t=TIMESTAMP,v1=HMAC
function verify(payload, header, secret) {
  if (!header || !secret) return false;
  const parts = {};
  header.split(',').forEach(function(p){
    const i = p.indexOf('=');
    if (i > 0) parts[p.slice(0, i).trim()] = p.slice(i + 1).trim();
  });
  if (!parts.t || !parts.v1) return false;
  const signed = parts.t + '.' + payload;
  const expected = crypto.createHmac('sha256', secret).update(signed, 'utf8').digest('hex');
  // Rechaza eventos más viejos de 5 minutos (previene replay)
  const nowSec = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSec - parseInt(parts.t, 10)) > 300) return false;
  // timing-safe compare
  try {
    return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(parts.v1, 'hex'));
  } catch (e) {
    return false;
  }
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const sig = event.headers['stripe-signature'] || event.headers['Stripe-Signature'];
  const payload = event.body || '';

  if (!verify(payload, sig, secret)) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid signature' }) };
  }

  let ev;
  try { ev = JSON.parse(payload); } catch (e) {
    return { statusCode: 400, body: 'Invalid JSON' };
  }

  // Solo procesamos checkout completados
  if (ev.type !== 'checkout.session.completed') {
    return { statusCode: 200, body: JSON.stringify({ received: true, type: ev.type, skipped: true }) };
  }

  const session = ev.data && ev.data.object;
  if (!session) return { statusCode: 200, body: JSON.stringify({ received: true, error: 'no session' }) };

  const email = (session.customer_details && session.customer_details.email) || session.customer_email || '';
  const amount = (session.amount_total || 0) / 100;
  const sessionId = session.id;
  const nowISO = new Date().toISOString();

  if (!email) {
    return { statusCode: 200, body: JSON.stringify({ received: true, skipped: 'no email in session' }) };
  }

  const SB = process.env.SUPABASE_URL;
  const KEY = process.env.SUPABASE_ANON_KEY;
  if (!SB || !KEY) {
    return { statusCode: 500, body: 'Supabase env vars missing' };
  }

  // ¿Existe el candidato?
  const checkRes = await fetch(SB + '/rest/v1/candidatos?email=eq.' + encodeURIComponent(email.toLowerCase()) + '&select=id,pago_monto', {
    headers: { apikey: KEY, Authorization: 'Bearer ' + KEY }
  });
  const rows = checkRes.ok ? await checkRes.json() : [];

  const body = {
    pago_monto: amount,
    pago_recibido: true,
    pago_fecha: nowISO,
    stripe_session_id: sessionId
  };

  let result = 'updated';
  if (rows && rows.length) {
    // Update existente
    await fetch(SB + '/rest/v1/candidatos?email=eq.' + encodeURIComponent(email.toLowerCase()), {
      method: 'PATCH',
      headers: {
        apikey: KEY,
        Authorization: 'Bearer ' + KEY,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal'
      },
      body: JSON.stringify(body)
    });
  } else {
    // Crear nuevo — el candidato completará el form después
    const name = (session.customer_details && session.customer_details.name) || email.split('@')[0];
    const createBody = Object.assign({}, body, {
      email: email.toLowerCase(),
      nombre: name,
      activo: true
    });
    const createRes = await fetch(SB + '/rest/v1/candidatos', {
      method: 'POST',
      headers: {
        apikey: KEY,
        Authorization: 'Bearer ' + KEY,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal'
      },
      body: JSON.stringify(createBody)
    });
    result = createRes.ok ? 'created' : 'create-failed (' + createRes.status + ')';
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ received: true, email: email, amount: amount, result: result })
  };
};
