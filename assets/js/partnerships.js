(function () {
    const form = document.getElementById('partnership-form');
    if (!form) return;
    const note = document.getElementById('partnership-note');
    const success = document.getElementById('partnership-success');
    const submitButton = form.querySelector('button[type="submit"]');

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        submitButton.disabled = true;
        submitButton.textContent = 'SENDING…';
        note.hidden = true;
        const values = Object.fromEntries(new FormData(form).entries());
        try {
            const response = await fetch('/api/partnerships/submit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(values)
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Submission failed.');
        } catch (error) {
            note.hidden = false;
            note.textContent = error.message || 'We could not send your request. Please try again.';
            submitButton.disabled = false;
            submitButton.textContent = 'REQUEST A PROPOSAL';
            return;
        }
        window.efcTrack?.('partnership_inquiry', {});
        form.style.display = 'none';
        success.style.display = 'block';
    });
}());
