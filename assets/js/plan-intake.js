(function () {
    const form = document.getElementById('plan-intake-form');
    if (!form) return;
    const note = document.getElementById('plan-intake-note');
    const submitButton = form.querySelector('button[type="submit"]');
    const injuryCheckbox = document.getElementById('plan-safety-injury');
    const injuryDetail = document.getElementById('plan-safety-injury-detail');

    if (injuryCheckbox && injuryDetail) {
        injuryCheckbox.addEventListener('change', () => {
            injuryDetail.hidden = !injuryCheckbox.checked;
            if (!injuryCheckbox.checked) injuryDetail.value = '';
        });
    }

    function showNote(message) {
        note.hidden = false;
        note.textContent = message;
    }

    function resetButton(label) {
        submitButton.disabled = false;
        submitButton.textContent = label;
    }

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const originalLabel = submitButton.textContent;
        note.hidden = true;
        submitButton.disabled = true;
        submitButton.textContent = 'SAVING YOUR INFO…';

        const data = Object.fromEntries(new FormData(form).entries());
        const payload = {
            ...data,
            addon_travel_pack: form.addon_travel_pack.checked,
            safety_pregnancy: form.safety_pregnancy.checked,
            safety_injury: form.safety_injury.checked,
            safety_heart_condition: form.safety_heart_condition.checked,
            safety_eating_disorder: form.safety_eating_disorder.checked,
        };

        let intakeResult;
        try {
            const response = await fetch('/api/plan/submit-intake', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            intakeResult = await response.json();
            if (!response.ok) throw new Error(intakeResult.error || 'Submission failed.');
        } catch (error) {
            showNote(error.message || 'We could not save your info. Please try again.');
            resetButton(originalLabel);
            return;
        }

        if (intakeResult.blocked) {
            form.style.display = 'none';
            showNote(intakeResult.message);
            window.efcTrack?.('plan_intake_blocked', {});
            return;
        }

        window.efcTrack?.('plan_intake_submitted', { goal: data.goal, addon: payload.addon_travel_pack });

        submitButton.textContent = 'PREPARING SECURE CHECKOUT…';
        try {
            const checkoutResponse = await fetch('/api/plan/checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ intakeId: intakeResult.intakeId, addon: payload.addon_travel_pack }),
            });
            const checkoutResult = await checkoutResponse.json();
            if (!checkoutResponse.ok || !checkoutResult.url) throw new Error(checkoutResult.error || 'Checkout could not be started.');
            window.efcTrack?.('plan_checkout_started', {});
            window.location.assign(checkoutResult.url);
        } catch (error) {
            showNote(error.message || 'Checkout is temporarily unavailable. Please try again.');
            resetButton(originalLabel);
        }
    });
}());
