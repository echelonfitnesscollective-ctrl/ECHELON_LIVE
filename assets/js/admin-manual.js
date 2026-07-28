const EFC_MANUAL_SECTIONS = [
    { id: 'systems', tag: 'SYSTEM DIRECTORY', title: 'THE Echelon STACK', intro: 'The systems currently supporting Echelon. Use the secure access directory in your password manager for the actual credentials.', cards: [
        ['Echelon Website', 'Public site', 'https://www.echelonfitness.co', 'Use for public pages, coaching applications, waitlist, and member access.'],
        ['GitHub', 'Source control', 'https://github.com/echelonfitnesscollective-ctrl/ECHELON_LIVE', 'The live site source. Every approved update is recorded here and triggers the Vercel deployment.'],
        ['Vercel', 'Hosting & deployments', 'https://vercel.com/dashboard', 'Hosts echelonfitness.co. Review the fresh deployment after every approved update.'],
        ['Supabase', 'Members, forms, admin data & site content', 'https://supabase.com/dashboard/project/plkdyvtriajpzcfgtwzp', 'Source of truth for member data, check-ins, goals, plans, messages, photos, the Admin Console, published Site Content, and the public Media Gallery.'],
        ['Formspree', 'Form delivery inbox', 'https://formspree.io/', 'Delivers contact and coaching application submissions to the Echelon inbox. Use it for fast notification, then track the actual follow-up in Coach Command.'],
        ['Stripe', 'Payments & enrollment checkout', 'https://dashboard.stripe.com/', 'Processes secure group fitness and approved-coaching payments. Keep Stripe in test mode until the full applicant-to-invite flow has been tested once.'],
        ['Calendly', 'Protected scheduling · activation pending', 'https://calendly.com/', 'Use for unlisted 1-on-1, private-group, and discovery-call booking links. Connect it to both the Burn-shift calendar and Echelon calendar before adding the URLs to assets/js/calendar-config.js.'],
        ['Google Business Profile', 'Reviews & discovery', 'https://business.google.com/', 'Manage business details, verification, and the link used in Echelon review-request messages.'],
        ['Instagram', 'Social channel', 'https://www.instagram.com/EchelonFitness.co', 'Primary social presence and community touchpoint.'],
        ['TikTok', 'Social channel', 'https://tr.ee/pO3gLtovXy', 'Short-form content and discovery channel.'],
        ['Etsy', 'Merch storefront · planned', '', 'Keep the shop placeholder until the Etsy shop is ready. Then add the Etsy URL in one place.'],
        ['Amway', 'Performance nutrition', 'https://www.amway.com/', 'Use only the approved product links and disclosure language already placed on the Echelon shop.']
    ]},
    { id: 'daily-ops', tag: 'DAILY OPERATIONS', title: 'THE DAILY COMMAND ROUTINE', steps: [
        ['Open the Today tab', 'Start in the Admin Console on Today. Clear overdue Coach Command tasks and create any new task that requires a next action.'],
        ['Review members and leads', 'Move to Members for active coaching activity, then Leads for new applications, contact requests, and waitlist entries.'],
        ['Follow up with intent', 'Create a task for every lead or member action that needs a next step. Give it a due date and priority.'],
        ['Close the loop', 'Mark completed tasks done and leave a private coach note for context the next time you return.']
    ]},
    { id: 'console-tabs', tag: 'ADMIN CONSOLE MAP', title: 'USE ONE FOCUSED TAB AT A TIME', intro: 'The Admin Console is intentionally organized as a horizontal tab workspace. Only the selected tab is visible, so operators can focus on one kind of work without losing their place.', steps: [
        ['Today', 'Your daily command center. Review priorities, clear Coach Command tasks, and create the next action for anything that needs follow-through.'],
        ['Members', 'Open member records, onboarding details, and recent check-ins. Use this tab for active coaching context and member-care decisions.'],
        ['Leads', 'Review coaching applications first, then contact and waitlist inquiries. Send the appropriate response and create a Coach Command task before moving on.'],
        ['Programs', 'Open an offering’s collapsible playbook for its delivery steps. The Echelon 12 card includes the completed coach PDF; other offerings show a clear PDF placeholder until their playbooks are built.'],
        ['Site Content', 'Create announcements, offers, resource releases, storefront notes, and calls to action without code. Drafts stay private; Published items display immediately; Scheduled items go live automatically; expiry dates remove items automatically.'],
        ['Media', 'Manage the public Echelon gallery. Upload a quality photo or short video, add the label and caption, set its display order, then publish it. To replace a frame, upload the new version first and remove the old version only after you see the new one live.'],
        ['Comms', 'Use the collapsed Response Library categories for approved scripts. Open only the situation you need, copy it, personalize every bracketed detail, then send.'],
        ['Library', 'Manage the member vault and private trainer resources. Use this for publishing guides and storing coach education, not for daily follow-ups.']
    ]},
    { id: 'offerings', tag: 'TRAINING HUB', title: 'RUN A FOCUSED OFFERING STACK', intro: 'The public Training Hub now presents six distinct programs. Keep Faith & Favor Mobility and VL Body Lab as their own cards; they are not one combined future-program offering. Launch a program only when its staff coverage, delivery plan, and calendar capacity are real.', steps: [
        ['Group Fitness · live', '$23 drop-in or $89/month unlimited. Use a fixed, published session schedule. Active 12-Week and 1-on-1 Hybrid clients are included; one class each month is free and open to the public.'],
        ['Private Group Training · now booking', 'For 3–15 people: friends, families, teams, organizations, celebrations, or wellness sessions. Start at $199 for up to five participants, then $25 per additional participant. Offer one-time or recurring groups only in designated event windows.'],
        ['Echelon 12 · live', 'A structured 12-week coaching system. Use the completed Echelon 12 Coach Playbook, then publish Week 1, nutrition baseline, and the check-in cadence after payment and onboarding.'],
        ['1-on-1 Coaching · live', 'Limited, high-touch coaching. Approval is required. Release only the windows you can honor around your Burn schedule and Echelon capacity.'],
        ['Faith & Favor Mobility · in development', 'A 45-minute small-group mobility, posture, core-stability, and active-recovery class. Keep it on the interest list until coverage and a sustainable recurring slot are confirmed.'],
        ['VL Body Lab · in development', 'A 50-minute strength, speed, and athletic-conditioning group experience. Keep it on the interest list until coverage and a sustainable recurring slot are confirmed.']
    ]},
    { id: 'new-lead', tag: 'LEAD FLOW', title: 'WHEN A NEW LEAD COMES IN', steps: [
        ['Find the lead', 'Open Coaching Applications or Contact & Waitlist in the Admin Console.'],
        ['Create the next action', 'Add a Coach Command follow-up task with their name, a due date, and the correct priority.'],
        ['Respond personally', 'Use your approved contact method. Update your private note with the important context and outcome.'],
        ['Move forward or close out', 'Keep the task open until there is a real next step. Mark it complete once the handoff or decision is final.']
    ]},
    { id: 'accepted-applicant', tag: 'ACCEPTED APPLICANT FLOW', title: 'FROM APPLICATION TO ACTIVE MEMBER', intro: 'The Admin Console now turns an approval into a clear, trackable handoff. Payment happens privately through Stripe; the Member Portal invitation only unlocks after Stripe confirms it.', steps: [
        ['Applicant submits', 'Formspree delivers the application notification and Supabase saves the record. A NEW MEMBER LAUNCH project and its private checklist are created automatically.'],
        ['Coach reviews', 'Open Leads → Coaching Applications. Read the application, select the aligned program and payment choice, then choose Create Payment Link. The checklist marks the review, program choice, and payment-link handoff complete.'],
        ['Applicant pays', 'Use Copy Payment Link and Open Payment Email to send the applicant their private Stripe link. They see only their coaching selection and complete secure Stripe checkout. Do not collect card details yourself.'],
        ['Stripe confirms', 'Stripe records the completed payment, changes the application to Paid — Ready to Invite, and completes the payment-verification step in the launch checklist. A failed or expired payment link stays inactive.'],
        ['Admin activates access', 'Return to that application and select Invite to Member Portal. Supabase sends the member a secure password/setup email and grants their active Member Portal access.'],
        ['Coach launches', 'Finish the remaining launch tasks: confirm onboarding and waiver, publish Week 1, set the check-in cadence, and confirm launch readiness. The member then sees their focused Coaching Hub first.']
    ]},
    { id: 'calendar', tag: 'SCHEDULING OPERATIONS', title: 'PROTECT YOUR COACHING WINDOWS', intro: 'Echelon scheduling is built to work around the coach’s Burn shifts instead of pretending there is unlimited availability. Booking links are private and should show only confirmed Echelon windows.', notice: 'Calendly is not activated until its three unlisted event URLs are added to assets/js/calendar-config.js. Until then, the Echelon Scheduling page intentionally tells clients that their approved booking link will be sent by Echelon.', steps: [
        ['Build the availability source', 'In Calendly, connect both the Burn-shift calendar and the Echelon calendar. Let busy events block availability automatically. Create one unlisted event each for 1-on-1 coaching, Private Group Training, and discovery calls.'],
        ['Set real rules', 'Use a minimum 24-hour notice, buffers before and after sessions, a daily session limit, and only the time blocks you can coach consistently. Reserve designated event windows for private groups.'],
        ['Activate the links', 'Paste the three Calendly URLs into assets/js/calendar-config.js: oneOnOneUrl, privateGroupUrl, and discoveryCallUrl. Commit the update to GitHub main and confirm Vercel shows a Ready production deployment.'],
        ['Send links at the right moment', 'For 1-on-1: after approval and payment. For Private Group Training: after the organizer is approved, payment or deposit is confirmed, and group details are aligned. For discovery calls: after a qualified inquiry needs a live conversation.'],
        ['Use the scheduling page', 'Send the appropriate /pages/booking.html?type= link rather than a raw Calendly URL when possible. It keeps the Echelon context, explains availability rules, and opens the matching private booking action once activated.'],
        ['Review each week', 'Compare the coming week against Burn commitments, active clients, group events, and recovery time. Close or adjust Calendly windows before they become a conflict.']
    ]},
    { id: 'communication', tag: 'COMMUNICATION STANDARD', title: 'HOW ECHELON RESPONDS', intro: 'The Response Library in the Admin Console is the approved starting point for every outreach moment. It keeps the language warm, clear, and consistent while leaving space for a real personal reply.', notice: 'Never paste credentials, health details, payment details, or a member’s private information into an email, text, or public message. Do not guarantee a fitness outcome or provide medical advice. Use the Medical / High-Risk Question script when a concern falls outside coaching scope.', steps: [
        ['Acknowledge quickly', 'For contact requests, coaching applications, waitlist entries, and check-ins, send the matching acknowledgment immediately or as soon as you see it.'],
        ['Personalize before sending', 'Replace every bracketed detail, read the full message, and give one clear next step. Never send a template untouched.'],
        ['Track the promise', 'If you say you will reply, schedule, review, or follow up, create a Coach Command task with a due date before leaving the conversation.'],
        ['Use the right channel', 'Email is the record for leads, onboarding, and decisions. Portal messaging is for active-member coaching. Social DMs should move to email or the application form when personal details are needed.'],
        ['Close the loop', 'After the person responds or the next action is complete, add the outcome to the relevant member or lead note and mark the Coach Command task complete.']
    ]},
    { id: 'member-care', tag: 'MEMBER FLOW', title: 'WHEN A MEMBER JOINS', steps: [
        ['Create secure access', 'Create or invite the member through Supabase Authentication, then direct them to the Member Portal.'],
        ['Complete readiness', 'Confirm onboarding intake and the Echelon waiver are complete before training begins.'],
        ['Build their program', 'Open their member record, add goals and notes, then publish their first workout plan in the Coaching Hub.'],
        ['Set the rhythm', 'Ask for weekly check-ins, review their momentum, and use private messages for timely support.']
    ]},
    { id: 'member-portal', tag: 'MEMBER EXPERIENCE', title: 'WHAT MEMBERS SEE FIRST', intro: 'The Member Portal is arranged around the member’s current coaching rhythm rather than a long menu of links. Direct a member to the first relevant action instead of asking them to search.', steps: [
        ['Coaching Hub first', 'This is the member&apos;s primary daily space: current plan, nutrition log, progress photos, and private coach messaging.'],
        ['Session Check-In next', 'Use when they are preparing for an in-person session or need to signal readiness to the coach.'],
        ['Weekly Performance', 'Use for the structured weekly review of progress, habits, recovery, and coaching focus.'],
        ['Vault and Resource Hub', 'The Member Vault holds private Echelon material. The Resource Hub provides the broader education and complimentary resources.'],
        ['First-Time Setup last', 'Onboarding and waiver are intentionally collapsed at the bottom. They must be complete before training begins, but they do not distract active members after setup.']
    ]},
    { id: 'publishing', tag: 'WEBSITE UPDATES', title: 'HOW TO PUBLISH AN UPDATE', steps: [
        ['Use Site Content for daily changes', 'For announcements, temporary offers, class notices, resource releases, shop messages, or a focused button, use the Site Content tab in the Admin Console. It publishes directly from Supabase—no code, GitHub, or Vercel step needed.'],
        ['Choose the right placement', 'Homepage places the update before About. Training, Resources, and Shop place it at the top of that specific section. Keep one strong message per placement whenever possible.'],
        ['Set the life cycle', 'Save unfinished copy as Draft. Choose Published for immediate visibility or Scheduled for a future go-live time. Add an end time for anything temporary so it removes itself automatically.'],
        ['Refresh the media gallery', 'Use the Media tab to upload photos or short MP4/WebM videos for the carousel. Publish only approved media, use low display-order numbers for priority frames, and remove retired frames after their replacement is confirmed.'],
        ['Work locally first', 'Make changes in the Echelon website folder and review them in your browser.'],
        ['Publish through GitHub', 'Commit the approved website changes to the ECHELON_LIVE main branch. Vercel automatically creates the production deployment.'],
        ['Review the deployment', 'Open Vercel after the GitHub update and confirm the production deployment is ready. The live domain then receives the new version.'],
        ['Verify live essentials', 'Test the home page and all six Training Hub cards, a form, member login, admin login, password reset, a member-prefilled check-in, and the booking page on echelonfitness.co.']
    ]},
    { id: 'access', tag: 'CREDENTIAL DIRECTORY', title: 'SECURE ACCESS, NOT SHARED PASSWORDS', notice: 'Do not store passwords, recovery codes, or payment details in this website or in the Admin Console. Keep them in a dedicated password manager and grant each operator their own access.', steps: [
        ['Password manager record', 'For each system above, store the sign-in URL, account owner, recovery contact, 2FA method, and emergency recovery instructions.'],
        ['Individual access only', 'Invite each operator to Vercel, Supabase, Formspree, and Etsy using their own email whenever that platform supports it.'],
        ['Handoff checklist', 'Before someone operates alone, have them complete a preview deployment, review a test lead, create a test task, and send a test member message.'],
        ['Offboarding', 'Remove their access from each system and your password manager as soon as their role ends.']
    ]},
    { id: 'overhaul-2026-07', tag: 'CHANGE LOG', title: 'SITE OVERHAUL — WHAT CHANGED', intro: 'A full site pass covering launch blockers, conversion, design, security, and compliance. Everything below is live in production. Keep this section until the next major update.', steps: [
        ['Pricing is now public', '12-Week Transformation shows "$399 paid in full, or $149/month." 1-on-1 Coaching shows "$399/month" flat. Both are hardcoded in index.html\'s Training Hub cards; update the text directly there if pricing changes.'],
        ['1-on-1 scarcity line is manual', 'The "Accepting up to 6 new 1-on-1 clients this month" line near the 1-on-1 card is plain text in index.html, not pulled from the roster automatically. Update it by hand as your actual capacity changes.'],
        ['Waiver now blocks Member Hub access', 'Member Portal, Coaching Hub, Nutrition, Performance, and the Member Vault all check for a signed member_waivers row before loading. A member with account access but no signed waiver is redirected to the waiver page automatically — nothing to check manually.'],
        ['Member Login is in every header', 'Previously footer-only. Now a small "Member Login" link sits in the header nav (and mobile menu) on the homepage and every public page.'],
        ['Standardize on "VL Body Lab"', 'Never use "VL Kinetic" in new copy, forms, or Formspree routing labels — it was a naming inconsistency that has been fully corrected site-wide.'],
        ['Shop link is a single variable', 'EFC_ETSY_SHOP_URL at the top of assets/js/shop-showcase.js controls the "Shop the Collection" button. Leave it blank for the current "Notify Me" waitlist state, or set your real Etsy URL there once the storefront is live — one change updates the whole site.'],
        ['Conversion tracking is wired but inactive', 'assets/js/analytics.js fires events for drop-in purchase, coaching application, private group inquiry, waitlist join, and check-in completion — but only once a GA4 Measurement ID is installed. It is currently a safe no-op.'],
        ['Scheduled backup is built but not yet running', 'scripts/backup/ exports member profiles, waivers, progress photos, coaching applications, and other critical tables to a Google Sheet + Drive folder daily via GitHub Actions — but needs a one-time Google Cloud service account setup before its first run. See scripts/backup/README.md.'],
        ['Security headers centralized', 'CSP, X-Frame-Options, and HSTS are all set in vercel.json. Contact and coaching application forms now go through rate-limited server routes (api/contact/submit.js, api/coaching-application/submit.js) instead of writing to Supabase directly from the browser.'],
        ['Legal pages contact info fixed', 'Privacy, Terms, and Disclaimer pages now list echelonfitnesscollective@gmail.com and www.echelonfitness.co (previously showed a placeholder domain that never matched the live site).'],
        ['Stripe catalog reviewed and fixed', '12-Week pay-in-full copy corrected to match the $399 Stripe price (was showing $349). Removed a stray duplicate price left on the Group Fitness product from initial setup.'],
        ['Private Group Training checkout now works', 'Previously had no working payment path at all. Now: base $199 (up to 5 people) + $25/person add-on price in Stripe; the admin Applications panel has a group-size field (3–15) that auto-calculates the total and sends a single payment link with both line items.'],
        ['First class free — no Stripe involved', 'New "Try your first class free" link on the Group Fitness card (pages/free-class.html) captures name/email/phone/preferred day into website_leads (lead_type "Free class request") for a coach to confirm and schedule — same pattern as the contact form, no payment step.'],
        ['Group Fitness purchases now show up for you', 'Previously a drop-in or unlimited purchase completed in Stripe but left zero record anywhere in the Admin Console. The webhook now logs each one into website_leads (lead_type "Group fitness purchase") so it shows up in your leads list like any other inquiry.'],
        ['Group Fitness pricing raised to market rate (2026-07-28)', 'Drop-in moved $20 → $23; Unlimited moved $59 → $89/month after checking local comps (a same-city competitor charges $125–213/mo for the same category of service). Old Stripe prices are archived, not deleted — anyone already subscribed at $59/mo keeps billing at that rate forever unless you or they change it. That is the entire grandfather mechanism: Stripe never migrates an existing subscription to a new price on its own.'],
        ['12-Week Transformation never auto-ends', 'The $149/mo plan is an open-ended Stripe subscription by design — "12-week" names the coaching curriculum, not a billing cutoff. Nothing cancels automatically. When a 12-Week enrollment is paid, the webhook creates a Coach Command task ("12-Week check-in: [name]") due 84 days later so you have the renew/upgrade/move-to-Group conversation at the natural checkpoint instead of losing the client to a silent auto-cancellation.'],
        ['Launch Faith & Favor / VL Body Lab without touching code', 'New "Launch Control" panel inside Program Delivery (Training Hub → scroll down). Type the coach\'s name, pick a date, click Launch Program — the public card flips from "IN DEVELOPMENT" to "LIVE" on its own once that date arrives, no code change or redeploy needed. "Revert to In Development" undoes it. If the fetch fails for any reason the card just keeps showing its normal static text, so nothing on the public site can break.'],
        ['Known open items', 'Waitlist confirmation email (needs a Formspree autoresponder or email API you set up), and a lapsed-member re-engagement flow (flagged, not built, needs your sign-off).']
    ]}
];

function manualElement(tag, text, className) { const el = document.createElement(tag); if (text) el.textContent = text; if (className) el.className = className; return el; }

function renderManualSection(section) {
    const article = manualElement('section', '', 'manual-section'); article.id = section.id;
    article.append(manualElement('span', section.tag, 'checkin-tag'), manualElement('h2', section.title));
    if (section.intro) article.append(manualElement('p', section.intro, 'manual-intro-copy'));
    if (section.notice) article.append(manualElement('p', section.notice, 'manual-security-notice'));
    if (section.cards) { const grid = manualElement('div', '', 'manual-system-grid'); section.cards.forEach(([name, type, url, description]) => { const card = manualElement('article', '', 'manual-system-card'); card.append(manualElement('span', type), manualElement('h3', name), manualElement('p', description)); if (url) { const link = manualElement('a', 'OPEN SYSTEM →'); link.href = url; link.target = '_blank'; link.rel = 'noopener'; card.append(link); } else card.append(manualElement('em', 'Link to be added when Etsy launches.')); grid.append(card); }); article.append(grid); }
    if (section.steps) { const list = manualElement('ol', '', 'manual-steps'); section.steps.forEach(([title, copy], index) => { const item = manualElement('li'); item.append(manualElement('span', String(index + 1).padStart(2, '0')), manualElement('strong', title), manualElement('p', copy)); list.append(item); }); article.append(list); }
    return article;
}

document.addEventListener('DOMContentLoaded', async () => {
    const root = document.getElementById('admin-operations-manual'); if (!root) return;
    const admin = await requireAdminSession(); if (!admin) return;
    document.getElementById('manual-session').textContent = admin.email || 'Echelon Administrator';
    document.getElementById('manual-updated-on').textContent = new Intl.DateTimeFormat(undefined, { month: 'long', day: 'numeric', year: 'numeric' }).format(new Date());
    const content = document.getElementById('manual-content'); const index = document.getElementById('manual-index-links');
    EFC_MANUAL_SECTIONS.forEach(section => { content.append(renderManualSection(section)); const link = manualElement('a', section.title); link.href = `#${section.id}`; index.append(link); });
    document.getElementById('manual-search').addEventListener('input', event => { const query = event.target.value.toLowerCase().trim(); content.querySelectorAll('.manual-section').forEach(section => { section.hidden = query && !section.innerText.toLowerCase().includes(query); }); });
});
