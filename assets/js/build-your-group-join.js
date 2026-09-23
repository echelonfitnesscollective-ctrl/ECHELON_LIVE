// Public, no-login confirm page for a Build Your Group invite - reached
// either as a shared group link (?lead=<id>) where anyone fills this in
// fresh, or a personal invite the organizer sent (?lead=<id>&attendee=
// <id>) where this same submit instead confirms and signs the waiver
// for that already-created attendee row. See api/calendar/gateway.js's
// handleBuildGroupJoin for which path a given request takes.

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('build-group-join-form');
    if (!form) return;

    const errorBox = document.getElementById('build-group-join-error');
    const feedback = document.getElementById('build-group-join-feedback');
    const success = document.getElementById('build-group-join-success');
    const submitButton = form.querySelector('button[type="submit"]');

    const params = new URLSearchParams(window.location.search);
    const leadId = params.get('lead');
    const attendeeId = params.get('attendee');

    if (!leadId) {
        form.style.display = 'none';
        if (errorBox) errorBox.textContent = 'This link is missing information. Please check the link your organizer sent you.';
        return;
    }

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const values = Object.fromEntries(new FormData(form).entries());
        const phone = (values.phone || '').trim();
        const email = (values.email || '').trim();
        if (!phone && !email) {
            if (feedback) feedback.textContent = 'Give us a phone number, an email, or both.';
            return;
        }

        submitButton.disabled = true;
        submitButton.textContent = 'CONFIRMING…';
        let submitError = null;
        try {
            const response = await fetch('/api/build-group/join', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    leadId,
                    attendeeId: attendeeId || undefined,
                    fullName: values.full_name,
                    phone,
                    email,
                    waiverAgreed: values.waiver_agreed === 'on'
                })
            });
            const result = await response.json();
            if (!response.ok) submitError = result.error || 'Could not confirm your spot.';
        } catch {
            submitError = 'Could not confirm your spot. Please try again.';
        }

        if (submitError) {
            submitButton.disabled = false;
            submitButton.textContent = 'CONFIRM MY SPOT';
            if (feedback) feedback.textContent = submitError;
            return;
        }

        if (feedback) feedback.textContent = '';
        form.style.display = 'none';
        if (success) success.style.display = '';
    });
});
