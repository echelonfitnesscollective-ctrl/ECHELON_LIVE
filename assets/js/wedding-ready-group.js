// Wedding Ready Group sign-up: pure interest capture, no payment here.
// Coach reviews signups in the Leads checklist and sends each person a
// Stripe payment link directly once the final group size (and so the
// $65 vs $100 rate) is decided - see api/forms/submit.js's
// submitWeddingReadyGroup for where this lands (website_leads).

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('wedding-group-form');
    if (!form) return;

    const success = document.getElementById('wedding-group-success');
    const feedback = document.getElementById('wedding-group-feedback');
    const submitButton = form.querySelector('button[type="submit"]');

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        submitButton.disabled = true;
        submitButton.textContent = 'SIGNING UP…';
        const values = formValues(form);
        let submitError = null;
        try {
            const response = await fetch('/api/forms/submit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ form: 'wedding_ready_group', ...values })
            });
            const result = await response.json();
            if (!response.ok) submitError = result.error || 'Submission failed.';
        } catch {
            submitError = 'We could not save your sign-up. Please try again.';
        }
        if (submitError) {
            submitButton.disabled = false;
            submitButton.textContent = 'SIGN ME UP';
            if (feedback) feedback.textContent = submitError;
            return;
        }
        if (feedback) feedback.textContent = '';
        form.reset();
        form.style.display = 'none';
        window.efcTrack?.('wedding_ready_group_signup', {});
        showEchelonSuccess(success, 'YOU’RE ON THE LIST', 'Coach Luther will follow up directly with the schedule and pricing once the group is finalized.', { onDismiss: () => { form.style.display = ''; submitButton.disabled = false; submitButton.textContent = 'SIGN ME UP'; } });
    });
});
