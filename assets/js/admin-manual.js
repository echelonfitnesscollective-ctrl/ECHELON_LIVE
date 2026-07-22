const EFC_MANUAL_SECTIONS = [
    { id: 'systems', tag: 'SYSTEM DIRECTORY', title: 'THE Echelon STACK', intro: 'The systems currently supporting Echelon. Use the secure access directory in your password manager for the actual credentials.', cards: [
        ['Echelon Website', 'Public site', 'https://www.echelonfitness.co', 'Use for public pages, coaching applications, waitlist, and member access.'],
        ['Vercel', 'Hosting & deployments', 'https://vercel.com/dashboard', 'Publish a preview first. Promote only after the site, forms, and portals pass a quick test.'],
        ['Supabase', 'Members, forms, admin data & photos', 'https://supabase.com/dashboard/project/plkdyvtriajpzcfgtwzp', 'Source of truth for member data, check-ins, goals, plans, messages, photos, and the Admin Console.'],
        ['Formspree', 'Form delivery inbox', 'https://formspree.io/', 'Secondary email copies for contact requests and coaching applications.'],
        ['Instagram', 'Social channel', 'https://www.instagram.com/EchelonFitness.co', 'Primary social presence and community touchpoint.'],
        ['TikTok', 'Social channel', 'https://tr.ee/pO3gLtovXy', 'Short-form content and discovery channel.'],
        ['Etsy', 'Merch storefront · planned', '', 'Keep the shop placeholder until the Etsy shop is ready. Then add the Etsy URL in one place.']
    ]},
    { id: 'daily-ops', tag: 'DAILY OPERATIONS', title: 'THE DAILY COMMAND ROUTINE', steps: [
        ['Open Coach Command', 'Start in the Admin Console. Clear overdue tasks, then review new applications and website inquiries.'],
        ['Review member activity', 'Check new weekly reviews, nutrition logs, photos, and coach messages from each member record.'],
        ['Follow up with intent', 'Create a task for every lead or member action that needs a next step. Give it a due date and priority.'],
        ['Close the loop', 'Mark completed tasks done and leave a private coach note for context the next time you return.']
    ]},
    { id: 'new-lead', tag: 'LEAD FLOW', title: 'WHEN A NEW LEAD COMES IN', steps: [
        ['Find the lead', 'Open Coaching Applications or Contact & Waitlist in the Admin Console.'],
        ['Create the next action', 'Add a Coach Command follow-up task with their name, a due date, and the correct priority.'],
        ['Respond personally', 'Use your approved contact method. Update your private note with the important context and outcome.'],
        ['Move forward or close out', 'Keep the task open until there is a real next step. Mark it complete once the handoff or decision is final.']
    ]},
    { id: 'member-care', tag: 'MEMBER FLOW', title: 'WHEN A MEMBER JOINS', steps: [
        ['Create secure access', 'Create or invite the member through Supabase Authentication, then direct them to the Member Portal.'],
        ['Complete readiness', 'Confirm onboarding intake and the Echelon waiver are complete before training begins.'],
        ['Build their program', 'Open their member record, add goals and notes, then publish their first workout plan in the Coaching Hub.'],
        ['Set the rhythm', 'Ask for weekly check-ins, review their momentum, and use private messages for timely support.']
    ]},
    { id: 'publishing', tag: 'WEBSITE UPDATES', title: 'HOW TO PUBLISH AN UPDATE', steps: [
        ['Work locally first', 'Make changes in the Echelon website folder and review them in your browser.'],
        ['Deploy a Vercel Preview', 'Use the existing Vercel project to create a preview deployment. Check the important links and forms there.'],
        ['Approve production', 'Promote the verified preview to Production only after testing. The live domain then receives the new version.'],
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
