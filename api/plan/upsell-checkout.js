'use strict';

// The Monthly Coaching upsell, offered right after a Custom 12-Week
// Program purchase completes (pages/plan-success.html). A second,
// separate Checkout Session rather than trying to add a subscription
// item into the original one-time session - Stripe Checkout doesn't
// mix mode:"payment" and a recurring price cleanly, and a short,
// one-click second checkout is the same pattern most of this kind of
// upsell uses in practice. Attaches to the same Stripe customer as the
// original purchase when we have it, so it reads as one relationship,
// not two unrelated charges.
//
// Required Vercel environment variables: STRIPE_SECRET_KEY, SUPABASE_URL,
// SUPABASE_SERVICE_ROLE_KEY, STRIPE_PRICE_PLAN_MONTHLY_COACHING.

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

async function fetchPaidIntake(id) {
  const response = await fetch(
    `${process.env.SUPABASE_URL}/rest/v1/plan_intakes?id=eq.${encodeURIComponent(id)}&select=id,email,status,stripe_customer_id&limit=1`,
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

async function markOffered(id) {
  await fetch(`${process.env.SUPABASE_URL}/rest/v1/plan_intakes?id=eq.${encodeURIComponent(id)}&monthly_coaching_status=eq.not_offered`, {
    method: 'PATCH',
    headers: {
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({ monthly_coaching_status: 'offered', updated_at: new Date().toISOString() }),
  });
}

module.exports = async function planUpsellCheckout(req, res) {
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

  const price = process.env.STRIPE_PRICE_PLAN_MONTHLY_COACHING;
  if (!process.env.STRIPE_SECRET_KEY || !price || !process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(503).json({ error: 'Checkout is being prepared. Please try again shortly.' });
  }

  const intakeId = String((req.body && req.body.intakeId) || '');
  if (!intakeId) return res.status(400).json({ error: 'Missing order.' });

  const intake = await fetchPaidIntake(intakeId);
  if (!intake || intake.status !== 'paid') {
    return res.status(403).json({ error: 'This upsell is only available right after a completed purchase.' });
  }

  const params = new URLSearchParams();
  params.set('mode', 'subscription');
  params.set('line_items[0][price]', price);
  params.set('line_items[0][quantity]', '1');
  if (intake.stripe_customer_id) {
    params.set('customer', intake.stripe_customer_id);
  } else {
    params.set('customer_email', intake.email);
  }
  params.set('success_url', `${siteUrl}/pages/plan-success.html?session_id={CHECKOUT_SESSION_ID}&intake=${intakeId}&coaching=1`);
  params.set('cancel_url', `${siteUrl}/pages/plan-success.html?intake=${intakeId}`);
  params.set('metadata[order_type]', 'plan_monthly_coaching');
  params.set('metadata[intake_id]', intakeId);

  try {
    const stripeResponse = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });
    const session = await stripeResponse.json();
    if (!stripeResponse.ok || !session.url) {
      console.error('Plan upsell checkout creation failed', (session && session.error && session.error.message) || stripeResponse.status);
      return res.status(502).json({ error: 'We could not begin checkout. Please try again.' });
    }
    await markOffered(intakeId);
    return res.status(200).json({ url: session.url });
  } catch (error) {
    console.error('Plan upsell checkout request failed', error && error.message);
    return res.status(503).json({ error: 'Checkout is temporarily unavailable. Please try again.' });
  }
};
