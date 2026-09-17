// Vercel serverless endpoint for the free starter-plan giveaway
// (pages/free-plan.html). Same shape as api/free-class/submit.js: a
// lead-capture form, no payment, writes to the shared website_leads
// table for the coach's own lead tracking. On top of that, this also
// writes the lead's *resolved* plan into free_plan_deliveries (same
// shared Supabase project EchelonOS uses) under a random token, and
// returns the resulting app.echelonfitness.co/plan/[token] URL - the
// actual plan now lives on a real EchelonOS page instead of being
// dumped inline on the marketing site or crammed into the email body.
// Required Vercel environment variables: SUPABASE_URL, SUPABASE_ANON_KEY.
// Optional: RESEND_API_KEY (email is skipped, not failed, without it).

const crypto = require('crypto');
const { notifyOwner, sendEmail } = require('../_lib/email');
const { getTemplate, templateGoals } = require('../_lib/free-plan-templates');

const inMemoryRateLimit = new Map();
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 3;

const APP_URL = 'https://app.echelonfitness.co';

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

// Short, personal, from Luther - not a corporate blast. The plan
// itself lives on the linked page now, so the email's job is just to
// feel like a real note and get them there.
function renderPlanEmail(name, template, planUrl, experienceLevel, daysPerWeek) {
  const firstName = (name || '').split(' ')[0] || 'there';
  const context = [
    experienceLevel ? `${experienceLevel.toLowerCase()} level` : null,
    daysPerWeek ? `${daysPerWeek} days a week to train` : null,
  ]
    .filter(Boolean)
    .join(', ');

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;color:#222;">
      <p>${firstName},</p>
      <p>I put together a ${template.title.split('—')[0].trim()} starter week for you${context ? ` — ${context}` : ''}. It's a real week, not a preview.</p>
      <p style="margin-top:20px;"><a href="${planUrl}" style="background:#D4AF37;color:#111;padding:12px 22px;text-decoration:none;font-weight:700;display:inline-block;">VIEW YOUR PLAN</a></p>
      <p style="margin-top:24px;">Run it, see how it feels, and let me know what questions come up.</p>
      <p style="margin-top:20px;">— Luther</p>
    </div>
  `;

  const text = [
    `${firstName},`,
    '',
    `I put together a ${template.title.split('—')[0].trim()} starter week for you${context ? ` — ${context}` : ''}. It's a real week, not a preview.`,
    '',
    `View your plan: ${planUrl}`,
    '',
    'Run it, see how it feels, and let me know what questions come up.',
    '',
    '— Luther',
  ].join('\n');

  return { html, text };
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
  const experienceLevel = String(body.experience_level || '').trim().slice(0, 60);
  const daysPerWeek = String(body.days_per_week || '').trim().slice(0, 20);

  if (!name || !email || !phone) {
    return res.status(400).json({ error: 'Please complete the required fields.' });
  }

  const template = getTemplate(goal);
  if (!template) {
    return res.status(400).json({ error: `Please pick a goal from: ${templateGoals().join(', ')}` });
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
        lead_type: 'Free plan request',
        full_name: name,
        email,
        phone,
        category: goal,
        message: `Experience: ${experienceLevel || 'Not provided'}. Days/week available: ${daysPerWeek || 'Not provided'}.`,
        source_data: { goal, experience_level: experienceLevel, days_per_week: daysPerWeek },
      }),
    });

    if (!insertResponse.ok) {
      console.error('Free-plan form insert failed', insertResponse.status, await insertResponse.text());
      return res.status(502).json({ error: 'We could not send your plan. Please try again.' });
    }

    const token = crypto.randomUUID().replace(/-/g, '');
    const deliveryResponse = await fetch(`${process.env.SUPABASE_URL}/rest/v1/free_plan_deliveries`, {
      method: 'POST',
      headers: { ...supabaseHeaders, prefer: 'return=minimal' },
      body: JSON.stringify({
        token,
        full_name: name,
        email,
        goal,
        experience_level: experienceLevel || null,
        days_per_week: daysPerWeek || null,
        plan: template,
      }),
    });

    if (!deliveryResponse.ok) {
      console.error('Free-plan delivery insert failed', deliveryResponse.status, await deliveryResponse.text());
      return res.status(502).json({ error: 'We could not build your plan page. Please try again.' });
    }

    const planUrl = `${APP_URL}/plan/${token}`;

    const { html, text } = renderPlanEmail(name, template, planUrl, experienceLevel, daysPerWeek);
    await sendEmail({ to: email, subject: `Your Free ${goal} Starter Plan`, text, html });

    await notifyOwner({
      subject: `New Free Plan Request: ${name} (${goal})`,
      text: `Name: ${name}\nEmail: ${email}\nPhone: ${phone}\nGoal: ${goal}\nExperience: ${experienceLevel || 'Not provided'}\nDays/week: ${daysPerWeek || 'Not provided'}\nPlan: ${planUrl}`,
    });

    return res.status(200).json({ ok: true, planUrl });
  } catch (error) {
    console.error('Free-plan form submission error', error && error.message);
    return res.status(503).json({ error: 'This form is temporarily unavailable. Please try again.' });
  }
};
