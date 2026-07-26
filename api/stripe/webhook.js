'use strict';

const { createHmac, timingSafeEqual } = require('node:crypto');

async function rawBody(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks);
}

function verifiedStripeEvent(payload, signature, secret) {
  const values = String(signature || '').split(',').reduce((result, item) => {
    const [key, value] = item.split('=');
    if (key && value && !result[key]) result[key] = value;
    return result;
  }, {});
  if (!values.t || !values.v1) return false;
  const expected = createHmac('sha256', secret).update(`${values.t}.${payload.toString('utf8')}`).digest('hex');
  const actual = Buffer.from(values.v1, 'hex');
  const expectedBuffer = Buffer.from(expected, 'hex');
  return actual.length === expectedBuffer.length && timingSafeEqual(actual, expectedBuffer);
}

module.exports = async function stripeWebhook(request, response) {
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Cache-Control', 'no-store');
  if (request.method !== 'POST') return response.status(405).json({ error: 'Method not allowed.' });
  if (!process.env.STRIPE_WEBHOOK_SECRET) return response.status(503).json({ error: 'Webhook is not configured.' });

  try {
    const body = await rawBody(request);
    if (!verifiedStripeEvent(body, request.headers['stripe-signature'], process.env.STRIPE_WEBHOOK_SECRET)) {
      return response.status(400).json({ error: 'Invalid Stripe signature.' });
    }
    const event = JSON.parse(body.toString('utf8'));
    // Member access is never granted from a browser redirect. Only verified webhooks
    // may be used for payment recording and fulfillment by a later server-side flow.
    console.info('Verified Stripe event', event.type, event.id);
    return response.status(200).json({ received: true });
  } catch (error) {
    console.error('Stripe webhook error', error && error.message);
    return response.status(400).json({ error: 'Webhook could not be processed.' });
  }
};

module.exports.config = { api: { bodyParser: false } };
