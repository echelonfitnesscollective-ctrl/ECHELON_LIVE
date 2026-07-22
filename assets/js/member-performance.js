function performanceNumber(value) {
    return value === '' ? null : Number(value);
}

function renderPerformanceList(container, records, emptyMessage, formatter) {
    container.replaceChildren();
    if (!records.length) {
        container.textContent = emptyMessage;
        return;
    }
    records.forEach((record) => {
        const item = document.createElement('article');
        item.className = 'performance-list-item';
        item.textContent = formatter(record);
        container.append(item);
    });
}

document.addEventListener('DOMContentLoaded', async () => {
    const form = document.getElementById('member-performance-form');
    if (!form) return;
    const member = await requireMemberSession();
    if (!member) return;

    form.elements.week_of.value = new Date().toISOString().slice(0, 10);
    const feedback = document.getElementById('member-performance-feedback');
    const submit = form.querySelector('button[type="submit"]');
    const [goalsResult, historyResult] = await Promise.all([
        echelonMemberClient.from('member_goals').select('goal, target_date, status').eq('user_id', member.id).eq('status', 'Active').order('created_at', { ascending: false }),
        echelonMemberClient.from('member_weekly_checkins').select('week_of, body_weight, workouts_completed, nutrition_adherence').eq('user_id', member.id).order('week_of', { ascending: false }).limit(6)
    ]);
    renderPerformanceList(document.getElementById('member-goals-list'), goalsResult.data || [], 'Your coach will add goals here.', (goal) => `${goal.goal}${goal.target_date ? ` · target ${goal.target_date}` : ''}`);
    renderPerformanceList(document.getElementById('member-performance-history'), historyResult.data || [], 'Your submitted check-ins will appear here.', (item) => `${item.week_of} · ${item.workouts_completed ?? '—'} workouts · ${item.nutrition_adherence ?? '—'}/10 nutrition`);

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        submit.disabled = true;
        submit.textContent = 'SAVING…';
        const data = Object.fromEntries(new FormData(form).entries());
        const { error } = await echelonMemberClient.from('member_weekly_checkins').upsert({
            user_id: member.id,
            week_of: data.week_of,
            body_weight: performanceNumber(data.body_weight),
            body_fat_percentage: performanceNumber(data.body_fat_percentage),
            workouts_completed: performanceNumber(data.workouts_completed),
            average_steps: performanceNumber(data.average_steps),
            average_sleep_hours: performanceNumber(data.average_sleep_hours),
            energy_score: performanceNumber(data.energy_score),
            stress_score: performanceNumber(data.stress_score),
            nutrition_adherence: performanceNumber(data.nutrition_adherence),
            protein_days: performanceNumber(data.protein_days),
            water_days: performanceNumber(data.water_days),
            wins: data.wins,
            blockers: data.blockers,
            coach_focus: data.coach_focus,
            updated_at: new Date().toISOString()
        }, { onConflict: 'user_id,week_of' });
        if (error) feedback.textContent = 'We could not save this check-in. Please try again.';
        else showEchelonSuccess(feedback, 'WEEKLY REVIEW SAVED', 'Your coach now has the context to guide your next week with precision.');
        submit.disabled = false;
        submit.textContent = 'SAVE WEEKLY CHECK-IN';
    });
});
