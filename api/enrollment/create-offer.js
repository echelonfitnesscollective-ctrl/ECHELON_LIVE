'use strict';

const { randomBytes } = require('node:crypto');

const PAYMENT_OPTIONS = {
  echelon_12_monthly: { priceEnv: 'STRIPE_PRICE_12_WEEK_MONTHLY', mode: 'subscription', label: 'Echelon 12 · $149 / month' },
  echelon_12_paid_in_full: { priceEnv: 'STRIPE_PRICE_12_WEEK_FULL', mode: 'payment', label: 'Echelon 12 · $399 paid in full' },
  one_on_one_monthly: { priceEnv: 'STRIPE_PRICE_ONE_ON_ONE_MONTHLY', mode: 'subscription', label: '1-on-1 Coaching · monthly' }
};

function siteUrl() { return String(process.env.SITE_URL || 'https://www.echelonfitness.co').replace(/\/$/, ''); }
function jsonHeaders(key) { return { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }; }

async function supabase(path, options = {}, service = true) {
  const key = service ? process.env.SUPABASE_SERVICE_ROLE_KEY : process.env.SUPABASE_ANON_KEY;
  const response = await fetch(`${process.env.SUPABASE_URL}${path}`, { ...options, headers: { ...jsonHeaders(key), ...(options.headers || {}) } });
  const text = await response.text();
  let body = null; try { body = text ? JSON.parse(text) : null; } catch (_) { body = text; }
  return { response, body };
}

async function requireAdmin(request) {
  const token = String(request.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token || !process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  const userResponse = await fetch(`${process.env.SUPABASE_URL}/auth/v1/user`, { headers: { apikey: process.env.SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` } });
  if (!userResponse.ok) return null;
  const user = await userResponse.json();
  const admin = await supabase(`/rest/v1/admin_users?user_id=eq.${encodeURIComponent(user.id)}&select=user_id&limit=1`);
  return admin.response.ok && Array.isArray(admin.body) && admin.body.length ? user : null;
}

async function markTask(projectId, title) {
  await supabase(`/rest/v1/onboarding_tasks?project_id=eq.${encodeURIComponent(projectId)}&title=eq.${encodeURIComponent(title)}&status=neq.completed`, {
    method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ status: 'completed', completed_at: new Date().toISOString() })
  });
}

module.exports = async function createEnrollmentOffer(request, response) {
  response.setHeader('Cache-Control', 'no-store'); response.setHeader('X-Content-Type-Options', 'nosniff');
  if (request.method !== 'POST') return response.status(405).json({ error: 'Method not allowed.' });
  const admin = await requireAdmin(request);
  if (!admin) return response.status(401).json({ error: 'Your admin session is required.' });
  const { applicationId, paymentOption } = request.body || {};
  const option = PAYMENT_OPTIONS[paymentOption];
  const price = option && process.env[option.priceEnv];
  if (!applicationId || !option || !price) return response.status(400).json({ error: 'Choose a configured Echelon payment option.' });
  try {
    const appResult = await supabase(`/rest/v1/coaching_applications?id=eq.${encodeURIComponent(applicationId)}&select=id,full_name,email,program_interest`);
    const application = Array.isArray(appResult.body) ? appResult.body[0] : null;
    if (!appResult.response.ok || !application) return response.status(404).json({ error: 'That application could not be found.' });
    const projectResult = await supabase(`/rest/v1/onboarding_projects?application_id=eq.${encodeURIComponent(applicationId)}&select=id&limit=1`);
    const project = Array.isArray(projectResult.body) ? projectResult.body[0] : null;
    if (!project) return response.status(409).json({ error: 'The member launch project is still being prepared. Refresh and try again.' });

    await supabase(`/rest/v1/enrollment_offers?project_id=eq.${encodeURIComponent(project.id)}&status=in.(draft,sent)`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ status: 'canceled' }) });
    const token = randomBytes(24).toString('hex');
    const now = new Date().toISOString();
    const offerResult = await supabase('/rest/v1/enrollment_offers', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ project_id: project.id, allowed_payment_options: [{ key: paymentOption, label: option.label, mode: option.mode }], payment_option: paymentOption, stripe_price_id: price, checkout_token: token, status: 'sent', payment_status: 'awaiting_payment', sent_at: now, expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() }) });
    const offer = Array.isArray(offerResult.body) ? offerResult.body[0] : null;
    if (!offerResult.response.ok || !offer) return response.status(502).json({ error: 'The payment offer could not be created.' });
    await supabase(`/rest/v1/coaching_applications?id=eq.${encodeURIComponent(applicationId)}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ status: 'Accepted — Payment Pending', application_status: 'approved', approved_program: option.label, payment_status: 'awaiting_payment', approved_at: now }) });
    await supabase(`/rest/v1/onboarding_projects?id=eq.${encodeURIComponent(project.id)}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ payment_status: 'checkout_created', membership_status: 'approved', onboarding_status: 'awaiting_admin' }) });
    await markTask(project.id, 'Review application and safety flags');
    await markTask(project.id, 'Choose program and assigned coach');
    await markTask(project.id, 'Create approved payment offer');
    await markTask(project.id, 'Send payment-selection link');
    await supabase('/rest/v1/automation_events', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ event_type: 'payment_offer_created', application_id: application.id, project_id: project.id, payload: { offer_id: offer.id, payment_option: paymentOption, operator_id: admin.id } }) });
    return response.status(200).json({ paymentUrl: `${siteUrl()}/pages/enrollment-checkout.html?token=${token}`, applicant: { name: application.full_name, email: application.email }, label: option.label });
  } catch (error) {
    console.error('Enrollment offer error', error && error.message);
    return response.status(503).json({ error: 'The offer could not be created right now.' });
  }
};

