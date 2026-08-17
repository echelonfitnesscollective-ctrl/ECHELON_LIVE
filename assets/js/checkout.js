(function () {
    const buttons = document.querySelectorAll('[data-checkout-offer]');
    if (!buttons.length) return;

    buttons.forEach((button) => {
        button.addEventListener('click', async () => {
            const originalLabel = button.textContent;
            const feedback = button.closest('.training-card-footer')?.querySelector('.checkout-feedback');
            if (feedback) feedback.textContent = '';
            button.disabled = true;
            button.textContent = 'PREPARING SECURE CHECKOUT…';
            try {
                const result = await fetch('/api/checkout/create', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ offer: button.dataset.checkoutOffer })
                });
                let data;
                try { data = await result.json(); } catch { throw new Error('Checkout is temporarily unavailable. Please try again.'); }
                if (!result.ok || !data.url) throw new Error(data.error || 'Checkout could not be started.');
                const offer = button.dataset.checkoutOffer;
                window.efcTrack?.(offer === 'group_drop_in' ? 'drop_in_purchase' : 'checkout_started', { offer });
                window.location.assign(data.url);
            } catch (error) {
                button.disabled = false;
                button.textContent = originalLabel;
                const message = error.message || 'Checkout is temporarily unavailable. Please try again.';
                if (feedback) feedback.textContent = message;
                else window.alert(message);
            }
        });
    });
}());
