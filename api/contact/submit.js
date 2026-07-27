// Vercel serverless proxy for the public contact form, adding IP-based rate
// limiting in front of the website_leads insert (previously written directly
// from the browser with no server in the request path at all).
// Required Vercel environment variables: SUPABASE_URL, SUPABASE_ANON_KEY.

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

module.exports = async function submitContact(req, res) {
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
  const name = String(body.name || '').trim().slice(0, 200);
  const email = String(body.email || '').trim().slice(0, 200);
  const inquiryType = String(body.inquiry_type || '').trim().slice(0, 100);
  const message = String(body.message || '').trim().slice(0, 4000);

  if (!name || !email || !inquiryType) {
    return res.status(400).json({ error: 'Please complete the required fields.' });
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
        lead_type: 'Contact request',
        full_name: name,
        email,
        category: inquiryType,
        message,
        source_data: body,
      }),
    });

    if (!insertResponse.ok) {
      console.error('Contact form insert failed', insertResponse.status, await insertResponse.text());
      return res.status(502).json({ error: 'We could not send your request. Please try again.' });
    }

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error('Contact form submission error', error && error.message);
    return res.status(503).json({ error: 'This form is temporarily unavailable. Please try again.' });
  }
};
