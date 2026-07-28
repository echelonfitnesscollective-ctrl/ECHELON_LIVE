const EFC_PROGRAM_SUPABASE_URL = 'https://plkdyvtriajpzcfgtwzp.supabase.co';
const EFC_PROGRAM_SUPABASE_KEY = 'sb_publishable_CwFNrWSrhLKURZIk_-yt1A_ZVpFHEwf';

function applyProgramLaunch(card, row) {
    const isLaunched = row.status === 'launched' && row.launch_at && new Date(row.launch_at) <= new Date();
    if (!isLaunched) return;

    const status = card.querySelector('[data-program-status]');
    if (status) {
        status.className = 'status live';
        status.textContent = '';
        status.append('LIVE ', Object.assign(document.createElement('span'), { className: 'live-dot' }));
    }

    if (row.coach_name) {
        const coach = card.querySelector('[data-program-coach]');
        if (coach) coach.textContent = `Coach: ${row.coach_name}`;
    }

    const cta = card.querySelector('[data-program-cta]');
    if (cta) {
        cta.href = `pages/coaching-application.html?program=${encodeURIComponent(card.dataset.programKey)}`;
        cta.textContent = 'APPLY NOW';
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    const cards = document.querySelectorAll('[data-program-key]');
    if (!cards.length || !window.supabase) return;
    try {
        const client = window.supabase.createClient(EFC_PROGRAM_SUPABASE_URL, EFC_PROGRAM_SUPABASE_KEY);
        const { data, error } = await client.from('program_launches').select('program_key, status, coach_name, launch_at');
        if (error || !data) return;
        cards.forEach((card) => {
            const row = data.find((item) => item.program_key === card.dataset.programKey);
            if (row) applyProgramLaunch(card, row);
        });
    } catch (_) {
        // Network or client error: cards keep their static "IN DEVELOPMENT" markup.
    }
});
