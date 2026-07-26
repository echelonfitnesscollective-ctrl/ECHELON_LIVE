(function () {
    const buttons = document.querySelectorAll('[data-checkout-offer]');
    if (!buttons.length) return;

    buttons.forEach((button) => {
        button.addEventListener('click', async () => {
            const originalLabel = button.textContent;
            button.disabled = true;
            button.textContent = 'PREPARING SECURE CHECKOUT…';
            try {
                const result = await fetch('/api/checkout/create', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ offer: button.dataset.checkoutOffer })
                });
                const data = await result.json();
                if (!result.ok || !data.url) throw new Error(data.error || 'Checkout could not be started.');
                window.location.assign(data.url);
            } catch (error) {
                button.disabled = false;
                button.textContent = originalLabel;
                window.alert(error.message || 'Checkout is temporarily unavailable. Please try again.');
            }
        });
    });
}());
