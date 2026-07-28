(function () {
    const form = document.getElementById('free-class-form');
    if (!form) return;
    const note = document.getElementById('free-class-note');
    const success = document.getElementById('free-class-success');
    const submitButton = form.querySelector('button[type="submit"]');

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        submitButton.disabled = true;
        submitButton.textContent = 'SENDING…';
        note.hidden = true;
        const values = Object.fromEntries(new FormData(form).entries());
        try {
            const response = await fetch('/api/free-class/submit', {
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
            submitButton.textContent = 'REQUEST MY FREE CLASS';
            return;
        }
        window.efcTrack?.('free_class_request', {});
        form.style.display = 'none';
        success.style.display = 'block';
    });
}());
