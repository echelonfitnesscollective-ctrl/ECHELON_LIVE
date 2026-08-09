'use strict';

function siteUrl() { return String(process.env.SITE_URL || 'https://www.echelonfitness.co').replace(/\/$/, ''); }
function jsonHeaders(key) { return { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }; }

async function supabase(path, options = {}) {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
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

function paymentEmailHtml(name, label, paymentUrl) {
  const greetingName = (name || '').split(/\s+/)[0] || 'there';
  return `<div style="max-width:520px;margin:0 auto;padding:40px 32px;background:#0d0d0c;color:#ffffff;font-family:'Helvetica Neue',Arial,sans-serif;"><p style="margin:0 0 28px;font-size:11px;letter-spacing:2px;color:#d7b55b;font-weight:700;">ECHELON FITNESS COLLECTIVE</p><h2 style="margin:0 0 16px;font-size:26px;line-height:1.2;color:#ffffff;">Your coaching next step.</h2><p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#cccccc;">Hi ${greetingName}, thank you for sharing your goals with Echelon. I'd be glad to move forward with ${label}.</p><p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#cccccc;">Your private payment link is below. Once payment is confirmed, I'll send your Member Portal invitation and onboarding next steps.</p><p style="margin:0 0 28px;"><a href="${paymentUrl}" style="display:inline-block;padding:14px 28px;background:#d7b55b;color:#0d0d0c;text-decoration:none;font-weight:700;font-size:13px;letter-spacing:1px;">VIEW PAYMENT LINK</a></p><p style="margin:0;font-size:13px;line-height:1.6;color:#888888;">Respectfully,<br>Echelon Fitness Collective</p></div>`;
}

function paymentEmailText(name, label, paymentUrl) {
  const greetingName = (name || '').split(/\s+/)[0] || 'there';
  return `Hi ${greetingName},\n\nThank you for sharing your goals with Echelon. I'd be glad to move forward with ${label}.\n\nYour private payment link is below. Once payment is confirmed, I'll send your Member Portal invitation and onboarding next steps.\n\n${paymentUrl}\n\nRespectfully,\nEchelon Fitness Collective`;
}

module.exports = async function sendPaymentEmail(request, response) {
  response.setHeader('Cache-Control', 'no-store'); response.setHeader('X-Content-Type-Options', 'nosniff');
  if (request.method !== 'POST') return response.status(405).json({ error: 'Method not allowed.' });
  const admin = await requireAdmin(request);
  if (!admin) return response.status(401).json({ error: 'Your admin session is required.' });
  if (!process.env.RESEND_API_KEY) return response.status(500).json({ error: 'Email sending is not configured yet. Add RESEND_API_KEY in Vercel.' });

  const applicationId = request.body?.applicationId;
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
};
