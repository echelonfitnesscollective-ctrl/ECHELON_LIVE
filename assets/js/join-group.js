const EFC_JOIN_TYPE_LABELS = { one_on_one: '1-on-1', private_group: 'Private Training Group', group_fitness: 'Group Fitness' };

document.addEventListener('DOMContentLoaded', async () => {
    const copy = document.getElementById('join-copy');
    const info = document.getElementById('join-session-info');
    const form = document.getElementById('join-form');
    const feedback = document.getElementById('join-feedback');
    const success = document.getElementById('join-success');
    const successHeading = document.getElementById('join-success-heading');
    const successDetail = document.getElementById('join-success-detail');
    if (!copy) return;

    const token = new URLSearchParams(window.location.search).get('token');
    if (!token) { copy.textContent = 'This link is incomplete. Ask your host for a new one.'; return; }

    let scheduledAtText = '';
    try {
        const result = await fetch(`/api/groups/info?token=${encodeURIComponent(token)}`);
        const body = await result.json();
        if (!result.ok) throw new Error(body.error || 'This link is not valid.');

        const when = new Date(body.scheduledAt);
        scheduledAtText = when.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }) + ' · ' + when.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
        const typeLabel = body.classLabel || EFC_JOIN_TYPE_LABELS[body.sessionType] || body.sessionType;

        if (body.full) {
            copy.textContent = `${typeLabel} · ${scheduledAtText} is full.`;
            info.hidden = false;
            info.textContent = `${body.taken}/${body.capacity} spots taken, plus the waitlist. Contact your host or Echelon for another option.`;
            return;
        }

        copy.textContent = `You're joining ${typeLabel}${body.hostName ? ` with ${body.hostName}` : ''}.`;
        info.hidden = false;
        info.textContent = body.waitlistOpen
            ? `${scheduledAtText} · Session is full, but a waitlist spot is open.`
            : `${scheduledAtText} · ${body.taken}/${body.capacity} spots taken`;
        form.hidden = false;
    } catch (error) {
        copy.textContent = error.message || 'This link is not valid. Ask your host for a new one.';
        return;
    }

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        feedback.textContent = '';
        const { full_name, email, phone, waiver_agreed } = form.elements;
        const submit = form.querySelector('button[type="submit"]');
        submit.disabled = true; submit.textContent = 'JOINING…';
        try {
            const result = await fetch('/api/groups/join', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    token,
                    fullName: full_name.value,
                    email: email.value,
                    phone: phone.value,
                    waiverAgreed: waiver_agreed.checked
                })
            });
            const body = await result.json();
            if (!result.ok) throw new Error(body.error || 'Could not save your spot.');
            form.hidden = true;
            info.hidden = true;
            copy.hidden = true;
            if (body.waitlisted) {
                successHeading.textContent = "YOU'RE ON THE WAITLIST";
                successDetail.textContent = `${scheduledAtText}. We'll confirm you if a spot opens up.`;
            } else {
                successHeading.textContent = "YOU'RE CONFIRMED";
                successDetail.textContent = `${scheduledAtText}. See you there.`;
            }
            success.hidden = false;
        } catch (error) {
            feedback.textContent = error.message;
            submit.disabled = false; submit.textContent = 'JOIN SESSION';
        }
    });
});
