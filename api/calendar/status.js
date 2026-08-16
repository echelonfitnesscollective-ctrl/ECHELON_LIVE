'use strict';

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

module.exports = async function calendarStatus(request, response) {
  response.setHeader('Cache-Control', 'no-store'); response.setHeader('X-Content-Type-Options', 'nosniff');
  if (request.method !== 'GET') return response.status(405).json({ error: 'Method not allowed.' });
  const admin = await requireAdmin(request);
  if (!admin) return response.status(401).json({ error: 'Your admin session is required.' });

  try {
    const result = await supabase('/rest/v1/coach_calendar_tokens?id=eq.1&select=refresh_token,connected_email,connected_at&limit=1');
    const row = Array.isArray(result.body) ? result.body[0] : null;
    return response.status(200).json({
      connected: Boolean(row?.refresh_token),
      connectedEmail: row?.connected_email || null,
      connectedAt: row?.connected_at || null,
      configured: Boolean(process.env.GOOGLE_CALENDAR_CLIENT_ID)
    });
  } catch (error) {
    console.error('Calendar status error', error && error.message);
    return response.status(503).json({ error: 'Could not check the calendar connection right now.' });
  }
};
