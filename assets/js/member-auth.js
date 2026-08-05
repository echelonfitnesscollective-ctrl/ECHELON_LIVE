// Supabase's client strips the auth hash from the URL shortly after load, so
// capture whether this link was an invite (first-ever password set) before
// that happens. Used to route brand-new members to a welcome page instead of
// straight to the portal, without affecting ordinary "forgot password" resets.
const EFC_AUTH_HASH_TYPE = new URLSearchParams(window.location.hash.replace(/^#/, '')).get('type');

const EFC_SUPABASE_URL = 'https://plkdyvtriajpzcfgtwzp.supabase.co';
const EFC_SUPABASE_KEY = 'sb_publishable_CwFNrWSrhLKURZIk_-yt1A_ZVpFHEwf';
const EFC_MEMBER_STEP_UP_KEY = 'efc_member_step_up_user';
const EFC_MEMBER_LAST_ACTIVITY_KEY = 'efc_member_last_activity';
// 15 minutes of no clicks/keys/scrolling on a member page signs the session
// out and sends the member back to the login form. This is separate from the
// browser's own saved-password/Face-ID autofill, which still works normally
// on the next sign-in, it just is not treated as "still signed in."
const EFC_MEMBER_IDLE_TIMEOUT_MS = 15 * 60 * 1000;
const EFC_MEMBER_IDLE_CHECK_INTERVAL_MS = 60 * 1000;
const EFC_MEMBER_PAGES = new Set([
    'member-portal.html', 'member-coaching.html', 'member-nutrition.html',
    'member-performance.html', 'member-library.html', 'member-onboarding.html',
    'member-waiver.html'
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

function hasRequiredMemberSignIn(member) {
    return Boolean(member && window.sessionStorage.getItem(EFC_MEMBER_STEP_UP_KEY) === member.id);
}

function markMemberSignIn(member) {
    if (!member) return;
    window.sessionStorage.setItem(EFC_MEMBER_STEP_UP_KEY, member.id);
    recordMemberActivity();
}

function clearMemberSignIn() {
    window.sessionStorage.removeItem(EFC_MEMBER_STEP_UP_KEY);
    window.sessionStorage.removeItem(EFC_MEMBER_LAST_ACTIVITY_KEY);
}

function recordMemberActivity() {
    window.sessionStorage.setItem(EFC_MEMBER_LAST_ACTIVITY_KEY, String(Date.now()));
}

function isMemberSessionIdle() {
    const last = Number(window.sessionStorage.getItem(EFC_MEMBER_LAST_ACTIVITY_KEY));
    return !last || (Date.now() - last) > EFC_MEMBER_IDLE_TIMEOUT_MS;
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

        markMemberSignIn(signedInMember);
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

    const existingMember = await getAuthenticatedMember();
    if (existingMember) showUpdateForm();

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
