(function () {
    const params = new URLSearchParams(window.location.search);
    const intakeId = params.get('intake');
    const coachingAdded = params.get('coaching') === '1';

    const upsellCard = document.getElementById('plan-upsell-card');
    const coachingAddedCard = document.getElementById('plan-coaching-added-card');
    const mainCard = document.getElementById('plan-success-main');

    if (coachingAdded) {
        if (mainCard) mainCard.hidden = true;
        if (coachingAddedCard) coachingAddedCard.hidden = false;
        window.efcTrack?.('plan_monthly_coaching_added', {});
        return;
    }

    if (!intakeId) return;
    window.efcTrack?.('plan_purchase_complete', {});
    if (upsellCard) upsellCard.hidden = false;

    const button = document.getElementById('plan-upsell-button');
    const note = document.getElementById('plan-upsell-note');
    if (!button) return;

    button.addEventListener('click', async () => {
        const originalLabel = button.textContent;
        button.disabled = true;
        button.textContent = 'PREPARING SECURE CHECKOUT…';
        if (note) note.hidden = true;
        try {
            const response = await fetch('/api/plan/upsell-checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ intakeId }),
            });
            const result = await response.json();
            if (!response.ok || !result.url) throw new Error(result.error || 'Checkout could not be started.');
            window.efcTrack?.('plan_monthly_coaching_checkout_started', {});
            window.location.assign(result.url);
        } catch (error) {
            button.disabled = false;
            button.textContent = originalLabel;
            if (note) {
                note.hidden = false;
                note.textContent = error.message || 'We could not start checkout. Please try again.';
            } else {
                window.alert(error.message || 'We could not start checkout. Please try again.');
            }
        }
    });
}());
