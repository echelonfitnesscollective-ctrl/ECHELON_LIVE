'use strict';

const EFC_SESSION_TYPE_LABELS = { one_on_one: '1-on-1 Coaching', private_group: 'Private Group Training' };

function jsonHeaders(key) { return { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }; }

async function supabase(path, options = {}) {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const response = await fetch(`${process.env.SUPABASE_URL}${path}`, { ...options, headers: { ...jsonHeaders(key), ...(options.headers || {}) } });
  const text = await response.text();
  let body = null; try { body = text ? JSON.parse(text) : null; } catch (_) { body = text; }
  return { response, body };
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

async function getAccessToken() {
  const tokenRow = await supabase('/rest/v1/coach_calendar_tokens?id=eq.1&select=refresh_token&limit=1');
  const refreshToken = Array.isArray(tokenRow.body) ? tokenRow.body[0]?.refresh_token : null;
  if (!refreshToken) return null;
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: process.env.GOOGLE_CALENDAR_CLIENT_ID,
      client_secret: process.env.GOOGLE_CALENDAR_CLIENT_SECRET,
      grant_type: 'refresh_token'
    })
  });
  const tokens = await tokenResponse.json();
  return tokenResponse.ok ? tokens.access_token : null;
}

module.exports = async function syncBooking(request, response) {
  response.setHeader('Cache-Control', 'no-store'); response.setHeader('X-Content-Type-Options', 'nosniff');
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

    const accessToken = await getAccessToken();
    if (!accessToken) return response.status(200).json({ synced: false, reason: 'not_connected' });

    if (action === 'cancel') {
      if (booking.google_event_id) {
        await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(booking.google_event_id)}`, {
          method: 'DELETE', headers: { Authorization: `Bearer ${accessToken}` }
        });
      }
      return response.status(200).json({ synced: true });
    }

    const start = new Date(booking.scheduled_at);
    const end = new Date(start.getTime() + booking.duration_minutes * 60 * 1000);
    const eventResponse = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
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
};
