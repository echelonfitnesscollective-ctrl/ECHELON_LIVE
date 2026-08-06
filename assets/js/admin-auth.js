const EFC_ADMIN_SUPABASE_URL = 'https://plkdyvtriajpzcfgtwzp.supabase.co';
const EFC_ADMIN_SUPABASE_KEY = 'sb_publishable_CwFNrWSrhLKURZIk_-yt1A_ZVpFHEwf';
const EFC_ADMIN_STEP_UP_KEY = 'efc_admin_step_up_user';
const EFC_ADMIN_LAST_ACTIVITY_KEY = 'efc_admin_last_activity';
// 15 minutes of no clicks/keys/scrolling in the Admin Console signs the
// session out and sends the admin back to the login form. This does not
// affect the browser or phone's own saved-password/Face-ID autofill, which
// still works normally on the next sign-in.
const EFC_ADMIN_IDLE_TIMEOUT_MS = 15 * 60 * 1000;
const EFC_ADMIN_IDLE_CHECK_INTERVAL_MS = 60 * 1000;

const echelonAdminClient = window.supabase.createClient(
    EFC_ADMIN_SUPABASE_URL,
    EFC_ADMIN_SUPABASE_KEY
);

async function getAdminUser() {
    const { data, error } = await echelonAdminClient.auth.getUser();
    return error ? null : data.user;
}

function hasAdminStepUp(user) {
    return Boolean(user && window.sessionStorage.getItem(EFC_ADMIN_STEP_UP_KEY) === user.id);
}

function markAdminStepUp(user) {
    if (!user) return;
    window.sessionStorage.setItem(EFC_ADMIN_STEP_UP_KEY, user.id);
    recordAdminActivity();
}

function clearAdminStepUp() {
    window.sessionStorage.removeItem(EFC_ADMIN_STEP_UP_KEY);
    window.sessionStorage.removeItem(EFC_ADMIN_LAST_ACTIVITY_KEY);
}

function recordAdminActivity() {
    window.sessionStorage.setItem(EFC_ADMIN_LAST_ACTIVITY_KEY, String(Date.now()));
}

function isAdminSessionIdle() {
    const last = Number(window.sessionStorage.getItem(EFC_ADMIN_LAST_ACTIVITY_KEY));
    return !last || (Date.now() - last) > EFC_ADMIN_IDLE_TIMEOUT_MS;
}

async function signOutIdleAdmin() {
    clearAdminStepUp();
    await echelonAdminClient.auth.signOut();
    window.location.replace('admin-login.html?reason=timeout');
}

let efcAdminIdleWatchStarted = false;
function startAdminIdleWatch() {
    if (efcAdminIdleWatchStarted) return;
    efcAdminIdleWatchStarted = true;

    let throttled = false;
    const onActivity = () => {
        if (throttled) return;
        throttled = true;
        window.setTimeout(() => { throttled = false; }, 30 * 1000);
        recordAdminActivity();
    };
    ['click', 'keydown', 'scroll', 'touchstart', 'mousemove'].forEach((evt) =>
        window.addEventListener(evt, onActivity, { passive: true })
    );

    window.setInterval(() => {
        if (isAdminSessionIdle()) signOutIdleAdmin();
    }, EFC_ADMIN_IDLE_CHECK_INTERVAL_MS);
}

async function isEchelonAdmin() {
    const user = await getAdminUser();
    if (!user) return false;
    const { data, error } = await echelonAdminClient.rpc('is_echelon_admin');
    return !error && data === true;
}

async function requireAdminSession() {
    const user = await getAdminUser();
    const isAdmin = user && await isEchelonAdmin();
    const timedOut = Boolean(user) && hasAdminStepUp(user) && isAdminSessionIdle();

    if (!user || !isAdmin || !hasAdminStepUp(user) || timedOut) {
        if (timedOut) {
            await signOutIdleAdmin();
            return null;
        }
        clearAdminStepUp();
        window.location.replace(`admin-login.html?reason=${isAdmin ? 'admin-sign-in-required' : 'not-authorized'}`);
        return null;
    }

    recordAdminActivity();
    startAdminIdleWatch();
    return user;
}

function showAdminLoginFeedback(message) {
    const feedback = document.getElementById('admin-login-feedback');
    if (feedback) feedback.textContent = message;
}

async function initializeAdminLogin() {
    const form = document.getElementById('admin-login-form');
    if (!form) return;

    const reason = new URLSearchParams(window.location.search).get('reason');
    if (reason === 'not-authorized') {
        showAdminLoginFeedback('This account is not authorized for the Echelon Admin Console.');
    } else if (reason === 'admin-sign-in-required') {
        showAdminLoginFeedback('Enter your admin password to access the Echelon Admin Console.');
    } else if (reason === 'timeout') {
        showAdminLoginFeedback('You were signed out after a period of inactivity. Please sign in again.');
    }

    const currentUser = await getAdminUser();
    if (currentUser && await isEchelonAdmin() && hasAdminStepUp(currentUser)) {
        window.location.replace('admin-dashboard.html');
        return;
    }

    const submitButton = form.querySelector('button[type="submit"]');
    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        showAdminLoginFeedback('');
        submitButton.disabled = true;
        submitButton.textContent = 'SIGNING IN…';

        const { error } = await echelonAdminClient.auth.signInWithPassword({
            email: form.elements.email.value.trim(),
            password: form.elements.password.value
        });

        const signedInUser = await getAdminUser();
        if (error || !(await isEchelonAdmin()) || !signedInUser) {
            await echelonAdminClient.auth.signOut();
            clearAdminStepUp();
            showAdminLoginFeedback(error
                ? 'We could not sign you in. Check your email and password, then try again.'
                : 'This account is not authorized for the Echelon Admin Console.');
            submitButton.disabled = false;
            submitButton.textContent = 'SIGN IN';
            return;
        }

        markAdminStepUp(signedInUser);
        window.location.replace('admin-dashboard.html');
    });
}

function formatFieldLabel(key) {
    return key.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatValue(value) {
    if (value === true) return 'Yes';
    if (value === false) return 'No';
    return value || 'Not provided';
}

function renderAdminRecords(container, records, emptyMessage, buildRecord) {
    container.replaceChildren();
    if (!records.length) {
        container.textContent = emptyMessage;
        return;
    }
    records.forEach((record) => container.append(buildRecord(record)));
}

function createAdminRecord(columns) {
    const record = document.createElement('article');
    record.className = 'admin-record';
    columns.forEach(({ text, strong }) => {
        const item = document.createElement(strong ? 'strong' : 'span');
        item.textContent = text;
        record.append(item);
    });
    return record;
}

function paymentOptionForApplication(application) {
    const program = String(application.program_interest || '').toLowerCase();
    if (program.includes('private') || program.includes('group')) return 'private_group_training';
    if (program.includes('1-on-1') || program.includes('one-on-one')) return 'one_on_one_monthly';
    return 'echelon_12_monthly';
}

function paymentEmailLink(application, paymentUrl, label) {
    const subject = 'Your Echelon coaching next step';
    const body = `Hi ${application.full_name || ''},\n\nThank you for sharing your goals with Echelon. I’d be glad to move forward with ${label}.\n\nYour private payment link is below. Once payment is confirmed, I’ll send your Member Portal invitation and onboarding next steps.\n\n${paymentUrl}\n\nRespectfully,\nEchelon Fitness Collective`;
    return `mailto:${encodeURIComponent(application.email || '')}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

const APPLICATION_DETAIL_FIELDS = [
    ['primary_goal', 'Primary Goal'],
    ['fitness_level', 'Current Fitness Level'],
    ['training_days_per_week', 'Training Days Per Week'],
    ['commitment_level', 'Commitment Level (1-10)'],
    ['goal_and_why', 'Goal & Why It Matters'],
    ['goal_timeline', 'Goal Timeline'],
    ['past_attempts', "What They've Tried Before"],
    ['current_barriers', 'Current Barriers'],
    ['six_month_success', '6-Month Success Vision'],
    ['support_system', 'Support System'],
    ['activity_level', 'Current Activity Level'],
    ['nutrition_rating', 'Nutrition Rating'],
    ['sleep_hours', 'Average Sleep (Hours)'],
    ['coaching_why', 'Why Coaching Will Help'],
    ['structured_program_ready', 'Ready for a Structured Program?'],
    ['group_experience_details', 'Private Group / Organization Details'],
    ['instagram_handle', 'Instagram Handle']
];

function buildApplicationDetailPanel(item) {
    const panel = document.createElement('div');
    panel.className = 'application-detail-panel';
    panel.hidden = true;

    const dl = document.createElement('dl');
    dl.className = 'application-detail-list';
    if (item.phone) {
        const dt = document.createElement('dt'); dt.textContent = 'Phone';
        const dd = document.createElement('dd'); dd.textContent = item.phone;
        dl.append(dt, dd);
    }
    const data = item.application_data && typeof item.application_data === 'object' ? item.application_data : {};
    APPLICATION_DETAIL_FIELDS.forEach(([key, label]) => {
        const value = data[key];
        if (value === undefined || value === null || String(value).trim() === '') return;
        const dt = document.createElement('dt'); dt.textContent = label;
        const dd = document.createElement('dd'); dd.textContent = String(value);
        dl.append(dt, dd);
    });
    if (!dl.children.length) {
        const empty = document.createElement('p'); empty.className = 'application-detail-empty'; empty.textContent = 'No additional application details were submitted.';
        panel.append(empty);
    } else {
        panel.append(dl);
    }
    if (item.admin_notes) {
        const notesLabel = document.createElement('p'); notesLabel.className = 'application-detail-notes-label'; notesLabel.textContent = 'COACH NOTES';
        const notes = document.createElement('p'); notes.className = 'application-detail-notes'; notes.textContent = item.admin_notes;
        panel.append(notesLabel, notes);
    }
    return panel;
}

function buildApplicationContactEditor(item, onSaved) {
    const section = document.createElement('div');
    section.className = 'application-contact-editor';
    const heading = document.createElement('p'); heading.className = 'application-contact-editor-label'; heading.textContent = 'EDIT NAME, EMAIL & PHONE';
    const form = document.createElement('form'); form.className = 'echelon-form';
    const nameInput = document.createElement('input'); nameInput.type = 'text'; nameInput.placeholder = 'Full name'; nameInput.value = item.full_name || ''; nameInput.setAttribute('aria-label', 'Full name');
    const emailInput = document.createElement('input'); emailInput.type = 'email'; emailInput.placeholder = 'Email'; emailInput.value = item.email || ''; emailInput.setAttribute('aria-label', 'Email');
    const phoneInput = document.createElement('input'); phoneInput.type = 'tel'; phoneInput.placeholder = 'Phone'; phoneInput.value = item.phone || ''; phoneInput.setAttribute('aria-label', 'Phone');
    const save = document.createElement('button'); save.type = 'submit'; save.className = 'btn-secondary'; save.textContent = 'SAVE CONTACT INFO';
    const feedback = document.createElement('p'); feedback.className = 'form-error'; feedback.setAttribute('role', 'status');
    form.append(nameInput, emailInput, phoneInput, save, feedback);
    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        feedback.textContent = '';
        const updated = { full_name: nameInput.value.trim(), email: emailInput.value.trim() || null, phone: phoneInput.value.trim() || null };
        if (!updated.full_name) { feedback.textContent = 'Name is required.'; return; }

        save.disabled = true; save.textContent = 'SAVING…';
        const { error } = await echelonAdminClient.from('coaching_applications').update(updated).eq('id', item.id);
        save.disabled = false; save.textContent = 'SAVE CONTACT INFO';
        if (error) { feedback.textContent = 'Could not save. Please try again.'; return; }

        feedback.textContent = 'Saved.';
        onSaved(updated);
    });
    section.append(heading, form);
    return section;
}

async function fetchExistingOfferForApplication(applicationId) {
    const projectResult = await echelonAdminClient.from('onboarding_projects').select('id').eq('application_id', applicationId).limit(1).maybeSingle();
    if (!projectResult.data) return null;
    const offerResult = await echelonAdminClient.from('enrollment_offers').select('checkout_token, allowed_payment_options').eq('project_id', projectResult.data.id).eq('status', 'sent').order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (!offerResult.data?.checkout_token) return null;
    const label = offerResult.data.allowed_payment_options?.[0]?.label || 'your coaching program';
    return { paymentUrl: `${window.location.origin}/pages/enrollment-checkout.html?token=${offerResult.data.checkout_token}`, label };
}

function renderPaymentLinkButtons(actions, item, paymentUrl, label) {
    actions.querySelectorAll('[data-payment-link-button]').forEach((el) => el.remove());
    const copy = document.createElement('button'); copy.type = 'button'; copy.className = 'btn-secondary'; copy.dataset.paymentLinkButton = '1'; copy.textContent = 'COPY PAYMENT LINK'; copy.addEventListener('click', async () => { try { await navigator.clipboard.writeText(paymentUrl); copy.textContent = 'LINK COPIED'; setTimeout(() => { copy.textContent = 'COPY PAYMENT LINK'; }, 2000); } catch (_) { window.prompt('Copy this private payment link:', paymentUrl); } });
    const email = document.createElement('a'); email.className = 'btn-primary'; email.dataset.paymentLinkButton = '1'; email.textContent = 'OPEN PAYMENT EMAIL'; email.href = paymentEmailLink(item, paymentUrl, label);
    actions.append(copy, email);
}

function createApplicationRecord(item) {
    const record = document.createElement('article');
    record.className = 'admin-record application-record';
    const top = document.createElement('div'); top.className = 'application-record-top';
    const name = document.createElement('strong'); name.textContent = item.full_name;
    const state = document.createElement('span'); state.className = `application-state ${item.payment_status === 'paid' ? 'is-paid' : ''}`; state.textContent = item.status || 'New';
    top.append(name, state);
    const details = document.createElement('span'); details.textContent = `${item.program_interest || 'Coaching'} · ${item.email || 'Email not provided'}`;
    const reference = document.createElement('span'); reference.className = 'application-reference'; reference.textContent = item.application_reference ? `REFERENCE · ${item.application_reference}` : 'PRIVATE APPLICATION';
    const detailPanel = buildApplicationDetailPanel(item);
    detailPanel.prepend(buildApplicationContactEditor(item, (updated) => {
        item.full_name = updated.full_name;
        item.email = updated.email;
        item.phone = updated.phone;
        name.textContent = item.full_name;
        details.textContent = `${item.program_interest || 'Coaching'} · ${item.email || 'Email not provided'}`;
    }));
    const detailToggle = document.createElement('button'); detailToggle.type = 'button'; detailToggle.className = 'btn-secondary application-detail-toggle'; detailToggle.textContent = 'VIEW DETAILS';
    detailToggle.addEventListener('click', () => {
        detailPanel.hidden = !detailPanel.hidden;
        detailToggle.textContent = detailPanel.hidden ? 'VIEW DETAILS' : 'HIDE DETAILS';
    });
    const actions = document.createElement('div'); actions.className = 'application-record-actions';
    actions.append(detailToggle);
    const paymentFeedback = document.createElement('p'); paymentFeedback.className = 'application-payment-feedback'; paymentFeedback.setAttribute('role', 'status');

    function buildCreateOfferForm(reopenLabel) {
        const choice = document.createElement('select'); choice.setAttribute('aria-label', `Payment option for ${item.full_name}`);
        [['echelon_12_monthly', 'ECHELON 12 · $149 / MO'], ['echelon_12_paid_in_full', 'ECHELON 12 · $399 PAID IN FULL'], ['one_on_one_monthly', '1-ON-1 COACHING · MONTHLY'], ['private_group_training', 'PRIVATE GROUP TRAINING · BY SIZE']].forEach(([value, label]) => { const option = document.createElement('option'); option.value = value; option.textContent = label; choice.append(option); });
        choice.value = paymentOptionForApplication(item);
        const groupSizeInput = document.createElement('input'); groupSizeInput.type = 'number'; groupSizeInput.min = '3'; groupSizeInput.max = '15'; groupSizeInput.placeholder = 'GROUP SIZE (3–15)'; groupSizeInput.setAttribute('aria-label', `Group size for ${item.full_name}`); groupSizeInput.hidden = choice.value !== 'private_group_training';
        choice.addEventListener('change', () => { groupSizeInput.hidden = choice.value !== 'private_group_training'; });
        const createOffer = document.createElement('button'); createOffer.type = 'button'; createOffer.className = 'btn-secondary'; createOffer.textContent = reopenLabel || 'CREATE PAYMENT LINK';
        createOffer.addEventListener('click', async () => {
            const groupSize = Number(groupSizeInput.value);
            if (choice.value === 'private_group_training' && (!Number.isInteger(groupSize) || groupSize < 3 || groupSize > 15)) { paymentFeedback.textContent = 'Enter a group size between 3 and 15.'; return; }
            createOffer.disabled = true; createOffer.textContent = 'CREATING…'; paymentFeedback.textContent = '';
            const { data: sessionData } = await echelonAdminClient.auth.getSession();
            const payload = { applicationId: item.id, paymentOption: choice.value };
            if (choice.value === 'private_group_training') payload.groupSize = groupSize;
            const result = await fetch('/api/enrollment/create-offer', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionData.session?.access_token || ''}` }, body: JSON.stringify(payload) });
            const body = await result.json();
            if (!result.ok || !body.paymentUrl) { paymentFeedback.textContent = body.error || 'The payment link could not be created.'; createOffer.disabled = false; createOffer.textContent = reopenLabel || 'CREATE PAYMENT LINK'; return; }
            paymentFeedback.textContent = 'Private payment link created. Send it from your email below.';
            choice.remove(); groupSizeInput.remove(); createOffer.remove();
            renderPaymentLinkButtons(actions, item, body.paymentUrl, body.label);
            initializeCoachCommand();
        });
        actions.append(choice, groupSizeInput, createOffer);
    }

    if (item.payment_status === 'awaiting_payment') {
        const loading = document.createElement('span'); loading.className = 'application-payment-feedback'; loading.textContent = 'Loading your payment link…';
        actions.append(loading);
        fetchExistingOfferForApplication(item.id).then((offer) => {
            loading.remove();
            if (offer) {
                renderPaymentLinkButtons(actions, item, offer.paymentUrl, offer.label);
                const change = document.createElement('button'); change.type = 'button'; change.className = 'btn-secondary application-change-plan'; change.textContent = 'CHOOSE A DIFFERENT PLAN INSTEAD';
                change.addEventListener('click', () => { change.remove(); buildCreateOfferForm('CREATE NEW PAYMENT LINK'); });
                actions.append(change);
            } else {
                paymentFeedback.textContent = 'A payment link was started earlier but could not be found, create a new one below.';
                buildCreateOfferForm();
            }
        });
    } else if (item.payment_status !== 'paid') {
        buildCreateOfferForm();
    }

    if (item.payment_status === 'paid') {
        const invite = document.createElement('button'); invite.type = 'button'; invite.className = 'btn-primary'; invite.textContent = item.invited_at ? 'INVITATION SENT' : 'INVITE TO MEMBER PORTAL'; invite.disabled = Boolean(item.invited_at);
        invite.addEventListener('click', async () => {
            if (!window.confirm(`Send ${item.full_name} their secure Member Portal invitation now?`)) return;
            invite.disabled = true; invite.textContent = 'SENDING…';
            const { data: sessionData } = await echelonAdminClient.auth.getSession();
            const result = await fetch('/api/enrollment/activate-member', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionData.session?.access_token || ''}` }, body: JSON.stringify({ applicationId: item.id }) });
            const body = await result.json();
            if (!result.ok) { paymentFeedback.textContent = body.error || 'The invite could not be sent.'; invite.disabled = false; invite.textContent = 'INVITE TO MEMBER PORTAL'; return; }
            paymentFeedback.textContent = body.message; invite.textContent = 'INVITATION SENT'; initializeOperationsConsole(); initializeCoachCommand();
        });
        actions.append(invite);
    }
    record.append(top, details, reference, actions, detailPanel, paymentFeedback);
    return record;
}

function coachTaskDate(value) {
    if (!value) return 'No due date';
    const date = new Date(`${value}T12:00:00`);
    return `Due ${date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
}

function taskIsOverdue(task) {
    if (task.status !== 'Open' || !task.due_at) return false;
    return new Date(`${task.due_at}T23:59:59`) < new Date();
}

function createCoachTask(task) {
    const article = document.createElement('article');
    article.className = `coach-task ${taskIsOverdue(task) ? 'is-overdue' : ''}`;
    const copy = document.createElement('div');
    const title = document.createElement('strong');
    title.textContent = task.title;
    const metadata = document.createElement('p');
    metadata.textContent = [task.related_name, task.task_type, coachTaskDate(task.due_at)].filter(Boolean).join(' · ');
    const detail = document.createElement('p');
    detail.className = 'coach-task-detail';
    detail.textContent = task.description || `${task.priority} priority`;
    copy.append(title, metadata, detail);
    const actions = document.createElement('div');
    actions.className = 'coach-task-actions';
    const action = document.createElement('button');
    action.type = 'button';
    action.className = 'coach-task-complete';
    action.textContent = task.status === 'Completed' ? 'COMPLETED' : 'MARK COMPLETE';
    action.disabled = task.status === 'Completed';
    action.addEventListener('click', async () => {
        action.disabled = true;
        const { error } = await echelonAdminClient.from('coach_tasks').update({ status: 'Completed', completed_at: new Date().toISOString() }).eq('id', task.id);
        if (!error) initializeCoachCommand();
        else action.disabled = false;
    });
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'coach-task-delete';
    remove.textContent = 'REMOVE';
    remove.addEventListener('click', async () => {
        if (!window.confirm(`Remove “${task.title}” from the Coach Command queue?`)) return;
        remove.disabled = true;
        const { error } = await echelonAdminClient.from('coach_tasks').delete().eq('id', task.id);
        if (!error) initializeCoachCommand();
        else { remove.disabled = false; window.alert('That task could not be removed. Please try again.'); }
    });
    actions.append(action, remove);
    article.append(copy, actions);
    return article;
}

async function initializeCoachCommand() {
    const taskList = document.getElementById('coach-task-list');
    if (!taskList) return;
    const attentionList = document.getElementById('coach-attention-list');
    const status = document.getElementById('coach-command-status');
    const [tasksResult, applicationsResult, leadsResult] = await Promise.all([
        echelonAdminClient.from('coach_tasks').select('id, title, description, related_name, task_type, priority, status, due_at, created_at').order('created_at', { ascending: false }).limit(40),
        echelonAdminClient.from('coaching_applications').select('full_name, program_interest, created_at').eq('status', 'New').order('created_at', { ascending: false }).limit(8),
        echelonAdminClient.from('website_leads').select('full_name, lead_type, created_at').eq('status', 'New').order('created_at', { ascending: false }).limit(8)
    ]);
    if (tasksResult.error) {
        status.textContent = 'Coach tasks are not connected yet. Run the Coach Command database update.';
        return;
    }
    const tasks = tasksResult.data || [];
    const openTasks = tasks.filter((task) => task.status === 'Open');
    const visibleTasks = [...openTasks.filter(taskIsOverdue), ...openTasks.filter((task) => !taskIsOverdue(task)), ...tasks.filter((task) => task.status === 'Completed').slice(0, 5)];
    taskList.replaceChildren();
    if (!visibleTasks.length) taskList.textContent = 'Your queue is clear. Add a follow-up or coaching action above.';
    visibleTasks.forEach((task) => taskList.append(createCoachTask(task)));

    const attention = [];
    const overdue = openTasks.filter(taskIsOverdue).length;
    if (overdue) attention.push({ title: `${overdue} overdue coach task${overdue === 1 ? '' : 's'}`, detail: 'Open your task queue and complete or reschedule these first.' });
    (applicationsResult.data || []).forEach((item) => attention.push({ title: `New application: ${item.full_name}`, detail: item.program_interest }));
    (leadsResult.data || []).forEach((item) => attention.push({ title: `New ${item.lead_type || 'website'} inquiry: ${item.full_name}`, detail: new Date(item.created_at).toLocaleDateString() }));
    attentionList.replaceChildren();
    if (!attention.length) attentionList.textContent = 'No urgent site activity right now.';
    attention.slice(0, 8).forEach((item) => {
        const row = document.createElement('article');
        const heading = document.createElement('strong'); heading.textContent = item.title;
        const detail = document.createElement('span'); detail.textContent = item.detail;
        row.append(heading, detail); attentionList.append(row);
    });
    status.textContent = `${openTasks.length} open task${openTasks.length === 1 ? '' : 's'} · ${overdue} overdue`;

    const form = document.getElementById('coach-task-form');
    const feedback = document.getElementById('coach-task-feedback');
    if (form.dataset.bound) return;
    form.dataset.bound = 'true';
    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        feedback.textContent = '';
        const fields = form.elements;
        const { error } = await echelonAdminClient.from('coach_tasks').insert({
            title: fields.title.value.trim(), description: fields.description.value.trim() || null,
            related_name: fields.related_name.value.trim() || null, due_at: fields.due_at.value || null,
            task_type: fields.task_type.value, priority: fields.priority.value
        });
        if (error) { feedback.textContent = 'Task could not be saved. Please try again.'; return; }
        form.reset();
        feedback.textContent = 'Coach task added to the queue.';
        initializeCoachCommand();
    });
}

async function initializeOperationsConsole() {
    const applicationsList = document.getElementById('admin-applications-list');
    if (!applicationsList) return;

    const [applicationsResult, leadsResult, checkinsResult, resourcesResult] = await Promise.all([
        echelonAdminClient.from('coaching_applications').select('id, full_name, email, phone, program_interest, application_data, status, application_reference, application_status, payment_status, invited_at, admin_notes, created_at').order('created_at', { ascending: false }).limit(25),
        echelonAdminClient.from('website_leads').select('full_name, email, lead_type, category, status, created_at').order('created_at', { ascending: false }).limit(25),
        echelonAdminClient.from('session_checkins').select('full_name, email, program, status, checked_in_at').order('checked_in_at', { ascending: false }).limit(25),
        echelonAdminClient.from('trainer_resources').select('title, category, resource_url, notes, created_at').order('created_at', { ascending: false })
    ]);

    const applications = applicationsResult.data || [];
    const leads = leadsResult.data || [];
    const checkins = checkinsResult.data || [];
    const resources = resourcesResult.data || [];
    document.getElementById('admin-application-count').textContent = applications.filter((item) => item.status === 'New' || item.application_status === 'submitted').length;
    document.getElementById('admin-checkin-count').textContent = checkins.filter((item) => new Date(item.checked_in_at).toDateString() === new Date().toDateString()).length;

    const applicationsStatus = document.getElementById('admin-applications-status');
    applicationsStatus.textContent = applicationsResult.error ? 'Unable to load applications.' : `${applications.length} recent application${applications.length === 1 ? '' : 's'}`;
    renderAdminRecords(applicationsList, applications, 'Applications will appear here when submitted.', createApplicationRecord);

    const leadsStatus = document.getElementById('admin-leads-status');
    leadsStatus.textContent = leadsResult.error ? 'Unable to load website leads.' : `${leads.length} recent site lead${leads.length === 1 ? '' : 's'}`;
    renderAdminRecords(document.getElementById('admin-leads-list'), leads, 'Contact requests and waitlist entries will appear here.', (item) => createAdminRecord([
        { text: item.full_name, strong: true },
        { text: `${item.lead_type} · ${item.category || item.email}` },
        { text: new Date(item.created_at).toLocaleString() }
    ]));

    const checkinsStatus = document.getElementById('admin-checkins-status');
    checkinsStatus.textContent = checkinsResult.error ? 'Unable to load check-ins.' : `${checkins.length} recent check-in${checkins.length === 1 ? '' : 's'}`;
    renderAdminRecords(document.getElementById('admin-checkins-list'), checkins, 'Check-ins will appear here when submitted.', (item) => createAdminRecord([
        { text: item.full_name, strong: true },
        { text: `${item.program} · ${item.email}` },
        { text: new Date(item.checked_in_at).toLocaleString() }
    ]));

    const resourceList = document.getElementById('trainer-resources-list');
    renderAdminRecords(resourceList, resources, 'Save links, templates, and education here for your team.', (item) => createAdminRecord([
        { text: item.title, strong: true },
        { text: item.category },
        { text: item.resource_url || item.notes || 'Private note' }
    ]));

    const resourceForm = document.getElementById('trainer-resource-form');
    const resourceFeedback = document.getElementById('trainer-resource-feedback');
    resourceForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const { error } = await echelonAdminClient.from('trainer_resources').insert({
            title: resourceForm.elements.title.value.trim(),
            category: resourceForm.elements.category.value.trim(),
            resource_url: resourceForm.elements.resource_url.value.trim() || null,
            notes: resourceForm.elements.notes.value.trim() || null
        });
        if (error) {
            resourceFeedback.textContent = 'We could not save that resource.';
            return;
        }
        resourceFeedback.textContent = 'Resource saved.';
        resourceForm.reset();
        initializeOperationsConsole();
    }, { once: true });
}

async function initializeMemberLibraryManager() {
    const form = document.getElementById('member-library-form');
    if (!form) return;
    const list = document.getElementById('member-library-admin-list');
    const feedback = document.getElementById('member-library-feedback');
    async function refreshLibrary() {
        const { data, error } = await echelonAdminClient.from('member_library_resources').select('title, category, description, published, created_at').order('created_at', { ascending: false });
        if (error) { list.textContent = 'Run the Member Library database update to activate this section.'; return; }
        renderAdminRecords(list, data || [], 'No private member resources have been published yet.', item => createAdminRecord([{ text: item.title, strong: true }, { text: item.category }, { text: item.published ? 'Published' : 'Draft' }]));
    }
    await refreshLibrary();
    form.addEventListener('submit', async event => {
        event.preventDefault(); feedback.textContent = '';
        const file = form.elements.resource_file.files[0];
        if (!file || file.size > 15 * 1024 * 1024) { feedback.textContent = 'Choose a PDF or image under 15 MB.'; return; }
        const safeName = file.name.toLowerCase().replace(/[^a-z0-9.]+/g, '-');
        const path = `${Date.now()}-${safeName}`;
        const upload = await echelonAdminClient.storage.from('member-library').upload(path, file, { contentType: file.type, upsert: false });
        if (upload.error) { feedback.textContent = 'The file could not be uploaded.'; return; }
        const { error } = await echelonAdminClient.from('member_library_resources').insert({ title: form.elements.title.value.trim(), category: form.elements.category.value.trim(), description: form.elements.description.value.trim() || null, storage_path: path, published: true });
        if (error) { await echelonAdminClient.storage.from('member-library').remove([path]); feedback.textContent = 'The file uploaded, but could not be published.'; return; }
        form.reset(); feedback.textContent = 'Published to the Member Vault.'; refreshLibrary();
    });
    initializeBulkLibraryUpload(refreshLibrary);
}

function bulkLibraryDeriveCategory(filename) {
    const n = filename.toLowerCase();
    if (n.includes('cutting')) return 'Cutting';
    if (n.includes('bulking')) return 'Bulking';
    if (n.includes('muscle') || n.includes('hypertrophy')) return 'Muscle';
    if (n.includes('performance')) return 'Performance';
    if (n.includes('older') || n.includes('senior') || n.includes('wellness')) return 'Older-Adult Wellness';
    return 'Weight Loss';
}

function bulkLibraryDeriveTitle(filename) {
    let title = filename.replace(/\.pdf$/i, '').replace(/^Echelon\s*-\s*/i, '');
    const categoryPrefixes = ['Weight Loss', 'Cutting', 'Bulking', 'Muscle', 'Performance', 'Older-Adult Wellness', 'Older-Adult'];
    categoryPrefixes.forEach(prefix => {
        const re = new RegExp('^' + prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*-\\s*', 'i');
        title = title.replace(re, '');
    });
    return title.trim() || filename;
}

function initializeBulkLibraryUpload(refreshLibrary) {
    const filesInput = document.getElementById('member-library-bulk-files');
    const preview = document.getElementById('member-library-bulk-preview');
    const submitBtn = document.getElementById('member-library-bulk-submit');
    const feedback = document.getElementById('member-library-bulk-feedback');
    if (!filesInput || !preview || !submitBtn) return;

    const categoryOptions = ['Weight Loss', 'Cutting', 'Bulking', 'Muscle', 'Performance', 'Older-Adult Wellness', 'Fuel', 'Training', 'General'];

    filesInput.addEventListener('change', () => {
        preview.replaceChildren();
        const files = Array.from(filesInput.files || []);
        if (!files.length) { submitBtn.hidden = true; return; }
        files.forEach((file, index) => {
            const row = document.createElement('div');
            row.className = 'admin-bulk-row';
            const titleInput = document.createElement('input');
            titleInput.type = 'text'; titleInput.value = bulkLibraryDeriveTitle(file.name);
            titleInput.dataset.bulkTitle = String(index);
            titleInput.setAttribute('aria-label', `Title for ${file.name}`);
            const categorySelect = document.createElement('select');
            categorySelect.dataset.bulkCategory = String(index);
            categorySelect.setAttribute('aria-label', `Goal category for ${file.name}`);
            const guessed = bulkLibraryDeriveCategory(file.name);
            categoryOptions.forEach(opt => {
                const o = document.createElement('option'); o.value = opt; o.textContent = opt;
                if (opt === guessed) o.selected = true;
                categorySelect.append(o);
            });
            const nameSpan = document.createElement('span');
            nameSpan.className = 'admin-bulk-filename'; nameSpan.textContent = file.name;
            row.append(nameSpan, titleInput, categorySelect);
            preview.append(row);
        });
        submitBtn.hidden = false;
        feedback.textContent = '';
    });

    submitBtn.addEventListener('click', async () => {
        const files = Array.from(filesInput.files || []);
        if (!files.length) return;
        submitBtn.disabled = true;
        let published = 0;
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            if (file.size > 15 * 1024 * 1024) { feedback.textContent = `Skipped ${file.name}: over 15 MB.`; continue; }
            feedback.textContent = `Publishing ${i + 1} of ${files.length}: ${file.name}...`;
            const titleInput = preview.querySelector(`[data-bulk-title="${i}"]`);
            const categorySelect = preview.querySelector(`[data-bulk-category="${i}"]`);
            const title = (titleInput?.value || file.name).trim();
            const category = categorySelect?.value || 'General';
            const safeName = file.name.toLowerCase().replace(/[^a-z0-9.]+/g, '-');
            const path = `${Date.now()}-${i}-${safeName}`;
            const upload = await echelonAdminClient.storage.from('member-library').upload(path, file, { contentType: file.type, upsert: false });
            if (upload.error) { feedback.textContent = `Failed to upload ${file.name}, stopped there.`; break; }
            const { error } = await echelonAdminClient.from('member_library_resources').insert({ title, category, description: null, storage_path: path, published: true });
            if (error) { await echelonAdminClient.storage.from('member-library').remove([path]); feedback.textContent = `${file.name} uploaded but could not be published, stopped there.`; break; }
            published++;
        }
        submitBtn.disabled = false;
        if (published === files.length) {
            feedback.textContent = `Published all ${published} resources to the Member Vault.`;
            filesInput.value = ''; preview.replaceChildren(); submitBtn.hidden = true;
        } else if (published > 0) {
            feedback.textContent += ` (${published} of ${files.length} published before stopping.)`;
        }
        refreshLibrary();
    });
}

async function initializeEquipmentManager() {
    const form = document.getElementById('equipment-form');
    if (!form) return;
    const list = document.getElementById('equipment-list');
    const feedback = document.getElementById('equipment-feedback');

    async function refreshEquipment() {
        const [{ data: items, error: itemsError }, { data: notes, error: notesError }] = await Promise.all([
            echelonAdminClient.from('equipment_inventory').select('id, name, category, price, quantity, condition, purchase_date, notes').order('created_at', { ascending: false }),
            echelonAdminClient.from('equipment_notes').select('id, equipment_id, note, created_at').order('created_at', { ascending: false })
        ]);
        if (itemsError) { list.textContent = 'Run the coaching content database update to activate this section.'; return; }
        list.replaceChildren();
        if (!items.length) { list.textContent = 'No equipment logged yet.'; return; }
        items.forEach((item) => {
            const record = document.createElement('details');
            record.className = 'equipment-record';

            const summary = document.createElement('summary');
            const nameEl = document.createElement('strong'); nameEl.textContent = item.name;
            const categoryEl = document.createElement('span'); categoryEl.textContent = item.category || 'N/A';
            const priceEl = document.createElement('span'); priceEl.textContent = item.price != null ? `$${Number(item.price).toFixed(2)}` : 'N/A';
            const qtyEl = document.createElement('span'); qtyEl.textContent = `Qty ${item.quantity}`;
            const conditionEl = document.createElement('span'); conditionEl.textContent = item.condition || 'N/A';
            const deleteBtn = document.createElement('button'); deleteBtn.type = 'button'; deleteBtn.className = 'equipment-record-delete'; deleteBtn.textContent = 'DELETE';
            deleteBtn.addEventListener('click', async (event) => {
                event.preventDefault();
                if (!window.confirm(`Remove "${item.name}" from equipment inventory?`)) return;
                const { error } = await echelonAdminClient.from('equipment_inventory').delete().eq('id', item.id);
                if (!error) refreshEquipment();
            });
            summary.append(nameEl, categoryEl, priceEl, qtyEl, conditionEl, deleteBtn);

            const body = document.createElement('div');
            body.className = 'equipment-record-body';
            if (item.notes) {
                const generalNote = document.createElement('p');
                generalNote.textContent = item.notes;
                body.append(generalNote);
            }

            const noteList = document.createElement('ul');
            noteList.className = 'equipment-note-list';
            const itemNotes = (notes || []).filter((note) => note.equipment_id === item.id);
            if (itemNotes.length) {
                itemNotes.forEach((note) => {
                    const li = document.createElement('li');
                    const text = document.createElement('span'); text.textContent = note.note;
                    const time = document.createElement('time'); time.textContent = new Date(note.created_at).toLocaleString();
                    li.append(text, time);
                    noteList.append(li);
                });
            } else {
                const empty = document.createElement('li');
                empty.textContent = 'No notes yet.';
                noteList.append(empty);
            }
            body.append(noteList);

            const noteForm = document.createElement('form');
            noteForm.className = 'equipment-note-form';
            const noteInput = document.createElement('input');
            noteInput.type = 'text'; noteInput.placeholder = 'Add a note (repair, reorder, condition update...)';
            noteInput.setAttribute('aria-label', 'Add a note');
            noteInput.required = true;
            const noteSubmit = document.createElement('button');
            noteSubmit.type = 'submit'; noteSubmit.className = 'btn-secondary'; noteSubmit.textContent = 'ADD NOTE';
            noteForm.append(noteInput, noteSubmit);
            noteForm.addEventListener('submit', async (event) => {
                event.preventDefault();
                const noteText = noteInput.value.trim();
                if (!noteText) return;
                const { data: userData } = await echelonAdminClient.auth.getUser();
                const { error } = await echelonAdminClient.from('equipment_notes').insert({ equipment_id: item.id, note: noteText, author_id: userData?.user?.id || null });
                if (!error) refreshEquipment();
            });
            body.append(noteForm);

            record.append(summary, body);
            list.append(record);
        });
    }

    await refreshEquipment();

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        feedback.textContent = '';
        const { error } = await echelonAdminClient.from('equipment_inventory').insert({
            name: form.elements.name.value.trim(),
            category: form.elements.category.value.trim() || null,
            price: form.elements.price.value ? Number(form.elements.price.value) : null,
            quantity: form.elements.quantity.value ? Number(form.elements.quantity.value) : 1,
            condition: form.elements.condition.value.trim() || null,
            purchase_date: form.elements.purchase_date.value || null,
            notes: form.elements.notes.value.trim() || null
        });
        if (error) { feedback.textContent = 'We could not save that item. Please try again.'; return; }
        form.reset();
        feedback.textContent = 'Equipment added.';
        refreshEquipment();
    });
}

function workoutSettingLabel(setting) {
    if (setting === 'mobile') return 'Mobile';
    if (setting === 'both') return 'Gym or Mobile';
    return 'Gym';
}

async function initializeWorkoutLibraryManager() {
    const exerciseForm = document.getElementById('exercise-form');
    if (!exerciseForm) return;

    // ---- EXERCISES ----
    const exerciseList = document.getElementById('exercise-list');
    const exerciseFeedback = document.getElementById('exercise-feedback');
    const exerciseCancelBtn = document.getElementById('exercise-form-cancel');
    let exercises = [];

    function loadExerciseIntoForm(item) {
        exerciseForm.elements.id.value = item.id;
        exerciseForm.elements.name.value = item.name || '';
        exerciseForm.elements.target_area.value = item.target_area || '';
        exerciseForm.elements.description.value = item.description || '';
        exerciseForm.elements.form_cues.value = item.form_cues || '';
        exerciseForm.elements.coaching_cues.value = item.coaching_cues || '';
        exerciseForm.elements.modification_up.value = item.modification_up || '';
        exerciseForm.elements.modification_down.value = item.modification_down || '';
        exerciseForm.elements.modification_pregnancy.value = item.modification_pregnancy || '';
        exerciseForm.elements.video_url.value = item.video_url || '';
        exerciseForm.elements.equipment_needed.value = item.equipment_needed || '';
        exerciseForm.elements.status.value = item.status || 'draft';
        exerciseCancelBtn.hidden = false;
        exerciseForm.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    async function refreshExercises() {
        const { data, error } = await echelonAdminClient.from('exercise_library').select('*').order('created_at', { ascending: false });
        if (error) { exerciseList.textContent = 'Run the coaching content database update to activate this section.'; return []; }
        renderAdminRecords(exerciseList, data || [], 'No exercises yet.', (item) => {
            const record = createAdminRecord([
                { text: item.name, strong: true },
                { text: item.target_area || 'N/A' },
                { text: item.status === 'published' ? 'Published' : 'Draft' }
            ]);
            record.style.cursor = 'pointer';
            record.addEventListener('click', () => loadExerciseIntoForm(item));
            return record;
        });
        return data || [];
    }

    exerciseCancelBtn.addEventListener('click', () => {
        exerciseForm.reset();
        exerciseForm.elements.id.value = '';
        exerciseCancelBtn.hidden = true;
    });

    exerciseForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        exerciseFeedback.textContent = '';
        const id = exerciseForm.elements.id.value;
        const payload = {
            name: exerciseForm.elements.name.value.trim(),
            target_area: exerciseForm.elements.target_area.value.trim() || null,
            description: exerciseForm.elements.description.value.trim() || null,
            form_cues: exerciseForm.elements.form_cues.value.trim() || null,
            coaching_cues: exerciseForm.elements.coaching_cues.value.trim() || null,
            modification_up: exerciseForm.elements.modification_up.value.trim() || null,
            modification_down: exerciseForm.elements.modification_down.value.trim() || null,
            modification_pregnancy: exerciseForm.elements.modification_pregnancy.value.trim() || null,
            video_url: exerciseForm.elements.video_url.value.trim() || null,
            equipment_needed: exerciseForm.elements.equipment_needed.value.trim() || null,
            status: exerciseForm.elements.status.value
        };
        const { error } = id
            ? await echelonAdminClient.from('exercise_library').update(payload).eq('id', id)
            : await echelonAdminClient.from('exercise_library').insert(payload);
        if (error) { exerciseFeedback.textContent = 'We could not save that exercise. Please try again.'; return; }
        exerciseForm.reset();
        exerciseForm.elements.id.value = '';
        exerciseCancelBtn.hidden = true;
        exerciseFeedback.textContent = 'Saved.';
        exercises = await refreshExercises();
        populateExerciseSelect();
    });

    // ---- WORKOUTS ----
    const workoutForm = document.getElementById('workout-form');
    const workoutList = document.getElementById('workout-list');
    const workoutFeedback = document.getElementById('workout-feedback');
    const workoutCancelBtn = document.getElementById('workout-form-cancel');
    const workoutExerciseEditor = document.getElementById('workout-exercise-editor');
    const workoutExerciseEditorTitle = document.getElementById('workout-exercise-editor-title');
    const workoutExerciseForm = document.getElementById('workout-exercise-form');
    const workoutExerciseList = document.getElementById('workout-exercise-list');
    let activeWorkoutId = null;
    let workouts = [];

    function populateExerciseSelect() {
        const select = workoutExerciseForm.elements.exercise_id;
        select.replaceChildren();
        exercises.filter((e) => e.status === 'published').forEach((e) => {
            const opt = document.createElement('option');
            opt.value = e.id; opt.textContent = e.name;
            select.append(opt);
        });
    }

    function loadWorkoutIntoForm(item) {
        workoutForm.elements.id.value = item.id;
        workoutForm.elements.title.value = item.title || '';
        workoutForm.elements.category.value = item.category || '';
        workoutForm.elements.description.value = item.description || '';
        workoutForm.elements.setting.value = item.setting || 'gym';
        workoutForm.elements.status.value = item.status || 'draft';
        workoutCancelBtn.hidden = false;
    }

    async function refreshWorkoutExercises() {
        if (!activeWorkoutId) return;
        const { data, error } = await echelonAdminClient
            .from('workout_exercises')
            .select('id, sort_order, sets, reps, rest_seconds, notes, exercise_library(name)')
            .eq('workout_id', activeWorkoutId)
            .order('sort_order', { ascending: true });
        if (error) { workoutExerciseList.textContent = 'Could not load exercises for this workout.'; return; }
        renderAdminRecords(workoutExerciseList, data || [], 'No exercises added to this workout yet.', (row) => {
            const record = createAdminRecord([
                { text: row.exercise_library?.name || 'Unknown exercise', strong: true },
                { text: `${row.sets ?? 'N/A'} sets x ${row.reps || 'N/A'}${row.rest_seconds ? ` · ${row.rest_seconds}s rest` : ''}` },
                { text: row.notes || '' }
            ]);
            const removeBtn = document.createElement('button');
            removeBtn.type = 'button'; removeBtn.className = 'equipment-record-delete'; removeBtn.textContent = 'REMOVE';
            removeBtn.addEventListener('click', async () => {
                const { error: delError } = await echelonAdminClient.from('workout_exercises').delete().eq('id', row.id);
                if (!delError) refreshWorkoutExercises();
            });
            record.append(removeBtn);
            return record;
        });
    }

    async function openWorkoutExerciseEditor(workout) {
        activeWorkoutId = workout.id;
        loadWorkoutIntoForm(workout);
        workoutExerciseEditor.hidden = false;
        workoutExerciseEditorTitle.textContent = `EXERCISES IN "${(workout.title || '').toUpperCase()}"`;
        await refreshWorkoutExercises();
    }

    async function refreshWorkouts() {
        const { data, error } = await echelonAdminClient.from('workouts').select('*').order('created_at', { ascending: false });
        if (error) { workoutList.textContent = 'Run the coaching content database update to activate this section.'; return []; }
        renderAdminRecords(workoutList, data || [], 'No workouts yet.', (item) => {
            const record = createAdminRecord([
                { text: item.title, strong: true },
                { text: `${item.category || 'N/A'} · ${workoutSettingLabel(item.setting)}` },
                { text: item.status === 'published' ? 'Published' : 'Draft' }
            ]);
            record.style.cursor = 'pointer';
            record.addEventListener('click', () => openWorkoutExerciseEditor(item));
            return record;
        });
        return data || [];
    }

    workoutExerciseForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (!activeWorkoutId) return;
        const { data: existing } = await echelonAdminClient.from('workout_exercises').select('sort_order').eq('workout_id', activeWorkoutId).order('sort_order', { ascending: false }).limit(1);
        const nextSort = existing && existing.length ? existing[0].sort_order + 1 : 0;
        const { error } = await echelonAdminClient.from('workout_exercises').insert({
            workout_id: activeWorkoutId,
            exercise_id: workoutExerciseForm.elements.exercise_id.value,
            sort_order: nextSort,
            sets: workoutExerciseForm.elements.sets.value ? Number(workoutExerciseForm.elements.sets.value) : null,
            reps: workoutExerciseForm.elements.reps.value.trim() || null,
            rest_seconds: workoutExerciseForm.elements.rest_seconds.value ? Number(workoutExerciseForm.elements.rest_seconds.value) : null,
            notes: workoutExerciseForm.elements.notes.value.trim() || null
        });
        if (!error) { workoutExerciseForm.reset(); refreshWorkoutExercises(); }
    });

    workoutCancelBtn.addEventListener('click', () => {
        workoutForm.reset();
        workoutForm.elements.id.value = '';
        workoutCancelBtn.hidden = true;
        workoutExerciseEditor.hidden = true;
        activeWorkoutId = null;
    });

    workoutForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        workoutFeedback.textContent = '';
        const id = workoutForm.elements.id.value;
        const payload = {
            title: workoutForm.elements.title.value.trim(),
            category: workoutForm.elements.category.value.trim() || null,
            description: workoutForm.elements.description.value.trim() || null,
            setting: workoutForm.elements.setting.value,
            status: workoutForm.elements.status.value
        };
        const { error } = id
            ? await echelonAdminClient.from('workouts').update(payload).eq('id', id)
            : await echelonAdminClient.from('workouts').insert(payload);
        if (error) { workoutFeedback.textContent = 'We could not save that workout. Please try again.'; return; }
        workoutForm.reset();
        workoutForm.elements.id.value = '';
        workoutCancelBtn.hidden = true;
        workoutFeedback.textContent = 'Saved.';
        workouts = await refreshWorkouts();
        populateWorkoutSelect();
    });

    // ---- PROGRAM TEMPLATES ----
    const programForm = document.getElementById('program-template-form');
    const programList = document.getElementById('program-template-list');
    const programFeedback = document.getElementById('program-template-feedback');
    const programCancelBtn = document.getElementById('program-template-form-cancel');
    const programCalendarEditor = document.getElementById('program-calendar-editor');
    const programCalendarEditorTitle = document.getElementById('program-calendar-editor-title');
    const programCalendarForm = document.getElementById('program-calendar-form');
    const programCalendarList = document.getElementById('program-calendar-list');
    let activeProgramId = null;

    function populateWorkoutSelect() {
        const select = programCalendarForm.elements.workout_id;
        select.replaceChildren();
        workouts.filter((w) => w.status === 'published').forEach((w) => {
            const opt = document.createElement('option');
            opt.value = w.id; opt.textContent = w.title;
            select.append(opt);
        });
    }

    function loadProgramIntoForm(item) {
        programForm.elements.id.value = item.id;
        programForm.elements.title.value = item.title || '';
        programForm.elements.goal.value = item.goal || '';
        programForm.elements.description.value = item.description || '';
        programForm.elements.duration_weeks.value = item.duration_weeks || 12;
        programForm.elements.status.value = item.status || 'draft';
        programCancelBtn.hidden = false;
    }

    async function refreshProgramCalendar() {
        if (!activeProgramId) return;
        const { data, error } = await echelonAdminClient
            .from('program_template_workouts')
            .select('id, week_number, day_number, notes, workouts(title)')
            .eq('program_template_id', activeProgramId)
            .order('week_number', { ascending: true })
            .order('day_number', { ascending: true });
        if (error) { programCalendarList.textContent = "Could not load this program's calendar."; return; }
        renderAdminRecords(programCalendarList, data || [], 'No workouts assigned yet.', (row) => {
            const record = createAdminRecord([
                { text: `Week ${row.week_number}, Day ${row.day_number}`, strong: true },
                { text: row.workouts?.title || 'Unknown workout' },
                { text: row.notes || '' }
            ]);
            const removeBtn = document.createElement('button');
            removeBtn.type = 'button'; removeBtn.className = 'equipment-record-delete'; removeBtn.textContent = 'REMOVE';
            removeBtn.addEventListener('click', async () => {
                const { error: delError } = await echelonAdminClient.from('program_template_workouts').delete().eq('id', row.id);
                if (!delError) refreshProgramCalendar();
            });
            record.append(removeBtn);
            return record;
        });
    }

    async function openProgramCalendarEditor(program) {
        activeProgramId = program.id;
        loadProgramIntoForm(program);
        programCalendarEditor.hidden = false;
        programCalendarEditorTitle.textContent = `ASSIGN WORKOUTS · "${(program.title || '').toUpperCase()}"`;
        await refreshProgramCalendar();
    }

    async function refreshPrograms() {
        const { data, error } = await echelonAdminClient.from('program_templates').select('*').order('created_at', { ascending: false });
        if (error) { programList.textContent = 'Run the coaching content database update to activate this section.'; return; }
        renderAdminRecords(programList, data || [], 'No program templates yet.', (item) => {
            const record = createAdminRecord([
                { text: item.title, strong: true },
                { text: item.goal || 'N/A' },
                { text: `${item.duration_weeks} wks · ${item.status === 'published' ? 'Published' : 'Draft'}` }
            ]);
            record.style.cursor = 'pointer';
            record.addEventListener('click', () => openProgramCalendarEditor(item));
            return record;
        });
    }

    programCalendarForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (!activeProgramId) return;
        const { error } = await echelonAdminClient.from('program_template_workouts').upsert({
            program_template_id: activeProgramId,
            week_number: Number(programCalendarForm.elements.week_number.value),
            day_number: Number(programCalendarForm.elements.day_number.value),
            workout_id: programCalendarForm.elements.workout_id.value,
            notes: programCalendarForm.elements.notes.value.trim() || null
        }, { onConflict: 'program_template_id,week_number,day_number' });
        if (!error) { programCalendarForm.reset(); refreshProgramCalendar(); }
    });

    programCancelBtn.addEventListener('click', () => {
        programForm.reset();
        programForm.elements.id.value = '';
        programCancelBtn.hidden = true;
        programCalendarEditor.hidden = true;
        activeProgramId = null;
    });

    programForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        programFeedback.textContent = '';
        const id = programForm.elements.id.value;
        const payload = {
            title: programForm.elements.title.value.trim(),
            goal: programForm.elements.goal.value.trim() || null,
            description: programForm.elements.description.value.trim() || null,
            duration_weeks: Number(programForm.elements.duration_weeks.value) || 12,
            status: programForm.elements.status.value
        };
        const { error } = id
            ? await echelonAdminClient.from('program_templates').update(payload).eq('id', id)
            : await echelonAdminClient.from('program_templates').insert(payload);
        if (error) { programFeedback.textContent = 'We could not save that program. Please try again.'; return; }
        programForm.reset();
        programForm.elements.id.value = '';
        programCancelBtn.hidden = true;
        programFeedback.textContent = 'Saved.';
        await refreshPrograms();
    });

    // ---- initial load (order matters: exercises before workouts before programs) ----
    exercises = await refreshExercises();
    workouts = await refreshWorkouts();
    await refreshPrograms();
    populateExerciseSelect();
    populateWorkoutSelect();
}

function cmsDateForInput(value) {
    const date = value ? new Date(value) : new Date();
    date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
    return date.toISOString().slice(0, 16);
}

function cmsPlacementLabel(value) {
    return { homepage: 'Homepage', training: 'Training Hub', resources: 'Resources', shop: 'Shop' }[value] || value;
}

function cmsStatusClass(value) {
    return value === 'Published' ? 'is-published' : value === 'Scheduled' ? 'is-scheduled' : '';
}

function cmsScheduleLabel(item) {
    const publish = new Date(item.publish_at).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
    if (item.status === 'Draft') return 'Private draft';
    return item.status === 'Scheduled' || new Date(item.publish_at) > new Date() ? `Scheduled · ${publish}` : `Live since ${publish}`;
}

async function initializeSiteContentManager() {
    const form = document.getElementById('site-content-form');
    if (!form) return;
    const list = document.getElementById('site-content-list');
    const feedback = document.getElementById('site-content-feedback');
    const count = document.getElementById('site-content-count');
    const editorTitle = document.getElementById('site-content-form-title');
    const reset = document.getElementById('site-content-reset');
    const save = document.getElementById('site-content-save');
    let records = [];

    const resetEditor = () => {
        form.reset();
        form.elements.content_id.value = '';
        form.elements.placement.value = 'homepage';
        form.elements.status.value = 'Draft';
        form.elements.publish_at.value = cmsDateForInput();
        form.elements.sort_order.value = '0';
        editorTitle.textContent = 'CREATE AN UPDATE';
        save.textContent = 'SAVE UPDATE';
        reset.hidden = true;
        feedback.textContent = '';
    };

    const editRecord = (item) => {
        form.elements.content_id.value = item.id;
        form.elements.placement.value = item.placement;
        form.elements.status.value = item.status;
        form.elements.eyebrow.value = item.eyebrow || '';
        form.elements.title.value = item.title || '';
        form.elements.body.value = item.body || '';
        form.elements.cta_label.value = item.cta_label || '';
        form.elements.cta_url.value = item.cta_url || '';
        form.elements.image_url.value = item.image_url || '';
        form.elements.publish_at.value = cmsDateForInput(item.publish_at);
        form.elements.expires_at.value = item.expires_at ? cmsDateForInput(item.expires_at) : '';
        form.elements.sort_order.value = String(item.sort_order || 0);
        editorTitle.textContent = 'EDIT SITE UPDATE';
        save.textContent = 'SAVE CHANGES';
        reset.hidden = false;
        form.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    const render = () => {
        list.replaceChildren();
        count.textContent = `${records.length} ITEM${records.length === 1 ? '' : 'S'}`;
        if (!records.length) {
            const empty = document.createElement('p');
            empty.className = 'cms-content-empty';
            empty.textContent = 'No site updates yet. Create your first one on the left.';
            list.append(empty);
            return;
        }
        records.forEach((item) => {
            const card = document.createElement('article');
            card.className = `cms-content-item ${cmsStatusClass(item.status)}`;
            const copy = document.createElement('div');
            const tag = document.createElement('span'); tag.className = 'checkin-tag'; tag.textContent = item.eyebrow || cmsPlacementLabel(item.placement).toUpperCase();
            const title = document.createElement('h4'); title.textContent = item.title;
            const body = document.createElement('p'); body.textContent = item.body || 'No supporting copy added.';
            const meta = document.createElement('div'); meta.className = 'cms-content-meta';
            const status = document.createElement('span'); status.className = 'cms-status'; status.textContent = item.status.toUpperCase();
            const placement = document.createElement('span'); placement.textContent = cmsPlacementLabel(item.placement).toUpperCase();
            const schedule = document.createElement('span'); schedule.textContent = cmsScheduleLabel(item);
            meta.append(status, placement, schedule);
            copy.append(tag, title, body, meta);

            const actions = document.createElement('div'); actions.className = 'cms-content-actions';
            const edit = document.createElement('button'); edit.type = 'button'; edit.textContent = 'EDIT'; edit.addEventListener('click', () => editRecord(item));
            const publish = document.createElement('button'); publish.type = 'button';
            publish.textContent = item.status === 'Published' ? 'UNPUBLISH' : 'PUBLISH NOW';
            publish.addEventListener('click', async () => {
                publish.disabled = true;
                const values = item.status === 'Published' ? { status: 'Draft' } : { status: 'Published', publish_at: new Date().toISOString() };
                const { error } = await echelonAdminClient.from('site_content_items').update(values).eq('id', item.id);
                if (error) { feedback.textContent = 'That update could not be changed. Please try again.'; publish.disabled = false; return; }
                await refresh();
            });
            const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'cms-delete'; remove.textContent = 'REMOVE';
            remove.addEventListener('click', async () => {
                if (!window.confirm(`Remove “${item.title}”? This cannot be undone.`)) return;
                remove.disabled = true;
                const { error } = await echelonAdminClient.from('site_content_items').delete().eq('id', item.id);
                if (error) { feedback.textContent = 'That update could not be removed. Please try again.'; remove.disabled = false; return; }
                if (form.elements.content_id.value === item.id) resetEditor();
                await refresh();
            });
            actions.append(edit, publish, remove);
            card.append(copy, actions); list.append(card);
        });
    };

    const refresh = async () => {
        count.textContent = 'LOADING…';
        const { data, error } = await echelonAdminClient.from('site_content_items').select('*').order('updated_at', { ascending: false }).limit(100);
        if (error) {
            list.textContent = 'Run the Site Content CMS database update to activate this section.';
            count.textContent = 'SETUP REQUIRED';
            return;
        }
        records = data || [];
        render();
    };

    resetEditor();
    reset.addEventListener('click', resetEditor);
    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        feedback.textContent = '';
        const values = form.elements;
        const publishAt = new Date(values.publish_at.value);
        const expiresAt = values.expires_at.value ? new Date(values.expires_at.value) : null;
        if (Number.isNaN(publishAt.getTime()) || (expiresAt && expiresAt <= publishAt)) {
            feedback.textContent = 'Choose a valid go-live time and an end time that is later.';
            return;
        }
        save.disabled = true;
        save.textContent = 'SAVING…';
        const payload = {
            placement: values.placement.value,
            status: values.status.value,
            eyebrow: values.eyebrow.value.trim() || null,
            title: values.title.value.trim(),
            body: values.body.value.trim() || null,
            cta_label: values.cta_label.value.trim() || null,
            cta_url: values.cta_url.value.trim() || null,
            image_url: values.image_url.value.trim() || null,
            publish_at: publishAt.toISOString(),
            expires_at: expiresAt ? expiresAt.toISOString() : null,
            sort_order: Number(values.sort_order.value) || 0
        };
        const query = values.content_id.value
            ? echelonAdminClient.from('site_content_items').update(payload).eq('id', values.content_id.value)
            : echelonAdminClient.from('site_content_items').insert(payload);
        const { error } = await query;
        save.disabled = false;
        save.textContent = values.content_id.value ? 'SAVE CHANGES' : 'SAVE UPDATE';
        if (error) { feedback.textContent = 'Your update could not be saved. Please check the details and try again.'; return; }
        resetEditor();
        feedback.textContent = payload.status === 'Published' ? 'Published. The site will refresh with this update.' : payload.status === 'Scheduled' ? 'Scheduled. It will publish automatically at the time you set.' : 'Saved as a private draft.';
        await refresh();
    });
    await refresh();
}

function siteMediaPublicUrl(path) {
    return echelonAdminClient.storage.from('site-media').getPublicUrl(path).data.publicUrl;
}

async function initializeSiteMediaManager() {
    const form = document.getElementById('site-media-form');
    if (!form) return;
    const list = document.getElementById('site-media-list');
    const feedback = document.getElementById('site-media-feedback');
    const count = document.getElementById('site-media-count');
    const save = document.getElementById('site-media-save');
    let records = [];

    const refresh = async () => {
        count.textContent = 'LOADING…';
        const { data, error } = await echelonAdminClient.from('site_media_items').select('*').order('sort_order', { ascending: true }).order('created_at', { ascending: false }).limit(60);
        if (error) { list.textContent = 'Run the Media Manager database update to activate this section.'; count.textContent = 'SETUP REQUIRED'; return; }
        records = data || [];
        list.replaceChildren(); count.textContent = `${records.length} FRAME${records.length === 1 ? '' : 'S'}`;
        if (!records.length) { const empty = document.createElement('p'); empty.className = 'cms-content-empty'; empty.textContent = 'No managed media yet. Your original Echelon gallery remains live until you publish a frame here.'; list.append(empty); return; }
        records.forEach((item) => {
            const card = document.createElement('article'); card.className = `cms-content-item media-content-item${item.published ? ' is-published' : ''}`;
            const preview = document.createElement(item.media_type === 'video' ? 'video' : 'img'); preview.className = 'media-manager-preview'; preview.src = siteMediaPublicUrl(item.storage_path); preview.alt = item.title || 'Echelon media';
            if (item.media_type === 'video') { preview.muted = true; preview.preload = 'metadata'; preview.playsInline = true; }
            const copy = document.createElement('div');
            const tag = document.createElement('span'); tag.className = 'checkin-tag'; tag.textContent = item.media_type === 'video' ? 'SHORT VIDEO' : 'PHOTO';
            const title = document.createElement('h4'); title.textContent = item.title || 'ECHELON IN MOTION';
            const caption = document.createElement('p'); caption.textContent = item.caption || 'No caption added.';
            const meta = document.createElement('div'); meta.className = 'cms-content-meta';
            const visibility = document.createElement('span'); visibility.className = 'cms-status'; visibility.textContent = item.published ? 'PUBLISHED' : 'DRAFT';
            const order = document.createElement('span'); order.textContent = `ORDER ${item.sort_order}`; meta.append(visibility, order); copy.append(tag, title, caption, meta);
            const actions = document.createElement('div'); actions.className = 'cms-content-actions';
            const reorder = document.createElement('button'); reorder.type = 'button'; reorder.textContent = 'SET ORDER';
            reorder.addEventListener('click', async () => {
                const value = window.prompt('Display order (lower numbers appear first):', String(item.sort_order));
                if (value === null) return; const sortOrder = Number(value);
                if (!Number.isInteger(sortOrder) || sortOrder < 0 || sortOrder > 999) { feedback.textContent = 'Use a whole number from 0 to 999.'; return; }
                const { error } = await echelonAdminClient.from('site_media_items').update({ sort_order: sortOrder }).eq('id', item.id);
                if (error) { feedback.textContent = 'The display order could not be saved.'; return; } feedback.textContent = 'Display order updated.'; refresh();
            });
            const publish = document.createElement('button'); publish.type = 'button'; publish.textContent = item.published ? 'UNPUBLISH' : 'PUBLISH';
            publish.addEventListener('click', async () => {
                const { error } = await echelonAdminClient.from('site_media_items').update({ published: !item.published }).eq('id', item.id);
                if (error) { feedback.textContent = 'That media item could not be updated.'; return; } feedback.textContent = item.published ? 'Removed from the public gallery.' : 'Published to the public gallery.'; refresh();
            });
            const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'cms-delete'; remove.textContent = 'REMOVE';
            remove.addEventListener('click', async () => {
                if (!window.confirm(`Remove “${item.title || 'this media item'}” from the Echelon gallery?`)) return;
                remove.disabled = true;
                const { error } = await echelonAdminClient.from('site_media_items').delete().eq('id', item.id);
                if (error) { feedback.textContent = 'The media item could not be removed.'; remove.disabled = false; return; }
                await echelonAdminClient.storage.from('site-media').remove([item.storage_path]);
                feedback.textContent = 'Removed from the gallery.'; refresh();
            });
            actions.append(reorder, publish, remove); card.append(preview, copy, actions); list.append(card);
        });
    };

    form.addEventListener('submit', async (event) => {
        event.preventDefault(); feedback.textContent = '';
        const file = form.elements.media_file.files[0];
        if (!file || file.size > 30 * 1024 * 1024) { feedback.textContent = 'Choose a JPG, PNG, WebP, MP4, or WebM file under 30 MB.'; return; }
        const isVideo = file.type.startsWith('video/'); const isImage = file.type.startsWith('image/');
        if (!isVideo && !isImage) { feedback.textContent = 'Choose a JPG, PNG, WebP, MP4, or WebM file.'; return; }
        save.disabled = true; save.textContent = 'UPLOADING…';
        const safeName = file.name.toLowerCase().replace(/[^a-z0-9.]+/g, '-'); const path = `${Date.now()}-${safeName}`;
        const upload = await echelonAdminClient.storage.from('site-media').upload(path, file, { contentType: file.type, upsert: false });
        if (upload.error) { feedback.textContent = 'The file could not be uploaded. Please try again.'; save.disabled = false; save.textContent = 'UPLOAD TO GALLERY'; return; }
        const { error } = await echelonAdminClient.from('site_media_items').insert({ media_type: isVideo ? 'video' : 'image', title: form.elements.title.value.trim() || 'ECHELON IN MOTION', caption: form.elements.caption.value.trim() || null, storage_path: path, published: form.elements.published.value === 'true', sort_order: Number(form.elements.sort_order.value) || 0 });
        save.disabled = false; save.textContent = 'UPLOAD TO GALLERY';
        if (error) { await echelonAdminClient.storage.from('site-media').remove([path]); feedback.textContent = 'The file uploaded, but the gallery could not be updated.'; return; }
        form.reset(); form.elements.title.value = 'ECHELON IN MOTION'; form.elements.published.value = 'true'; form.elements.sort_order.value = '0';
        feedback.textContent = 'Added to your media queue. It is live if you chose Publish.'; await refresh();
    });
    await refresh();
}

function renderIntakeDetail(row) {
    const detail = document.getElementById('admin-intake-detail');
    const profile = row.profile;
    const email = profile?.email || `Member ${row.user_id.slice(0, 8)}`;
    const memberName = profile?.full_name || email;
    const updated = row.updated_at ? new Date(row.updated_at).toLocaleString() : 'Unknown date';

    detail.replaceChildren();
    const heading = document.createElement('h3');
    heading.textContent = memberName.toUpperCase();
    const timestamp = document.createElement('p');
    timestamp.className = 'admin-detail-date';
    timestamp.textContent = `Last submitted: ${updated}`;
    detail.append(heading, timestamp);

    const waiverStatus = document.createElement('p');
    waiverStatus.className = 'admin-detail-date';
    waiverStatus.textContent = row.waiver
        ? `Waiver signed by ${row.waiver.full_name} on ${new Date(row.waiver.signed_at).toLocaleString()}`
        : 'Waiver not yet signed.';
    detail.append(waiverStatus);

    appendMemberProfileEditor(detail, row, email);
    appendMemberTracker(detail, row, memberName);
    appendMemberTrainingProfile(detail, row);
    appendMemberCoachingControls(detail, row, memberName);

    [['PAR-Q READINESS', row.parq], ['HEALTH & CONTACT NOTES', row.health_history]].forEach(([title, values]) => {
        const section = document.createElement('section');
        const titleElement = document.createElement('h4');
        titleElement.textContent = title;
        const list = document.createElement('dl');
        Object.entries(values || {}).forEach(([key, value]) => {
            const term = document.createElement('dt');
            term.textContent = formatFieldLabel(key);
            const description = document.createElement('dd');
            description.textContent = formatValue(value);
            list.append(term, description);
        });
        section.append(titleElement, list);
        detail.append(section);
    });
}

function appendMemberProfileEditor(detail, row, email) {
    const profile = row.profile || {};
    const section = document.createElement('section');
    const heading = document.createElement('h4');
    heading.textContent = 'MEMBER PROFILE';
    const form = document.createElement('form');
    form.className = 'echelon-form admin-member-profile-form';
    const name = document.createElement('input');
    name.placeholder = 'Full name';
    name.value = profile.full_name || '';
    const phone = document.createElement('input');
    phone.placeholder = 'Phone number';
    phone.type = 'tel';
    phone.value = profile.phone || '';
    const emailDisplay = document.createElement('p');
    emailDisplay.className = 'admin-detail-date';
    emailDisplay.textContent = email;
    const save = document.createElement('button');
    save.type = 'submit';
    save.className = 'btn-secondary';
    save.textContent = 'SAVE MEMBER PROFILE';
    form.append(name, phone, save);
    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const { error } = await echelonAdminClient.from('member_profiles').update({
            full_name: name.value.trim() || null,
            phone: phone.value.trim() || null
        }).eq('user_id', row.user_id);
        if (!error) {
            row.profile = { ...profile, full_name: name.value.trim(), phone: phone.value.trim(), email };
            renderIntakeDetail(row);
        }
    });
    section.append(heading, emailDisplay, form);
    detail.append(section);
}

async function appendMemberTracker(detail, row, memberName) {
    const tracker = document.createElement('section');
    const title = document.createElement('h4');
    title.textContent = 'COACH NOTES & GOALS';
    const summary = document.createElement('p');
    summary.className = 'admin-detail-date';
    summary.textContent = 'Loading private tracker…';
    tracker.append(title, summary);
    detail.append(tracker);

    const [notesResult, goalsResult, performanceResult] = await Promise.all([
        echelonAdminClient.from('member_notes').select('note, created_at').eq('user_id', row.user_id).order('created_at', { ascending: false }).limit(5),
        echelonAdminClient.from('member_goals').select('goal, target_date, status').eq('user_id', row.user_id).order('created_at', { ascending: false }).limit(5),
        echelonAdminClient.from('member_weekly_checkins').select('week_of, body_weight, workouts_completed, nutrition_adherence, energy_score').eq('user_id', row.user_id).order('week_of', { ascending: false }).limit(4)
    ]);
    if (notesResult.error || goalsResult.error || performanceResult.error) {
        summary.textContent = 'Private tracker is unavailable right now.';
        return;
    }

    summary.textContent = '';
    const existing = document.createElement('p');
    existing.className = 'admin-detail-date';
    existing.textContent = `${goalsResult.data.length} goal(s) · ${notesResult.data.length} recent note(s) · ${performanceResult.data.length} weekly check-in(s)`;
    tracker.append(existing);

    performanceResult.data.forEach((checkin) => {
        const item = document.createElement('p');
        item.className = 'admin-detail-date';
        item.textContent = `${checkin.week_of}: ${checkin.workouts_completed ?? 'N/A'} workouts · nutrition ${checkin.nutrition_adherence ?? 'N/A'}/10 · energy ${checkin.energy_score ?? 'N/A'}/10${checkin.body_weight ? ` · ${checkin.body_weight} lb` : ''}`;
        tracker.append(item);
    });

    const goalForm = document.createElement('form');
    goalForm.className = 'echelon-form';
    const goalInput = document.createElement('input');
    goalInput.placeholder = 'Add a member goal';
    goalInput.required = true;
    const goalButton = document.createElement('button');
    goalButton.className = 'btn-secondary';
    goalButton.type = 'submit';
    goalButton.textContent = 'SAVE GOAL';
    goalForm.append(goalInput, goalButton);
    goalForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        await echelonAdminClient.from('member_goals').insert({ user_id: row.user_id, member_name: memberName, goal: goalInput.value.trim() });
        renderIntakeDetail(row);
    });

    const noteForm = document.createElement('form');
    noteForm.className = 'echelon-form';
    const noteInput = document.createElement('textarea');
    noteInput.placeholder = 'Add a private coach note';
    noteInput.required = true;
    noteInput.rows = 3;
    const noteButton = document.createElement('button');
    noteButton.className = 'btn-secondary';
    noteButton.type = 'submit';
    noteButton.textContent = 'SAVE NOTE';
    noteForm.append(noteInput, noteButton);
    noteForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        await echelonAdminClient.from('member_notes').insert({ user_id: row.user_id, member_name: memberName, note: noteInput.value.trim() });
        renderIntakeDetail(row);
    });
    tracker.append(goalForm, noteForm);
}

function trainingProfileSelect(label, options, value) {
    const select = document.createElement('select');
    select.setAttribute('aria-label', label);
    const blank = document.createElement('option'); blank.value = ''; blank.textContent = label; select.append(blank);
    options.forEach((opt) => {
        const option = document.createElement('option');
        option.value = opt; option.textContent = opt;
        if (opt === value) option.selected = true;
        select.append(option);
    });
    return select;
}

const TRAINING_PROFILE_DELIVERY_SETTINGS = ['Group Fitness', 'Private Group Training', '1-on-1 Coaching', '12-Week Transformation', 'VL Body Lab', 'Faith & Favor Mobility'];
const TRAINING_PROFILE_GOALS = ['Cutting', 'Weight Loss', 'Bulking', 'Muscle (Hypertrophy)', 'Performance', 'Older-Adult Wellness'];
const TRAINING_PROFILE_EXPERIENCE = ['New to training', 'Beginner (under 6 months)', 'Intermediate (6 months-2 years)', 'Advanced (2+ years)'];
const TRAINING_PROFILE_EQUIPMENT = ['Full gym', 'Home gym - dumbbells/bands', 'Bodyweight only', 'Mobile - coach brings equipment'];
const TRAINING_PROFILE_ACTIVITY = ['Sedentary', 'Lightly active', 'Moderately active', 'Very active'];
const TRAINING_PROFILE_CLEARANCE = ['Cleared - no restrictions', 'Cleared with restrictions', 'Pending clearance', 'Not yet discussed'];

async function appendMemberTrainingProfile(detail, row) {
    const section = document.createElement('section');
    const heading = document.createElement('h4');
    heading.textContent = 'TRAINING PROFILE';
    const summary = document.createElement('p');
    summary.className = 'admin-detail-date';
    summary.textContent = 'Loading intake…';
    section.append(heading, summary);
    detail.append(section);

    const { data: profile, error } = await echelonAdminClient
        .from('member_training_profiles')
        .select('*')
        .eq('user_id', row.user_id)
        .maybeSingle();
    if (error) { summary.textContent = 'Training Profile will be ready after its database update is run.'; return; }
    summary.textContent = profile ? `Last updated ${new Date(profile.updated_at).toLocaleDateString()}` : 'No intake on file yet - the fields below personalize which base program and modifications this member gets.';

    const form = document.createElement('form'); form.className = 'echelon-form';
    const deliverySelect = trainingProfileSelect('Delivery setting', TRAINING_PROFILE_DELIVERY_SETTINGS, profile?.delivery_setting);
    const primaryGoalSelect = trainingProfileSelect('Primary goal', TRAINING_PROFILE_GOALS, profile?.primary_goal);
    const secondaryGoalSelect = trainingProfileSelect('Secondary goal', TRAINING_PROFILE_GOALS, profile?.secondary_goal);
    const ageInput = document.createElement('input'); ageInput.type = 'number'; ageInput.min = '13'; ageInput.max = '100'; ageInput.placeholder = 'Age'; ageInput.setAttribute('aria-label', 'Age'); ageInput.value = profile?.age ?? '';
    const experienceSelect = trainingProfileSelect('Training experience', TRAINING_PROFILE_EXPERIENCE, profile?.training_experience);
    const daysInput = document.createElement('input'); daysInput.type = 'number'; daysInput.min = '1'; daysInput.max = '7'; daysInput.placeholder = 'Training days available per week'; daysInput.setAttribute('aria-label', 'Training days available per week'); daysInput.value = profile?.training_days_available ?? '';
    const durationInput = document.createElement('input'); durationInput.type = 'number'; durationInput.min = '10'; durationInput.max = '180'; durationInput.placeholder = 'Session duration (minutes)'; durationInput.setAttribute('aria-label', 'Session duration in minutes'); durationInput.value = profile?.session_duration_minutes ?? '';
    const equipmentSelect = trainingProfileSelect('Equipment access', TRAINING_PROFILE_EQUIPMENT, profile?.equipment_access);
    const activitySelect = trainingProfileSelect('Current activity level', TRAINING_PROFILE_ACTIVITY, profile?.current_activity_level);
    const injuriesInput = document.createElement('textarea'); injuriesInput.rows = 2; injuriesInput.placeholder = 'Injuries, pain, surgeries, pregnancy/postpartum status, or medical conditions'; injuriesInput.setAttribute('aria-label', 'Injuries, pain, surgeries, pregnancy or postpartum status, or medical conditions'); injuriesInput.value = profile?.injuries_conditions || '';
    const clearanceSelect = trainingProfileSelect('Medical clearance', TRAINING_PROFILE_CLEARANCE, profile?.medical_clearance);
    const preferencesInput = document.createElement('textarea'); preferencesInput.rows = 2; preferencesInput.placeholder = 'Exercise preferences (likes, dislikes, movements to avoid)'; preferencesInput.setAttribute('aria-label', 'Exercise preferences'); preferencesInput.value = profile?.exercise_preferences || '';
    const sleepStressInput = document.createElement('textarea'); sleepStressInput.rows = 2; sleepStressInput.placeholder = 'Sleep and stress'; sleepStressInput.setAttribute('aria-label', 'Sleep and stress'); sleepStressInput.value = profile?.sleep_stress || '';
    const barrierInput = document.createElement('textarea'); barrierInput.rows = 2; barrierInput.placeholder = 'Biggest consistency barrier'; barrierInput.setAttribute('aria-label', 'Biggest consistency barrier'); barrierInput.value = profile?.consistency_barrier || '';
    const saveButton = document.createElement('button'); saveButton.type = 'submit'; saveButton.className = 'btn-secondary'; saveButton.textContent = profile ? 'UPDATE TRAINING PROFILE' : 'SAVE TRAINING PROFILE';
    const feedback = document.createElement('p'); feedback.className = 'form-error'; feedback.setAttribute('role', 'status');

    form.append(
        deliverySelect, primaryGoalSelect, secondaryGoalSelect, ageInput, experienceSelect,
        daysInput, durationInput, equipmentSelect, activitySelect, injuriesInput,
        clearanceSelect, preferencesInput, sleepStressInput, barrierInput, saveButton, feedback
    );

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        feedback.textContent = '';
        const payload = {
            user_id: row.user_id,
            delivery_setting: deliverySelect.value || null,
            primary_goal: primaryGoalSelect.value || null,
            secondary_goal: secondaryGoalSelect.value || null,
            age: ageInput.value ? Number(ageInput.value) : null,
            training_experience: experienceSelect.value || null,
            training_days_available: daysInput.value ? Number(daysInput.value) : null,
            session_duration_minutes: durationInput.value ? Number(durationInput.value) : null,
            equipment_access: equipmentSelect.value || null,
            current_activity_level: activitySelect.value || null,
            injuries_conditions: injuriesInput.value.trim() || null,
            medical_clearance: clearanceSelect.value || null,
            exercise_preferences: preferencesInput.value.trim() || null,
            sleep_stress: sleepStressInput.value.trim() || null,
            consistency_barrier: barrierInput.value.trim() || null
        };
        const { error: saveError } = await echelonAdminClient.from('member_training_profiles').upsert(payload, { onConflict: 'user_id' });
        if (saveError) { feedback.textContent = 'We could not save this profile. Please try again.'; return; }
        feedback.textContent = 'Saved.';
        renderIntakeDetail(row);
    });

    section.append(form);
}

async function appendMemberCoachingControls(detail, row, memberName) {
    const section = document.createElement('section');
    const heading = document.createElement('h4');
    heading.textContent = 'COACHING HUB';
    const summary = document.createElement('p');
    summary.className = 'admin-detail-date';
    summary.textContent = 'Loading plans and messages…';
    section.append(heading, summary);
    detail.append(section);
    const admin = await getAdminUser();
    const [assignmentsResult, workoutsResult, programsResult, enrollmentResult, messagesResult] = await Promise.all([
        echelonAdminClient.from('member_daily_workouts').select('id, assigned_date, status, coach_note, workouts(title)').eq('user_id', row.user_id).order('assigned_date', { ascending: false }).limit(6),
        echelonAdminClient.from('workouts').select('id, title, setting').eq('status', 'published').order('title', { ascending: true }),
        echelonAdminClient.from('program_templates').select('id, title, duration_weeks').eq('status', 'published').order('title', { ascending: true }),
        echelonAdminClient.from('member_program_enrollments').select('start_date, status, program_templates(title)').eq('user_id', row.user_id).eq('status', 'active').order('start_date', { ascending: false }).limit(1),
        echelonAdminClient.from('coach_messages').select('sender_id, message, created_at').or(`sender_id.eq.${row.user_id},recipient_id.eq.${row.user_id}`).order('created_at', { ascending: false }).limit(6)
    ]);
    if (assignmentsResult.error || workoutsResult.error || messagesResult.error || !admin) { summary.textContent = 'Coaching Hub will be ready after its database update is run.'; return; }
    summary.textContent = `${assignmentsResult.data.length} recent assignment(s) · ${messagesResult.data.length} recent message(s)`;

    if (!enrollmentResult.error && enrollmentResult.data.length) {
        const active = enrollmentResult.data[0];
        const enrolledNote = document.createElement('p'); enrolledNote.className = 'admin-detail-date';
        enrolledNote.textContent = `Currently enrolled: ${active.program_templates?.title || 'Unknown program'} · started ${active.start_date}`;
        section.append(enrolledNote);
    }

    const enrollForm = document.createElement('form'); enrollForm.className = 'echelon-form';
    const programSelect = document.createElement('select'); programSelect.required = true; programSelect.setAttribute('aria-label', 'Program to enroll in');
    if (!programsResult.error && programsResult.data.length) {
        programsResult.data.forEach(p => { const opt = document.createElement('option'); opt.value = p.id; opt.textContent = `${p.title} (${p.duration_weeks} wks)`; programSelect.append(opt); });
    } else {
        const opt = document.createElement('option'); opt.textContent = 'Publish a program template first'; opt.value = ''; programSelect.append(opt); programSelect.disabled = true;
    }
    const enrollDateInput = document.createElement('input'); enrollDateInput.type = 'date'; enrollDateInput.required = true; enrollDateInput.setAttribute('aria-label', 'Program start date'); enrollDateInput.valueAsDate = new Date();
    const enrollButton = document.createElement('button'); enrollButton.type = 'submit'; enrollButton.className = 'btn-secondary'; enrollButton.textContent = 'ENROLL IN PROGRAM';
    const enrollFeedback = document.createElement('p'); enrollFeedback.className = 'form-error'; enrollFeedback.setAttribute('role', 'status');
    enrollForm.append(programSelect, enrollDateInput, enrollButton, enrollFeedback);
    enrollForm.addEventListener('submit', async event => {
        event.preventDefault();
        enrollFeedback.textContent = '';
        const { data: templateWorkouts, error: fetchError } = await echelonAdminClient
            .from('program_template_workouts')
            .select('week_number, day_number, workout_id, notes')
            .eq('program_template_id', programSelect.value);
        if (fetchError || !templateWorkouts.length) { enrollFeedback.textContent = 'This program has no workouts assigned yet.'; return; }
        const start = new Date(`${enrollDateInput.value}T00:00:00`);
        const rows = templateWorkouts.map(tw => {
            const date = new Date(start);
            date.setDate(date.getDate() + (tw.week_number - 1) * 7 + (tw.day_number - 1));
            return { user_id: row.user_id, workout_id: tw.workout_id, assigned_date: date.toISOString().slice(0, 10), coach_note: tw.notes || null };
        });
        const { error: insertError } = await echelonAdminClient.from('member_daily_workouts').insert(rows);
        if (insertError) { enrollFeedback.textContent = 'We could not enroll this member. Please try again.'; return; }
        await echelonAdminClient.from('member_program_enrollments').insert({ user_id: row.user_id, program_template_id: programSelect.value, start_date: enrollDateInput.value });
        renderIntakeDetail(row);
    });

    const assignForm = document.createElement('form'); assignForm.className = 'echelon-form';
    const workoutSelect = document.createElement('select'); workoutSelect.required = true; workoutSelect.setAttribute('aria-label', "Today's Work workout");
    if (!workoutsResult.data.length) {
        const opt = document.createElement('option'); opt.textContent = 'Publish a workout in the Workout Library first'; opt.value = ''; workoutSelect.append(opt); workoutSelect.disabled = true;
    } else {
        workoutsResult.data.forEach(w => { const opt = document.createElement('option'); opt.value = w.id; opt.textContent = `${w.title} (${workoutSettingLabel(w.setting)})`; workoutSelect.append(opt); });
    }
    const dateInput = document.createElement('input'); dateInput.type = 'date'; dateInput.required = true; dateInput.setAttribute('aria-label', 'Assigned date'); dateInput.valueAsDate = new Date();
    const noteInput = document.createElement('textarea'); noteInput.rows = 2; noteInput.placeholder = "Coach note for this workout (optional)"; noteInput.setAttribute('aria-label', 'Coach note');
    const assignButton = document.createElement('button'); assignButton.type = 'submit'; assignButton.className = 'btn-secondary'; assignButton.textContent = "ASSIGN A SINGLE DAY";
    assignForm.append(workoutSelect, dateInput, noteInput, assignButton);
    assignForm.addEventListener('submit', async event => {
        event.preventDefault();
        const { error } = await echelonAdminClient.from('member_daily_workouts').insert({ user_id: row.user_id, workout_id: workoutSelect.value, assigned_date: dateInput.value, coach_note: noteInput.value.trim() || null });
        if (!error) renderIntakeDetail(row);
    });

    const history = document.createElement('div'); history.className = 'coaching-history';
    assignmentsResult.data.forEach(item => {
        const line = document.createElement('p'); line.className = 'admin-detail-date';
        line.textContent = `${item.assigned_date} · ${item.workouts?.title || 'Unknown workout'} · ${item.status === 'completed' ? 'Completed' : 'Assigned'} `;
        const removeBtn = document.createElement('button'); removeBtn.type = 'button'; removeBtn.className = 'equipment-record-delete'; removeBtn.textContent = 'REMOVE';
        removeBtn.addEventListener('click', async () => { const { error: delError } = await echelonAdminClient.from('member_daily_workouts').delete().eq('id', item.id); if (!delError) renderIntakeDetail(row); });
        line.append(removeBtn);
        history.append(line);
    });

    const messages = document.createElement('div'); messages.className = 'coaching-history';
    messagesResult.data.forEach(item => { const line = document.createElement('p'); line.className = 'admin-detail-date'; line.textContent = `${item.sender_id === row.user_id ? memberName : 'You'}: ${item.message}`; messages.append(line); });
    const messageForm = document.createElement('form'); messageForm.className = 'echelon-form';
    const messageInput = document.createElement('textarea'); messageInput.rows = 3; messageInput.placeholder = 'Send a private message to this member'; messageInput.required = true;
    const messageButton = document.createElement('button'); messageButton.type = 'submit'; messageButton.className = 'btn-secondary'; messageButton.textContent = 'SEND MEMBER MESSAGE';
    messageForm.append(messageInput, messageButton);
    messageForm.addEventListener('submit', async event => { event.preventDefault(); const { error } = await echelonAdminClient.from('coach_messages').insert({ sender_id: admin.id, recipient_id: row.user_id, message: messageInput.value.trim() }); if (!error) renderIntakeDetail(row); });
    section.append(enrollForm, assignForm, history, messages, messageForm);
}

async function initializeAdminDashboard() {
    const list = document.getElementById('admin-intake-list');
    if (!list) return;

    const admin = await requireAdminSession();
    if (!admin) return;
    document.getElementById('admin-email').textContent = admin.email || 'Echelon Administrator';

    const signOut = document.getElementById('admin-sign-out');
    signOut.addEventListener('click', async () => {
        clearAdminStepUp();
        await echelonAdminClient.auth.signOut();
        window.location.replace('admin-login.html');
    });

    const status = document.getElementById('admin-intake-status');
    const { data: onboardingRecords, error: onboardingError } = await echelonAdminClient
        .from('member_onboarding')
        .select('user_id, parq, health_history, acknowledged_at, updated_at')
        .order('updated_at', { ascending: false });

    if (onboardingError) {
        status.textContent = 'We could not load intake submissions.';
        return;
    }

    const { data: profiles, error: profilesError } = await echelonAdminClient
        .from('member_profiles')
        .select('user_id, email, full_name, phone');

    if (profilesError) {
        status.textContent = 'We could not load member details.';
        return;
    }

    const { data: waivers, error: waiversError } = await echelonAdminClient
        .from('member_waivers')
        .select('user_id, full_name, signed_at, agreement_version');

    if (waiversError) {
        status.textContent = 'We could not load waiver records.';
        return;
    }

    document.getElementById('admin-member-count').textContent = onboardingRecords.length;

    const profilesByUserId = new Map(
        profiles.map((profile) => [profile.user_id, profile])
    );
    const waiversByUserId = new Map(
        waivers.map((waiver) => [waiver.user_id, waiver])
    );
    const data = onboardingRecords.map((record) => ({
        ...record,
        profile: profilesByUserId.get(record.user_id),
        waiver: waiversByUserId.get(record.user_id)
    }));

    status.textContent = data.length ? `${data.length} submission${data.length === 1 ? '' : 's'}` : 'No submissions yet';
    if (!data.length) {
        list.textContent = 'When a member submits their onboarding intake, it will appear here.';
        return;
    }

    data.forEach((row, index) => {
        const profile = row.profile;
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'admin-intake-item';
        const name = document.createElement('strong');
        name.textContent = profile?.full_name || profile?.email || `Member ${row.user_id.slice(0, 8)}`;
        const email = document.createElement('span');
        email.textContent = profile?.email || 'Email not available';
        const phone = document.createElement('span');
        phone.textContent = profile?.phone || 'Phone not added';
        button.append(name, email, phone);
        button.addEventListener('click', () => {
            list.querySelectorAll('.admin-intake-item').forEach((item) => item.classList.remove('active'));
            button.classList.add('active');
            renderIntakeDetail(row);
        });
        list.append(button);
        if (index === 0) {
            button.classList.add('active');
            renderIntakeDetail(row);
        }
    });
}

document.addEventListener('DOMContentLoaded', () => {
    initializeAdminLogin();
    initializeAdminDashboard().then(() => {
        initializeOperationsConsole();
        initializeCoachCommand();
        initializeMemberLibraryManager();
        initializeSiteContentManager();
        initializeSiteMediaManager();
        initializeCommunicationsLibrary();
        initializeSectionControl();
        initializeEquipmentManager();
        initializeWorkoutLibraryManager();
        initializeCoachingPlaybook();
        initializeAdminTabs();
    });
});

function sectionControlStatusLabel(row) {
    if (!row || row.status === 'hidden') return 'Status: Empty · not shown on the site';
    if (row.status !== 'launched' || !row.launch_at) return 'Status: In development';
    const launchDate = new Date(row.launch_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    if (new Date(row.launch_at) > new Date()) return `Status: Scheduled, goes live ${launchDate}`;
    if (row.expires_at) {
        const expiresDate = new Date(row.expires_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
        if (new Date(row.expires_at) <= new Date()) return `Status: Expired, was live until ${expiresDate}`;
        return `Status: Live since ${launchDate}, expires ${expiresDate}`;
    }
    return `Status: Live since ${launchDate}`;
}

function renderDetailRows(container, details) {
    container.innerHTML = '';
    (details || []).forEach((item) => addDetailRow(container, item?.label || '', item?.value || ''));
}

function addDetailRow(container, label = '', value = '') {
    const row = document.createElement('div');
    row.className = 'detail-row';
    row.innerHTML = `
        <input type="text" class="detail-row-label" placeholder="Label" value="${label.replace(/"/g, '&quot;')}">
        <input type="text" class="detail-row-value" placeholder="Value" value="${value.replace(/"/g, '&quot;')}">
        <button type="button" class="detail-row-remove" data-remove-row aria-label="Remove row">×</button>
    `;
    row.querySelector('[data-remove-row]').addEventListener('click', () => row.remove());
    container.appendChild(row);
}

function collectDetailRows(container) {
    return Array.from(container.querySelectorAll('.detail-row'))
        .map((row) => ({
            label: row.querySelector('.detail-row-label').value.trim(),
            value: row.querySelector('.detail-row-value').value.trim(),
        }))
        .filter((item) => item.label && item.value);
}

async function initializeSectionControl() {
    const grid = document.querySelector('[data-section-control-grid]');
    const forms = document.querySelectorAll('.section-control-card');
    if (!grid || !forms.length) return;

    const { data: rows } = await echelonAdminClient
        .from('training_programs')
        .select('program_key, name, subtitle, description, note, details, status, launch_at, expires_at, sort_order');
    let currentRows = rows || [];

    const findRow = (key) => currentRows.find((item) => item.program_key === key) || { program_key: key, status: 'in_development', sort_order: 0, details: [] };

    const renderForm = (form) => {
        const key = form.dataset.programKey;
        const row = findRow(key);
        form.elements.name.value = row.name || '';
        form.elements.subtitle.value = row.subtitle || '';
        form.elements.description.value = row.description || '';
        form.elements.note.value = row.note || '';
        renderDetailRows(form.querySelector('[data-detail-rows]'), row.details);

        const statusEl = form.querySelector('[data-launch-status]');
        if (statusEl) statusEl.textContent = sectionControlStatusLabel(row);

        const toggleHiddenBtn = form.querySelector('[data-toggle-hidden]');
        if (toggleHiddenBtn) toggleHiddenBtn.textContent = row.status === 'hidden' ? 'SHOW ON SITE' : 'HIDE FROM SITE';

        if (form.dataset.gated) {
            if (row.launch_at) form.elements.launch_at.value = new Date(row.launch_at).toISOString().slice(0, 10);
            else form.elements.launch_at.value = '';
            if (form.elements.expires_at) {
                form.elements.expires_at.value = row.expires_at ? new Date(row.expires_at).toISOString().slice(0, 10) : '';
            }
            const revertBtn = form.querySelector('[data-revert]');
            revertBtn.hidden = row.status === 'hidden' || (form.dataset.specialEvent !== 'true' && row.status !== 'launched');
        }
    };

    const reorderGrid = () => {
        currentRows
            .slice()
            .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
            .forEach((row) => {
                const form = Array.from(forms).find((f) => f.dataset.programKey === row.program_key);
                if (form) grid.appendChild(form);
            });
    };

    forms.forEach((form) => {
        renderForm(form);

        form.querySelector('[data-add-detail-row]').addEventListener('click', () => {
            addDetailRow(form.querySelector('[data-detail-rows]'));
        });

        const feedback = form.querySelector('[data-launch-feedback]');
        const key = form.dataset.programKey;

        form.addEventListener('submit', async (event) => {
            event.preventDefault();
            feedback.textContent = '';
            const payload = {
                name: form.elements.name.value.trim(),
                subtitle: form.elements.subtitle.value.trim() || null,
                description: form.elements.description.value.trim(),
                note: form.elements.note.value.trim() || null,
                details: collectDetailRows(form.querySelector('[data-detail-rows]')),
            };

            if (form.dataset.gated) {
                const launchAt = form.elements.launch_at.value;
                if (launchAt) {
                    payload.status = 'launched';
                    payload.launch_at = launchAt;
                    if (form.elements.expires_at) {
                        payload.expires_at = form.elements.expires_at.value || null;
                    }
                }
                // No launch date yet: save content only, leave status/launch_at untouched
                // so editing a still-unlaunched card never force-launches it.
            }

            const submitBtn = form.querySelector('button[type="submit"]');
            const originalLabel = submitBtn.textContent;
            submitBtn.disabled = true; submitBtn.textContent = 'SAVING…';
            const { error } = await echelonAdminClient.from('training_programs').update(payload).eq('program_key', key);
            submitBtn.disabled = false; submitBtn.textContent = originalLabel;
            if (error) { feedback.textContent = 'Could not save. Please try again.'; return; }

            currentRows = currentRows.map((row) => (row.program_key === key ? { ...row, ...payload } : row));
            renderForm(form);
            feedback.textContent = 'Saved. The public site reflects this automatically.';
        });

        const revertBtn = form.querySelector('[data-revert]');
        if (revertBtn) {
            revertBtn.addEventListener('click', async () => {
                const isSpecialEvent = form.dataset.specialEvent === 'true';
                const confirmMsg = isSpecialEvent
                    ? 'Clear this special event slot? This removes it from the public site and blanks the form.'
                    : 'Revert this program back to "In Development" on the public site?';
                if (!window.confirm(confirmMsg)) return;

                const payload = isSpecialEvent
                    ? { name: '', subtitle: null, description: '', note: null, details: [], status: 'hidden', launch_at: null, expires_at: null }
                    : { status: 'in_development', launch_at: null };

                const { error } = await echelonAdminClient.from('training_programs').update(payload).eq('program_key', key);
                if (error) { feedback.textContent = 'Could not revert. Please try again.'; return; }

                currentRows = currentRows.map((row) => (row.program_key === key ? { ...row, ...payload } : row));
                renderForm(form);
                feedback.textContent = isSpecialEvent ? 'Slot cleared.' : 'Reverted to in development.';
            });
        }

        const toggleHiddenBtn = form.querySelector('[data-toggle-hidden]');
        if (toggleHiddenBtn) {
            toggleHiddenBtn.addEventListener('click', async () => {
                const row = findRow(key);
                const nextStatus = row.status === 'hidden'
                    ? (form.dataset.gated && !row.launch_at ? 'in_development' : 'launched')
                    : 'hidden';

                toggleHiddenBtn.disabled = true;
                const { error } = await echelonAdminClient.from('training_programs').update({ status: nextStatus }).eq('program_key', key);
                toggleHiddenBtn.disabled = false;
                if (error) { feedback.textContent = 'Could not update visibility. Please try again.'; return; }

                currentRows = currentRows.map((r) => (r.program_key === key ? { ...r, status: nextStatus } : r));
                renderForm(form);
                feedback.textContent = nextStatus === 'hidden' ? 'Hidden from the public site.' : 'Visible on the public site again.';
            });
        }

        const moveUp = form.querySelector('[data-move-up]');
        const moveDown = form.querySelector('[data-move-down]');
        const move = async (direction) => {
            const sorted = currentRows.slice().sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
            const index = sorted.findIndex((row) => row.program_key === key);
            const swapIndex = direction === 'up' ? index - 1 : index + 1;
            if (swapIndex < 0 || swapIndex >= sorted.length) return;

            const a = sorted[index];
            const b = sorted[swapIndex];
            const aOrder = a.sort_order ?? 0;
            const bOrder = b.sort_order ?? 0;

            await Promise.all([
                echelonAdminClient.from('training_programs').update({ sort_order: bOrder }).eq('program_key', a.program_key),
                echelonAdminClient.from('training_programs').update({ sort_order: aOrder }).eq('program_key', b.program_key),
            ]);

            currentRows = currentRows.map((row) => {
                if (row.program_key === a.program_key) return { ...row, sort_order: bOrder };
                if (row.program_key === b.program_key) return { ...row, sort_order: aOrder };
                return row;
            });
            reorderGrid();
        };
        moveUp.addEventListener('click', () => move('up'));
        moveDown.addEventListener('click', () => move('down'));
    });

    reorderGrid();
}

const EFC_COMMUNICATION_TEMPLATES = [
    { tag: '01 · AUTOMATIC ACKNOWLEDGMENT', title: 'GENERAL INQUIRY RECEIVED', description: 'Use for every website contact request.', featured: true, subject: 'We received your message: Echelon Fitness Collective', body: `Hi [First Name],

Thank you for reaching out to Echelon Fitness Collective. Your message is in, and we’re reviewing the details now.

A member of our team will personally follow up within [timeframe] with the clearest next step. If your message includes a preferred time to connect, we’ll do our best to honor it.

Respectfully,
[Your Name]
Echelon Fitness Collective` },
    { tag: '02 · LEAD RESPONSE', title: 'COACHING APPLICATION RECEIVED', description: 'Confirm review without promising acceptance.', subject: 'Your Echelon coaching application is in', body: `Hi [First Name],

Thank you for applying to coach with Echelon. We received your application and will review your goals, availability, and the support you’re looking for.

We’ll follow up by [date/timeframe] with either a recommended next step or a few questions to help us place you well.

Respectfully,
[Your Name]
Echelon Fitness Collective` },
    { tag: '03 · NEXT STEP', title: 'COACHING ACCEPTANCE + PAYMENT', description: 'Send only after creating their private payment link in Leads.', subject: 'Your Echelon coaching next step', body: `Hi [First Name],

Thank you for sharing your goals with us. Based on what you shared, I’d be glad to move forward with [Echelon 12 / 1-on-1 Coaching].

Your next step is to complete your private enrollment through our secure Stripe link: [payment link]. Once payment is confirmed, I’ll send your Member Portal invitation, onboarding checklist, and first training date.

I’m looking forward to building this with intention.

Respectfully,
[Your Name]
Echelon Fitness Collective` },
    { tag: '04 · GENTLE CLOSE', title: 'NOT YET / WAITLIST', description: 'Keep the relationship warm and the answer clear.', subject: 'Your place with Echelon', body: `Hi [First Name],

Thank you again for your interest in Echelon. [The current coaching roster is full / I recommend beginning with a Free Class before private coaching].

I’ve added you to the [program] waitlist, and I’ll personally reach out when the next opening or appropriate starting point is available. In the meantime, you can explore our complimentary training resources here: [link].

Respectfully,
[Your Name]
Echelon Fitness Collective` },
    { tag: '05 · EXPERIENCE', title: 'FREE CLASS CONFIRMATION', description: 'Set a polished first-visit expectation.', subject: 'Your Echelon Free Class is confirmed', body: `Hi [First Name],

Your Free Class is confirmed for [day, date] at [time]. We’ll use this time to talk through your goals, movement history, and the most aligned path forward.

Please arrive [10] minutes early, wear comfortable training clothes, and bring water. If anything changes, reply here and we’ll help you adjust your reservation.

Respectfully,
[Your Name]
Echelon Fitness Collective` },
    { tag: '06 · ONBOARDING', title: 'WELCOME & REQUIRED FORMS', description: 'Use after a member has committed.', subject: 'Welcome to Echelon: your onboarding begins here', body: `Hi [First Name],

Welcome to Echelon. Before your program begins, please complete your Member Portal onboarding: [portal link]. This includes your readiness information, waiver acknowledgment, goals, and preferred training schedule.

Once complete, I’ll finalize your Week 1 plan and send your first check-in date. Please complete it by [date] so we can begin with a clear foundation.

Respectfully,
[Your Name]
Echelon Fitness Collective` },
    { tag: '07 · MEMBER CARE', title: 'WEEKLY CHECK-IN REMINDER', description: 'Support consistency without pressure.', subject: 'Your Echelon weekly check-in', body: `Hi [First Name],

It’s time for your weekly Echelon check-in. Please submit your updates in the Member Portal by [day/time] so I can review your momentum, answer questions, and make any needed adjustments before the next training week.

Progress is built from honest information, not perfect weeks. Share what happened, what felt strong, and where you need support.

Respectfully,
[Your Name]
Echelon Fitness Collective` },
    { tag: '08 · MEMBER CARE', title: 'MISSED CHECK-IN FOLLOW-UP', description: 'Bring the member back into rhythm.', subject: 'Let’s reset your Echelon rhythm', body: `Hi [First Name],

I noticed we missed your weekly check-in. No pressure. I want to make sure you have what you need to keep moving forward.

Reply with a quick update on how the week went, or submit your check-in here: [portal link]. If your schedule, recovery, or goals have shifted, we’ll adjust the plan together.

Respectfully,
[Your Name]
Echelon Fitness Collective` },
    { tag: '09 · PORTAL SUPPORT', title: 'LOGIN / PASSWORD HELP', description: 'Guide access without ever handling a password.', subject: 'Member Portal access', body: `Hi [First Name],

I’m glad to help you get back into the Echelon Member Portal. Please use the password reset option on the login page: [member portal link]. Enter the email address connected to your membership, then follow the reset link sent to your inbox.

For security, Echelon cannot see or send passwords. If the reset email does not arrive within [timeframe], reply here with the email address you used and I’ll check the account setup.

Respectfully,
[Your Name]
Echelon Fitness Collective` },
    { tag: '10 · COMMUNITY', title: 'REVIEW REQUEST', description: 'Ask after a real, positive milestone.', subject: 'A small favor from Echelon', body: `Hi [First Name],

I’m grateful you’ve chosen to train with Echelon. If your experience has felt valuable, would you be willing to leave a brief Google review? It helps the right people find a coaching space built with intention.

You can share your experience here: [Google review link]

Thank you for being part of the collective.

Respectfully,
[Your Name]
Echelon Fitness Collective` },
    { tag: '11 · BOUNDARY', title: 'MEDICAL / HIGH-RISK QUESTION', description: 'Stay caring, professional, and in scope.', subject: 'Your question and next best step', body: `Hi [First Name],

Thank you for sharing that with me. Your safety comes first. I can help with general training structure and modifications once you have appropriate guidance, but I’m not able to diagnose, treat, or provide medical advice.

Please speak with a licensed healthcare professional about [concern] before continuing or changing your training. Once you have their guidance, send me any relevant training restrictions and we’ll build the next step thoughtfully.

Respectfully,
[Your Name]
Echelon Fitness Collective` },
    { tag: '12 · SHOP', title: 'MERCH / NUTRITION REQUEST', description: 'Direct to the storefront without a hard sell.', subject: 'Echelon shop details', body: `Hi [First Name],

Thank you for your interest in Echelon goods. Our current apparel collections are available through [Etsy shop link].

For performance nutrition, you can explore the current product options here: [nutrition link]. Products are not intended to diagnose, treat, cure, or prevent any disease; please review labels and consult a qualified healthcare professional for personal health questions.

Respectfully,
[Your Name]
Echelon Fitness Collective` }
];

function initializeCommunicationsLibrary() {
    const library = document.getElementById('communications-library');
    if (!library || library.childElementCount) return;

    const groups = [
        { label: 'LEADS & FIRST RESPONSE', copy: 'New inquiries, applications, waitlist decisions, and the first Echelon experience.', templates: EFC_COMMUNICATION_TEMPLATES.slice(0, 5) },
        { label: 'MEMBER EXPERIENCE', copy: 'Onboarding and the composed weekly coaching rhythm for active members.', templates: EFC_COMMUNICATION_TEMPLATES.slice(5, 8) },
        { label: 'SUPPORT, COMMUNITY & BOUNDARIES', copy: 'Portal support, review requests, shop questions, and professional scope.', templates: EFC_COMMUNICATION_TEMPLATES.slice(8) }
    ];

    groups.forEach((group) => {
        const section = document.createElement('details');
        section.className = 'communication-category';
        const categorySummary = document.createElement('summary');
        const categoryLabel = document.createElement('span'); categoryLabel.className = 'checkin-tag'; categoryLabel.textContent = group.label;
        const categoryTitle = document.createElement('strong'); categoryTitle.textContent = `${group.templates.length} READY-TO-SEND SCRIPTS`;
        const categoryCopy = document.createElement('p'); categoryCopy.textContent = group.copy;
        const categoryMark = document.createElement('i'); categoryMark.textContent = '+';
        categorySummary.append(categoryLabel, categoryTitle, categoryCopy, categoryMark);
        const grid = document.createElement('div'); grid.className = 'communication-category-grid';

        group.templates.forEach((template) => {
        const card = document.createElement('article');
        card.className = `communication-card${template.featured ? ' featured' : ''}`;
        const tag = document.createElement('span'); tag.className = 'checkin-tag'; tag.textContent = template.tag;
        const title = document.createElement('h3'); title.textContent = template.title;
        const description = document.createElement('p'); description.textContent = template.description;
        const details = document.createElement('details');
        const summary = document.createElement('summary'); summary.textContent = 'VIEW SCRIPT';
        const script = document.createElement('textarea'); script.readOnly = true; script.setAttribute('aria-label', template.title); script.value = `Subject: ${template.subject}\n\n${template.body}`;
        details.append(summary, script);
        const copy = document.createElement('button'); copy.className = 'template-copy'; copy.type = 'button'; copy.textContent = 'COPY SCRIPT';
        const feedback = document.createElement('p'); feedback.className = 'template-feedback'; feedback.setAttribute('aria-live', 'polite');
        copy.addEventListener('click', async () => {
            try { await navigator.clipboard.writeText(script.value); feedback.textContent = 'Copied. Personalize the bracketed details before sending.'; }
            catch (error) { script.focus(); script.select(); feedback.textContent = 'Script selected. Press Command + C to copy.'; }
        });
        card.append(tag, title, description, details, copy, feedback);
        grid.append(card);
        });
        section.append(categorySummary, grid);
        library.append(section);
    });
}

function initializeAdminTabs() {
    const tabs = [...document.querySelectorAll('[data-admin-tab]')];
    const panels = [...document.querySelectorAll('[data-admin-panel]')];
    if (!tabs.length || !panels.length) return;

    const selectTab = (tabName) => {
        tabs.forEach((tab) => {
            const active = tab.dataset.adminTab === tabName;
            tab.classList.toggle('active', active);
            tab.setAttribute('aria-selected', String(active));
        });
        panels.forEach((panel) => {
            const active = panel.dataset.adminPanel === tabName;
            panel.hidden = !active;
            if (active) panel.open = true;
        });
    };

    tabs.forEach((tab) => tab.addEventListener('click', () => selectTab(tab.dataset.adminTab)));
    document.querySelectorAll('[data-admin-open]').forEach((link) => link.addEventListener('click', () => selectTab(link.dataset.adminOpen)));
    selectTab('today');
}
