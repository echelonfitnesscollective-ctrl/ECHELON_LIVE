'use strict';

module.exports = function healthApi(req, res) {
  const origin = req.headers.origin;
  if (origin) res.setHeader('Access-Control-Allow-Origin', origin);
  else res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();

  return res.status(200).json({
    ok: true,
    vercel: Boolean(process.env.VERCEL || process.env.VERCEL_ENV),
    stripeConfigured: Boolean(process.env.STRIPE_SECRET_KEY?.trim()),
  });
};
