'use strict';

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

function sendToAdmin(response, status) {
  response.writeHead(302, { Location: `${siteUrl()}/pages/admin-dashboard.html?calendar=${status}` });
  response.end();
}

module.exports = async function calendarOAuthCallback(request, response) {
  response.setHeader('Cache-Control', 'no-store'); response.setHeader('X-Content-Type-Options', 'nosniff');
  const url = new URL(request.url, siteUrl());
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  if (url.searchParams.get('error') || !code || !state) return sendToAdmin(response, 'error');

  try {
    const tokenRow = await supabase('/rest/v1/coach_calendar_tokens?id=eq.1&select=oauth_state,oauth_state_created_at&limit=1');
    const stored = Array.isArray(tokenRow.body) ? tokenRow.body[0] : null;
    const stateAge = stored?.oauth_state_created_at ? Date.now() - new Date(stored.oauth_state_created_at).getTime() : Infinity;
    if (!stored?.oauth_state || stored.oauth_state !== state || stateAge > 10 * 60 * 1000) return sendToAdmin(response, 'error');

    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CALENDAR_CLIENT_ID,
        client_secret: process.env.GOOGLE_CALENDAR_CLIENT_SECRET,
        redirect_uri: redirectUri(),
        grant_type: 'authorization_code'
      })
    });
    const tokens = await tokenResponse.json();
    if (!tokenResponse.ok || !tokens.refresh_token) return sendToAdmin(response, 'error');

    let connectedEmail = null;
    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', { headers: { Authorization: `Bearer ${tokens.access_token}` } });
    if (userInfoResponse.ok) connectedEmail = (await userInfoResponse.json()).email || null;

    const saveResult = await supabase('/rest/v1/coach_calendar_tokens?id=eq.1', {
      method: 'PATCH', headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        refresh_token: tokens.refresh_token,
        connected_email: connectedEmail,
        connected_at: new Date().toISOString(),
        oauth_state: null,
        oauth_state_created_at: null
      })
    });
    if (!saveResult.response.ok) return sendToAdmin(response, 'error');

    return sendToAdmin(response, 'connected');
  } catch (error) {
    console.error('Calendar OAuth callback error', error && error.message);
    return sendToAdmin(response, 'error');
  }
};
