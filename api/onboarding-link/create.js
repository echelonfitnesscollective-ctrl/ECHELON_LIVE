'use strict';

// Admin-only: generates a private "ASSIGN ONBOARDING QUESTIONS" link for a
// prospect who didn't get on a call, so they can answer the coaching
// application question set themselves. Same token pattern as
// api/enrollment/create-offer.js (checkout_token) and session_groups
// (join_token): a random hex token is the only way into the row, there is
// no anon/authenticated RLS policy on prospect_onboarding_links.

const { randomBytes } = require('node:crypto');

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

module.exports = async function createOnboardingLink(request, response) {
  response.setHeader('Cache-Control', 'no-store'); response.setHeader('X-Content-Type-Options', 'nosniff');
  if (request.method !== 'POST') return response.status(405).json({ error: 'Method not allowed.' });
  const admin = await requireAdmin(request);
  if (!admin) return response.status(401).json({ error: 'Your admin session is required.' });
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return response.status(503).json({ error: 'This is being prepared. Please try again shortly.' });

  const body = request.body || {};
  const prospectName = String(body.prospect_name || '').trim().slice(0, 200);
  const prospectEmail = String(body.prospect_email || '').trim().slice(0, 200);
  const prospectPhone = String(body.prospect_phone || '').trim().slice(0, 60);
  const programInterest = String(body.program_interest || '').trim().slice(0, 200);
  if (!prospectName) return response.status(400).json({ error: 'Enter the prospect\'s name first.' });

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
};
