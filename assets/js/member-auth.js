// Supabase's client strips the auth hash from the URL shortly after load, so
// capture whether this link was an invite (first-ever password set) before
// that happens. Used to route brand-new members to a welcome page instead of
// straight to the portal, without affecting ordinary "forgot password" resets.
// Checked in both places: older emails still in inboxes use the #-hash format,
// new ones use the ?token_hash= format from verifyPasswordResetToken() below.
const EFC_AUTH_HASH_TYPE = new URLSearchParams(window.location.hash.replace(/^#/, '')).get('type')
    || new URLSearchParams(window.location.search).get('type');

const EFC_SUPABASE_URL = 'https://plkdyvtriajpzcfgtwzp.supabase.co';
const EFC_SUPABASE_KEY = 'sb_publishable_CwFNrWSrhLKURZIk_-yt1A_ZVpFHEwf';
const EFC_MEMBER_STEP_UP_KEY = 'efc_member_step_up_user';
const EFC_MEMBER_LAST_ACTIVITY_KEY = 'efc_member_last_activity';
const EFC_MEMBER_TRUST_KEY = 'efc_member_trusted_device';
// Untrusted devices (shared/public computers) sign out after 15 minutes idle,
// same as before. Trusted devices (the member's own phone) get a full hour,
// this is what actually fixes "signed out mid-set": mobile browsers routinely
// wipe sessionStorage when a tab is backgrounded for a few seconds (checking
// a timer, a text), which used to look identical to a real timeout. Trusted
// devices store their step-up marker in localStorage instead, which survives
// that, so only genuine inactivity signs them out.
const EFC_MEMBER_IDLE_TIMEOUT_MS = 15 * 60 * 1000;
const EFC_MEMBER_TRUSTED_IDLE_TIMEOUT_MS = 60 * 60 * 1000;
const EFC_MEMBER_IDLE_CHECK_INTERVAL_MS = 60 * 1000;
const EFC_MEMBER_PAGES = new Set([
    'member-portal.html', 'member-coaching.html', 'member-nutrition.html',
    'member-performance.html', 'member-library.html', 'member-onboarding.html',
    'member-waiver.html', 'member-booking.html'
]);

const echelonMemberClient = window.supabase.createClient(
    EFC_SUPABASE_URL,
    EFC_SUPABASE_KEY
);

function getSafeNextPage() {
    const nextPage = new URLSearchParams(window.location.search).get('next');
    return nextPage && EFC_MEMBER_PAGES.has(nextPage) ? nextPage : 'member-portal.html';
}

async function getAuthenticatedMember() {
    const { data, error } = await echelonMemberClient.auth.getUser();
    return error ? null : data.user;
}

function isTrustedDevice() {
    return window.localStorage.getItem(EFC_MEMBER_TRUST_KEY) === '1';
}

// Trusted devices persist across tab close/background (localStorage);
// untrusted devices behave as before, cleared when the tab session ends
// (sessionStorage). Both are checked on read so a device trusted in one tab
// is recognized in another, and so downgrading trust mid-session still works.
function memberSignInStorages() {
    return isTrustedDevice() ? [window.localStorage, window.sessionStorage] : [window.sessionStorage];
}

function hasRequiredMemberSignIn(member) {
    if (!member) return false;
    return memberSignInStorages().some((store) => store.getItem(EFC_MEMBER_STEP_UP_KEY) === member.id);
}

function markMemberSignIn(member, trustDevice) {
    if (!member) return;
    if (trustDevice) window.localStorage.setItem(EFC_MEMBER_TRUST_KEY, '1');
    else window.localStorage.removeItem(EFC_MEMBER_TRUST_KEY);
    const store = trustDevice ? window.localStorage : window.sessionStorage;
    store.setItem(EFC_MEMBER_STEP_UP_KEY, member.id);
    recordMemberActivity();
}

function clearMemberSignIn() {
    [window.localStorage, window.sessionStorage].forEach((store) => {
        store.removeItem(EFC_MEMBER_STEP_UP_KEY);
        store.removeItem(EFC_MEMBER_LAST_ACTIVITY_KEY);
    });
}

function recordMemberActivity() {
    const store = isTrustedDevice() ? window.localStorage : window.sessionStorage;
    store.setItem(EFC_MEMBER_LAST_ACTIVITY_KEY, String(Date.now()));
}

function isMemberSessionIdle() {
    const store = isTrustedDevice() ? window.localStorage : window.sessionStorage;
    const timeout = isTrustedDevice() ? EFC_MEMBER_TRUSTED_IDLE_TIMEOUT_MS : EFC_MEMBER_IDLE_TIMEOUT_MS;
    const last = Number(store.getItem(EFC_MEMBER_LAST_ACTIVITY_KEY));
    return !last || (Date.now() - last) > timeout;
}

async function signOutIdleMember() {
    clearMemberSignIn();
    await echelonMemberClient.auth.signOut();
    window.location.replace('member-login.html?timeout=1');
}

let efcMemberIdleWatchStarted = false;
function startMemberIdleWatch() {
    if (efcMemberIdleWatchStarted) return;
    efcMemberIdleWatchStarted = true;

    let throttled = false;
    const onActivity = () => {
        if (throttled) return;
        throttled = true;
        window.setTimeout(() => { throttled = false; }, 30 * 1000);
        recordMemberActivity();
    };
    ['click', 'keydown', 'scroll', 'touchstart', 'mousemove'].forEach((evt) =>
        window.addEventListener(evt, onActivity, { passive: true })
    );

    window.setInterval(() => {
        if (isMemberSessionIdle()) signOutIdleMember();
    }, EFC_MEMBER_IDLE_CHECK_INTERVAL_MS);
}

async function requireMemberSession() {
    const member = await getAuthenticatedMember();
    const timedOut = Boolean(member) && hasRequiredMemberSignIn(member) && isMemberSessionIdle();

    if (!member || !hasRequiredMemberSignIn(member) || timedOut || !(await hasMemberHubAccess())) {
        if (timedOut) {
            await signOutIdleMember();
            return null;
        }
        window.location.replace(
            `member-login.html?next=${encodeURIComponent(window.location.pathname.split('/').pop())}`
        );
        return null;
    }

    const currentPage = window.location.pathname.split('/').pop();
    if (!EFC_ONBOARDING_EXEMPT_PAGES.has(currentPage) && !(await hasCompletedOnboarding(member))) {
        window.location.replace('member-onboarding.html');
        return null;
    }
    if (!EFC_WAIVER_EXEMPT_PAGES.has(currentPage) && !(await hasSignedWaiver(member))) {
        window.location.replace('member-waiver.html');
        return null;
    }

    recordMemberActivity();
    startMemberIdleWatch();
    return member;
}

async function hasMemberHubAccess() {
    const { data, error } = await echelonMemberClient.rpc('has_member_hub_access');
    return !error && data === true;
}

const EFC_WAIVER_EXEMPT_PAGES = new Set(['member-waiver.html', 'member-onboarding.html']);
const EFC_ONBOARDING_EXEMPT_PAGES = new Set(['member-onboarding.html']);

async function hasCompletedOnboarding(member) {
    const { data, error } = await echelonMemberClient
        .from('member_onboarding')
        .select('user_id')
        .eq('user_id', member.id)
        .maybeSingle();
    return !error && Boolean(data);
}

async function hasSignedWaiver(member) {
    const { data, error } = await echelonMemberClient
        .from('member_waivers')
        .select('user_id')
        .eq('user_id', member.id)
        .maybeSingle();
    return !error && Boolean(data);
}

async function initializeMemberLogin() {
    const form = document.getElementById('member-login-form');
    if (!form) return;

    const existingMember = await getAuthenticatedMember();
    if (existingMember && hasRequiredMemberSignIn(existingMember) && await hasMemberHubAccess()) {
        window.location.replace(getSafeNextPage());
        return;
    }

    const feedback = document.getElementById('member-login-feedback');
    const submitButton = form.querySelector('button[type="submit"]');

    if (new URLSearchParams(window.location.search).get('timeout') === '1') {
        feedback.textContent = 'You were signed out after a period of inactivity. Please sign in again.';
    }

    form.addEventListener('submit', async (event) => {
        event.preventDefault();

        feedback.textContent = '';
        submitButton.disabled = true;
        submitButton.textContent = 'SIGNING IN...';

        const email = form.elements.email.value.trim();
        const password = form.elements.password.value;
        const { error } = await echelonMemberClient.auth.signInWithPassword({ email, password });

        if (error) {
            feedback.textContent = 'We could not sign you in. Check your email and password, then try again.';
            submitButton.disabled = false;
            submitButton.textContent = 'SIGN IN';
            return;
        }

        const signedInMember = await getAuthenticatedMember();
        if (!signedInMember || !(await hasMemberHubAccess())) {
            await echelonMemberClient.auth.signOut();
            clearMemberSignIn();
            feedback.textContent = 'Member Hub access is available after Echelon approval. Please contact Echelon if you believe this is an error.';
            submitButton.disabled = false;
            submitButton.textContent = 'SIGN IN';
            return;
        }

        markMemberSignIn(signedInMember, Boolean(form.elements.trust_device?.checked));
        window.location.replace(getSafeNextPage());
    });
}

async function initializeMemberPortal() {
    // Only the actual member portal needs the signed-in session gate.
    // Without this guard, the sign-in page redirects to itself when a visitor
    // is not yet signed in.
    const signOutButton = document.getElementById('member-sign-out');
    if (!signOutButton) return;

    const member = await requireMemberSession();
    if (!member) return;

    const emailElement = document.getElementById('member-email');
    if (emailElement) emailElement.textContent = member.email || 'Echelon Member';

    signOutButton.addEventListener('click', async () => {
        clearMemberSignIn();
        await echelonMemberClient.auth.signOut();
        window.location.replace('member-login.html');
    });

    await initializeMemberSettings(member);
    await initializeMemberProfileAnswers(member);
}

async function initializeMemberProfileAnswers(member) {
    const form = document.getElementById('member-profile-form');
    if (!form) return;

    const status = document.getElementById('member-profile-status');
    const feedback = document.getElementById('member-profile-feedback');
    const fieldsPlaceholder = document.getElementById('member-profile-fields');
    const submitButton = form.querySelector('button[type="submit"]');

    const [questionsResult, answersResult] = await Promise.all([
        echelonMemberClient.from('application_questions').select('question_key, label, field_type, options, help_text, section_label, required').eq('active', true).order('sort_order', { ascending: true }),
        echelonMemberClient.from('member_profile_answers').select('question_key, answer').eq('user_id', member.id)
    ]);

    if (questionsResult.error || !questionsResult.data) {
        if (status) status.textContent = 'We could not load your coaching profile. Please refresh and try again.';
        return;
    }

    const questions = questionsResult.data;
    const answerMap = Object.fromEntries((answersResult.data || []).map((row) => [row.question_key, row.answer || '']));
    fieldsPlaceholder.replaceWith(buildApplicationQuestionFields(questions, answerMap));
    if (status) status.remove();
    if (submitButton) submitButton.disabled = false;

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        feedback.textContent = '';
        submitButton.disabled = true;
        submitButton.textContent = 'SAVING…';

        const rows = questions.map((question) => ({
            user_id: member.id,
            question_key: question.question_key,
            answer: (form.elements[question.question_key]?.value || '').trim() || null
        }));

        const { error } = await echelonMemberClient.from('member_profile_answers').upsert(rows, { onConflict: 'user_id,question_key' });

        submitButton.disabled = false;
        submitButton.textContent = 'SAVE PROFILE';
        feedback.textContent = error ? 'We could not save your profile. Please try again.' : 'Saved.';
    });
}

async function initializeMemberSettings(member) {
    const form = document.getElementById('member-settings-form');
    if (!form) return;

    const feedback = document.getElementById('member-settings-feedback');
    const { data: profile } = await echelonMemberClient
        .from('member_profiles')
        .select('full_name, phone')
        .eq('user_id', member.id)
        .maybeSingle();
    if (profile) {
        form.elements.full_name.value = profile.full_name || '';
        form.elements.phone.value = profile.phone || '';
    }

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        feedback.textContent = '';
        const submitButton = form.querySelector('button[type="submit"]');
        submitButton.disabled = true;
        submitButton.textContent = 'SAVING…';

        const { error } = await echelonMemberClient.from('member_profiles').update({
            full_name: form.elements.full_name.value.trim(),
            phone: form.elements.phone.value.trim() || null
        }).eq('user_id', member.id);

        submitButton.disabled = false;
        submitButton.textContent = 'SAVE CHANGES';
        feedback.textContent = error ? 'We could not save your changes. Please try again.' : 'Saved.';
    });

    const passwordButton = document.getElementById('member-settings-password');
    const passwordFeedback = document.getElementById('member-settings-password-feedback');
    if (passwordButton) {
        passwordButton.addEventListener('click', async () => {
            passwordButton.disabled = true;
            passwordButton.textContent = 'SENDING…';
            const { error } = await echelonMemberClient.auth.resetPasswordForEmail(
                member.email,
                { redirectTo: `${window.location.origin}/pages/member-reset.html` }
            );
            passwordButton.disabled = false;
            passwordButton.textContent = 'SEND PASSWORD RESET LINK';
            passwordFeedback.textContent = error
                ? 'We could not send a reset link. Please try again.'
                : `Check ${member.email} for a secure link to set your password.`;
        });
    }
}

// Invite/reset emails used to link straight to Supabase's own verify endpoint,
// which consumes the one-time token on the first GET request to it. Corporate
// and webmail link scanners (Outlook Safe Links, some spam filters) fetch that
// link automatically to check it's safe, burning the token before the member
// ever clicks it, they land back on the main site with no error visible.
// The email templates now link to this page instead, with the token carried
// as ?token_hash=&type= in the query string, and verification only happens
// here, inside real page JavaScript. Scanners that just fetch the URL never
// run this, only an actual browser opening the page does.
async function verifyPasswordResetToken() {
    const params = new URLSearchParams(window.location.search);
    const tokenHash = params.get('token_hash');
    const type = params.get('type');
    if (!tokenHash || !type) return false;

    const { error } = await echelonMemberClient.auth.verifyOtp({ token_hash: tokenHash, type });
    window.history.replaceState({}, '', window.location.pathname);
    return !error;
}

async function initializeMemberPasswordReset() {
    const requestForm = document.getElementById('password-reset-request-form');
    const updateForm = document.getElementById('password-reset-update-form');
    if (!requestForm || !updateForm) return;

    const requestFeedback = document.getElementById('password-reset-request-feedback');
    const updateFeedback = document.getElementById('password-reset-update-feedback');

    const showUpdateForm = () => {
        requestForm.hidden = true;
        updateForm.hidden = false;
    };

    const verifiedFromLink = await verifyPasswordResetToken();
    const existingMember = await getAuthenticatedMember();
    if (verifiedFromLink || existingMember) showUpdateForm();

    echelonMemberClient.auth.onAuthStateChange((event) => {
        if (event === 'PASSWORD_RECOVERY') showUpdateForm();
    });

    requestForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        requestFeedback.textContent = '';

        if (window.location.protocol === 'file:') {
            requestFeedback.textContent = 'Password setup is available after the site is published.';
            return;
        }

        const { error } = await echelonMemberClient.auth.resetPasswordForEmail(
            requestForm.elements.email.value.trim(),
            { redirectTo: `${window.location.origin}/pages/member-reset.html` }
        );

        requestFeedback.textContent = error
            ? 'We could not send a reset link. Please try again or contact Echelon.'
            : 'Check your email for a secure link to set your password.';
    });

    updateForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        updateFeedback.textContent = '';

        const password = updateForm.elements.password.value;
        const confirmation = updateForm.elements.password_confirmation.value;

        if (password.length < 8) {
            updateFeedback.textContent = 'Use at least 8 characters for your password.';
            return;
        }

        if (password !== confirmation) {
            updateFeedback.textContent = 'Your passwords do not match.';
            return;
        }

        const { error } = await echelonMemberClient.auth.updateUser({ password });
        if (error) {
            updateFeedback.textContent = 'We could not update your password. Please request a new reset link.';
            return;
        }

        const destination = EFC_AUTH_HASH_TYPE === 'invite' ? 'member-welcome.html' : 'member-portal.html';
        updateFeedback.textContent = destination === 'member-welcome.html'
            ? 'Password set. Welcome to Echelon…'
            : 'Password updated. Taking you to your member portal…';
        window.setTimeout(() => window.location.replace(destination), 900);
    });
}

async function initializeMemberWelcome() {
    const nameEl = document.getElementById('member-welcome-name');
    const programEl = document.getElementById('member-welcome-program');
    if (!nameEl || !programEl) return;

    const member = await getAuthenticatedMember();
    if (!member) {
        window.location.replace('member-login.html');
        return;
    }

    const firstName = String(member.user_metadata?.full_name || '').trim().split(/\s+/)[0];
    nameEl.textContent = firstName || 'there';

    const { data } = await echelonMemberClient
        .from('account_access')
        .select('program')
        .eq('user_id', member.id)
        .maybeSingle();
    programEl.textContent = data?.program || member.user_metadata?.program || 'Echelon Coaching';
}

document.addEventListener('DOMContentLoaded', () => {
    initializeMemberLogin();
    initializeMemberPortal();
    initializeMemberPasswordReset();
    initializeMemberWelcome();
});
