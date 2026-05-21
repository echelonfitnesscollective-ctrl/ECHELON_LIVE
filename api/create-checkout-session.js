'use strict';

const { createStripeCheckoutSession } = require('../lib/stripe-checkout');

function trimSlash(s) {
  return String(s || '').trim().replace(/\/+$/, '');
}

function resolveFrontEntryFromRequest(req) {
  const pathPrefix = String(process.env.CLIENT_PATH_PREFIX || '')
    .trim()
    .replace(/^\/+|\/+$/g, '');
  const clientEntry = String(process.env.CLIENT_ENTRY || 'index.html')
    .trim()
    .replace(/^\/+/, '');

  /** Optional stable URL override (recommended for prod custom domains) — no trailing slash */
  const explicit = trimSlash(process.env.PUBLIC_SITE_BASE);
  let siteRoot = explicit;

  if (!siteRoot) {
    let proto = (req.headers['x-forwarded-proto'] || '').split(',')[0].trim();
    let host = (req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim();

    if ((!proto || !host) && process.env.VERCEL_URL) {
      host = process.env.VERCEL_URL;
      proto = proto || 'https';
    }

    if (!host) return null;
    proto = proto || 'https';
    siteRoot = `${proto}://${host}`;
  }

  siteRoot = trimSlash(siteRoot);
  if (!pathPrefix) return `${siteRoot}/${clientEntry}`;
  return `${siteRoot}/${pathPrefix}/${clientEntry}`;
}

function applyCors(req, res) {
  const origin = req.headers.origin;
  if (origin) res.setHeader('Access-Control-Allow-Origin', origin);
  else res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Vary', 'Origin');
}

function parseBody(req) {
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  return req.body && typeof req.body === 'object' ? req.body : {};
}

module.exports = async function createCheckoutApi(req, res) {
  applyCors(req, res);

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const stripeSecret = process.env.STRIPE_SECRET_KEY?.trim();
  if (!stripeSecret) {
    return res.status(503).json({
      error: 'Payments not configured: set STRIPE_SECRET_KEY on Vercel (or server/.env locally).',
    });
  }

  const frontEntry = resolveFrontEntryFromRequest(req);
  if (!frontEntry) {
    return res.status(500).json({
      error: 'Cannot derive storefront URL. Set PUBLIC_SITE_BASE (recommended) or check Host headers.',
    });
  }

  let items;
  try {
    items = parseBody(req).items;
    const session = await createStripeCheckoutSession(items, stripeSecret, frontEntry);
    return res.status(200).json(session);
  } catch (err) {
    console.error('[vercel:create-checkout-session]', err && err.message);
    const code = err && err.code;
    if (code === 'EMPTY') return res.status(400).json({ error: err.message });
    if (code === 'SKU') return res.status(400).json({ error: err.message });
    const msg = typeof err.message === 'string' ? err.message : 'Checkout creation failed.';
    return res.status(500).json({ error: msg });
  }
};
