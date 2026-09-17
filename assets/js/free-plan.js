(function () {
    const form = document.getElementById('free-plan-form');
    if (!form) return;
    const note = document.getElementById('free-plan-note');
    const success = document.getElementById('free-plan-success');
    const submitButton = form.querySelector('button[type="submit"]');

    function renderTemplate(template) {
        const daysHtml = template.days
            .map((day) => {
                const items = day.items.map((item) => `<li>${item}</li>`).join('');
                return `<div class="free-plan-day"><h4>${day.label}</h4>${items ? `<ul>${items}</ul>` : ''}</div>`;
            })
            .join('');

        success.innerHTML = `
            <h2>${template.title}</h2>
            <p class="free-plan-subtitle">${template.subtitle}</p>
            <p><strong>Level:</strong> ${template.level}<br><strong>Structure:</strong> ${template.structure}</p>
            <div class="free-plan-days">${daysHtml}</div>
            <p class="free-plan-nutrition"><strong>Nutrition guidance:</strong> ${template.nutrition}</p>
            <p class="free-plan-hook">This plan is Week 1, static, forever, it doesn't adjust as you progress, doesn't account for injuries, and isn't personalized beyond your goal. That's exactly what real coaching adds. We also emailed you a copy.</p>
            <a href="coaching-application.html" class="btn-primary">APPLY FOR COACHING</a>
        `;
    }

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
        renderTemplate(result.template);
        form.style.display = 'none';
        success.style.display = 'block';
    });
}());
