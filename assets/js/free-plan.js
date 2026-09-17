(function () {
    const form = document.getElementById('free-plan-form');
    if (!form) return;
    const note = document.getElementById('free-plan-note');
    const success = document.getElementById('free-plan-success');
    const submitButton = form.querySelector('button[type="submit"]');

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        submitButton.disabled = true;
        submitButton.textContent = 'BUILDING YOUR PLAN…';
        note.hidden = true;
        const values = Object.fromEntries(new FormData(form).entries());
        let result;
        try {
            const response = await fetch('/api/free-plan/submit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(values)
            });
            result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Submission failed.');
        } catch (error) {
            note.hidden = false;
            note.textContent = error.message || 'We could not build your plan. Please try again.';
            submitButton.disabled = false;
            submitButton.textContent = 'GET MY FREE PLAN';
            return;
        }
        window.efcTrack?.('free_plan_request', { goal: values.goal });

        // The plan itself now lives on a real EchelonOS page - redirect
        // there. Success div stays as a brief fallback in case the
        // redirect is blocked (some in-app browsers do this) so there's
        // still a real link to click instead of a dead end.
        form.style.display = 'none';
        success.style.display = 'block';
        success.innerHTML = `
            <h2>Your plan is ready.</h2>
            <p>We're taking you there now. If nothing happens, <a href="${result.planUrl}">view your plan here</a>.</p>
        `;
        window.location.href = result.planUrl;
    });
}());
