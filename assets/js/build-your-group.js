// Build Your Group: applying reveals a private group-management panel
// (no login, gated only by the lead's own unguessable id) where the
// organizer first picks a real date/time for their session (over on
// EchelonOS's public /build-group/<leadId> picker - see
// src/lib/build-group-schedule.ts there), then can share one link so
// each person self-registers and signs their own waiver, or add
// someone directly by name/phone/email - the latter, when an email is
// given, sends that person their own personal confirm-and-sign link
// (api/build-group/invite). Everything here talks to
// api/calendar/gateway.js's build-group-* routes, never Supabase
// directly - the same trust model as the real group-join links
// (assets/js/join-group.js), just for a promo that now has a real
// time once the organizer sets one.

const BUILD_GROUP_APP_URL = 'https://app.echelonfitness.co';

function buildGroupJoinUrl(leadId) {
    return `${window.location.origin}/pages/build-your-group-join.html?lead=${encodeURIComponent(leadId)}`;
}

function buildGroupScheduleUrl(leadId) {
    return `${BUILD_GROUP_APP_URL}/build-group/${encodeURIComponent(leadId)}`;
}

function renderRoster(container, attendees) {
    container.textContent = '';
    if (!attendees.length) {
        const empty = document.createElement('p');
        empty.className = 'build-group-help';
        empty.textContent = 'No one added yet.';
        container.append(empty);
        return;
    }
    // Attendee name/phone/email come from a public, unauthenticated
    // endpoint (anyone with the shared join link can submit them), so
    // they're untrusted - built as real DOM nodes with textContent
    // rather than interpolated into innerHTML, which previously let a
    // name like "<img src=x onerror=...>" execute in the organizer's
    // browser on this origin the next time the roster refreshed.
    for (const a of attendees) {
        const contact = [a.phone, a.email].filter(Boolean).join(' · ') || 'No contact info';
        const signed = a.waiverAgreed;

        const item = document.createElement('div');
        item.className = 'build-group-roster-item';

        const info = document.createElement('div');
        const name = document.createElement('p');
        name.className = 'build-group-roster-name';
        name.textContent = a.name;
        const contactEl = document.createElement('p');
        contactEl.className = 'build-group-roster-contact';
        contactEl.textContent = contact;
        info.append(name, contactEl);

        const status = document.createElement('span');
        status.className = `build-group-roster-status${signed ? ' is-signed' : ''}`;
        status.textContent = signed ? 'Waiver Signed' : 'Pending';

        item.append(info, status);
        container.append(item);
    }
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
    const scheduleLink = document.getElementById('build-group-schedule-link');
    const unscheduledBox = document.getElementById('build-group-unscheduled');
    const scheduledBox = document.getElementById('build-group-scheduled');
    const scheduledWhen = document.getElementById('build-group-scheduled-when');
    const inviteSection = document.getElementById('build-group-invite-section');

    let leadId = null;

    function showManager() {
        form.style.display = 'none';
        if (linkInput) linkInput.value = buildGroupJoinUrl(leadId);
        if (scheduleLink) scheduleLink.href = buildGroupScheduleUrl(leadId);
        if (manager) manager.style.display = '';
    }

    async function refreshGroupInfo() {
        if (!leadId) return;
        try {
            const response = await fetch(`/api/build-group/info?lead=${encodeURIComponent(leadId)}`);
            const result = await response.json();
            if (!response.ok) return;

            if (roster) renderRoster(roster, result.attendees || []);

            const scheduled = result.scheduledSession;
            const isScheduled = Boolean(scheduled && scheduled.scheduledAtISO);
            if (unscheduledBox) unscheduledBox.style.display = isScheduled ? 'none' : '';
            if (scheduledBox) scheduledBox.style.display = isScheduled ? '' : 'none';
            if (inviteSection) inviteSection.style.display = isScheduled ? '' : 'none';
            if (isScheduled && scheduledWhen) {
                const when = new Date(scheduled.scheduledAtISO);
                scheduledWhen.textContent = when.toLocaleString('en-US', {
                    timeZone: 'America/New_York',
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                    timeZoneName: 'short',
                });
            }
        } catch (_) {
            // Info just won't refresh this time; the next reload will retry.
        }
    }

    // A returning organizer (e.g. the "pick a time" link they were
    // emailed, or just their own bookmarked group link) reaches this
    // page as pages/build-your-group.html?lead=<id> - skip straight to
    // the manager panel instead of showing the application form again.
    const existingLeadId = new URLSearchParams(window.location.search).get('lead');
    if (existingLeadId) {
        leadId = existingLeadId;
        showManager();
        refreshGroupInfo();
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
        window.efcTrack?.('build_your_group_apply', { group_size: values.group_size });

        showManager();
        refreshGroupInfo();
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
            refreshGroupInfo();
        });
    }
});
