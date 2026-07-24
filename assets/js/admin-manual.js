const EFC_MANUAL_SECTIONS = [
    { id: 'systems', tag: 'SYSTEM DIRECTORY', title: 'THE Echelon STACK', intro: 'The systems currently supporting Echelon. Use the secure access directory in your password manager for the actual credentials.', cards: [
        ['Echelon Website', 'Public site', 'https://www.echelonfitness.co', 'Use for public pages, coaching applications, waitlist, and member access.'],
        ['GitHub', 'Source control', 'https://github.com/echelonfitnesscollective-ctrl/ECHELON_LIVE', 'The live site source. Every approved update is recorded here and triggers the Vercel deployment.'],
        ['Vercel', 'Hosting & deployments', 'https://vercel.com/dashboard', 'Hosts echelonfitness.co. Review the fresh deployment after every approved update.'],
        ['Supabase', 'Members, forms, admin data & site content', 'https://supabase.com/dashboard/project/plkdyvtriajpzcfgtwzp', 'Source of truth for member data, check-ins, goals, plans, messages, photos, the Admin Console, published Site Content, and the public Media Gallery.'],
        ['Formspree', 'Form delivery inbox', 'https://formspree.io/', 'Delivers contact and coaching application submissions to the Echelon inbox. Use it for fast notification, then track the actual follow-up in Coach Command.'],
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
    { id: 'new-lead', tag: 'LEAD FLOW', title: 'WHEN A NEW LEAD COMES IN', steps: [
        ['Find the lead', 'Open Coaching Applications or Contact & Waitlist in the Admin Console.'],
        ['Create the next action', 'Add a Coach Command follow-up task with their name, a due date, and the correct priority.'],
        ['Respond personally', 'Use your approved contact method. Update your private note with the important context and outcome.'],
        ['Move forward or close out', 'Keep the task open until there is a real next step. Mark it complete once the handoff or decision is final.']
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
        ['Verify live essentials', 'Test the home page, a form, member login, admin login, and password reset on echelonfitness.co.']
    ]},
    { id: 'access', tag: 'CREDENTIAL DIRECTORY', title: 'SECURE ACCESS, NOT SHARED PASSWORDS', notice: 'Do not store passwords, recovery codes, or payment details in this website or in the Admin Console. Keep them in a dedicated password manager and grant each operator their own access.', steps: [
        ['Password manager record', 'For each system above, store the sign-in URL, account owner, recovery contact, 2FA method, and emergency recovery instructions.'],
        ['Individual access only', 'Invite each operator to Vercel, Supabase, Formspree, and Etsy using their own email whenever that platform supports it.'],
        ['Handoff checklist', 'Before someone operates alone, have them complete a preview deployment, review a test lead, create a test task, and send a test member message.'],
        ['Offboarding', 'Remove their access from each system and your password manager as soon as their role ends.']
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
