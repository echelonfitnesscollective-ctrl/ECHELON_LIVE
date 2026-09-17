// Vercel serverless proxy for the coaching application form, adding IP-based
// rate limiting in front of the coaching_applications insert (previously
// written directly from the browser with no server in the request path).
//
// Also handles the "ASSIGN ONBOARDING QUESTIONS" prospect-facing flow
// (pages/onboarding-questions.html): GET ?token=... looks up a
// prospect_onboarding_links row and returns prefill + the active question
// set, and POST with a `token` field submits those answers as a
// coaching_applications row. Folded into this file rather than a new one
// under api/onboarding-link/ because Vercel's Hobby plan caps a deployment
// at 12 serverless functions and this project is already at that limit.
//
// Required Vercel environment variables: SUPABASE_URL, SUPABASE_ANON_KEY,
// SUPABASE_SERVICE_ROLE_KEY (service role only needed for the token-lookup
// path, since prospect_onboarding_links has no anon RLS policy on purpose).

const { notifyOwner } = require('../_lib/email');

const inMemoryRateLimit = new Map();
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW_WRITE = 3;
const MAX_PER_WINDOW_READ = 20;

function publicSiteUrl() {
  return String(process.env.SITE_URL || 'https://www.echelonfitness.co').trim().replace(/\/$/, '');
}

function clientIp(req) {
  return String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();
}

function rateLimited(key, max) {
  const now = Date.now();
  const entry = inMemoryRateLimit.get(key) || { count: 0, windowStart: now };
  if (now - entry.windowStart > WINDOW_MS) {
    entry.count = 0;
    entry.windowStart = now;
  }
  entry.count += 1;
  inMemoryRateLimit.set(key, entry);
  if (inMemoryRateLimit.size > 1000) {
    const cutoff = now - WINDOW_MS;
    for (const [k, v] of inMemoryRateLimit) if (v.windowStart < cutoff) inMemoryRateLimit.delete(k);
  }
  return entry.count > max;
}

async function serviceDb(path, options = {}) {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const result = await fetch(`${process.env.SUPABASE_URL}${path}`, { ...options, headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', ...(options.headers || {}) } });
  const text = await result.text(); let body = null; try { body = text ? JSON.parse(text) : null; } catch (_) { body = text; }
  return { result, body };
}

async function handleOnboardingLinkInfo(req, res) {
  if (rateLimited(`onboarding-link-info:${clientIp(req)}`, MAX_PER_WINDOW_READ)) {
    return res.status(429).json({ error: 'Too many requests. Please wait a minute and try again.' });
  }
  const token = String(req.query?.token || '');
  if (!token || !/^[a-f0-9]{48}$/i.test(token)) return res.status(400).json({ error: 'This link is not valid.' });
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return res.status(503).json({ error: 'This is being prepared. Please try again shortly.' });

  try {
    const linkQuery = `/rest/v1/prospect_onboarding_links?token=eq.${encodeURIComponent(token)}&select=prospect_name,prospect_email,prospect_phone,program_interest,status&limit=1`;
    const linkResult = await serviceDb(linkQuery);
    const link = Array.isArray(linkResult.body) ? linkResult.body[0] : null;
    if (!linkResult.result.ok || !link) return res.status(404).json({ error: 'This link could not be found.' });
    if (link.status !== 'pending') return res.status(410).json({ error: 'This link has already been used. Contact Echelon if you need a new one.' });

    const questionsQuery = '/rest/v1/application_questions?active=eq.true&select=question_key,label,field_type,options,help_text,section_label,required&order=sort_order.asc';
    const questionsResult = await serviceDb(questionsQuery);
    const questions = Array.isArray(questionsResult.body) ? questionsResult.body : [];

    return res.status(200).json({
      prospect: { name: link.prospect_name, email: link.prospect_email, phone: link.prospect_phone, programInterest: link.program_interest },
      questions,
    });
  } catch (error) {
    console.error('Onboarding link info error', error && error.message);
    return res.status(503).json({ error: 'This is temporarily unavailable. Please try again.' });
  }
}

async function handleOnboardingLinkSubmit(req, res, body, fullName, email, phone, programInterest) {
  const token = String(body.token || '');
  if (!/^[a-f0-9]{48}$/i.test(token)) return res.status(400).json({ error: 'This link is not valid.' });
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return res.status(503).json({ error: 'This is being prepared. Please try again shortly.' });

  const answers = body.answers && typeof body.answers === 'object' ? body.answers : {};

  try {
    const linkQuery = `/rest/v1/prospect_onboarding_links?token=eq.${encodeURIComponent(token)}&select=id,status&limit=1`;
    const linkResult = await serviceDb(linkQuery);
    const link = Array.isArray(linkResult.body) ? linkResult.body[0] : null;
    if (!linkResult.result.ok || !link) return res.status(404).json({ error: 'This link could not be found.' });
    if (link.status !== 'pending') return res.status(410).json({ error: 'This link has already been used.' });

    const insertResult = await serviceDb('/rest/v1/coaching_applications', {
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
      return res.status(502).json({ error: 'We could not save your answers. Please try again.' });
    }

    await serviceDb(`/rest/v1/prospect_onboarding_links?id=eq.${encodeURIComponent(link.id)}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ status: 'completed', application_id: application.id, completed_at: new Date().toISOString() }),
    });

    await notifyOwner({
      subject: `Onboarding Questions Completed: ${fullName}`,
      text: `${fullName} filled out the onboarding questions you sent them.\nProgram interest: ${programInterest}\nEmail: ${email}\nPhone: ${phone || 'Not provided'}`,
    });

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error('Onboarding link submit error', error && error.message);
    return res.status(503).json({ error: 'This is temporarily unavailable. Please try again.' });
  }
}

module.exports = async function submitCoachingApplication(req, res) {
  const origin = String(req.headers.origin || '').replace(/\/$/, '');
  const siteUrl = publicSiteUrl();
  res.setHeader('Access-Control-Allow-Origin', origin === siteUrl ? origin : siteUrl);
  res.setHeader('Vary', 'Origin');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method === 'GET') return handleOnboardingLinkInfo(req, res);
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' });
  if (origin && origin !== siteUrl) return res.status(403).json({ error: 'This request was not accepted.' });

  const body = req.body || {};
  if (String(body.efc_hp || '').trim()) return res.status(200).json({ ok: true });
  const fullName = String(body.full_name || '').trim().slice(0, 200);
  const email = String(body.email || '').trim().slice(0, 200);
  const phone = String(body.phone || '').trim().slice(0, 60);
  const programInterest = String(body.program_interest || '').trim().slice(0, 200);

  if (!fullName || !email || !programInterest) {
    return res.status(400).json({ error: 'Please complete the required fields.' });
  }

  if (rateLimited(`coaching-application:${clientIp(req)}`, MAX_PER_WINDOW_WRITE)) {
    return res.status(429).json({ error: 'Too many requests. Please wait a minute and try again.' });
  }

  if (body.token) return handleOnboardingLinkSubmit(req, res, body, fullName, email, phone, programInterest);

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(503).json({ error: 'This form is being prepared. Please try again shortly.' });
  }

  try {
    // Service role, not the anon key: coaching_applications' RLS only
    // grants anon INSERT, not SELECT, and Prefer: return=representation
    // needs the inserting role to be able to read the row right back -
    // with the anon key that combination made every submission fail
    // ("We could not save your application"). Service role bypasses RLS
    // and is already how handleOnboardingLinkSubmit does this same
    // insert above; every field here is still server-sanitized the same
    // way regardless of which key performs the write.
    const insertResult = await serviceDb('/rest/v1/coaching_applications', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        full_name: fullName,
        email,
        phone,
        program_interest: programInterest,
        application_data: body,
      }),
    });

    if (!insertResult.result.ok) {
      console.error('Coaching application insert failed', insertResult.result.status, insertResult.body);
      return res.status(502).json({ error: 'We could not save your application. Please try again.' });
    }

    const application = Array.isArray(insertResult.body) ? insertResult.body[0] : null;

    await notifyOwner({
      subject: `New Coaching Application: ${fullName}`,
      text: `Program interest: ${programInterest}\nName: ${fullName}\nEmail: ${email}\nPhone: ${phone || 'Not provided'}`,
    });

    // Auto-add a follow-up task to the coach's task board so a new lead
    // never depends on someone remembering to add it by hand. coach_tasks
    // has no anon RLS policy (admin-only table), so this needs the
    // service-role client, same as the onboarding-link path above.
    if (application?.id && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const answers = body || {};
      const contextLines = [
        `Program interest: ${programInterest}`,
        answers.primary_goal ? `Primary goal: ${answers.primary_goal}` : null,
        answers.training_days_per_week ? `Training days/week: ${answers.training_days_per_week}` : null,
        answers.training_delivery_preference ? `Training preference: ${answers.training_delivery_preference}` : null,
        `Email: ${email}`,
        `Phone: ${phone || 'Not provided'}`,
        '',
        'Call to continue the application and walk through onboarding. Use "ASSIGN ONBOARDING QUESTIONS" on this profile to capture the rest of the question set live on the call.',
      ].filter(Boolean);
      await serviceDb('/rest/v1/coach_tasks', {
        method: 'POST',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({
          title: `New lead: ${fullName}`,
          description: contextLines.join('\n'),
          related_name: fullName,
          task_type: 'New lead follow-up',
          priority: 'High',
          application_id: application.id,
        }),
      }).catch((error) => console.error('Auto-created follow-up task failed', error && error.message));
    }

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error('Coaching application submission error', error && error.message);
    return res.status(503).json({ error: 'This form is temporarily unavailable. Please try again.' });
  }
};
