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

async function serviceRequest(path, options = {}) {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key || !process.env.SUPABASE_URL) return { result: null, body: null };
  const result = await fetch(`${process.env.SUPABASE_URL}${path}`, { ...options, headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', ...(options.headers || {}) } });
  const text = await result.text(); let body = null; try { body = text ? JSON.parse(text) : null; } catch (_) { body = text; }
  return { result, body };
}

async function completeLaunchTask(projectId, title) {
  await serviceRequest(`/rest/v1/onboarding_tasks?project_id=eq.${encodeURIComponent(projectId)}&title=eq.${encodeURIComponent(title)}&status=neq.completed`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ status: 'completed', completed_at: new Date().toISOString() }) });
}

async function processEnrollmentPayment(event) {
  const object = event.data && event.data.object;
  const offerId = object?.metadata?.offer_id || object?.client_reference_id;
  if (!offerId || !process.env.SUPABASE_SERVICE_ROLE_KEY) return;
  const prior = await serviceRequest(`/rest/v1/stripe_payment_events?stripe_event_id=eq.${encodeURIComponent(event.id)}&select=stripe_event_id&limit=1`);
  if (Array.isArray(prior.body) && prior.body.length) return;
  const offerResult = await serviceRequest(`/rest/v1/enrollment_offers?id=eq.${encodeURIComponent(offerId)}&select=id,project_id&limit=1`);
  const offer = Array.isArray(offerResult.body) ? offerResult.body[0] : null;
  if (!offer) return;
  const projectResult = await serviceRequest(`/rest/v1/onboarding_projects?id=eq.${encodeURIComponent(offer.project_id)}&select=id,application_id&limit=1`);
  const project = Array.isArray(projectResult.body) ? projectResult.body[0] : null;
  if (!project) return;
  const paid = event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded';
  const expired = event.type === 'checkout.session.expired' || event.type === 'checkout.session.async_payment_failed';
  const now = new Date().toISOString();
  await serviceRequest('/rest/v1/stripe_payment_events', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ stripe_event_id: event.id, event_type: event.type, offer_id: offer.id, project_id: project.id, application_id: project.application_id, payload: { checkout_session_id: object?.id || null, payment_status: object?.payment_status || null } }) });
  if (paid) {
    await serviceRequest(`/rest/v1/enrollment_offers?id=eq.${encodeURIComponent(offer.id)}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ status: 'accepted', payment_status: 'paid', paid_at: now, stripe_checkout_session_id: object?.id || null }) });
    await serviceRequest(`/rest/v1/onboarding_projects?id=eq.${encodeURIComponent(project.id)}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ payment_status: 'paid', membership_status: 'approved', onboarding_status: 'awaiting_admin' }) });
    await serviceRequest(`/rest/v1/coaching_applications?id=eq.${encodeURIComponent(project.application_id)}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ status: 'Paid — Ready to Invite', payment_status: 'paid' }) });
    await completeLaunchTask(project.id, 'Verify payment or approved exemption');
  } else if (expired) {
    await serviceRequest(`/rest/v1/enrollment_offers?id=eq.${encodeURIComponent(offer.id)}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ status: 'expired', payment_status: 'expired' }) });
  }
}

const GROUP_FITNESS_OFFER_KEYS = new Set(['group_drop_in', 'group_unlimited']);

async function processGroupFitnessPayment(event) {
  const object = event.data && event.data.object;
  const offerKey = object?.metadata?.offer_key;
  if (!GROUP_FITNESS_OFFER_KEYS.has(offerKey) || !process.env.SUPABASE_SERVICE_ROLE_KEY) return;
  const paid = event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded';
  if (!paid) return;
  const prior = await serviceRequest(`/rest/v1/stripe_payment_events?stripe_event_id=eq.${encodeURIComponent(event.id)}&select=stripe_event_id&limit=1`);
  if (Array.isArray(prior.body) && prior.body.length) return;
  const email = object?.customer_details?.email || object?.customer_email || '';
  const name = object?.customer_details?.name || 'Group Fitness customer';
  await serviceRequest('/rest/v1/stripe_payment_events', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ stripe_event_id: event.id, event_type: event.type, payload: { checkout_session_id: object?.id || null, offer_key: offerKey, mode: object?.mode || null, amount_total: object?.amount_total ?? null } }) });
  await serviceRequest('/rest/v1/website_leads', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ lead_type: 'Group fitness purchase', full_name: name, email, category: object?.metadata?.offer_label || offerKey, message: '', source_data: { checkout_session_id: object?.id || null, offer_key: offerKey, mode: object?.mode || null, amount_total: object?.amount_total ?? null } }) });
}

module.exports = async function stripeWebhook(request, response) {
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Cache-Control', 'no-store');
  if (request.method !== 'POST') return response.status(405).json({ error: 'Method not allowed.' });
  if (!process.env.STRIPE_WEBHOOK_SECRET) return response.status(503).json({ error: 'Webhook is not configured.' });
  try {
    const body = await rawBody(request);
    if (!verifiedStripeEvent(body, request.headers['stripe-signature'], process.env.STRIPE_WEBHOOK_SECRET)) return response.status(400).json({ error: 'Invalid Stripe signature.' });
    const event = JSON.parse(body.toString('utf8'));
    console.info('Verified Stripe event', event.type, event.id);
    await processEnrollmentPayment(event);
    await processGroupFitnessPayment(event);
    return response.status(200).json({ received: true });
  } catch (error) {
    console.error('Stripe webhook error', error && error.message);
    return response.status(400).json({ error: 'Webhook could not be processed.' });
  }
};

module.exports.config = { api: { bodyParser: false } };
