const EFC_SECTION_SUPABASE_URL = 'https://plkdyvtriajpzcfgtwzp.supabase.co';
const EFC_SECTION_SUPABASE_KEY = 'sb_publishable_CwFNrWSrhLKURZIk_-yt1A_ZVpFHEwf';

const SECTION_REFUND_LINK_KEYS = new Set([
    'group-fitness',
    'private-group-training',
    '12-week-transformation',
    '1-on-1-coaching',
]);

function isProgramVisible(row) {
    if (row.status !== 'launched' && row.status !== 'live') return false;
    if (row.status === 'live') return true;
    const now = new Date();
    if (row.launch_at && new Date(row.launch_at) > now) return false;
    if (row.expires_at && new Date(row.expires_at) <= now) return false;
    return true;
}

function applyProgramContent(card, row) {
    if (row.name) {
        const nameEl = card.querySelector('[data-program-name]');
        if (nameEl) nameEl.textContent = row.name;
    }
    if (row.subtitle) {
        const subtitleEl = card.querySelector('[data-program-subtitle]');
        if (subtitleEl) subtitleEl.textContent = row.subtitle;
    }
    if (row.description) {
        const descEl = card.querySelector('[data-program-description]');
        if (descEl) descEl.textContent = row.description;
    }
    if (row.note) {
        const noteEl = card.querySelector('[data-program-note]');
        if (noteEl) noteEl.textContent = row.note;
    }
    if (Array.isArray(row.details) && row.details.length) {
        const detailsEl = card.querySelector('[data-program-details]');
        if (detailsEl) {
            detailsEl.innerHTML = '';
            row.details.forEach((item) => {
                if (!item || !item.label || !item.value) return;
                const strong = document.createElement('strong');
                strong.textContent = item.label;
                const p = document.createElement('p');
                p.textContent = item.value;
                detailsEl.append(strong, p);
            });
            if (SECTION_REFUND_LINK_KEYS.has(card.dataset.programKey)) {
                const link = document.createElement('a');
                link.href = 'pages/terms.html#payments-refund-policy';
                link.className = 'refund-policy-link';
                link.textContent = 'Cancellation & Refund Policy →';
                detailsEl.append(link);
            }
        }
    }
}

function applyProgramGate(card, row) {
    const visible = isProgramVisible(row);

    if (card.hasAttribute('hidden')) {
        if (!visible) return;
        card.removeAttribute('hidden');
    }

    const status = card.querySelector('[data-program-status]');
    if (status) {
        if (visible) {
            status.className = 'status live';
            status.textContent = '';
            status.append('LIVE ', Object.assign(document.createElement('span'), { className: 'live-dot' }));
        } else {
            status.className = 'status soon';
            status.textContent = 'IN DEVELOPMENT';
        }
    }

    const cta = card.querySelector('[data-program-cta]');
    if (cta && visible) {
        cta.href = `pages/coaching-application.html?program=${encodeURIComponent(card.dataset.programKey)}`;
        cta.textContent = 'APPLY NOW';
    }
}

function reorderCards(container, cards, rows) {
    const order = rows
        .slice()
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
        .map((row) => row.program_key);

    order.forEach((key) => {
        const card = Array.from(cards).find((c) => c.dataset.programKey === key);
        if (card) container.appendChild(card);
    });
}

document.addEventListener('DOMContentLoaded', async () => {
    const container = document.getElementById('trainingCarousel');
    const cards = document.querySelectorAll('[data-program-key]');
    if (!container || !cards.length || !window.supabase) return;
    try {
        const client = window.supabase.createClient(EFC_SECTION_SUPABASE_URL, EFC_SECTION_SUPABASE_KEY);
        const { data, error } = await client
            .from('training_programs')
            .select('program_key, name, subtitle, description, note, details, status, launch_at, expires_at, sort_order');
        if (error || !data) return;

        cards.forEach((card) => {
            const row = data.find((item) => item.program_key === card.dataset.programKey);
            if (!row) return;
            applyProgramContent(card, row);
            if (card.querySelector('[data-program-status]') || card.hasAttribute('hidden')) {
                applyProgramGate(card, row);
            }
        });

        reorderCards(container, cards, data);
    } catch (_) {
        // Network or client error: cards keep their static markup and order.
    }
});
