'use strict';

// Stripe Checkout for the Echelon Online Coaching intake
// (pages/plan.html). Same shape as api/checkout/create.js - fixed
// Stripe Price IDs from env vars, never price_data - but this one
// requires a real plan_intakes row first (created by
// api/plan/submit-intake.js) and re-checks its safety-flagged/status
// server-side before ever building a session, so a direct POST here
// with a stale or blocked intakeId can't buy around the safety gate.
//
// Required Vercel environment variables: STRIPE_SECRET_KEY, SUPABASE_URL,
// SUPABASE_SERVICE_ROLE_KEY, STRIPE_PRICE_PLAN_CUSTOM_12_WEEK,
// STRIPE_PRICE_PLAN_HOLIDAY_TRAVEL_PACK.

const inMemoryRateLimit = new Map();
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 5;

function clientIp(req) {
  return String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();
}

function rateLimited(ip) {
  const now = Date.now();
  const entry = inMemoryRateLimit.get(ip) || { count: 0, windowStart: now };
  if (now - entry.windowStart > WINDOW_MS) {
    entry.count = 0;
    entry.windowStart = now;
  }
  entry.count += 1;
  inMemoryRateLimit.set(ip, entry);
  if (inMemoryRateLimit.size > 1000) {
    const cutoff = now - WINDOW_MS;
    for (const [key, value] of inMemoryRateLimit) if (value.windowStart < cutoff) inMemoryRateLimit.delete(key);
  }
  return entry.count > MAX_PER_WINDOW;
}

function publicSiteUrl() {
  return String(process.env.SITE_URL || 'https://www.echelonfitness.co').trim().replace(/\/$/, '');
}

async function fetchIntake(id) {
  const response = await fetch(
    `${process.env.SUPABASE_URL}/rest/v1/plan_intakes?id=eq.${encodeURIComponent(id)}&select=id,email,full_name,status,safety_flagged&limit=1`,
    {
      headers: {
        apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
    }
  );
  if (!response.ok) return null;
  const rows = await response.json();
  return Array.isArray(rows) ? rows[0] || null : null;
}

async function markCheckoutPending(id, sessionId) {
  await fetch(`${process.env.SUPABASE_URL}/rest/v1/plan_intakes?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: {
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({ status: 'checkout_pending', stripe_checkout_session_id: sessionId, updated_at: new Date().toISOString() }),
  });
}

module.exports = async function planCheckout(req, res) {
  const origin = String(req.headers.origin || '').replace(/\/$/, '');
  const siteUrl = publicSiteUrl();
  res.setHeader('Access-Control-Allow-Origin', origin === siteUrl ? origin : siteUrl);
  res.setHeader('Vary', 'Origin');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' });
  if (origin && origin !== siteUrl) return res.status(403).json({ error: 'This checkout request was not accepted.' });

  if (rateLimited(clientIp(req))) {
    return res.status(429).json({ error: 'Too many requests. Please wait a minute and try again.' });
  }

  const mainPrice = process.env.STRIPE_PRICE_PLAN_CUSTOM_12_WEEK;
  const addonPrice = process.env.STRIPE_PRICE_PLAN_HOLIDAY_TRAVEL_PACK;
  if (!process.env.STRIPE_SECRET_KEY || !mainPrice || !process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(503).json({ error: 'Checkout is being prepared. Please try again shortly.' });
  }

  const intakeId = String((req.body && req.body.intakeId) || '');
  if (!intakeId) return res.status(400).json({ error: 'Missing intake.' });

  const intake = await fetchIntake(intakeId);
  if (!intake) return res.status(404).json({ error: 'We could not find your intake. Please fill out the form again.' });
  if (intake.safety_flagged || intake.status === 'blocked') {
    return res.status(403).json({ error: 'This intake was stopped by our safety screen and cannot be checked out.' });
  }
  if (intake.status === 'paid') {
    return res.status(409).json({ error: 'This order has already been paid.' });
  }

  const wantsAddon = req.body && (req.body.addon === true || req.body.addon === 'true');

  const params = new URLSearchParams();
  params.set('mode', 'payment');
  params.set('line_items[0][price]', mainPrice);
  params.set('line_items[0][quantity]', '1');
  if (wantsAddon && addonPrice) {
    params.set('line_items[1][price]', addonPrice);
    params.set('line_items[1][quantity]', '1');
  }
  params.set('customer_email', intake.email);
  params.set('customer_creation', 'always');
  params.set('success_url', `${siteUrl}/pages/plan-success.html?session_id={CHECKOUT_SESSION_ID}&intake=${intakeId}`);
  params.set('cancel_url', `${siteUrl}/pages/plan.html`);
  params.set('billing_address_collection', 'auto');
  params.set('metadata[order_type]', 'plan');
  params.set('metadata[intake_id]', intakeId);
  params.set('metadata[addon_travel_pack]', wantsAddon ? 'true' : 'false');

  try {
    const stripeResponse = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });
    const session = await stripeResponse.json();
    if (!stripeResponse.ok || !session.url) {
      console.error('Plan checkout creation failed', (session && session.error && session.error.message) || stripeResponse.status);
      return res.status(502).json({ error: 'We could not begin checkout. Please try again.' });
    }
    await markCheckoutPending(intakeId, session.id);
    return res.status(200).json({ url: session.url });
  } catch (error) {
    console.error('Plan checkout request failed', error && error.message);
    return res.status(503).json({ error: 'Checkout is temporarily unavailable. Please try again.' });
  }
};
