'use strict';

// Echelon Online Coaching intake (pages/plan.html, $97 Custom 12-Week
// Program). A flagged buyer (pregnancy, injury, heart condition, eating
// disorder) still pays and gets an intake row like anyone else - the
// coach reviews these personally (call within 24-48h, text/email if no
// answer) rather than blocking the sale outright. safety_flagged is
// still the real server-side source of truth downstream: it's what
// keeps isSafeToDraft() (echelonos/src/lib/plan-program-rules.ts) from
// ever letting the AI auto-draft one of these, and plan-queue's
// draftProgram moves it straight to "Needs Human Review" instead.
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
  // 200 with no real intakeId rather than a 4xx, so a bot can't tell
  // this field is being checked.
  if (String(body.efc_hp || '').trim()) {
    return res.status(200).json({ blocked: false, intakeId: null });
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
    status: 'submitted',
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
        subject: `SAFETY REVIEW NEEDED: ${fullName} (Echelon Online Coaching)`,
        text: `${fullName} (${email}) flagged a safety concern on the Custom 12-Week Program intake and is proceeding to checkout.\n\nFlags: ${[
          safetyPregnancy && 'pregnancy',
          safetyInjury && `injury (${row.safety_injury_detail || 'no detail given'})`,
          safetyHeart && 'heart condition',
          safetyEatingDisorder && 'eating disorder history',
        ]
          .filter(Boolean)
          .join(', ')}\n\nThis order will NOT be auto-drafted - it'll sit under Needs Human Review in the queue once paid. Call them within 24-48 hours; text or email to schedule a call if they don't pick up.\n\nPhone: ${String(body.phone || '').trim() || 'not provided'}`,
      });
    }

    return res.status(200).json({ blocked: false, intakeId: inserted[0].id });
  } catch (error) {
    console.error('plan intake submit error', error && error.message);
    return res.status(503).json({ error: 'This is temporarily unavailable. Please try again.' });
  }
};
