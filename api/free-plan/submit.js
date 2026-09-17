// Vercel serverless endpoint for the free starter-plan giveaway
// (pages/free-plan.html). Same shape as api/free-class/submit.js: a
// lead-capture form, no payment, writes to the shared website_leads
// table. The one difference is this also emails the matched template
// straight to the lead and returns it in the response so the page can
// render it immediately, no second round trip.
// Required Vercel environment variables: SUPABASE_URL, SUPABASE_ANON_KEY.
// Optional: RESEND_API_KEY (email is skipped, not failed, without it).

const { notifyOwner, sendEmail } = require('../_lib/email');
const { getTemplate, templateGoals } = require('../_lib/free-plan-templates');

const inMemoryRateLimit = new Map();
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 3;

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

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function renderTemplateEmail(name, template) {
  const daysHtml = template.days
    .map(
      (day) => `
        <tr><td style="padding:16px 0 4px;font-weight:700;color:#111;">${escapeHtml(day.label)}</td></tr>
        ${day.items.map((item) => `<tr><td style="padding:2px 0 2px 12px;color:#333;">• ${escapeHtml(item)}</td></tr>`).join('')}
      `
    )
    .join('');

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;">
      <p style="color:#111;">Hey ${escapeHtml(name) || 'there'},</p>
      <p style="color:#333;">Here's your free starter plan from Echelon Fitness Collective.</p>
      <h2 style="color:#111;margin-top:24px;">${escapeHtml(template.title)}</h2>
      <p style="color:#555;font-style:italic;">${escapeHtml(template.subtitle)}</p>
      <p style="color:#333;"><b>Level:</b> ${escapeHtml(template.level)}<br><b>Structure:</b> ${escapeHtml(template.structure)}</p>
      <table style="width:100%;border-collapse:collapse;">${daysHtml}</table>
      <p style="margin-top:20px;color:#333;"><b>Nutrition guidance:</b> ${escapeHtml(template.nutrition)}</p>
      <p style="margin-top:24px;color:#333;">This plan is Week 1, static, forever — it doesn't adjust as you progress, doesn't account for injuries, and isn't personalized beyond your goal. That's exactly what real coaching adds.</p>
      <p style="margin-top:16px;"><a href="https://www.echelonfitness.co/pages/coaching-application.html" style="background:#D4AF37;color:#111;padding:12px 20px;text-decoration:none;font-weight:700;display:inline-block;">APPLY FOR COACHING</a></p>
      <p style="margin-top:24px;color:#999;font-size:12px;">Echelon Fitness Collective</p>
    </div>
  `;

  const text = [
    `Hey ${name || 'there'},`,
    '',
    `Here's your free starter plan: ${template.title}`,
    template.subtitle,
    '',
    `Level: ${template.level}`,
    `Structure: ${template.structure}`,
    '',
    ...template.days.flatMap((day) => [day.label, ...day.items.map((item) => `  - ${item}`)]),
    '',
    `Nutrition guidance: ${template.nutrition}`,
    '',
    'This plan is Week 1, static, forever - it does not adjust as you progress. Real coaching adapts. Apply: https://www.echelonfitness.co/pages/coaching-application.html',
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
  const goal = String(body.goal || '').trim();
  const experienceLevel = String(body.experience_level || '').trim().slice(0, 60);
  const daysPerWeek = String(body.days_per_week || '').trim().slice(0, 20);

  if (!name || !email) {
    return res.status(400).json({ error: 'Please complete the required fields.' });
  }

  const template = getTemplate(goal);
  if (!template) {
    return res.status(400).json({ error: `Please pick a goal from: ${templateGoals().join(', ')}` });
  }

  try {
    const insertResponse = await fetch(`${process.env.SUPABASE_URL}/rest/v1/website_leads`, {
      method: 'POST',
      headers: {
        apikey: process.env.SUPABASE_ANON_KEY,
        authorization: `Bearer ${process.env.SUPABASE_ANON_KEY}`,
        'content-type': 'application/json',
        prefer: 'return=minimal',
      },
      body: JSON.stringify({
        lead_type: 'Free plan request',
        full_name: name,
        email,
        category: goal,
        message: `Experience: ${experienceLevel || 'Not provided'}. Days/week available: ${daysPerWeek || 'Not provided'}.`,
        source_data: { goal, experience_level: experienceLevel, days_per_week: daysPerWeek },
      }),
    });

    if (!insertResponse.ok) {
      console.error('Free-plan form insert failed', insertResponse.status, await insertResponse.text());
      return res.status(502).json({ error: 'We could not send your plan. Please try again.' });
    }

    const { html, text } = renderTemplateEmail(name, template);
    await sendEmail({ to: email, subject: `Your Free ${goal} Starter Plan — Echelon Fitness Collective`, text, html });

    await notifyOwner({
      subject: `New Free Plan Request: ${name} (${goal})`,
      text: `Name: ${name}\nEmail: ${email}\nGoal: ${goal}\nExperience: ${experienceLevel || 'Not provided'}\nDays/week: ${daysPerWeek || 'Not provided'}`,
    });

    return res.status(200).json({ ok: true, template });
  } catch (error) {
    console.error('Free-plan form submission error', error && error.message);
    return res.status(503).json({ error: 'This form is temporarily unavailable. Please try again.' });
  }
};
