function performanceNumber(value) {
    return value === '' ? null : Number(value);
}

function computeCheckinStreak(rows) {
    // rows must be sorted by week_of descending. Treats weeks within ~10 days
    // of each other as consecutive, allowing some slack in check-in day.
    if (!rows.length) return { count: 0, current: false };
    let streak = 1;
    for (let i = 0; i < rows.length - 1; i++) {
        const diffDays = (new Date(rows[i].week_of) - new Date(rows[i + 1].week_of)) / 86400000;
        if (diffDays <= 10) streak++;
        else break;
    }
    const daysSinceLatest = (Date.now() - new Date(rows[0].week_of)) / 86400000;
    return { count: streak, current: daysSinceLatest <= 10 };
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
        echelonMemberClient.from('member_weekly_checkins').select('week_of, body_weight, workouts_completed, nutrition_adherence').eq('user_id', member.id).order('week_of', { ascending: false }).limit(52)
    ]);
    renderPerformanceList(document.getElementById('member-goals-list'), goalsResult.data || [], 'Your coach will add goals here.', (goal) => `${goal.goal}${goal.target_date ? ` · target ${goal.target_date}` : ''}`);
    const checkinHistory = historyResult.data || [];
    renderPerformanceList(document.getElementById('member-performance-history'), checkinHistory.slice(0, 6), 'Your submitted check-ins will appear here.', (item) => `${item.week_of} · ${item.workouts_completed ?? 'N/A'} workouts · ${item.nutrition_adherence ?? 'N/A'}/10 nutrition`);

    const streakBadge = document.getElementById('member-streak-badge');
    const streak = computeCheckinStreak(checkinHistory);
    if (streakBadge && streak.count > 1 && streak.current) {
        streakBadge.hidden = false;
        streakBadge.textContent = `${streak.count} WEEKS IN A ROW`;
    }

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
        else {
            form.reset();
            form.elements.week_of.value = new Date().toISOString().slice(0, 10);
            showEchelonSuccess(feedback, 'WEEKLY REVIEW SAVED', 'Your coach now has the context to guide your next week with precision.');
        }
        submit.disabled = false;
        submit.textContent = 'SAVE WEEKLY CHECK-IN';
    });
});
