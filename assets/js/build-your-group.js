// Build Your Group: applying reveals a private group-management panel
// (no login, gated only by the lead's own unguessable id) where the
// organizer either shares one link so each person self-registers and
// signs their own waiver, or adds someone directly by name/phone/email
// - the latter, when an email is given, sends that person their own
// personal confirm-and-sign link (api/build-group/invite). Everything
// here talks to api/calendar/gateway.js's build-group-* routes, never
// Supabase directly - the same trust model as the real group-join
// links (assets/js/join-group.js), just for a promo with no fixed
// session yet.

function buildGroupJoinUrl(leadId) {
    return `${window.location.origin}/pages/build-your-group-join.html?lead=${encodeURIComponent(leadId)}`;
}

function renderRoster(container, attendees) {
    if (!attendees.length) {
        container.innerHTML = '<p class="build-group-help">No one added yet.</p>';
        return;
    }
    container.innerHTML = attendees.map((a) => {
        const contact = [a.phone, a.email].filter(Boolean).join(' · ') || 'No contact info';
        const signed = a.waiverAgreed;
        return `<div class="build-group-roster-item">
            <div>
                <p class="build-group-roster-name">${a.name}</p>
                <p class="build-group-roster-contact">${contact}</p>
            </div>
            <span class="build-group-roster-status${signed ? ' is-signed' : ''}">${signed ? 'Waiver Signed' : 'Pending'}</span>
        </div>`;
    }).join('');
}

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('build-group-form');
    if (!form) return;

    const feedback = document.getElementById('build-group-feedback');
    const submitButton = form.querySelector('button[type="submit"]');
    const manager = document.getElementById('build-group-manager');
    const linkInput = document.getElementById('build-group-link-input');
    const copyButton = document.getElementById('build-group-copy-link');
    const inviteForm = document.getElementById('build-group-invite-form');
    const inviteFeedback = document.getElementById('build-group-invite-feedback');
    const roster = document.getElementById('build-group-roster');

    let leadId = null;

    async function refreshRoster() {
        if (!leadId || !roster) return;
        try {
            const response = await fetch(`/api/build-group/info?lead=${encodeURIComponent(leadId)}`);
            const result = await response.json();
            if (response.ok) renderRoster(roster, result.attendees || []);
        } catch (_) {
            // Roster just won't refresh this time; the next add/reload will retry.
        }
    }

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        submitButton.disabled = true;
        submitButton.textContent = 'SUBMITTING…';
        const values = formValues(form);
        let submitError = null;
        let response;
        try {
            response = await fetch('/api/forms/submit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ form: 'build_your_group', ...values })
            });
            const result = await response.json();
            if (!response.ok) submitError = result.error || 'Submission failed.';
            else leadId = result.leadId;
        } catch {
            submitError = 'We could not save your application. Please try again.';
        }
        if (submitError || !leadId) {
            submitButton.disabled = false;
            submitButton.textContent = 'APPLY TO BUILD YOUR GROUP';
            if (feedback) feedback.textContent = submitError || 'We could not save your application. Please try again.';
            return;
        }
        if (feedback) feedback.textContent = '';
        form.style.display = 'none';
        window.efcTrack?.('build_your_group_apply', { group_size: values.group_size });

        if (linkInput) linkInput.value = buildGroupJoinUrl(leadId);
        if (manager) manager.style.display = '';
        refreshRoster();
    });

    if (copyButton && linkInput) {
        copyButton.addEventListener('click', async () => {
            try {
                await navigator.clipboard.writeText(linkInput.value);
                copyButton.textContent = 'COPIED!';
                setTimeout(() => { copyButton.textContent = 'COPY LINK'; }, 2000);
            } catch (_) {
                linkInput.removeAttribute('readonly');
                linkInput.select();
            }
        });
    }

    if (inviteForm) {
        const inviteButton = inviteForm.querySelector('button[type="submit"]');
        inviteForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            if (!leadId) return;
            const values = formValues(inviteForm);
            if (!values.name?.trim() || (!values.phone?.trim() && !values.email?.trim())) {
                if (inviteFeedback) inviteFeedback.textContent = 'Enter their name and a phone or email.';
                return;
            }
            inviteButton.disabled = true;
            inviteButton.textContent = 'ADDING…';
            let addError = null;
            try {
                const response = await fetch('/api/build-group/invite', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ leadId, ...values })
                });
                const result = await response.json();
                if (!response.ok) addError = result.error || 'Could not add that person.';
            } catch {
                addError = 'Could not add that person. Please try again.';
            }
            inviteButton.disabled = false;
            inviteButton.textContent = 'ADD TO MY GROUP';
            if (addError) {
                if (inviteFeedback) inviteFeedback.textContent = addError;
                return;
            }
            if (inviteFeedback) inviteFeedback.textContent = '';
            inviteForm.reset();
            refreshRoster();
        });
    }
});
