'use strict';

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const express = require('express');
const cors = require('cors');
const { catalog } = require('./catalog');
const { createStripeCheckoutSession } = require('../lib/stripe-checkout');

const PORT = Number(process.env.PORT || 4242);

/**
 * Visible site root (scheme + host, no trailing slash), e.g. http://localhost:5173 or https://ecf.com
 */
const ORIGIN_HOST = (
  process.env.CLIENT_ORIGIN_HOST ||
  process.env.CLIENT_ORIGIN ||
  'http://127.0.0.1:5500'
).replace(/\/$/, '');

/** Optional prefix if the HTML is not at domain root — e.g. ECHELON_LIVE-main */
const PATH_PREFIX = String(process.env.CLIENT_PATH_PREFIX || '')
  .trim()
  .replace(/^\/+/, '')
  .replace(/\/+$/, '');

/** File under the prefixed path served as storefront (often index.html) */
const CLIENT_ENTRY = String(process.env.CLIENT_ENTRY || 'index.html')
  .trim()
  .replace(/^\/+/, '');

/** Full URL Stripe should send users back to — must match exactly what you paste in browser */
const FRONTENTRY_BASE = PATH_PREFIX
  ? `${ORIGIN_HOST}/${PATH_PREFIX}/${CLIENT_ENTRY}`
  : `${ORIGIN_HOST}/${CLIENT_ENTRY}`;

/** Comma-separated list of browser origins allowed to call checkout (typically same as ORIGIN_HOST) */
const PAYMENT_ORIGINS = (process.env.PAYMENT_ORIGINS || ORIGIN_HOST)
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const stripeSecret = process.env.STRIPE_SECRET_KEY?.trim();

const app = express();

app.use(
  cors({
    origin(origin, cb) {
      if (!origin) return cb(null, true); // Curl / tooling
      if (PAYMENT_ORIGINS.some((allowed) => allowed === '*' || origin === allowed))
        return cb(null, true);
      return cb(new Error('Not allowed by CORS'));
    },
  }),
);

app.use(express.json({ limit: '32kb' }));

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    stripeConfigured: Boolean(stripeSecret),
    catalogueSkus: Object.keys(catalog()),
    storefrontReturnExample: `${FRONTENTRY_BASE}?checkout=success`,
    source: 'express',
  });
});

app.post('/api/create-checkout-session', async (req, res) => {
  if (!stripeSecret) {
    return res.status(503).json({
      error: 'Payments not configured: set STRIPE_SECRET_KEY in server/.env',
    });
  }

  const rawItems = (req.body && req.body.items) || [];

  try {
    const { url, id } = await createStripeCheckoutSession(rawItems, stripeSecret, FRONTENTRY_BASE);
    return res.json({ url, id });
  } catch (err) {
    console.error('[checkout]', err.message || err);
    if (err.code === 'EMPTY') return res.status(400).json({ error: err.message });
    if (err.code === 'SKU') return res.status(400).json({ error: err.message });
    const msg =
      typeof err.message === 'string' ? err.message : 'Checkout creation failed.';
    return res.status(500).json({ error: msg });
  }
});

app.listen(PORT, () => {
  console.log(`Echelon checkout API listening on http://127.0.0.1:${PORT}`);
  console.log(`Stripe return URLs use: ${FRONTENTRY_BASE}`);
  console.log(`CORS PAYMENT_ORIGINS: ${PAYMENT_ORIGINS.join(', ')}`);
});
