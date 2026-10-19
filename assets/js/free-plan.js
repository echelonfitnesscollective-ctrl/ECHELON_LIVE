(function () {
    const form = document.getElementById('free-plan-form');
    if (!form) return;
    const note = document.getElementById('free-plan-note');
    const success = document.getElementById('free-plan-success');
    const submitButton = form.querySelector('button[type="submit"]');

    // The recommendation is a static lookup, not something the server
    // needs to compute - it mirrors the 3 programs on the Compare
    // Programs carousel (coaching-application.html). The ?program=
    // values match the keys coaching-application.js already reads to
    // preselect "What Are You Applying For?".
    const RECOMMENDATIONS = {
        'self-guided': {
            name: 'Echelon Online Coaching',
            copy: 'A custom 12-week program built around your goal, delivered by email in 24–48 hours. No live application, no subscription.',
            href: 'plan.html',
            cta: 'See Echelon Online Coaching'
        },
        '1-on-1': {
            name: '1-On-1 Coaching',
            copy: 'Full individual attention on your body, schedule and goals, with a coach who adjusts your plan as you go.',
            href: 'coaching-application.html?program=1-on-1-coaching',
            cta: 'Apply For 1-On-1 Coaching'
        },
        group: {
            name: 'Private Group Training / Organization Wellness',
            copy: 'A custom group experience built around your team, company, church or friend group (3–25 people).',
            href: 'coaching-application.html?program=private-group-training',
            cta: 'Apply For Group Training'
        }
    };

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        submitButton.disabled = true;
        submitButton.textContent = 'FINDING YOUR PROGRAM…';
        note.hidden = true;

        const values = Object.fromEntries(new FormData(form).entries());
        const recommendation = RECOMMENDATIONS[values.training_style];

        try {
            const response = await fetch('/api/free-plan/submit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(values)
            });
            if (!response.ok) {
                const result = await response.json().catch(() => ({}));
                throw new Error(result.error || 'Submission failed.');
            }
        } catch (error) {
            note.hidden = false;
            note.textContent = error.message || 'Something went wrong. Please try again.';
            submitButton.disabled = false;
            submitButton.textContent = 'SEE MY RECOMMENDATION';
            return;
        }

        window.efcTrack?.('program_quiz_complete', { goal: values.goal, training_style: values.training_style });

        form.style.display = 'none';
        success.style.display = 'block';
        success.innerHTML = `
            <span class="checkin-tag">RECOMMENDED FOR YOU</span>
            <h2>${recommendation.name}</h2>
            <p>${recommendation.copy}</p>
            <a href="${recommendation.href}" class="btn-primary">${recommendation.cta} →</a>
        `;
    });
}());
