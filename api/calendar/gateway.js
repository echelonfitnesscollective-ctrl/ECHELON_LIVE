'use strict';

// Every Google Calendar endpoint, the group-join links, plus the health
// check, collapsed into one serverless function. Vercel's Hobby plan caps
// a deployment at 12 functions and the site was already at that ceiling,
// so this file is reached via explicit vercel.json rewrites (?route=...)
// instead of one file per action -- /api/calendar/oauth-start,
// /api/calendar/oauth-callback, /api/calendar/status,
// /api/calendar/sync-booking, /api/calendar/freebusy, /api/groups/create,
// /api/groups/info, /api/groups/join, /api/build-group/info,
// /api/build-group/invite, /api/build-group/join, and (public URL
// unchanged) /api/health all resolve here.

const { randomBytes } = require('node:crypto');
const { sendEmail } = require('../_lib/email');

const EFC_SESSION_TYPE_LABELS = { one_on_one: '1-on-1 Coaching', private_group: 'Private Training Group', group_fitness: 'Group Fitness' };

// group-join is the one route here a stranger can call with no admin/member
// session at all (that's the point, guests join via link), so it's the one
// that needs its own IP throttle rather than relying on auth to gate abuse.
const groupJoinRateLimit = new Map();
const GROUP_JOIN_WINDOW_MS = 60_000;
const GROUP_JOIN_MAX_PER_WINDOW = 5;

function clientIp(request) {
  return String(request.headers['x-forwarded-for'] || request.socket?.remoteAddress || 'unknown').split(',')[0].trim();
}

function isGroupJoinRateLimited(ip) {
  const now = Date.now();
  const entry = groupJoinRateLimit.get(ip) || { count: 0, windowStart: now };
  if (now - entry.windowStart > GROUP_JOIN_WINDOW_MS) { entry.count = 0; entry.windowStart = now; }
  entry.count += 1;
  groupJoinRateLimit.set(ip, entry);
  if (groupJoinRateLimit.size > 1000) {
    const cutoff = now - GROUP_JOIN_WINDOW_MS;
    for (const [key, value] of groupJoinRateLimit) if (value.windowStart < cutoff) groupJoinRateLimit.delete(key);
  }
  return entry.count > GROUP_JOIN_MAX_PER_WINDOW;
}

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
      scope: 'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.calendars https://www.googleapis.com/auth/userinfo.email',
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

// Shared by the authenticated sync-booking flow and the anonymous
// group-join flow -- creates a Google Calendar event for a booking and
// writes the resulting event id back. Best-effort: never throws.
async function createCalendarEventForBooking(booking) {
  try {
    const session = await getCalendarSession();
    if (!session) return;
    const start = new Date(booking.scheduled_at);
    const end = new Date(start.getTime() + booking.duration_minutes * 60 * 1000);
    const eventResponse = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(session.calendarId)}/events`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        summary: `${booking.class_label || EFC_SESSION_TYPE_LABELS[booking.session_type] || booking.session_type} · ${booking.member_name}`,
        description: booking.notes || undefined,
        start: { dateTime: start.toISOString() },
        end: { dateTime: end.toISOString() }
      })
    });
    const event = await eventResponse.json();
    if (!eventResponse.ok || !event.id) return;
    await supabase(`/rest/v1/session_bookings?id=eq.${encodeURIComponent(booking.id)}`, {
      method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ google_event_id: event.id })
    });
  } catch (error) {
    console.error('Create calendar event error', error && error.message);
  }
}

async function handleGroupCreate(request, response) {
  if (request.method !== 'POST') return response.status(405).json({ error: 'Method not allowed.' });
  const admin = await requireAdmin(request);
  if (!admin) return response.status(401).json({ error: 'Your admin session is required.' });

  const { sessionType, windowId, date, time, durationMinutes, capacity, classLabel, hostName, hostEmail, notes } = request.body || {};
  if (!date || !time || !['private_group', 'group_fitness'].includes(sessionType)) {
    return response.status(400).json({ error: 'A session type, date, and time are required.' });
  }
  const scheduledAt = new Date(`${date}T${time}`);
  if (Number.isNaN(scheduledAt.getTime())) return response.status(400).json({ error: 'Choose a valid date and time.' });

  try {
    const insertResult = await supabase('/rest/v1/session_groups', {
      method: 'POST', headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        window_id: windowId || null,
        session_type: sessionType,
        scheduled_at: scheduledAt.toISOString(),
        duration_minutes: Math.max(15, Number(durationMinutes) || 60),
        capacity: Math.max(1, Number(capacity) || 1),
        class_label: classLabel?.trim() || null,
        host_name: hostName?.trim() || null,
        host_email: hostEmail?.trim() || null,
        notes: notes?.trim() || null
      })
    });
    const group = Array.isArray(insertResult.body) ? insertResult.body[0] : null;
    if (!insertResult.response.ok || !group) return response.status(502).json({ error: 'Could not create that group session.' });
    return response.status(200).json({ joinUrl: `${siteUrl()}/pages/join-group.html?token=${group.join_token}` });
  } catch (error) {
    console.error('Group create error', error && error.message);
    return response.status(503).json({ error: 'Could not create that group session right now.' });
  }
}

async function handleGroupInfo(request, response) {
  if (request.method !== 'GET') return response.status(405).json({ error: 'Method not allowed.' });
  const token = request.query.token;
  if (!token) return response.status(400).json({ error: 'A link token is required.' });

  try {
    const groupResult = await supabase(`/rest/v1/session_groups?join_token=eq.${encodeURIComponent(token)}&select=id,session_type,class_label,scheduled_at,duration_minutes,capacity,host_name&limit=1`);
    const group = Array.isArray(groupResult.body) ? groupResult.body[0] : null;
    if (!group) return response.status(404).json({ error: 'This link is not valid. Ask your host for a new one.' });

    const takenResult = await supabase(`/rest/v1/session_bookings?scheduled_at=eq.${encodeURIComponent(group.scheduled_at)}&status=in.(confirmed,waitlisted)&select=status`);
    const takenRows = Array.isArray(takenResult.body) ? takenResult.body : [];
    const taken = takenRows.filter((row) => row.status === 'confirmed').length;
    const waitlisted = takenRows.filter((row) => row.status === 'waitlisted').length;
    const waitlistOpen = taken >= group.capacity && waitlisted < 1;

    return response.status(200).json({
      sessionType: group.session_type,
      classLabel: group.class_label,
      scheduledAt: group.scheduled_at,
      durationMinutes: group.duration_minutes,
      capacity: group.capacity,
      taken,
      full: taken >= group.capacity && waitlisted >= 1,
      waitlistOpen,
      hostName: group.host_name
    });
  } catch (error) {
    console.error('Group info error', error && error.message);
    return response.status(503).json({ error: 'Could not load this session right now.' });
  }
}

async function handleGroupJoin(request, response) {
  if (request.method !== 'POST') return response.status(405).json({ error: 'Method not allowed.' });
  if (isGroupJoinRateLimited(clientIp(request))) return response.status(429).json({ error: 'Too many requests. Please wait a minute and try again.' });
  const { token, fullName, email, phone, waiverAgreed } = request.body || {};
  if (!token || !fullName?.trim() || !waiverAgreed) return response.status(400).json({ error: 'Your name and a signed waiver are required.' });

  try {
    const groupResult = await supabase(`/rest/v1/session_groups?join_token=eq.${encodeURIComponent(token)}&select=id,window_id,session_type,class_label,scheduled_at,duration_minutes&limit=1`);
    const group = Array.isArray(groupResult.body) ? groupResult.body[0] : null;
    if (!group) return response.status(404).json({ error: 'This link is not valid. Ask your host for a new one.' });

    const insertResult = await supabase('/rest/v1/session_bookings', {
      method: 'POST', headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        user_id: null,
        member_name: fullName.trim(),
        guest_email: email?.trim() || null,
        guest_phone: phone?.trim() || null,
        waiver_agreed: true,
        session_type: group.session_type,
        class_label: group.class_label,
        scheduled_at: group.scheduled_at,
        duration_minutes: group.duration_minutes,
        booked_by: 'guest',
        window_id: group.window_id,
        group_id: group.id
      })
    });
    const booking = Array.isArray(insertResult.body) ? insertResult.body[0] : null;
    if (!insertResult.response.ok || !booking) {
      if (insertResult.body?.code === '23514') return response.status(409).json({ error: 'This session just filled up.' });
      return response.status(502).json({ error: 'Could not save your spot, try again.' });
    }

    if (booking.status === 'confirmed') createCalendarEventForBooking(booking);
    return response.status(200).json({ confirmed: booking.status === 'confirmed', waitlisted: booking.status === 'waitlisted', scheduledAt: booking.scheduled_at });
  } catch (error) {
    console.error('Group join error', error && error.message);
    return response.status(503).json({ error: 'Could not save your spot right now.' });
  }
}

// Build Your Group: a lead's own id (an unguessable uuid, never publicly
// enumerable - website_leads has no public read policy) is the only key
// needed to manage or join a group, same trust model as session_groups'
// join_token above. No admin/member session involved anywhere in this
// flow - the "coach" side is just the existing Leads checklist.
async function getBuildGroupLead(leadId) {
  const result = await supabase(`/rest/v1/website_leads?id=eq.${encodeURIComponent(leadId)}&lead_type=eq.${encodeURIComponent('Build Your Group')}&select=id,full_name&limit=1`);
  return Array.isArray(result.body) && result.body[0] ? result.body[0] : null;
}

async function handleBuildGroupInfo(request, response) {
  if (request.method !== 'GET') return response.status(405).json({ error: 'Method not allowed.' });
  const leadId = request.query.lead;
  if (!leadId) return response.status(400).json({ error: 'A group link is required.' });

  try {
    const lead = await getBuildGroupLead(leadId);
    if (!lead) return response.status(404).json({ error: 'This group link is not valid.' });

    const attendeesResult = await supabase(`/rest/v1/build_group_attendees?lead_id=eq.${encodeURIComponent(leadId)}&select=id,name,phone,email,waiver_agreed,added_by&order=created_at.asc`);
    const attendees = Array.isArray(attendeesResult.body) ? attendeesResult.body : [];
    return response.status(200).json({
      attendees: attendees.map((a) => ({ id: a.id, name: a.name, phone: a.phone, email: a.email, waiverAgreed: a.waiver_agreed, addedBy: a.added_by })),
    });
  } catch (error) {
    console.error('Build group info error', error && error.message);
    return response.status(503).json({ error: 'Could not load your group right now.' });
  }
}

// Organizer enters someone directly - creates the attendee row right
// away (so the roster and the coach's checklist both see them
// immediately) and, when an email was given, sends that person their
// own personal confirm-and-sign-the-waiver link. Phone-only attendees
// still get a personal joinUrl back in the response so the organizer
// can copy and text it themselves - there is no SMS sending here.
async function handleBuildGroupInvite(request, response) {
  if (request.method !== 'POST') return response.status(405).json({ error: 'Method not allowed.' });
  if (isGroupJoinRateLimited(clientIp(request))) return response.status(429).json({ error: 'Too many requests. Please wait a minute and try again.' });

  const { leadId, name, phone, email } = request.body || {};
  if (!leadId || !name?.trim() || (!phone?.trim() && !email?.trim())) {
    return response.status(400).json({ error: 'A name and a phone or email are required.' });
  }

  try {
    const lead = await getBuildGroupLead(leadId);
    if (!lead) return response.status(404).json({ error: 'This group link is not valid.' });

    const insertResult = await supabase('/rest/v1/build_group_attendees', {
      method: 'POST', headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        lead_id: leadId,
        name: name.trim(),
        phone: phone?.trim() || null,
        email: email?.trim() || null,
        added_by: 'organizer',
        invited_at: new Date().toISOString(),
      }),
    });
    const attendee = Array.isArray(insertResult.body) ? insertResult.body[0] : null;
    if (!insertResult.response.ok || !attendee) return response.status(502).json({ error: 'Could not add that person.' });

    const joinUrl = `${siteUrl()}/pages/build-your-group-join.html?lead=${leadId}&attendee=${attendee.id}`;
    if (attendee.email) {
      await sendEmail({
        to: attendee.email,
        subject: "You're invited to join an Echelon group",
        text: `Hi ${attendee.name.split(' ')[0]},\n\n${lead.full_name || 'Someone'} added you to their group for Echelon's Build Your Group promo. Confirm your spot and sign the quick waiver here:\n\n${joinUrl}\n\nThis is a private invite - please don't share this link on social media.`,
      });
    }

    return response.status(200).json({ id: attendee.id, name: attendee.name, phone: attendee.phone, email: attendee.email, waiverAgreed: false, addedBy: 'organizer', joinUrl });
  } catch (error) {
    console.error('Build group invite error', error && error.message);
    return response.status(503).json({ error: 'Could not add that person right now.' });
  }
}

// Two shapes through one route: attendeeId present means the organizer
// already entered this person and they're just confirming + signing
// their own waiver (an update); no attendeeId means a brand-new
// self-join off the shared group link (an insert).
async function handleBuildGroupJoin(request, response) {
  if (request.method !== 'POST') return response.status(405).json({ error: 'Method not allowed.' });
  if (isGroupJoinRateLimited(clientIp(request))) return response.status(429).json({ error: 'Too many requests. Please wait a minute and try again.' });

  const { leadId, attendeeId, fullName, email, phone, waiverAgreed } = request.body || {};
  if (!leadId || !fullName?.trim() || !waiverAgreed) return response.status(400).json({ error: 'Your name and a signed waiver are required.' });

  try {
    const lead = await getBuildGroupLead(leadId);
    if (!lead) return response.status(404).json({ error: 'This group link is not valid.' });

    if (attendeeId) {
      const updateResult = await supabase(`/rest/v1/build_group_attendees?id=eq.${encodeURIComponent(attendeeId)}&lead_id=eq.${encodeURIComponent(leadId)}`, {
        method: 'PATCH', headers: { Prefer: 'return=representation' },
        body: JSON.stringify({
          name: fullName.trim(),
          phone: phone?.trim() || null,
          email: email?.trim() || null,
          waiver_agreed: true,
          joined_at: new Date().toISOString(),
        }),
      });
      const updated = Array.isArray(updateResult.body) ? updateResult.body[0] : null;
      if (!updateResult.response.ok || !updated) return response.status(404).json({ error: 'This personal link is not valid.' });
      return response.status(200).json({ confirmed: true });
    }

    const insertResult = await supabase('/rest/v1/build_group_attendees', {
      method: 'POST', headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        lead_id: leadId,
        name: fullName.trim(),
        phone: phone?.trim() || null,
        email: email?.trim() || null,
        added_by: 'self',
        waiver_agreed: true,
        joined_at: new Date().toISOString(),
      }),
    });
    if (!insertResult.response.ok) return response.status(502).json({ error: 'Could not save your spot, try again.' });
    return response.status(200).json({ confirmed: true });
  } catch (error) {
    console.error('Build group join error', error && error.message);
    return response.status(503).json({ error: 'Could not save your spot right now.' });
  }
}

// One-time admin action: creates a real Stripe Product plus the two
// recurring Prices and Payment Links a manual campaign like Wedding
// Ready Group needs (a $65/mo group rate and a $100/mo individual
// rate), then hands both Payment Link URLs straight back so they can
// be wired into wherever the coach sends them from. Deliberately not
// idempotent - re-running this creates a second product/set of prices,
// so it's meant to be triggered once per campaign, by the coach's own
// admin session, never automatically.
async function handleCreateCampaignPrices(request, response) {
  if (request.method !== 'POST') return response.status(405).json({ error: 'Method not allowed.' });
  const admin = await requireAdmin(request);
  if (!admin) return response.status(401).json({ error: 'Your admin session is required.' });
  if (!process.env.STRIPE_SECRET_KEY) return response.status(503).json({ error: 'Stripe is not configured yet.' });

  const { productName, productDescription, prices } = request.body || {};
  if (!productName?.trim() || !Array.isArray(prices) || prices.length === 0) {
    return response.status(400).json({ error: 'A product name and at least one price are required.' });
  }
  for (const p of prices) {
    if (!p?.label || !Number.isFinite(Number(p.unitAmount)) || Number(p.unitAmount) <= 0) {
      return response.status(400).json({ error: 'Each price needs a label and a positive unit amount in cents.' });
    }
  }

  const stripeHeaders = { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`, 'Content-Type': 'application/x-www-form-urlencoded' };

  try {
    const productParams = new URLSearchParams();
    productParams.set('name', productName.trim());
    if (productDescription?.trim()) productParams.set('description', productDescription.trim());
    const productResponse = await fetch('https://api.stripe.com/v1/products', { method: 'POST', headers: stripeHeaders, body: productParams });
    const product = await productResponse.json();
    if (!productResponse.ok) return response.status(502).json({ error: product.error?.message || 'Could not create the Stripe product.' });

    const results = [];
    for (const p of prices) {
      const priceParams = new URLSearchParams();
      priceParams.set('product', product.id);
      priceParams.set('unit_amount', String(Math.round(Number(p.unitAmount))));
      priceParams.set('currency', 'usd');
      priceParams.set('nickname', p.label);
      if (p.recurringInterval) priceParams.set('recurring[interval]', p.recurringInterval);
      const priceResponse = await fetch('https://api.stripe.com/v1/prices', { method: 'POST', headers: stripeHeaders, body: priceParams });
      const price = await priceResponse.json();
      if (!priceResponse.ok) return response.status(502).json({ error: price.error?.message || `Could not create the "${p.label}" price.` });

      const linkParams = new URLSearchParams();
      linkParams.set('line_items[0][price]', price.id);
      linkParams.set('line_items[0][quantity]', '1');
      const linkResponse = await fetch('https://api.stripe.com/v1/payment_links', { method: 'POST', headers: stripeHeaders, body: linkParams });
      const link = await linkResponse.json();
      if (!linkResponse.ok) return response.status(502).json({ error: link.error?.message || `Could not create a payment link for "${p.label}".` });

      results.push({ label: p.label, priceId: price.id, paymentLink: link.url });
    }

    return response.status(200).json({ productId: product.id, prices: results });
  } catch (error) {
    console.error('Create campaign prices error', error && error.message);
    return response.status(503).json({ error: 'Could not create Stripe prices right now.' });
  }
}

// One-time admin action: creates a real Stripe Coupon + Promotion Code
// against an existing recurring Price (defaults to the Echelon 12 monthly
// price), so a coach can hand out a redeemable code - like "WEDDING65" -
// instead of a one-off Payment Link. The discount is computed from the
// Price's live unit_amount rather than a hardcoded number, so it stays
// correct even if that price ever changes. Applies_to[products] scopes the
// coupon to that one product so it can't be misapplied to unrelated
// checkouts. Requires STRIPE_ALLOW_PROMOTION_CODES=true so the checkout
// flows in api/enrollment/checkout.js and api/checkout/create.js actually
// show the "Add promotion code" field.
async function handleCreatePromoCode(request, response) {
  if (request.method !== 'POST') return response.status(405).json({ error: 'Method not allowed.' });
  const admin = await requireAdmin(request);
  if (!admin) return response.status(401).json({ error: 'Your admin session is required.' });
  if (!process.env.STRIPE_SECRET_KEY) return response.status(503).json({ error: 'Stripe is not configured yet.' });

  const { code, priceId, discountedAmountCents, maxRedemptions, redeemBy } = request.body || {};
  const targetPriceId = priceId || process.env.STRIPE_PRICE_12_WEEK_MONTHLY;
  if (!code?.trim() || !targetPriceId || !Number.isFinite(Number(discountedAmountCents)) || Number(discountedAmountCents) <= 0) {
    return response.status(400).json({ error: 'A code, target price, and positive discounted amount (in cents) are required.' });
  }
  if (!Number.isInteger(Number(maxRedemptions)) || Number(maxRedemptions) <= 0) {
    return response.status(400).json({ error: 'Enter how many people can redeem this code.' });
  }

  const stripeHeaders = { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`, 'Content-Type': 'application/x-www-form-urlencoded' };

  try {
    const priceResponse = await fetch(`https://api.stripe.com/v1/prices/${encodeURIComponent(targetPriceId)}`, { headers: stripeHeaders });
    const price = await priceResponse.json();
    if (!priceResponse.ok) return response.status(502).json({ error: price.error?.message || 'Could not look up that Stripe price.' });

    const amountOff = Number(price.unit_amount) - Number(discountedAmountCents);
    if (!(amountOff > 0)) return response.status(400).json({ error: 'The discounted amount must be less than the price’s current amount.' });

    const couponParams = new URLSearchParams();
    couponParams.set('amount_off', String(Math.round(amountOff)));
    couponParams.set('currency', price.currency || 'usd');
    couponParams.set('duration', 'forever');
    couponParams.set('name', `${code.trim().toUpperCase()} Promo`);
    couponParams.set('applies_to[products][0]', price.product);
    const couponResponse = await fetch('https://api.stripe.com/v1/coupons', { method: 'POST', headers: stripeHeaders, body: couponParams });
    const coupon = await couponResponse.json();
    if (!couponResponse.ok) return response.status(502).json({ error: coupon.error?.message || 'Could not create the Stripe coupon.', step: 'coupon', stripeError: coupon.error });

    const promoParams = new URLSearchParams();
    promoParams.set('promotion[type]', 'coupon');
    promoParams.set('promotion[coupon]', coupon.id);
    promoParams.set('code', code.trim().toUpperCase());
    promoParams.set('max_redemptions', String(Number(maxRedemptions)));
    if (redeemBy) promoParams.set('expires_at', String(Math.floor(new Date(redeemBy).getTime() / 1000)));
    const promoResponse = await fetch('https://api.stripe.com/v1/promotion_codes', { method: 'POST', headers: stripeHeaders, body: promoParams });
    const promo = await promoResponse.json();
    if (!promoResponse.ok) return response.status(502).json({ error: promo.error?.message || 'Could not create the promotion code.', step: 'promotion_code', stripeError: promo.error, couponId: coupon.id });

    return response.status(200).json({
      code: promo.code,
      couponId: coupon.id,
      promotionCodeId: promo.id,
      originalAmountCents: price.unit_amount,
      discountedAmountCents: Number(discountedAmountCents),
      maxRedemptions: promo.max_redemptions,
      expiresAt: promo.expires_at,
    });
  } catch (error) {
    console.error('Create promo code error', error && error.message);
    return response.status(503).json({ error: 'Could not create the promo code right now.' });
  }
}

async function handleSyncBooking(request, response) {
  if (request.method !== 'POST') return response.status(405).json({ error: 'Method not allowed.' });
  const user = await requireUser(request);
  if (!user) return response.status(401).json({ error: 'Your session is required.' });

  const { bookingId, action } = request.body || {};
  if (!bookingId || !['create', 'cancel'].includes(action)) return response.status(400).json({ error: 'A booking and a valid action are required.' });

  try {
    const bookingResult = await supabase(`/rest/v1/session_bookings?id=eq.${encodeURIComponent(bookingId)}&select=id,user_id,member_name,session_type,class_label,scheduled_at,duration_minutes,notes,status,google_event_id&limit=1`);
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

    if (booking.status !== 'confirmed') return response.status(200).json({ synced: false, reason: 'waitlisted' });

    await createCalendarEventForBooking(booking);
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
  if (route === 'group-create') return handleGroupCreate(request, response);
  if (route === 'group-info') return handleGroupInfo(request, response);
  if (route === 'group-join') return handleGroupJoin(request, response);
  if (route === 'build-group-info') return handleBuildGroupInfo(request, response);
  if (route === 'build-group-invite') return handleBuildGroupInvite(request, response);
  if (route === 'build-group-join') return handleBuildGroupJoin(request, response);
  if (route === 'create-campaign-prices') return handleCreateCampaignPrices(request, response);
  if (route === 'create-promo-code') return handleCreatePromoCode(request, response);
  return response.status(404).json({ error: 'Not found.' });
};
