// Shared owner-notification email, used by every public form endpoint.
// Underscore-prefixed directory so Vercel does not treat this as a route.
// Required Vercel environment variable: RESEND_API_KEY (from resend.com).
// Optional: OWNER_NOTIFICATION_EMAIL (defaults below), RESEND_FROM_EMAIL
// (defaults to Resend's shared sandbox sender, which needs no domain setup).
//
// Awaited by callers before they respond to the client: Vercel can freeze a
// serverless function immediately after the response is sent, so firing this
// off without waiting for it risks the email never actually going out.

async function notifyOwner({ subject, text }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error('RESEND_API_KEY is not set; skipping owner notification email.');
    return;
  }

  const to = process.env.OWNER_NOTIFICATION_EMAIL || 'echelonfitnesscollective@gmail.com';
  const from = process.env.RESEND_FROM_EMAIL || 'Echelon Fitness Collective <onboarding@resend.dev>';

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to, subject, text }),
    });
    if (!response.ok) {
      console.error('Owner notification email failed', response.status, await response.text());
    }
  } catch (error) {
    console.error('Owner notification email error', error && error.message);
  }
}

module.exports = { notifyOwner };
