document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('member-login-form');
    if (!form) return;

    const overlay = document.createElement('div');
    overlay.className = 'zamiyah-overlay';
    overlay.setAttribute('aria-hidden', 'true');
    overlay.innerHTML = `
        <div class="zamiyah-hearts"></div>
        <div class="zamiyah-message">
            <div class="zamiyah-emoji-row">💗 💕 💖 💗 💕</div>
            <h2>I LOVE YOU ZAMIYAH M</h2>
            <div class="zamiyah-emoji-row">💖 💗 💕 💖 💗</div>
        </div>
    `;
    document.body.appendChild(overlay);

    const heartsLayer = overlay.querySelector('.zamiyah-hearts');
    const heartEmojis = ['💗', '💕', '💖', '💓', '💞', '🩷'];

    function spawnHearts() {
        heartsLayer.innerHTML = '';
        for (let i = 0; i < 28; i++) {
            const span = document.createElement('span');
            span.textContent = heartEmojis[Math.floor(Math.random() * heartEmojis.length)];
            span.style.left = Math.random() * 100 + '%';
            span.style.fontSize = (1.1 + Math.random() * 1.8) + 'rem';
            span.style.animationDuration = (4 + Math.random() * 4) + 's';
            span.style.animationDelay = (Math.random() * 3) + 's';
            heartsLayer.appendChild(span);
        }
    }

    function closeOverlay() {
        overlay.classList.remove('active');
        overlay.setAttribute('aria-hidden', 'true');
    }

    overlay.addEventListener('click', closeOverlay);

    form.addEventListener('submit', (event) => {
        const email = (form.elements.email.value || '').trim().toLowerCase();
        const password = form.elements.password.value || '';
        if (email === 'lulu' && password === 'melon') {
            event.preventDefault();
            event.stopImmediatePropagation();
            form.reset();
            spawnHearts();
            overlay.classList.add('active');
            overlay.setAttribute('aria-hidden', 'false');
        }
    });
});
