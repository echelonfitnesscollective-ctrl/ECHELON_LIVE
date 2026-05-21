'use strict';

const { catalog } = require('../lib/catalog');

module.exports = function healthApi(req, res) {
  const origin = req.headers.origin;
  if (origin) res.setHeader('Access-Control-Allow-Origin', origin);
  else res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();

  const stripeConfigured = Boolean(process.env.STRIPE_SECRET_KEY?.trim());
  const vercel = Boolean(process.env.VERCEL || process.env.VERCEL_ENV);

  return res.status(200).json({
    ok: true,
    vercel,
    stripeConfigured,
    catalogueSkus: Object.keys(catalog()),
  });
};
