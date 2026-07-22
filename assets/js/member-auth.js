const EFC_SUPABASE_URL = 'https://plkdyvtriajpzcfgtwzp.supabase.co';
const EFC_SUPABASE_KEY = 'sb_publishable_CwFNrWSrhLKURZIk_-yt1A_ZVpFHEwf';
const EFC_ADMIN_MEMBER_EMAIL = 'luther.casimir@gmail.com';
const EFC_MEMBER_STEP_UP_KEY = 'efc_member_step_up_user';

const echelonMemberClient = window.supabase.createClient(
    EFC_SUPABASE_URL,
    EFC_SUPABASE_KEY
);

function getSafeNextPage() {
    const nextPage = new URLSearchParams(window.location.search).get('next');
    return nextPage && nextPage.endsWith('.html') ? nextPage : 'member-portal.html';
}

async function getAuthenticatedMember() {
    const { data, error } = await echelonMemberClient.auth.getUser();
    return error ? null : data.user;
}

function isAdministratorMember(member) {
    return member?.email?.trim().toLowerCase() === EFC_ADMIN_MEMBER_EMAIL;
}

function hasRequiredMemberSignIn(member) {
    return !isAdministratorMember(member) || window.sessionStorage.getItem(EFC_MEMBER_STEP_UP_KEY) === member.id;
}

function markMemberSignIn(member) {
    if (isAdministratorMember(member)) window.sessionStorage.setItem(EFC_MEMBER_STEP_UP_KEY, member.id);
}

function clearMemberSignIn() {
    window.sessionStorage.removeItem(EFC_MEMBER_STEP_UP_KEY);
}

async function requireMemberSession() {
    const member = await getAuthenticatedMember();

    if (!member || !hasRequiredMemberSignIn(member)) {
        window.location.replace(
            `member-login.html?next=${encodeURIComponent(window.location.pathname.split('/').pop())}`
        );
        return null;
    }

    return member;
}

async function initializeMemberLogin() {
    const form = document.getElementById('member-login-form');
    if (!form) return;

    const existingMember = await getAuthenticatedMember();
    if (existingMember && hasRequiredMemberSignIn(existingMember)) {
        window.location.replace(getSafeNextPage());
        return;
    }

    const feedback = document.getElementById('member-login-feedback');
    const submitButton = form.querySelector('button[type="submit"]');

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

        markMemberSignIn(await getAuthenticatedMember());
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

        updateFeedback.textContent = 'Password updated. Taking you to your member portal…';
        window.setTimeout(() => window.location.replace('member-portal.html'), 900);
    });
}

document.addEventListener('DOMContentLoaded', () => {
    initializeMemberLogin();
    initializeMemberPortal();
    initializeMemberPasswordReset();
});
