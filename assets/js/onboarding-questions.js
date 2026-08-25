const EFC_ONBOARDING_STATIC_FIELDS = new Set(['efc_hp', 'program_interest', 'full_name', 'email', 'phone']);

function onboardingFormValues(form) {
    return Object.fromEntries(new FormData(form).entries());
}

document.addEventListener('DOMContentLoaded', async () => {
    const status = document.getElementById('onboarding-link-status');
    const form = document.getElementById('onboarding-questions-form');
    const feedback = document.getElementById('onboarding-questions-feedback');
    if (!form) return;

    const token = new URLSearchParams(window.location.search).get('token') || '';
    if (!token) {
        status.textContent = 'This link is missing its access code. Please use the exact link your coach sent you.';
        return;
    }

    let payload;
    try {
        const response = await fetch(`/api/coaching-application/submit?token=${encodeURIComponent(token)}`);
        payload = await response.json();
        if (!response.ok) throw new Error(payload.error || 'This link could not be loaded.');
    } catch (error) {
        status.textContent = error.message || 'This link could not be loaded. Please try again shortly.';
        return;
    }

    const prospect = payload.prospect || {};
    if (prospect.name) form.elements.full_name.value = prospect.name;
    if (prospect.email) form.elements.email.value = prospect.email;
    if (prospect.phone) form.elements.phone.value = prospect.phone;
    if (prospect.programInterest) {
        const matchingOption = Array.from(form.elements.program_interest.options)
            .find((option) => option.value === prospect.programInterest);
        if (matchingOption) form.elements.program_interest.value = prospect.programInterest;
    }

    document.getElementById('onboarding-dynamic-questions').append(buildApplicationQuestionFields(payload.questions || []));
    status.remove();
    form.hidden = false;

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const submitButton = form.querySelector('button[type="submit"]');
        submitButton.disabled = true;
        submitButton.textContent = 'SUBMITTING…';
        feedback.textContent = '';

        const values = onboardingFormValues(form);
        const answers = {};
        Object.keys(values).forEach((key) => {
            if (!EFC_ONBOARDING_STATIC_FIELDS.has(key)) answers[key] = values[key];
        });

        try {
            const response = await fetch('/api/coaching-application/submit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    token,
                    efc_hp: values.efc_hp,
                    full_name: values.full_name,
                    email: values.email,
                    phone: values.phone,
                    program_interest: values.program_interest,
                    answers,
                }),
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Submission failed.');
        } catch (error) {
            feedback.textContent = error.message || 'We could not save your answers. Please try again.';
            submitButton.disabled = false;
            submitButton.textContent = 'SUBMIT ANSWERS';
            return;
        }

        form.hidden = true;
        showEchelonSuccess(feedback, 'ANSWERS RECEIVED', 'Thank you. Your coach has everything they need and will follow up with your next steps.');
    });
});
