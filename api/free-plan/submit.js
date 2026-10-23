// Vercel serverless endpoint for the "Find Your Program" quiz
// (pages/free-plan.html). A lead-capture form, no payment, writes to
// the shared website_leads table for the coach's own lead tracking.
// The actual program
// recommendation is a static lookup computed client-side in
// assets/js/free-plan.js from the training_style answer, so this
// endpoint's only job is to save the lead and notify the owner.
// Required Vercel environment variables: SUPABASE_URL, SUPABASE_ANON_KEY.
// Optional: RESEND_API_KEY (owner email is skipped, not failed, without it).

const { notifyOwner } = require('../_lib/email');

const inMemoryRateLimit = new Map();
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 3;

const TRAINING_STYLE_LABELS = {
  'self-guided': 'On their own, with a program to follow',
  '1-on-1': '1-on-1 with a coach for accountability',
  group: 'As part of a group, team, or organization',
};

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

module.exports = async function submitFreePlan(req, res) {
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
  if (String(body.efc_hp || '').trim()) return res.status(200).json({ ok: true });

  const name = String(body.name || '').trim().slice(0, 200);
  const email = String(body.email || '').trim().slice(0, 200);
  const phone = String(body.phone || '').trim().slice(0, 40);
  const goal = String(body.goal || '').trim();
  const trainingStyle = String(body.training_style || '').trim();

  if (!name || !email || !phone || !goal || !TRAINING_STYLE_LABELS[trainingStyle]) {
    return res.status(400).json({ error: 'Please complete the required fields.' });
  }

  const supabaseHeaders = {
    apikey: process.env.SUPABASE_ANON_KEY,
    authorization: `Bearer ${process.env.SUPABASE_ANON_KEY}`,
    'content-type': 'application/json',
  };

  try {
    const insertResponse = await fetch(`${process.env.SUPABASE_URL}/rest/v1/website_leads`, {
      method: 'POST',
      headers: { ...supabaseHeaders, prefer: 'return=minimal' },
      body: JSON.stringify({
        lead_type: 'Program quiz',
        full_name: name,
        email,
        phone,
        category: goal,
        message: `Wants to train: ${TRAINING_STYLE_LABELS[trainingStyle]}.`,
        source_data: { goal, training_style: trainingStyle },
      }),
    });

    if (!insertResponse.ok) {
      console.error('Program quiz insert failed', insertResponse.status, await insertResponse.text());
      return res.status(502).json({ error: 'We could not save your answers. Please try again.' });
    }

    await notifyOwner({
      subject: `New Program Quiz Lead: ${name} (${goal})`,
      text: `Name: ${name}\nEmail: ${email}\nPhone: ${phone}\nGoal: ${goal}\nWants to train: ${TRAINING_STYLE_LABELS[trainingStyle]}`,
    });

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error('Program quiz submission error', error && error.message);
    return res.status(503).json({ error: 'This form is temporarily unavailable. Please try again.' });
  }
};
