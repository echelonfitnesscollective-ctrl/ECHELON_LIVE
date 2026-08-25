'use strict';

// Public: submits answers for a prospect_onboarding_links token. Creates a
// normal coaching_applications row (source='admin_assigned_link') so it
// shows up in the Admin Console's existing Applications list exactly like a
// public application, then marks the link completed so the token can't be
// reused.

const { notifyOwner } = require('../_lib/email');

const inMemoryRateLimit = new Map();
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 3;

function clientIp(request) {
  return String(request.headers['x-forwarded-for'] || request.socket?.remoteAddress || 'unknown').split(',')[0].trim();
}

function rateLimited(ip) {
  const now = Date.now();
  const entry = inMemoryRateLimit.get(ip) || { count: 0, windowStart: now };
  if (now - entry.windowStart > WINDOW_MS) { entry.count = 0; entry.windowStart = now; }
  entry.count += 1;
  inMemoryRateLimit.set(ip, entry);
  if (inMemoryRateLimit.size > 1000) {
    const cutoff = now - WINDOW_MS;
    for (const [key, value] of inMemoryRateLimit) if (value.windowStart < cutoff) inMemoryRateLimit.delete(key);
  }
  return entry.count > MAX_PER_WINDOW;
}

async function db(path, options = {}) {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const result = await fetch(`${process.env.SUPABASE_URL}${path}`, { ...options, headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', ...(options.headers || {}) } });
  const text = await result.text(); let body = null; try { body = text ? JSON.parse(text) : null; } catch (_) { body = text; }
  return { result, body };
}

module.exports = async function onboardingLinkSubmit(request, response) {
  response.setHeader('Cache-Control', 'no-store'); response.setHeader('X-Content-Type-Options', 'nosniff');
  if (request.method !== 'POST') return response.status(405).json({ error: 'Method not allowed.' });
  if (rateLimited(clientIp(request))) return response.status(429).json({ error: 'Too many requests. Please wait a minute and try again.' });
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return response.status(503).json({ error: 'This is being prepared. Please try again shortly.' });

  const body = request.body || {};
  const token = String(body.token || '');
  if (!token || !/^[a-f0-9]{48}$/i.test(token)) return response.status(400).json({ error: 'This link is not valid.' });
  if (String(body.efc_hp || '').trim()) return response.status(200).json({ ok: true });

  const fullName = String(body.full_name || '').trim().slice(0, 200);
  const email = String(body.email || '').trim().slice(0, 200);
  const phone = String(body.phone || '').trim().slice(0, 60);
  const programInterest = String(body.program_interest || '').trim().slice(0, 200);
  if (!fullName || !email || !programInterest) return response.status(400).json({ error: 'Please complete the required fields.' });

  const answers = body.answers && typeof body.answers === 'object' ? body.answers : {};

  try {
    const linkQuery = `/rest/v1/prospect_onboarding_links?token=eq.${encodeURIComponent(token)}&select=id,status&limit=1`;
    const linkResult = await db(linkQuery);
    const link = Array.isArray(linkResult.body) ? linkResult.body[0] : null;
    if (!linkResult.result.ok || !link) return response.status(404).json({ error: 'This link could not be found.' });
    if (link.status !== 'pending') return response.status(410).json({ error: 'This link has already been used.' });

    const insertResult = await db('/rest/v1/coaching_applications', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        full_name: fullName,
        email,
        phone: phone || null,
        program_interest: programInterest,
        application_data: answers,
        source: 'admin_assigned_link',
      }),
    });
    const application = Array.isArray(insertResult.body) ? insertResult.body[0] : null;
    if (!insertResult.result.ok || !application) {
      console.error('Onboarding link application insert failed', insertResult.result.status, insertResult.body);
      return response.status(502).json({ error: 'We could not save your answers. Please try again.' });
    }

    await db(`/rest/v1/prospect_onboarding_links?id=eq.${encodeURIComponent(link.id)}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ status: 'completed', application_id: application.id, completed_at: new Date().toISOString() }),
    });

    await notifyOwner({
      subject: `Onboarding Questions Completed: ${fullName}`,
      text: `${fullName} filled out the onboarding questions you sent them.\nProgram interest: ${programInterest}\nEmail: ${email}\nPhone: ${phone || 'Not provided'}`,
    });

    return response.status(200).json({ ok: true });
  } catch (error) {
    console.error('Onboarding link submit error', error && error.message);
    return response.status(503).json({ error: 'This is temporarily unavailable. Please try again.' });
  }
};
