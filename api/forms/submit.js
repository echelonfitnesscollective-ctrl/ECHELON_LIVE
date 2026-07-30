// Vercel serverless proxy for the check-in and waitlist forms
// (pages/checkin.html, pages/waitlist.html). Previously these two forms wrote
// directly to Supabase from the browser using the public anon key: no rate
// limiting, no field length caps. This proxy brings both in line with every
// other public form on the site.
//
// Combined into one function (dispatched by body.form) rather than two
// separate files because Vercel's Hobby plan caps a deployment at 12
// serverless functions; see database/supabase-echolon-operating-system.sql
// commit history / admin manual changelog "Security audit fixes" for context.
// Required Vercel environment variables: SUPABASE_URL, SUPABASE_ANON_KEY.

const inMemoryRateLimit = new Map();
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 5;

function publicSiteUrl() {
  return String(process.env.SITE_URL || 'https://www.echelonfitness.co').trim().replace(/\/$/, '');
}

function clientIp(req) {
  return String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();
}

function rateLimited(ip) {
  const now = Date.now();
  const entry = inMemoryRateLimit.get(ip) || { count: 0, windowStart: now };
  if (now - entry.windowStart > WINDOW_MS) {
    entry.count = 0;
    entry.windowStart = now;
  }
  entry.count += 1;
  inMemoryRateLimit.set(ip, entry);
  if (inMemoryRateLimit.size > 1000) {
    const cutoff = now - WINDOW_MS;
    for (const [key, value] of inMemoryRateLimit) if (value.windowStart < cutoff) inMemoryRateLimit.delete(key);
  }
  return entry.count > MAX_PER_WINDOW;
}

async function insertRow(table, payload) {
  const response = await fetch(`${process.env.SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      apikey: process.env.SUPABASE_ANON_KEY,
      authorization: `Bearer ${process.env.SUPABASE_ANON_KEY}`,
      'content-type': 'application/json',
      prefer: 'return=minimal',
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`${table} insert failed: ${response.status} ${text}`);
  }
}

function submitCheckin(body) {
  const fullName = String(body.full_name || '').trim().slice(0, 200);
  const email = String(body.email || '').trim().slice(0, 200);
  const phone = String(body.phone || '').trim().slice(0, 40);
  const program = String(body.program || '').trim().slice(0, 100);
  const firstTime = String(body.first_time || '').trim().slice(0, 100);
  const emergencyContact = String(body.emergency_contact || '').trim().slice(0, 200);
  const coachNote = String(body.coach_note || '').trim().slice(0, 2000);
  const waiverAgreed = body.waiver_agreed === 'YES';

  if (!fullName || !email || !program) {
    return { error: 'Please complete the required fields.' };
  }

  return {
    table: 'session_checkins',
    payload: {
      full_name: fullName,
      email,
      phone,
      program,
      first_time: firstTime,
      emergency_contact: emergencyContact,
      coach_note: coachNote,
      waiver_agreed: waiverAgreed,
    },
  };
}

function submitWaitlist(body) {
  const fullName = String(body.full_name || '').trim().slice(0, 200);
  const email = String(body.email || '').trim().slice(0, 200);
  const phone = String(body.phone || '').trim().slice(0, 40);
  const interest = String(body.interest || '').trim().slice(0, 200);
  const notes = String(body.notes || '').trim().slice(0, 2000);

  if (!fullName || !email) {
    return { error: 'Please complete the required fields.' };
  }

  return {
    table: 'website_leads',
    payload: {
      lead_type: 'Waitlist',
      full_name: fullName,
      email,
      phone,
      category: interest,
      message: notes,
      source_data: body,
    },
  };
}

module.exports = async function submitSiteForm(req, res) {
  const origin = String(req.headers.origin || '').replace(/\/$/, '');
  const siteUrl = publicSiteUrl();
  res.setHeader('Access-Control-Allow-Origin', origin === siteUrl ? origin : siteUrl);
  res.setHeader('Vary', 'Origin');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' });
  if (origin && origin !== siteUrl) return res.status(403).json({ error: 'This request was not accepted.' });

  if (rateLimited(clientIp(req))) {
    return res.status(429).json({ error: 'Too many requests. Please wait a minute and try again.' });
  }

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
    return res.status(503).json({ error: 'This form is being prepared. Please try again shortly.' });
  }

  const body = req.body || {};
  const form = String(body.form || '').trim();

  let result;
  if (form === 'checkin') result = submitCheckin(body);
  else if (form === 'waitlist') result = submitWaitlist(body);
  else return res.status(400).json({ error: 'Unknown form.' });

  if (result.error) return res.status(400).json({ error: result.error });

  try {
    await insertRow(result.table, result.payload);
    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error('Site form submission error', error && error.message);
    return res.status(502).json({ error: 'We could not save your submission. Please try again.' });
  }
};
