'use strict';

const OFFERS = {
  group_drop_in: { priceEnv: 'STRIPE_PRICE_GROUP_DROP_IN', mode: 'payment', label: 'Echelon Group Fitness Drop-In' },
  group_unlimited: { priceEnv: 'STRIPE_PRICE_GROUP_UNLIMITED', mode: 'subscription', label: 'Echelon Group Fitness Unlimited' },
};

const inMemoryRateLimit = new Map();
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 3;

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

module.exports = async function createGroupCheckout(req, res) {
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

  const offerKey = String(req.body && req.body.offer || '');
  const offer = OFFERS[offerKey];
  const price = offer && process.env[offer.priceEnv];
  if (!offer || !price || !process.env.STRIPE_SECRET_KEY) {
    return res.status(503).json({ error: 'Checkout is being prepared. Please try again shortly.' });
  }

  const params = new URLSearchParams();
  params.set('mode', offer.mode);
  params.set('line_items[0][price]', price);
  params.set('line_items[0][quantity]', '1');
  params.set('success_url', `${siteUrl}/pages/checkout-success.html?session_id={CHECKOUT_SESSION_ID}`);
  params.set('cancel_url', `${siteUrl}/index.html#training`);
  params.set('metadata[offer_key]', offerKey);
  params.set('metadata[offer_label]', offer.label);
  params.set('billing_address_collection', 'auto');
  if (offer.mode === 'payment') params.set('customer_creation', 'always');
  if (String(process.env.STRIPE_ALLOW_PROMOTION_CODES).toLowerCase() === 'true') params.set('allow_promotion_codes', 'true');

  try {
    const stripeResponse = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });
    const session = await stripeResponse.json();
    if (!stripeResponse.ok || !session.url) {
      console.error('Stripe Checkout creation failed', session && session.error && session.error.message || stripeResponse.status);
      return res.status(502).json({ error: 'We could not begin checkout. Please try again.' });
    }
    return res.status(200).json({ url: session.url });
  } catch (error) {
    console.error('Stripe Checkout request failed', error && error.message);
    return res.status(503).json({ error: 'Checkout is temporarily unavailable. Please try again.' });
  }
};
