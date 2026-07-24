const EFC_ADMIN_SUPABASE_URL = 'https://plkdyvtriajpzcfgtwzp.supabase.co';
const EFC_ADMIN_SUPABASE_KEY = 'sb_publishable_CwFNrWSrhLKURZIk_-yt1A_ZVpFHEwf';
const EFC_ADMIN_EMAIL = 'luther.casimir@gmail.com';
const EFC_ADMIN_STEP_UP_KEY = 'efc_admin_step_up_user';

const echelonAdminClient = window.supabase.createClient(
    EFC_ADMIN_SUPABASE_URL,
    EFC_ADMIN_SUPABASE_KEY
);

async function getAdminUser() {
    const { data, error } = await echelonAdminClient.auth.getUser();
    return error ? null : data.user;
}

function hasAdminEmail(user) {
    return user?.email?.trim().toLowerCase() === EFC_ADMIN_EMAIL;
}

function hasAdminStepUp(user) {
    return Boolean(user && window.sessionStorage.getItem(EFC_ADMIN_STEP_UP_KEY) === user.id);
}

function markAdminStepUp(user) {
    if (user) window.sessionStorage.setItem(EFC_ADMIN_STEP_UP_KEY, user.id);
}

function clearAdminStepUp() {
    window.sessionStorage.removeItem(EFC_ADMIN_STEP_UP_KEY);
}

async function isEchelonAdmin() {
    const user = await getAdminUser();
    if (!hasAdminEmail(user)) return false;
    const { data, error } = await echelonAdminClient.rpc('is_echelon_admin');
    return !error && data === true;
}

async function requireAdminSession() {
    const user = await getAdminUser();
    if (!user || !(await isEchelonAdmin()) || !hasAdminStepUp(user)) {
        clearAdminStepUp();
        window.location.replace(`admin-login.html?reason=${hasAdminEmail(user) ? 'admin-sign-in-required' : 'not-authorized'}`);
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

    const reason = new URLSearchParams(window.location.search).get('reason');
    if (reason === 'not-authorized') {
        showAdminLoginFeedback('This account is not authorized for the Echelon Admin Console.');
    } else if (reason === 'admin-sign-in-required') {
        showAdminLoginFeedback('Enter your admin password to access the Echelon Admin Console.');
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
        if (error || !(await isEchelonAdmin()) || !hasAdminEmail(signedInUser)) {
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
        feedback.textContent = payload.status === 'Published' ? 'Published — the site will refresh with this update.' : payload.status === 'Scheduled' ? 'Scheduled — it will publish automatically at the time you set.' : 'Saved as a private draft.';
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
        initializeAdminTabs();
    });
});

const EFC_COMMUNICATION_TEMPLATES = [
    { tag: '01 · AUTOMATIC ACKNOWLEDGMENT', title: 'GENERAL INQUIRY RECEIVED', description: 'Use for every website contact request.', featured: true, subject: 'We received your message — Echelon Fitness Collective', body: `Hi [First Name],

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
    { tag: '03 · NEXT STEP', title: 'COACHING ACCEPTANCE', description: 'Invite the right-fit applicant into onboarding.', subject: 'Your Echelon coaching next step', body: `Hi [First Name],

Thank you for sharing your goals with us. Based on what you shared, I’d be glad to move forward with [Echelon 12 / 1-on-1 Coaching].

Your next step is [booking link / payment step / consultation time]. Once that is complete, I’ll send your welcome sequence, onboarding checklist, and first training date.

I’m looking forward to building this with intention.

Respectfully,
[Your Name]
Echelon Fitness Collective` },
    { tag: '04 · GENTLE CLOSE', title: 'NOT YET / WAITLIST', description: 'Keep the relationship warm and the answer clear.', subject: 'Your place with Echelon', body: `Hi [First Name],

Thank you again for your interest in Echelon. [The current coaching roster is full / I recommend beginning with a Fitness Intro before private coaching].

I’ve added you to the [program] waitlist, and I’ll personally reach out when the next opening or appropriate starting point is available. In the meantime, you can explore our complimentary training resources here: [link].

Respectfully,
[Your Name]
Echelon Fitness Collective` },
    { tag: '05 · EXPERIENCE', title: 'FITNESS INTRO CONFIRMATION', description: 'Set a polished first-visit expectation.', subject: 'Your Echelon Fitness Intro is confirmed', body: `Hi [First Name],

Your Fitness Intro is confirmed for [day, date] at [time]. We’ll use this time to talk through your goals, movement history, and the most aligned path forward.

Please arrive [10] minutes early, wear comfortable training clothes, and bring water. If anything changes, reply here and we’ll help you adjust your reservation.

Respectfully,
[Your Name]
Echelon Fitness Collective` },
    { tag: '06 · ONBOARDING', title: 'WELCOME & REQUIRED FORMS', description: 'Use after a member has committed.', subject: 'Welcome to Echelon — your onboarding begins here', body: `Hi [First Name],

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

I noticed we missed your weekly check-in. No pressure — I want to make sure you have what you need to keep moving forward.

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
            try { await navigator.clipboard.writeText(script.value); feedback.textContent = 'Copied — personalize the bracketed details before sending.'; }
            catch (error) { script.focus(); script.select(); feedback.textContent = 'Script selected — press Command + C to copy.'; }
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
    selectTab('today');
}
