'use strict';

const { createHmac, timingSafeEqual } = require('node:crypto');
const { notifyOwner } = require('../_lib/email.js');

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
  const offerResult = await serviceRequest(`/rest/v1/enrollment_offers?id=eq.${encodeURIComponent(offerId)}&select=id,project_id,payment_option&limit=1`);
  const offer = Array.isArray(offerResult.body) ? offerResult.body[0] : null;
  if (!offer) return;
  const projectResult = await serviceRequest(`/rest/v1/onboarding_projects?id=eq.${encodeURIComponent(offer.project_id)}&select=id,application_id,coaching_applications(full_name)&limit=1`);
  const project = Array.isArray(projectResult.body) ? projectResult.body[0] : null;
  if (!project) return;
  const paid = event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded';
  const expired = event.type === 'checkout.session.expired' || event.type === 'checkout.session.async_payment_failed';
  const now = new Date().toISOString();
  await serviceRequest('/rest/v1/stripe_payment_events', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ stripe_event_id: event.id, event_type: event.type, offer_id: offer.id, project_id: project.id, application_id: project.application_id, payload: { checkout_session_id: object?.id || null, payment_status: object?.payment_status || null } }) });
  if (paid) {
    await serviceRequest(`/rest/v1/enrollment_offers?id=eq.${encodeURIComponent(offer.id)}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ status: 'accepted', payment_status: 'paid', paid_at: now, stripe_checkout_session_id: object?.id || null }) });
    await serviceRequest(`/rest/v1/onboarding_projects?id=eq.${encodeURIComponent(project.id)}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ payment_status: 'paid', membership_status: 'approved', onboarding_status: 'awaiting_admin' }) });
    await serviceRequest(`/rest/v1/coaching_applications?id=eq.${encodeURIComponent(project.application_id)}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ status: 'Paid: Ready to Invite', payment_status: 'paid' }) });
    await completeLaunchTask(project.id, 'Verify payment or approved exemption');
    if (String(offer.payment_option || '').startsWith('echelon_12_')) {
      const clientName = project.coaching_applications?.full_name || 'this client';
      const checkinDue = new Date(Date.now() + 70 * 24 * 60 * 60 * 1000).toISOString();
      await serviceRequest('/rest/v1/coach_tasks', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({
        title: `Week 10 Progress Review: ${clientName}`,
        description: `${clientName}'s Transformation Coaching started today. Their plan keeps running until you or they change it, nothing auto-cancels. Around week 10-11, sit down for a real Progress Review: pull up their progress photos and weekly check-in history from the Coaching Hub, walk through wins and what to improve, then present the options to continue or step up a tier. Use the GENERATE CHECKOUT LINK button on their Members profile for whichever they choose.`,
        related_name: clientName,
        task_type: 'Renewal check-in',
        priority: 'Normal',
        due_at: checkinDue,
      }) });
    }
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

// Echelon Goods orders are flagged by metadata[order_type]=shop (set in
// api/shop/checkout.js) rather than an offer-key lookup, since a shop
// order has no fixed catalog of Stripe Price IDs to match against - the
// line items are built with price_data at checkout time.
async function processShopOrder(event) {
  const object = event.data && event.data.object;
  if (object?.metadata?.order_type !== 'shop') return;
  const paid = event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded';
  if (!paid) return;
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const prior = await serviceRequest(`/rest/v1/stripe_payment_events?stripe_event_id=eq.${encodeURIComponent(event.id)}&select=stripe_event_id&limit=1`);
    if (Array.isArray(prior.body) && prior.body.length) return;
    await serviceRequest('/rest/v1/stripe_payment_events', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ stripe_event_id: event.id, event_type: event.type, payload: { checkout_session_id: object?.id || null, order_summary: object?.metadata?.order_summary || null, amount_total: object?.amount_total ?? null } }) });
  }
  const email = object?.customer_details?.email || object?.customer_email || 'unknown email';
  const name = object?.customer_details?.name || 'Shop customer';
  const address = object?.shipping_details?.address || object?.customer_details?.address || null;
  const addressLines = address
    ? [address.line1, address.line2, [address.city, address.state, address.postal_code].filter(Boolean).join(', '), address.country].filter(Boolean).join('\n')
    : 'No shipping address collected.';
  const summary = object?.metadata?.order_summary || 'Order details unavailable, check the Stripe dashboard.';
  const amount = typeof object?.amount_total === 'number' ? `$${(object.amount_total / 100).toFixed(2)}` : 'unknown amount';
  await notifyOwner({
    subject: `New Echelon Goods order: ${amount}`,
    text: `${name} (${email}) just placed an Echelon Goods order.\n\nItems:\n${summary}\n\nTotal: ${amount}\n\nShip to:\n${addressLines}\n\nStripe checkout session: ${object?.id || 'unknown'}`,
  });
}

// Echelon Online Coaching: the $97 Custom 12-Week Program (+ optional
// $27 Holiday Travel Pack add-on, same session, extra line item).
// metadata[intake_id] ties this checkout session back to the
// plan_intakes row api/plan/submit-intake.js created before Stripe was
// ever involved - this is the moment that row flips to "paid" and
// becomes eligible for the coach's approval queue (a later step).
async function processPlanOrder(event) {
  const object = event.data && event.data.object;
  if (object?.metadata?.order_type !== 'plan') return;
  const intakeId = object?.metadata?.intake_id;
  if (!intakeId || !process.env.SUPABASE_SERVICE_ROLE_KEY) return;
  const paid = event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded';
  const expired = event.type === 'checkout.session.expired' || event.type === 'checkout.session.async_payment_failed';
  if (!paid && !expired) return;

  const prior = await serviceRequest(`/rest/v1/stripe_payment_events?stripe_event_id=eq.${encodeURIComponent(event.id)}&select=stripe_event_id&limit=1`);
  if (Array.isArray(prior.body) && prior.body.length) return;
  await serviceRequest('/rest/v1/stripe_payment_events', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ stripe_event_id: event.id, event_type: event.type, payload: { checkout_session_id: object?.id || null, intake_id: intakeId, amount_total: object?.amount_total ?? null, addon_travel_pack: object?.metadata?.addon_travel_pack === 'true' } }) });

  if (paid) {
    const now = new Date().toISOString();
    await serviceRequest(`/rest/v1/plan_intakes?id=eq.${encodeURIComponent(intakeId)}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ status: 'paid', paid_at: now, stripe_customer_id: object?.customer || null, updated_at: now }) });
    const amount = typeof object?.amount_total === 'number' ? `$${(object.amount_total / 100).toFixed(2)}` : 'unknown amount';
    const email = object?.customer_details?.email || object?.customer_email || 'unknown email';
    await notifyOwner({
      subject: `New Echelon Online Coaching order: ${amount}`,
      text: `A Custom 12-Week Program order just came in.\n\nEmail: ${email}\nAmount: ${amount}\nHoliday Travel Pack add-on: ${object?.metadata?.addon_travel_pack === 'true' ? 'yes' : 'no'}\n\nThe intake is now marked paid in plan_intakes (id ${intakeId}). It's ready for the approval queue once that's built.`,
    });
  } else if (expired) {
    await serviceRequest(`/rest/v1/plan_intakes?id=eq.${encodeURIComponent(intakeId)}&status=eq.checkout_pending`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ status: 'expired', updated_at: new Date().toISOString() }) });
  }
}

// The Monthly Coaching upsell (api/plan/upsell-checkout.js), a separate
// subscription checkout offered right after the main plan purchase.
async function processPlanMonthlyCoaching(event) {
  const object = event.data && event.data.object;
  if (object?.metadata?.order_type !== 'plan_monthly_coaching') return;
  const intakeId = object?.metadata?.intake_id;
  if (!intakeId || !process.env.SUPABASE_SERVICE_ROLE_KEY) return;
  const paid = event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded';
  if (!paid) return;

  const prior = await serviceRequest(`/rest/v1/stripe_payment_events?stripe_event_id=eq.${encodeURIComponent(event.id)}&select=stripe_event_id&limit=1`);
  if (Array.isArray(prior.body) && prior.body.length) return;
  await serviceRequest('/rest/v1/stripe_payment_events', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ stripe_event_id: event.id, event_type: event.type, payload: { checkout_session_id: object?.id || null, intake_id: intakeId, subscription: object?.subscription || null } }) });
  await serviceRequest(`/rest/v1/plan_intakes?id=eq.${encodeURIComponent(intakeId)}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ monthly_coaching_status: 'subscribed', updated_at: new Date().toISOString() }) });
  const email = object?.customer_details?.email || object?.customer_email || 'unknown email';
  await notifyOwner({
    subject: 'New Monthly Coaching subscriber ($49/mo)',
    text: `${email} just started Monthly Coaching right after their Custom 12-Week Program purchase (intake ${intakeId}).`,
  });
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
    await processShopOrder(event);
    await processPlanOrder(event);
    await processPlanMonthlyCoaching(event);
    return response.status(200).json({ received: true });
  } catch (error) {
    console.error('Stripe webhook error', error && error.message);
    return response.status(400).json({ error: 'Webhook could not be processed.' });
  }
};

module.exports.config = { api: { bodyParser: false } };
