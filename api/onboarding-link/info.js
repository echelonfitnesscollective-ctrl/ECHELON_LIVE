'use strict';

// Public: looks up a prospect_onboarding_links row by its token (no login),
// same pattern as api/enrollment/checkout.js's GET. Returns just enough to
// render the onboarding-questions page: the prefill contact info and the
// active application question set.

const inMemoryRateLimit = new Map();
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 20;

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

module.exports = async function onboardingLinkInfo(request, response) {
  response.setHeader('Cache-Control', 'no-store'); response.setHeader('X-Content-Type-Options', 'nosniff');
  if (request.method !== 'GET') return response.status(405).json({ error: 'Method not allowed.' });
  if (rateLimited(clientIp(request))) return response.status(429).json({ error: 'Too many requests. Please wait a minute and try again.' });
  const token = String(request.query?.token || '');
  if (!token || !/^[a-f0-9]{48}$/i.test(token)) return response.status(400).json({ error: 'This link is not valid.' });
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return response.status(503).json({ error: 'This is being prepared. Please try again shortly.' });

  try {
    const linkQuery = `/rest/v1/prospect_onboarding_links?token=eq.${encodeURIComponent(token)}&select=prospect_name,prospect_email,prospect_phone,program_interest,status&limit=1`;
    const linkResult = await db(linkQuery);
    const link = Array.isArray(linkResult.body) ? linkResult.body[0] : null;
    if (!linkResult.result.ok || !link) return response.status(404).json({ error: 'This link could not be found.' });
    if (link.status !== 'pending') return response.status(410).json({ error: 'This link has already been used. Contact Echelon if you need a new one.' });

    const questionsQuery = '/rest/v1/application_questions?active=eq.true&select=question_key,label,field_type,options,help_text,section_label,required&order=sort_order.asc';
    const questionsResult = await db(questionsQuery);
    const questions = Array.isArray(questionsResult.body) ? questionsResult.body : [];

    return response.status(200).json({
      prospect: { name: link.prospect_name, email: link.prospect_email, phone: link.prospect_phone, programInterest: link.program_interest },
      questions,
    });
  } catch (error) {
    console.error('Onboarding link info error', error && error.message);
    return response.status(503).json({ error: 'This is temporarily unavailable. Please try again.' });
  }
};
