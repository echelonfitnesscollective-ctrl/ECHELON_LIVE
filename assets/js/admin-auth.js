const EFC_ADMIN_SUPABASE_URL = 'https://plkdyvtriajpzcfgtwzp.supabase.co';
const EFC_ADMIN_SUPABASE_KEY = 'sb_publishable_CwFNrWSrhLKURZIk_-yt1A_ZVpFHEwf';

const echelonAdminClient = window.supabase.createClient(
    EFC_ADMIN_SUPABASE_URL,
    EFC_ADMIN_SUPABASE_KEY
);

async function getAdminUser() {
    const { data, error } = await echelonAdminClient.auth.getUser();
    return error ? null : data.user;
}

async function isEchelonAdmin() {
    const { data, error } = await echelonAdminClient.rpc('is_echelon_admin');
    return !error && data === true;
}

async function requireAdminSession() {
    const user = await getAdminUser();
    if (!user || !(await isEchelonAdmin())) {
        await echelonAdminClient.auth.signOut();
        window.location.replace('admin-login.html?reason=not-authorized');
        return null;
    }
    return user;
}

function showAdminLoginFeedback(message) {
    const feedback = document.getElementById('admin-login-feedback');
    if (feedback) feedback.textContent = message;
}

async function initializeAdminLogin() {
    const form = document.getElementById('admin-login-form');
    if (!form) return;

    if (new URLSearchParams(window.location.search).get('reason') === 'not-authorized') {
        showAdminLoginFeedback('This account is not authorized for the Echelon Admin Console.');
    }

    const currentUser = await getAdminUser();
    if (currentUser && await isEchelonAdmin()) {
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

        if (error || !(await isEchelonAdmin())) {
            await echelonAdminClient.auth.signOut();
            showAdminLoginFeedback(error
                ? 'We could not sign you in. Check your email and password, then try again.'
                : 'This account is not authorized for the Echelon Admin Console.');
            submitButton.disabled = false;
            submitButton.textContent = 'SIGN IN';
            return;
        }

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
    article.append(copy, action);
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
        echelonAdminClient.from('coaching_applications').select('full_name, email, program_interest, status, created_at').order('created_at', { ascending: false }).limit(25),
        echelonAdminClient.from('website_leads').select('full_name, email, lead_type, category, status, created_at').order('created_at', { ascending: false }).limit(25),
        echelonAdminClient.from('session_checkins').select('full_name, email, program, status, checked_in_at').order('checked_in_at', { ascending: false }).limit(25),
        echelonAdminClient.from('trainer_resources').select('title, category, resource_url, notes, created_at').order('created_at', { ascending: false })
    ]);

    const applications = applicationsResult.data || [];
    const leads = leadsResult.data || [];
    const checkins = checkinsResult.data || [];
    const resources = resourcesResult.data || [];
    document.getElementById('admin-application-count').textContent = applications.filter((item) => item.status === 'New').length;
    document.getElementById('admin-checkin-count').textContent = checkins.filter((item) => new Date(item.checked_in_at).toDateString() === new Date().toDateString()).length;

    const applicationsStatus = document.getElementById('admin-applications-status');
    applicationsStatus.textContent = applicationsResult.error ? 'Unable to load applications.' : `${applications.length} recent application${applications.length === 1 ? '' : 's'}`;
    renderAdminRecords(applicationsList, applications, 'Applications will appear here when submitted.', (item) => createAdminRecord([
        { text: item.full_name, strong: true },
        { text: `${item.program_interest} · ${item.email}` },
        { text: item.status }
    ]));

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
        item.textContent = `${checkin.week_of}: ${checkin.workouts_completed ?? '—'} workouts · nutrition ${checkin.nutrition_adherence ?? '—'}/10 · energy ${checkin.energy_score ?? '—'}/10${checkin.body_weight ? ` · ${checkin.body_weight} lb` : ''}`;
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
    const [plansResult, messagesResult] = await Promise.all([
        echelonAdminClient.from('member_workout_plans').select('title, week_of, status').eq('user_id', row.user_id).order('created_at', { ascending: false }).limit(4),
        echelonAdminClient.from('coach_messages').select('sender_id, message, created_at').or(`sender_id.eq.${row.user_id},recipient_id.eq.${row.user_id}`).order('created_at', { ascending: false }).limit(6)
    ]);
    if (plansResult.error || messagesResult.error || !admin) { summary.textContent = 'Coaching Hub will be ready after its database update is run.'; return; }
    summary.textContent = `${plansResult.data.length} plan(s) · ${messagesResult.data.length} recent message(s)`;
    const planForm = document.createElement('form'); planForm.className = 'echelon-form';
    const planTitle = document.createElement('input'); planTitle.placeholder = 'Workout plan title'; planTitle.required = true;
    const planText = document.createElement('textarea'); planText.rows = 5; planText.placeholder = 'Write the program here: days, exercises, sets, reps, and instructions.'; planText.required = true;
    const planButton = document.createElement('button'); planButton.type = 'submit'; planButton.className = 'btn-secondary'; planButton.textContent = 'PUBLISH TRAINING PLAN';
    planForm.append(planTitle, planText, planButton);
    planForm.addEventListener('submit', async event => { event.preventDefault(); const { error } = await echelonAdminClient.from('member_workout_plans').insert({ user_id: row.user_id, title: planTitle.value.trim(), plan_text: planText.value.trim(), status: 'Active' }); if (!error) renderIntakeDetail(row); });
    const messages = document.createElement('div'); messages.className = 'coaching-history';
    messagesResult.data.forEach(item => { const line = document.createElement('p'); line.className = 'admin-detail-date'; line.textContent = `${item.sender_id === row.user_id ? memberName : 'You'}: ${item.message}`; messages.append(line); });
    const messageForm = document.createElement('form'); messageForm.className = 'echelon-form';
    const messageInput = document.createElement('textarea'); messageInput.rows = 3; messageInput.placeholder = 'Send a private message to this member'; messageInput.required = true;
    const messageButton = document.createElement('button'); messageButton.type = 'submit'; messageButton.className = 'btn-secondary'; messageButton.textContent = 'SEND MEMBER MESSAGE';
    messageForm.append(messageInput, messageButton);
    messageForm.addEventListener('submit', async event => { event.preventDefault(); const { error } = await echelonAdminClient.from('coach_messages').insert({ sender_id: admin.id, recipient_id: row.user_id, message: messageInput.value.trim() }); if (!error) renderIntakeDetail(row); });
    section.append(planForm, messages, messageForm);
}

async function initializeAdminDashboard() {
    const list = document.getElementById('admin-intake-list');
    if (!list) return;

    const admin = await requireAdminSession();
    if (!admin) return;
    document.getElementById('admin-email').textContent = admin.email || 'Echelon Administrator';

    const signOut = document.getElementById('admin-sign-out');
    signOut.addEventListener('click', async () => {
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
    });
});
