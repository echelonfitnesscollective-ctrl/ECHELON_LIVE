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

    // One matching article per goal, so the result page has something
    // concrete to read while they decide instead of just a bare CTA.
    // Hand-picked from assets/js/resource-hub.js's own RESOURCE_ITEMS -
    // id/category/title/description here must stay in sync with that
    // file if an article is ever renamed or removed.
    const GOAL_ARTICLES = {
        'Weight Loss': { id: 'free-education', category: 'WEIGHT LOSS', title: 'WHAT IS WEIGHT LOSS, REALLY?', description: 'The real mechanism behind fat loss, and why crash diets backfire.' },
        Cutting: { id: 'free-cutting', category: 'CUTTING', title: 'WHAT MAKES CUTTING DIFFERENT FROM "JUST LOSING WEIGHT"', description: 'Where cutting differs from general weight loss, and why it matters for keeping your muscle.' },
        Bulking: { id: 'free-bulking', category: 'BULKING', title: 'UNDERSTANDING THE CALORIC SURPLUS', description: 'What a caloric surplus is, how much you need, and why more isn’t better.' },
        Muscle: { id: 'free-muscle-hypertrophy', category: 'MUSCLE', title: 'WHAT ACTUALLY CAUSES MUSCLE GROWTH?', description: 'Mechanical tension, metabolic stress, and muscle damage, in plain language.' },
        Performance: { id: 'free-performance', category: 'PERFORMANCE', title: 'WHAT IS ATHLETIC PERFORMANCE TRAINING, REALLY?', description: 'What performance training actually is, versus training for looks alone.' },
        'General Fitness': { id: 'free-training', category: 'TRAINING', title: 'THE 3-PART STARTER', description: 'A simple way to structure your first consistent training week.' },
        'Older-Adult Wellness': { id: 'free-older-adult-wellness', category: 'OLDER ADULT', title: 'WHY STRENGTH TRAINING MATTERS MORE, NOT LESS, AS YOU AGE', description: 'Why strength training becomes more important, not less, with age.' },
        Pregnancy: { id: 'free-pregnancy-prenatal', category: 'PREGNANCY', title: 'PRENATAL TRAINING: WHAT ACTUALLY CHANGES (AND WHAT DOESN’T)', description: 'What genuinely needs to change about your training during pregnancy, and what doesn’t.' }
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

        const article = GOAL_ARTICLES[values.goal];

        form.style.display = 'none';
        success.style.display = 'block';
        success.innerHTML = `
            <div class="free-plan-result-recommendation">
                <span class="checkin-tag">RECOMMENDED FOR YOU</span>
                <h2>${recommendation.name}</h2>
                <p>${recommendation.copy}</p>
                <a href="${recommendation.href}" class="btn-primary">${recommendation.cta} →</a>
            </div>
            ${article ? `
            <div class="free-plan-result-reading">
                <p class="free-plan-result-subhead">WHILE YOU DECIDE</p>
                <a class="resource-preview-card" href="resources-hub.html#resource=${article.id}">
                    <span class="checkin-tag">${article.category}</span>
                    <h3>${article.title}</h3>
                    <p>${article.description}</p>
                    <span class="resource-preview-cta">READ GUIDE →</span>
                </a>
                <a href="resources-hub.html#free-library" class="free-plan-cta-link">Browse all 37 free guides →</a>
            </div>` : ''}
        `;
    });
}());
