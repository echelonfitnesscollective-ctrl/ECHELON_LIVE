'use strict';

// Every Google Calendar endpoint, plus the health check, collapsed into one
// serverless function. Vercel's Hobby plan caps a deployment at 12
// functions and the site was already at that ceiling, so this file is
// reached via explicit vercel.json rewrites (?route=...) instead of one
// file per action -- /api/calendar/oauth-start, /api/calendar/oauth-callback,
// /api/calendar/status, /api/calendar/sync-booking, /api/calendar/freebusy,
// and (public URL unchanged) /api/health all resolve here.

const { randomBytes } = require('node:crypto');

const EFC_SESSION_TYPE_LABELS = { one_on_one: '1-on-1 Coaching', private_group: 'Private Training Group', group_fitness: 'Group Fitness' };

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

async function requireUser(request) {
  const token = String(request.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token || !process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) return null;
  const userResponse = await fetch(`${process.env.SUPABASE_URL}/auth/v1/user`, { headers: { apikey: process.env.SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` } });
  if (!userResponse.ok) return null;
  return userResponse.json();
}

async function isAdmin(userId) {
  const result = await supabase(`/rest/v1/admin_users?user_id=eq.${encodeURIComponent(userId)}&select=user_id&limit=1`);
  return result.response.ok && Array.isArray(result.body) && result.body.length > 0;
}

async function getCalendarSession() {
  const tokenRow = await supabase('/rest/v1/coach_calendar_tokens?id=eq.1&select=refresh_token,training_calendar_id&limit=1');
  const row = Array.isArray(tokenRow.body) ? tokenRow.body[0] : null;
  if (!row?.refresh_token) return null;
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: row.refresh_token,
      client_id: process.env.GOOGLE_CALENDAR_CLIENT_ID,
      client_secret: process.env.GOOGLE_CALENDAR_CLIENT_SECRET,
      grant_type: 'refresh_token'
    })
  });
  const tokens = await tokenResponse.json();
  if (!tokenResponse.ok) return null;
  return { accessToken: tokens.access_token, calendarId: row.training_calendar_id || 'primary' };
}

// Creates the dedicated yellow "Echelon Training" calendar the first time a
// coach connects, so session events land on their own color-coded calendar
// instead of mixing into the primary one. Returns null on failure -- the
// caller falls back to 'primary' rather than blocking the whole connection.
async function createTrainingCalendar(accessToken) {
  try {
    const createResponse = await fetch('https://www.googleapis.com/calendar/v3/calendars', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ summary: 'Echelon Training' })
    });
    const created = await createResponse.json();
    if (!createResponse.ok || !created.id) return null;
    await fetch(`https://www.googleapis.com/calendar/v3/users/me/calendarList/${encodeURIComponent(created.id)}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ colorId: '5' }) // Banana -- the closest stock Google Calendar color to Echelon gold.
    });
    return created.id;
  } catch (error) {
    console.error('Create training calendar error', error && error.message);
    return null;
  }
}

async function handleHealth(request, response) {
  const origin = request.headers.origin;
  if (origin) response.setHeader('Access-Control-Allow-Origin', origin);
  else response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (request.method === 'OPTIONS') return response.status(204).end();
  return response.status(200).json({
    ok: true,
    vercel: Boolean(process.env.VERCEL || process.env.VERCEL_ENV),
    stripeConfigured: Boolean(process.env.STRIPE_SECRET_KEY?.trim())
  });
}

async function handleOAuthStart(request, response) {
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
}

function sendToAdmin(response, status) {
  response.writeHead(302, { Location: `${siteUrl()}/pages/admin-dashboard.html?calendar=${status}` });
  response.end();
}

async function handleOAuthCallback(request, response) {
  const code = request.query.code;
  const state = request.query.state;
  if (request.query.error || !code || !state) return sendToAdmin(response, 'error');

  try {
    const tokenRow = await supabase('/rest/v1/coach_calendar_tokens?id=eq.1&select=oauth_state,oauth_state_created_at,training_calendar_id&limit=1');
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

    const trainingCalendarId = stored.training_calendar_id || await createTrainingCalendar(tokens.access_token);

    const saveResult = await supabase('/rest/v1/coach_calendar_tokens?id=eq.1', {
      method: 'PATCH', headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        refresh_token: tokens.refresh_token,
        connected_email: connectedEmail,
        connected_at: new Date().toISOString(),
        training_calendar_id: trainingCalendarId,
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
}

async function handleStatus(request, response) {
  if (request.method !== 'GET') return response.status(405).json({ error: 'Method not allowed.' });
  const admin = await requireAdmin(request);
  if (!admin) return response.status(401).json({ error: 'Your admin session is required.' });

  try {
    const result = await supabase('/rest/v1/coach_calendar_tokens?id=eq.1&select=refresh_token,connected_email,connected_at,training_calendar_id&limit=1');
    const row = Array.isArray(result.body) ? result.body[0] : null;
    return response.status(200).json({
      connected: Boolean(row?.refresh_token),
      connectedEmail: row?.connected_email || null,
      connectedAt: row?.connected_at || null,
      trainingCalendarActive: Boolean(row?.training_calendar_id),
      configured: Boolean(process.env.GOOGLE_CALENDAR_CLIENT_ID)
    });
  } catch (error) {
    console.error('Calendar status error', error && error.message);
    return response.status(503).json({ error: 'Could not check the calendar connection right now.' });
  }
}

async function handleFreeBusy(request, response) {
  if (request.method !== 'GET') return response.status(405).json({ error: 'Method not allowed.' });
  const user = await requireUser(request);
  if (!user) return response.status(401).json({ error: 'Your session is required.' });

  const days = Math.min(60, Math.max(1, Number(request.query.days) || 14));
  const timeMin = new Date();
  const timeMax = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

  try {
    const session = await getCalendarSession();
    if (!session) return response.status(200).json({ busy: [] });

    const calendarIds = Array.from(new Set(['primary', session.calendarId]));
    const freeBusyResponse = await fetch('https://www.googleapis.com/calendar/v3/freeBusy', {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ timeMin: timeMin.toISOString(), timeMax: timeMax.toISOString(), items: calendarIds.map((id) => ({ id })) })
    });
    const body = await freeBusyResponse.json();
    if (!freeBusyResponse.ok) return response.status(200).json({ busy: [] });

    const busy = calendarIds.flatMap((id) => body.calendars?.[id]?.busy || []);
    return response.status(200).json({ busy });
  } catch (error) {
    console.error('Calendar freebusy error', error && error.message);
    return response.status(200).json({ busy: [] });
  }
}

async function handleSyncBooking(request, response) {
  if (request.method !== 'POST') return response.status(405).json({ error: 'Method not allowed.' });
  const user = await requireUser(request);
  if (!user) return response.status(401).json({ error: 'Your session is required.' });

  const { bookingId, action } = request.body || {};
  if (!bookingId || !['create', 'cancel'].includes(action)) return response.status(400).json({ error: 'A booking and a valid action are required.' });

  try {
    const bookingResult = await supabase(`/rest/v1/session_bookings?id=eq.${encodeURIComponent(bookingId)}&select=id,user_id,member_name,session_type,scheduled_at,duration_minutes,notes,google_event_id&limit=1`);
    const booking = Array.isArray(bookingResult.body) ? bookingResult.body[0] : null;
    if (!booking) return response.status(404).json({ error: 'That booking could not be found.' });
    if (booking.user_id !== user.id && !(await isAdmin(user.id))) return response.status(403).json({ error: 'You cannot sync this booking.' });

    const session = await getCalendarSession();
    if (!session) return response.status(200).json({ synced: false, reason: 'not_connected' });

    if (action === 'cancel') {
      if (booking.google_event_id) {
        await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(session.calendarId)}/events/${encodeURIComponent(booking.google_event_id)}`, {
          method: 'DELETE', headers: { Authorization: `Bearer ${session.accessToken}` }
        });
      }
      return response.status(200).json({ synced: true });
    }

    const start = new Date(booking.scheduled_at);
    const end = new Date(start.getTime() + booking.duration_minutes * 60 * 1000);
    const eventResponse = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(session.calendarId)}/events`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        summary: `${EFC_SESSION_TYPE_LABELS[booking.session_type] || booking.session_type} · ${booking.member_name}`,
        description: booking.notes || undefined,
        start: { dateTime: start.toISOString() },
        end: { dateTime: end.toISOString() }
      })
    });
    const event = await eventResponse.json();
    if (!eventResponse.ok || !event.id) return response.status(200).json({ synced: false, reason: 'google_error' });

    await supabase(`/rest/v1/session_bookings?id=eq.${encodeURIComponent(bookingId)}`, {
      method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ google_event_id: event.id })
    });
    return response.status(200).json({ synced: true });
  } catch (error) {
    console.error('Booking sync error', error && error.message);
    return response.status(200).json({ synced: false, reason: 'error' });
  }
}

module.exports = async function calendarGateway(request, response) {
  response.setHeader('Cache-Control', 'no-store'); response.setHeader('X-Content-Type-Options', 'nosniff');
  const route = Array.isArray(request.query.route) ? request.query.route[0] : request.query.route;

  if (route === 'health') return handleHealth(request, response);
  if (route === 'oauth-start') return handleOAuthStart(request, response);
  if (route === 'freebusy') return handleFreeBusy(request, response);
  if (route === 'oauth-callback') return handleOAuthCallback(request, response);
  if (route === 'status') return handleStatus(request, response);
  if (route === 'sync-booking') return handleSyncBooking(request, response);
  return response.status(404).json({ error: 'Not found.' });
};
