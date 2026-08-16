'use strict';

const { randomBytes } = require('node:crypto');

function siteUrl() { return String(process.env.SITE_URL || 'https://www.echelonfitness.co').replace(/\/$/, ''); }
function jsonHeaders(key) { return { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }; }
function redirectUri() { return `${siteUrl()}/api/calendar/oauth-callback`; }

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

module.exports = async function startCalendarOAuth(request, response) {
  response.setHeader('Cache-Control', 'no-store'); response.setHeader('X-Content-Type-Options', 'nosniff');
  if (request.method !== 'POST') return response.status(405).json({ error: 'Method not allowed.' });
  const admin = await requireAdmin(request);
  if (!admin) return response.status(401).json({ error: 'Your admin session is required.' });
  if (!process.env.GOOGLE_CALENDAR_CLIENT_ID) return response.status(500).json({ error: 'Google Calendar is not configured yet. Add GOOGLE_CALENDAR_CLIENT_ID and GOOGLE_CALENDAR_CLIENT_SECRET in Vercel.' });

  try {
    const state = randomBytes(24).toString('hex');
    const stateResult = await supabase('/rest/v1/coach_calendar_tokens?id=eq.1', {
      method: 'PATCH', headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ oauth_state: state, oauth_state_created_at: new Date().toISOString() })
    });
    if (!stateResult.response.ok) return response.status(502).json({ error: 'Could not start the Google connection.' });

    const params = new URLSearchParams({
      client_id: process.env.GOOGLE_CALENDAR_CLIENT_ID,
      redirect_uri: redirectUri(),
      response_type: 'code',
      access_type: 'offline',
      prompt: 'consent',
      scope: 'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/userinfo.email',
      state
    });
    return response.status(200).json({ authUrl: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}` });
  } catch (error) {
    console.error('Calendar OAuth start error', error && error.message);
    return response.status(503).json({ error: 'Could not start the Google connection right now.' });
  }
};
