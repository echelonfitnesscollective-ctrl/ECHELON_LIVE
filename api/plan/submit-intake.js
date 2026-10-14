'use strict';

// Echelon Online Coaching intake (pages/plan.html, $97 Custom 12-Week
// Program). This is the one safety-critical gate in the whole flow: if
// the buyer flags pregnancy, an injury, a heart condition, or an eating
// disorder, the sale stops HERE, before any Stripe session is ever
// created - never trust the client-side copy of this check alone, this
// server-side check is the real one.
//
// Writes with the service-role key, not the anon key used by
// lower-sensitivity forms (free-plan, leads) - plan_intakes holds real
// PII and health-screening answers, and has no public RLS policy at
// all (see supabase/migrations/20261013010000_plan_intakes.sql in the
// echelonos repo), so only a trusted server call can ever write a row.
//
// Required Vercel environment variables: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.

const { notifyOwner } = require('../_lib/email.js');

const inMemoryRateLimit = new Map();
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 5;

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

function publicSiteUrl() {
  return String(process.env.SITE_URL || 'https://www.echelonfitness.co').trim().replace(/\/$/, '');
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SEE_YOUR_DOCTOR_MESSAGE =
  "For your safety, we can't sell this self-guided program online based on what you shared. Please check with your doctor first. If you'd still like to train with us, apply for 1-on-1 coaching instead, a real coach reviews every application and can build around your situation directly.";

module.exports = async function submitPlanIntake(req, res) {
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

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(503).json({ error: 'This is being prepared. Please try again shortly.' });
  }

  const body = req.body || {};

  // Honeypot: a bot fills this, a real visitor never sees it. Reply
  // with the same shape a real safety block uses so nothing about this
  // check is observable from the outside.
  if (String(body.efc_hp || '').trim()) {
    return res.status(200).json({ blocked: true, message: SEE_YOUR_DOCTOR_MESSAGE });
  }

  const fullName = String(body.full_name || '').trim().slice(0, 200);
  const email = String(body.email || '').trim().slice(0, 200);
  if (!fullName || !EMAIL_RE.test(email)) {
    return res.status(400).json({ error: 'Please enter a valid name and email.' });
  }

  const safetyPregnancy = body.safety_pregnancy === true || body.safety_pregnancy === 'true';
  const safetyInjury = body.safety_injury === true || body.safety_injury === 'true';
  const safetyHeart = body.safety_heart_condition === true || body.safety_heart_condition === 'true';
  const safetyEatingDisorder = body.safety_eating_disorder === true || body.safety_eating_disorder === 'true';
  const flagged = safetyPregnancy || safetyInjury || safetyHeart || safetyEatingDisorder;

  const row = {
    full_name: fullName,
    email,
    phone: String(body.phone || '').trim().slice(0, 40) || null,
    goal: String(body.goal || '').trim().slice(0, 100) || null,
    experience_level: String(body.experience_level || '').trim().slice(0, 50) || null,
    training_location: String(body.training_location || '').trim().slice(0, 50) || null,
    equipment: String(body.equipment || '').trim().slice(0, 1000) || null,
    days_per_week: String(body.days_per_week || '').trim().slice(0, 20) || null,
    schedule_notes: String(body.schedule_notes || '').trim().slice(0, 1000) || null,
    travel_notes: String(body.travel_notes || '').trim().slice(0, 1000) || null,
    addon_travel_pack: body.addon_travel_pack === true || body.addon_travel_pack === 'true',
    safety_pregnancy: safetyPregnancy,
    safety_injury: safetyInjury,
    safety_injury_detail: safetyInjury ? String(body.safety_injury_detail || '').trim().slice(0, 500) || null : null,
    safety_heart_condition: safetyHeart,
    safety_eating_disorder: safetyEatingDisorder,
    safety_flagged: flagged,
    status: flagged ? 'blocked' : 'submitted',
  };

  try {
    const response = await fetch(`${process.env.SUPABASE_URL}/rest/v1/plan_intakes`, {
      method: 'POST',
      headers: {
        apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify(row),
    });
    const inserted = await response.json();
    if (!response.ok || !Array.isArray(inserted) || !inserted[0]) {
      console.error('plan_intakes insert failed', response.status, inserted);
      return res.status(502).json({ error: 'We could not save your info. Please try again.' });
    }

    if (flagged) {
      await notifyOwner({
        subject: `Plan intake blocked by safety screen: ${fullName}`,
        text: `${fullName} (${email}) was stopped from purchasing the Custom 12-Week Program by the safety screen.\n\nFlags: ${[
          safetyPregnancy && 'pregnancy',
          safetyInjury && `injury (${row.safety_injury_detail || 'no detail given'})`,
          safetyHeart && 'heart condition',
          safetyEatingDisorder && 'eating disorder history',
        ]
          .filter(Boolean)
          .join(', ')}\n\nThey were shown a see-your-doctor message and directed to the 1-on-1 coaching application instead. No action needed unless you want to follow up directly.`,
      });
      return res.status(200).json({ blocked: true, message: SEE_YOUR_DOCTOR_MESSAGE });
    }

    return res.status(200).json({ blocked: false, intakeId: inserted[0].id });
  } catch (error) {
    console.error('plan intake submit error', error && error.message);
    return res.status(503).json({ error: 'This is temporarily unavailable. Please try again.' });
  }
};
