'use strict';

const { randomBytes } = require('node:crypto');

const PAYMENT_OPTIONS = {
  echelon_12_monthly: { priceEnv: 'STRIPE_PRICE_12_WEEK_MONTHLY', mode: 'subscription', label: 'Echelon 12 · $149 / month' },
  echelon_12_paid_in_full: { priceEnv: 'STRIPE_PRICE_12_WEEK_FULL', mode: 'payment', label: 'Echelon 12 · $399 paid in full' },
  one_on_one_monthly: { priceEnv: 'STRIPE_PRICE_ONE_ON_ONE_MONTHLY', mode: 'subscription', label: '1-on-1 Coaching · monthly' },
  private_group_training: { basePriceEnv: 'STRIPE_PRICE_PRIVATE_GROUP_BASE', addonPriceEnv: 'STRIPE_PRICE_PRIVATE_GROUP_ADDON', mode: 'payment', basePeople: 5, baseAmount: 199, addonAmount: 25 }
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

function paymentEmailHtml(name, label, paymentUrl) {
  const greetingName = (name || '').split(/\s+/)[0] || 'there';
  return `<div style="max-width:520px;margin:0 auto;padding:40px 32px;background:#0d0d0c;color:#ffffff;font-family:'Helvetica Neue',Arial,sans-serif;"><p style="margin:0 0 28px;font-size:11px;letter-spacing:2px;color:#d7b55b;font-weight:700;">ECHELON FITNESS COLLECTIVE</p><h2 style="margin:0 0 16px;font-size:26px;line-height:1.2;color:#ffffff;">Your coaching next step.</h2><p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#cccccc;">Hi ${greetingName}, thank you for sharing your goals with Echelon. I'd be glad to move forward with ${label}.</p><p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#cccccc;">Your private payment link is below. Once payment is confirmed, I'll send your Member Portal invitation and onboarding next steps.</p><p style="margin:0 0 28px;"><a href="${paymentUrl}" style="display:inline-block;padding:14px 28px;background:#d7b55b;color:#0d0d0c;text-decoration:none;font-weight:700;font-size:13px;letter-spacing:1px;">VIEW PAYMENT LINK</a></p><p style="margin:0;font-size:13px;line-height:1.6;color:#888888;">Respectfully,<br>Echelon Fitness Collective</p></div>`;
}

function paymentEmailText(name, label, paymentUrl) {
  const greetingName = (name || '').split(/\s+/)[0] || 'there';
  return `Hi ${greetingName},\n\nThank you for sharing your goals with Echelon. I'd be glad to move forward with ${label}.\n\nYour private payment link is below. Once payment is confirmed, I'll send your Member Portal invitation and onboarding next steps.\n\n${paymentUrl}\n\nRespectfully,\nEchelon Fitness Collective`;
}

async function sendPaymentEmail(admin, applicationId, response) {
  if (!process.env.RESEND_API_KEY) return response.status(500).json({ error: 'Email sending is not configured yet. Add RESEND_API_KEY in Vercel.' });
  if (!applicationId) return response.status(400).json({ error: 'Choose an applicant first.' });
  try {
    const appResult = await supabase(`/rest/v1/coaching_applications?id=eq.${encodeURIComponent(applicationId)}&select=id,full_name,email`);
    const application = Array.isArray(appResult.body) ? appResult.body[0] : null;
    if (!appResult.response.ok || !application) return response.status(404).json({ error: 'That application could not be found.' });
    if (!application.email) return response.status(409).json({ error: 'This applicant has no email on file.' });

    const projectResult = await supabase(`/rest/v1/onboarding_projects?application_id=eq.${encodeURIComponent(applicationId)}&select=id&limit=1`);
    const project = Array.isArray(projectResult.body) ? projectResult.body[0] : null;
    if (!project) return response.status(409).json({ error: 'The member launch project is still being prepared.' });

    const offerResult = await supabase(`/rest/v1/enrollment_offers?project_id=eq.${encodeURIComponent(project.id)}&status=eq.sent&select=checkout_token,allowed_payment_options&order=created_at.desc&limit=1`);
    const offer = Array.isArray(offerResult.body) ? offerResult.body[0] : null;
    if (!offer?.checkout_token) return response.status(409).json({ error: 'Create a payment link for this applicant first.' });

    const label = offer.allowed_payment_options?.[0]?.label || 'your coaching program';
    const paymentUrl = `${siteUrl()}/pages/enrollment-checkout.html?token=${offer.checkout_token}`;

    const emailResult = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Echelon Fitness Collective <welcome@echelonfitness.co>',
        to: application.email,
        subject: 'Your Echelon coaching next step',
        html: paymentEmailHtml(application.full_name, label, paymentUrl),
        text: paymentEmailText(application.full_name, label, paymentUrl)
      })
    });
    if (!emailResult.ok) return response.status(502).json({ error: 'The payment email could not be sent.' });

    await supabase('/rest/v1/automation_events', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ event_type: 'payment_email_sent', application_id: application.id, project_id: project.id, payload: { operator_id: admin.id } }) });
    return response.status(200).json({ message: `Payment email sent to ${application.email}.` });
  } catch (error) {
    console.error('Send payment email error', error && error.message);
    return response.status(503).json({ error: 'The payment email could not be sent right now.' });
  }
}

// Generates a one-time "ASSIGN ONBOARDING QUESTIONS" link (a
// prospect_onboarding_links row) for a lead/applicant the owner didn't get
// on a call with. Folded into this file, rather than a new one under
// api/onboarding-link/, because Vercel's Hobby plan caps a deployment at 12
// serverless functions and this project is already at that limit; this file
// already does admin-gated action dispatch (see sendPaymentEmail above), so
// it's the natural home. The public-facing half of this feature (info
// lookup + answer submission) lives in api/coaching-application/submit.js.
async function createOnboardingLink(admin, body, response) {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return response.status(503).json({ error: 'This is being prepared. Please try again shortly.' });
  const prospectName = String(body?.prospect_name || '').trim().slice(0, 200);
  const prospectEmail = String(body?.prospect_email || '').trim().slice(0, 200);
  const prospectPhone = String(body?.prospect_phone || '').trim().slice(0, 60);
  const programInterest = String(body?.program_interest || '').trim().slice(0, 200);
  if (!prospectName) return response.status(400).json({ error: "Enter the prospect's name first." });

  try {
    const token = randomBytes(24).toString('hex');
    const insertResult = await supabase('/rest/v1/prospect_onboarding_links', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        token,
        prospect_name: prospectName,
        prospect_email: prospectEmail || null,
        prospect_phone: prospectPhone || null,
        program_interest: programInterest || null,
        created_by: admin.id,
      }),
    });
    const link = Array.isArray(insertResult.body) ? insertResult.body[0] : null;
    if (!insertResult.response.ok || !link) return response.status(502).json({ error: 'The link could not be created.' });
    return response.status(200).json({ link: `${siteUrl()}/pages/onboarding-questions.html?token=${token}` });
  } catch (error) {
    console.error('Create onboarding link error', error && error.message);
    return response.status(503).json({ error: 'The link could not be created right now.' });
  }
}

// "RESEND WAIVER REMINDER" / "RESEND ONBOARDING REMINDER" in the Member
// Records detail view. Both just email the member a link back to the page
// that's still outstanding; assets/js/member-auth.js's requireMember()
// guard already auto-redirects a signed-in member to member-onboarding.html
// or member-waiver.html for anything they haven't finished, so a plain link
// to either page (or to member-login.html if they're signed out) always
// lands them in the right place. Folded into this file for the same
// 12-function-cap reason as createOnboardingLink above.
function reminderEmailCopy(kind) {
  return kind === 'waiver'
    ? { subject: 'Please sign your Echelon waiver', page: 'member-waiver.html', label: 'liability waiver', action: 'sign your waiver' }
    : { subject: 'Finish your Echelon onboarding', page: 'member-onboarding.html', label: 'health and readiness onboarding', action: 'complete your onboarding' };
}

function reminderEmailHtml(name, copy, url) {
  const greetingName = (name || '').split(/\s+/)[0] || 'there';
  return `<div style="max-width:520px;margin:0 auto;padding:40px 32px;background:#0d0d0c;color:#ffffff;font-family:'Helvetica Neue',Arial,sans-serif;"><p style="margin:0 0 28px;font-size:11px;letter-spacing:2px;color:#d7b55b;font-weight:700;">ECHELON FITNESS COLLECTIVE</p><h2 style="margin:0 0 16px;font-size:26px;line-height:1.2;color:#ffffff;">One quick step left.</h2><p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#cccccc;">Hi ${greetingName}, you're almost set. Before we get you fully underway, please ${copy.action} in the Member Portal.</p><p style="margin:0 0 28px;"><a href="${url}" style="display:inline-block;padding:14px 28px;background:#d7b55b;color:#0d0d0c;text-decoration:none;font-weight:700;font-size:13px;letter-spacing:1px;">${copy.action.toUpperCase()}</a></p><p style="margin:0;font-size:13px;line-height:1.6;color:#888888;">Respectfully,<br>Echelon Fitness Collective</p></div>`;
}

function reminderEmailText(name, copy, url) {
  const greetingName = (name || '').split(/\s+/)[0] || 'there';
  return `Hi ${greetingName},\n\nYou're almost set. Before we get you fully underway, please ${copy.action} in the Member Portal.\n\n${url}\n\nRespectfully,\nEchelon Fitness Collective`;
}

async function sendMemberReminder(body, kind, response) {
  if (!process.env.RESEND_API_KEY) return response.status(500).json({ error: 'Email sending is not configured yet. Add RESEND_API_KEY in Vercel.' });
  const email = String(body?.email || '').trim();
  const name = String(body?.name || '').trim();
  if (!email) return response.status(400).json({ error: 'This member has no email on file.' });

  const copy = reminderEmailCopy(kind);
  const url = `${siteUrl()}/pages/${copy.page}`;
  try {
    const emailResult = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Echelon Fitness Collective <welcome@echelonfitness.co>',
        to: email,
        subject: copy.subject,
        html: reminderEmailHtml(name, copy, url),
        text: reminderEmailText(name, copy, url),
      }),
    });
    if (!emailResult.ok) return response.status(502).json({ error: 'The reminder email could not be sent.' });
    return response.status(200).json({ message: `Reminder sent to ${email}.` });
  } catch (error) {
    console.error('Send member reminder error', error && error.message);
    return response.status(503).json({ error: 'The reminder could not be sent right now.' });
  }
}

module.exports = async function createEnrollmentOffer(request, response) {
  response.setHeader('Cache-Control', 'no-store'); response.setHeader('X-Content-Type-Options', 'nosniff');
  if (request.method !== 'POST') return response.status(405).json({ error: 'Method not allowed.' });
  const admin = await requireAdmin(request);
  if (!admin) return response.status(401).json({ error: 'Your admin session is required.' });
  if (request.body?.action === 'send-email') return sendPaymentEmail(admin, request.body?.applicationId, response);
  if (request.body?.action === 'create-onboarding-link') return createOnboardingLink(admin, request.body, response);
  if (request.body?.action === 'send-waiver-reminder') return sendMemberReminder(request.body, 'waiver', response);
  if (request.body?.action === 'send-onboarding-reminder') return sendMemberReminder(request.body, 'onboarding', response);
  const { applicationId, paymentOption, groupSize } = request.body || {};
  const option = PAYMENT_OPTIONS[paymentOption];
  if (!applicationId || !option) return response.status(400).json({ error: 'Choose a configured Echelon payment option.' });

  let price, label, lineItems = null, resolvedGroupSize = null;
  if (paymentOption === 'private_group_training') {
    resolvedGroupSize = Number(groupSize);
    if (!Number.isInteger(resolvedGroupSize) || resolvedGroupSize < 3 || resolvedGroupSize > 25) {
      return response.status(400).json({ error: 'Enter a group size between 3 and 25.' });
    }
    const basePrice = process.env[option.basePriceEnv];
    const addonPrice = process.env[option.addonPriceEnv];
    if (!basePrice || !addonPrice) return response.status(400).json({ error: 'Choose a configured Echelon payment option.' });
    const extraPeople = Math.max(0, resolvedGroupSize - option.basePeople);
    const total = option.baseAmount + extraPeople * option.addonAmount;
    price = basePrice;
    label = `Private Group Training · ${resolvedGroupSize} people · $${total}`;
    lineItems = [{ price: basePrice, quantity: 1 }];
    if (extraPeople > 0) lineItems.push({ price: addonPrice, quantity: extraPeople });
  } else {
    price = process.env[option.priceEnv];
    label = option.label;
    if (!price) return response.status(400).json({ error: 'Choose a configured Echelon payment option.' });
  }
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
    const offerResult = await supabase('/rest/v1/enrollment_offers', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ project_id: project.id, allowed_payment_options: [{ key: paymentOption, label, mode: option.mode }], payment_option: paymentOption, stripe_price_id: price, line_items: lineItems, group_size: resolvedGroupSize, checkout_token: token, status: 'sent', payment_status: 'awaiting_payment', sent_at: now, expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() }) });
    const offer = Array.isArray(offerResult.body) ? offerResult.body[0] : null;
    if (!offerResult.response.ok || !offer) return response.status(502).json({ error: 'The payment offer could not be created.' });
    await supabase(`/rest/v1/coaching_applications?id=eq.${encodeURIComponent(applicationId)}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ status: 'Accepted: Payment Pending', application_status: 'approved', approved_program: label, payment_status: 'awaiting_payment', approved_at: now }) });
    await supabase(`/rest/v1/onboarding_projects?id=eq.${encodeURIComponent(project.id)}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ payment_status: 'checkout_created', membership_status: 'approved', onboarding_status: 'awaiting_admin' }) });
    await markTask(project.id, 'Review application and safety flags');
    await markTask(project.id, 'Choose program and assigned coach');
    await markTask(project.id, 'Create approved payment offer');
    await markTask(project.id, 'Send payment-selection link');
    await supabase('/rest/v1/automation_events', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ event_type: 'payment_offer_created', application_id: application.id, project_id: project.id, payload: { offer_id: offer.id, payment_option: paymentOption, operator_id: admin.id } }) });
    return response.status(200).json({ paymentUrl: `${siteUrl()}/pages/enrollment-checkout.html?token=${token}`, applicant: { name: application.full_name, email: application.email }, label });
  } catch (error) {
    console.error('Enrollment offer error', error && error.message);
    return response.status(503).json({ error: 'The offer could not be created right now.' });
  }
};

