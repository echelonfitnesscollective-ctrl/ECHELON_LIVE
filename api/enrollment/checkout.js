'use strict';

function siteUrl() { return String(process.env.SITE_URL || 'https://www.echelonfitness.co').replace(/\/$/, ''); }
async function db(path, options = {}) {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const result = await fetch(`${process.env.SUPABASE_URL}${path}`, { ...options, headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', ...(options.headers || {}) } });
  const text = await result.text(); let body = null; try { body = text ? JSON.parse(text) : null; } catch (_) { body = text; }
  return { result, body };
}
function safeOffer(offer) { return { program: offer.allowed_payment_options?.[0]?.label || 'Echelon Coaching', expiresAt: offer.expires_at, status: offer.payment_status }; }

module.exports = async function enrollmentCheckout(request, response) {
  response.setHeader('Cache-Control', 'no-store'); response.setHeader('X-Content-Type-Options', 'nosniff');
  const token = String((request.method === 'GET' ? request.query?.token : request.body?.token) || '');
  if (!token || !/^[a-f0-9]{48}$/i.test(token)) return response.status(400).json({ error: 'This payment link is not valid.' });
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return response.status(503).json({ error: 'Secure checkout is being prepared.' });
  const offerQuery = `/rest/v1/enrollment_offers?checkout_token=eq.${encodeURIComponent(token)}&select=id,project_id,stripe_price_id,line_items,payment_option,allowed_payment_options,expires_at,status,payment_status,onboarding_projects!inner(application_id,prospective_clients(full_name,email))&limit=1`;
  const offerResult = await db(offerQuery); const offer = Array.isArray(offerResult.body) ? offerResult.body[0] : null;
  if (!offerResult.result.ok || !offer || offer.status !== 'sent' || offer.payment_status === 'paid' || (offer.expires_at && new Date(offer.expires_at) < new Date())) return response.status(410).json({ error: 'This payment link is no longer active. Please contact Echelon for a new one.' });
  if (request.method === 'GET') return response.status(200).json(safeOffer(offer));
  if (request.method !== 'POST') return response.status(405).json({ error: 'Method not allowed.' });
  const items = Array.isArray(offer.line_items) && offer.line_items.length ? offer.line_items : (offer.stripe_price_id ? [{ price: offer.stripe_price_id, quantity: 1 }] : []);
  if (!process.env.STRIPE_SECRET_KEY || !items.length) return response.status(503).json({ error: 'Secure checkout is being prepared.' });
  const applicant = offer.onboarding_projects?.prospective_clients || {};
  const mode = offer.allowed_payment_options?.[0]?.mode || 'payment';
  const params = new URLSearchParams();
  params.set('mode', mode);
  items.forEach((item, index) => {
    params.set(`line_items[${index}][price]`, item.price);
    params.set(`line_items[${index}][quantity]`, String(item.quantity || 1));
  });
  params.set('success_url', `${siteUrl()}/pages/checkout-success.html?enrollment=1`); params.set('cancel_url', `${siteUrl()}/pages/enrollment-checkout.html?token=${token}`);
  params.set('client_reference_id', offer.id); params.set('metadata[offer_id]', offer.id); params.set('metadata[project_id]', offer.project_id);
  if (applicant.email) params.set('customer_email', applicant.email);
  if (mode === 'payment') params.set('customer_creation', 'always');
  if (String(process.env.STRIPE_ALLOW_PROMOTION_CODES).toLowerCase() === 'true') params.set('allow_promotion_codes', 'true');
  try {
    const stripe = await fetch('https://api.stripe.com/v1/checkout/sessions', { method: 'POST', headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`, 'Content-Type': 'application/x-www-form-urlencoded' }, body: params.toString() });
    const session = await stripe.json();
    if (!stripe.ok || !session.url) return response.status(502).json({ error: 'We could not begin checkout. Please try again.' });
    await db(`/rest/v1/enrollment_offers?id=eq.${encodeURIComponent(offer.id)}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ stripe_checkout_session_id: session.id, payment_status: 'pending' }) });
    return response.status(200).json({ url: session.url });
  } catch (error) { console.error('Enrollment checkout error', error && error.message); return response.status(503).json({ error: 'Checkout is temporarily unavailable.' }); }
};

