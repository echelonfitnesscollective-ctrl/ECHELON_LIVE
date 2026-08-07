document.addEventListener('DOMContentLoaded', () => {
    const buttons = document.querySelectorAll('.training-card-details-btn');
    if (!buttons.length) return;

    const overlay = document.createElement('div');
    overlay.className = 'training-modal-overlay';
    overlay.setAttribute('aria-hidden', 'true');
    overlay.innerHTML = `
        <div class="training-modal-panel" role="dialog" aria-modal="true">
            <button type="button" class="training-modal-close" aria-label="Close">&times;</button>
            <h2 class="training-modal-title"></h2>
            <div class="detail-content training-modal-body"></div>
        </div>
    `;
    document.body.appendChild(overlay);

    const panel = overlay.querySelector('.training-modal-panel');
    const titleEl = overlay.querySelector('.training-modal-title');
    const bodyEl = overlay.querySelector('.training-modal-body');
    const closeBtn = overlay.querySelector('.training-modal-close');

    function openModal(button) {
        const card = button.closest('.training-card');
        if (!card) return;
        const nameEl = card.querySelector('[data-program-name]');
        const detailsEl = card.querySelector('[data-program-details]');
        titleEl.textContent = nameEl ? nameEl.textContent.trim() : '';
        bodyEl.innerHTML = detailsEl ? detailsEl.innerHTML : '';
        overlay.classList.add('active');
        overlay.setAttribute('aria-hidden', 'false');
        document.body.classList.add('training-modal-open');
        panel.scrollTop = 0;
        closeBtn.focus();
    }

    function closeModal() {
        overlay.classList.remove('active');
        overlay.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('training-modal-open');
    }

    buttons.forEach((button) => {
        button.addEventListener('click', () => openModal(button));
    });

    overlay.addEventListener('click', (event) => {
        if (event.target === overlay) closeModal();
    });
    closeBtn.addEventListener('click', closeModal);
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && overlay.classList.contains('active')) closeModal();
    });
});
