document.addEventListener('DOMContentLoaded', async () => {
    const member = await requireMemberSession();
    if (!member) return;
    const today = new Date().toISOString().slice(0, 10);
    const photoForm = document.getElementById('progress-photo-form');
    photoForm.elements.taken_on.value = today;

    // Set only by the coach, from the admin Training Profile. Not a member-facing control.
    const { data: trainingProfile } = await echelonMemberClient.from('member_training_profiles').select('pregnant_or_postpartum').eq('user_id', member.id).maybeSingle();
    const showPregnancyMods = !!trainingProfile?.pregnant_or_postpartum;

    async function forwardMemberMessage(message) {
        const notification = new FormData();
        notification.append('_subject', 'New Echelon Member Hub message');
        notification.append('_replyto', member.email || '');
        notification.append('source', 'Echelon Member Hub · Direct Line');
        notification.append('member_email', member.email || '');
        notification.append('message', message);
        try { const response = await fetch('https://formspree.io/f/mykrpvaz', { method: 'POST', body: notification, headers: { Accept: 'application/json' } }); return response.ok; } catch { return false; }
    }

    let todaysWorkAssignments = [];
    let todaysWorkIndex = 0;
    let exerciseLoadMap = new Map();
    const todaysWorkPrevBtn = document.getElementById('todays-work-prev');
    const todaysWorkNextBtn = document.getElementById('todays-work-next');
    const todaysWorkPosition = document.getElementById('todays-work-position');
    const todaysWorkJumpBtn = document.getElementById('todays-work-jump');
    const todaysWorkCalendar = document.getElementById('todays-work-calendar');
    let calendarMonthCursor = new Date(`${today}T00:00:00`);
    let programDateBounds = null;

    function buildDaySlide(assignment) {
        const isToday = assignment.assigned_date === today;
        const day = document.createElement('article'); day.className = 'todays-work-day' + (isToday ? ' is-today' : '');
        const heading = document.createElement('h3');
        heading.textContent = `${isToday ? 'TODAY' : assignment.assigned_date} · ${assignment.workouts?.title || 'Workout'}`;
        day.append(heading);
        const setting = assignment.workouts?.setting;
        if (setting && setting !== 'gym') {
            const settingTag = document.createElement('span'); settingTag.className = 'todays-work-setting';
            settingTag.textContent = setting === 'mobile' ? 'MOBILE SESSION' : 'GYM OR MOBILE';
            day.append(settingTag);
        }
        if (assignment.workouts?.description) { const desc = document.createElement('p'); desc.className = 'todays-work-day-desc'; desc.textContent = assignment.workouts.description; day.append(desc); }
        if (assignment.coach_note) { const note = document.createElement('p'); note.className = 'todays-work-coach-note'; note.textContent = `Coach note: ${assignment.coach_note}`; day.append(note); }
        (assignment.workouts?.workout_exercises || []).forEach(row => {
            const exercise = row.exercise_library;
            if (!exercise) return;
            const card = document.createElement('article'); card.className = 'todays-work-exercise';
            const name = document.createElement('h4'); name.textContent = exercise.name; card.append(name);
            const prescription = document.createElement('p'); prescription.className = 'todays-work-prescription';
            prescription.textContent = `${row.sets ?? 'N/A'} sets x ${row.reps || 'N/A'}${row.rest_seconds ? ` · ${row.rest_seconds}s rest` : ''}`;
            card.append(prescription);
            if (row.exercise_id) {
                const loadWrap = document.createElement('label'); loadWrap.className = 'todays-work-load';
                const loadLabelText = document.createElement('span'); loadLabelText.textContent = 'Load (lb)'; loadWrap.append(loadLabelText);
                const loadInput = document.createElement('input');
                loadInput.type = 'number'; loadInput.min = '0'; loadInput.step = '0.5'; loadInput.inputMode = 'decimal'; loadInput.placeholder = 'lb';
                const existingLoad = exerciseLoadMap.get(`${assignment.id}_${row.exercise_id}`);
                if (existingLoad !== undefined && existingLoad !== null) loadInput.value = existingLoad;
                const loadStatus = document.createElement('span'); loadStatus.className = 'todays-work-load-status';
                loadInput.addEventListener('change', async () => {
                    const value = loadInput.value === '' ? null : Number(loadInput.value);
                    loadStatus.textContent = 'Saving…';
                    const { error: logError } = await echelonMemberClient
                        .from('member_exercise_logs')
                        .upsert({ user_id: member.id, daily_workout_id: assignment.id, exercise_id: row.exercise_id, load_lb: value }, { onConflict: 'daily_workout_id,exercise_id' });
                    loadStatus.textContent = logError ? 'Could not save' : 'Saved';
                    if (!logError) exerciseLoadMap.set(`${assignment.id}_${row.exercise_id}`, value);
                    setTimeout(() => { loadStatus.textContent = ''; }, 2000);
                });
                loadWrap.append(loadInput, loadStatus);
                card.append(loadWrap);
            }
            if (exercise.target_area) { const target = document.createElement('p'); target.className = 'todays-work-target'; target.textContent = `Targets: ${exercise.target_area}`; card.append(target); }
            if (exercise.form_cues) { const cues = document.createElement('p'); cues.textContent = exercise.form_cues; card.append(cues); }
            if (exercise.coaching_cues) { const cues = document.createElement('p'); cues.textContent = exercise.coaching_cues; card.append(cues); }
            if (row.notes) { const notes = document.createElement('p'); notes.className = 'todays-work-coach-note'; notes.textContent = row.notes; card.append(notes); }
            const showUpDown = !showPregnancyMods;
            if ((showUpDown && (exercise.modification_up || exercise.modification_down)) || (showPregnancyMods && exercise.modification_pregnancy) || exercise.video_url) {
                const details = document.createElement('details'); details.className = 'todays-work-mods';
                const summary = document.createElement('summary'); summary.textContent = showPregnancyMods ? 'View Pregnancy-Safe Modification' : 'View Modifications'; details.append(summary);
                if (showPregnancyMods) {
                    if (exercise.modification_pregnancy) { const p = document.createElement('p'); p.innerHTML = `<strong>Pregnancy-safe:</strong> `; p.append(exercise.modification_pregnancy); details.append(p); }
                    else { const p = document.createElement('p'); p.textContent = 'No pregnancy-specific modification on file for this exercise yet, message your coach before loading it.'; details.append(p); }
                } else {
                    if (exercise.modification_up) { const p = document.createElement('p'); p.innerHTML = `<strong>Up:</strong> `; p.append(exercise.modification_up); details.append(p); }
                    if (exercise.modification_down) { const p = document.createElement('p'); p.innerHTML = `<strong>Down:</strong> `; p.append(exercise.modification_down); details.append(p); }
                }
                if (exercise.video_url) { const p = document.createElement('p'); const a = document.createElement('a'); a.href = exercise.video_url; a.target = '_blank'; a.rel = 'noopener'; a.textContent = 'Watch demo video'; p.append(a); details.append(p); }
                card.append(details);
            }
            day.append(card);
        });
        if (assignment.status === 'completed') {
            const done = document.createElement('p'); done.className = 'todays-work-status-done'; done.textContent = 'Marked complete'; day.append(done);
        } else {
            const completeButton = document.createElement('button'); completeButton.type = 'button'; completeButton.className = 'btn-secondary'; completeButton.textContent = 'MARK COMPLETE';
            completeButton.addEventListener('click', async () => { const { error: updateError } = await echelonMemberClient.from('member_daily_workouts').update({ status: 'completed' }).eq('id', assignment.id); if (!updateError) loadTodaysWork(); });
            day.append(completeButton);
        }
        return day;
    }

    function renderTodaysWorkSlide() {
        const list = document.getElementById('todays-work-list');
        if (!list) return;
        if (!todaysWorkAssignments.length) { list.textContent = "Your coach hasn't assigned any upcoming work yet."; if (todaysWorkPosition) todaysWorkPosition.textContent = ''; if (todaysWorkPrevBtn) todaysWorkPrevBtn.disabled = true; if (todaysWorkNextBtn) todaysWorkNextBtn.disabled = true; return; }
        const assignment = todaysWorkAssignments[todaysWorkIndex];
        const daySlide = buildDaySlide(assignment);
        list.replaceChildren(daySlide);
        if (todaysWorkPosition) {
            const isToday = assignment.assigned_date === today;
            todaysWorkPosition.textContent = `${isToday ? 'TODAY' : assignment.assigned_date} · ${todaysWorkIndex + 1} of ${todaysWorkAssignments.length}`;
        }
        if (todaysWorkPrevBtn) todaysWorkPrevBtn.disabled = todaysWorkIndex === 0;
        if (todaysWorkNextBtn) todaysWorkNextBtn.disabled = todaysWorkIndex === todaysWorkAssignments.length - 1;
        loadDaySummary(assignment.assigned_date).then((summary) => {
            if (list.firstElementChild !== daySlide) return;
            const box = document.createElement('div');
            box.className = 'todays-work-day-summary';
            if (summary.hasFood || summary.weight) {
                const parts = [];
                if (summary.hasFood) parts.push(`${Math.round(summary.totals.calories)} kcal`, `${Math.round(summary.totals.protein)}g protein`, `${Math.round(summary.totals.carbs)}g carbs`, `${Math.round(summary.totals.fat)}g fat`);
                if (summary.weight) parts.push(`Weight ${summary.weight.weight_value} ${summary.weight.weight_unit}`);
                box.textContent = `Logged that day: ${parts.join(' · ')}`;
            } else {
                box.textContent = 'Nothing logged for this day yet.';
            }
            daySlide.append(box);
        });
    }

    async function loadDaySummary(assignedDate) {
        const [{ data: foodRows }, { data: weightRow }] = await Promise.all([
            echelonMemberClient.from('food_logs').select('calories, protein_grams, carbohydrate_grams, fat_grams').eq('user_id', member.id).eq('log_date', assignedDate),
            echelonMemberClient.from('weight_logs').select('weight_value, weight_unit').eq('user_id', member.id).eq('log_date', assignedDate).maybeSingle()
        ]);
        const totals = (foodRows || []).reduce((acc, row) => {
            acc.calories += Number(row.calories) || 0;
            acc.protein += Number(row.protein_grams) || 0;
            acc.carbs += Number(row.carbohydrate_grams) || 0;
            acc.fat += Number(row.fat_grams) || 0;
            return acc;
        }, { calories: 0, protein: 0, carbs: 0, fat: 0 });
        return { totals, hasFood: (foodRows || []).length > 0, weight: weightRow || null };
    }

    async function loadStreak() {
        const streakEl = document.getElementById('member-streak');
        if (!streakEl) return;
        const since = new Date(`${today}T00:00:00`);
        since.setDate(since.getDate() - 30);
        const sinceStr = since.toISOString().slice(0, 10);
        const [{ data: workouts }, { data: foodDates }, { data: waterDates }] = await Promise.all([
            echelonMemberClient.from('member_daily_workouts').select('assigned_date, status').eq('user_id', member.id).gte('assigned_date', sinceStr).lte('assigned_date', today).order('assigned_date', { ascending: false }),
            echelonMemberClient.from('food_logs').select('log_date').eq('user_id', member.id).gte('log_date', sinceStr).lte('log_date', today),
            echelonMemberClient.from('water_logs').select('log_date').eq('user_id', member.id).gte('log_date', sinceStr).lte('log_date', today)
        ]);
        const foodDaySet = new Set((foodDates || []).map((r) => r.log_date));
        const waterDaySet = new Set((waterDates || []).map((r) => r.log_date));
        let streak = 0;
        for (const day of (workouts || [])) {
            const complete = day.status === 'completed' && foodDaySet.has(day.assigned_date) && waterDaySet.has(day.assigned_date);
            if (!complete && day.assigned_date === today) continue;
            if (complete) { streak += 1; continue; }
            break;
        }
        streakEl.textContent = streak > 0
            ? `🔥 ${streak} day${streak === 1 ? '' : 's'} strong, workout + macros + water logged every one`
            : 'Log your workout, macros, and water on the same day to start a streak.';
    }

    async function ensureProgramDateBounds() {
        if (programDateBounds) return programDateBounds;
        const [{ data: earliest }, { data: latest }] = await Promise.all([
            echelonMemberClient.from('member_daily_workouts').select('assigned_date').eq('user_id', member.id).order('assigned_date', { ascending: true }).limit(1),
            echelonMemberClient.from('member_daily_workouts').select('assigned_date').eq('user_id', member.id).order('assigned_date', { ascending: false }).limit(1)
        ]);
        programDateBounds = { min: earliest?.[0]?.assigned_date || today, max: latest?.[0]?.assigned_date || today };
        return programDateBounds;
    }

    function renderCalendar() {
        if (!todaysWorkCalendar) return;
        todaysWorkCalendar.replaceChildren();
        const year = calendarMonthCursor.getFullYear();
        const month = calendarMonthCursor.getMonth();

        const header = document.createElement('div');
        header.className = 'todays-work-calendar-header';
        const prevBtn = document.createElement('button');
        prevBtn.type = 'button'; prevBtn.textContent = '←'; prevBtn.setAttribute('aria-label', 'Previous month');
        const nextBtn = document.createElement('button');
        nextBtn.type = 'button'; nextBtn.textContent = '→'; nextBtn.setAttribute('aria-label', 'Next month');
        const label = document.createElement('span');
        label.textContent = calendarMonthCursor.toLocaleDateString([], { month: 'long', year: 'numeric' });
        prevBtn.addEventListener('click', () => { calendarMonthCursor = new Date(year, month - 1, 1); renderCalendar(); });
        nextBtn.addEventListener('click', () => { calendarMonthCursor = new Date(year, month + 1, 1); renderCalendar(); });
        header.append(prevBtn, label, nextBtn);
        todaysWorkCalendar.append(header);

        const grid = document.createElement('div');
        grid.className = 'todays-work-calendar-grid';
        ['S', 'M', 'T', 'W', 'T', 'F', 'S'].forEach((d) => { const el = document.createElement('span'); el.className = 'todays-work-calendar-dow'; el.textContent = d; grid.append(el); });
        const firstOfMonth = new Date(year, month, 1);
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const currentAssignment = todaysWorkAssignments[todaysWorkIndex];
        for (let i = 0; i < firstOfMonth.getDay(); i++) grid.append(document.createElement('span'));
        for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const dayBtn = document.createElement('button');
            dayBtn.type = 'button'; dayBtn.textContent = String(d); dayBtn.className = 'todays-work-calendar-day';
            if (dateStr === today) dayBtn.classList.add('is-today');
            if (currentAssignment && dateStr === currentAssignment.assigned_date) dayBtn.classList.add('is-selected');
            dayBtn.addEventListener('click', () => jumpToDate(dateStr));
            grid.append(dayBtn);
        }
        todaysWorkCalendar.append(grid);
    }

    async function jumpToDate(dateStr) {
        const center = new Date(`${dateStr}T00:00:00`);
        const from = new Date(center); from.setDate(from.getDate() - 7);
        const to = new Date(center); to.setDate(to.getDate() + 7);
        const { data, error } = await echelonMemberClient
            .from('member_daily_workouts')
            .select('id, assigned_date, status, coach_note, workouts(title, category, description, setting, workout_exercises(exercise_id, sort_order, sets, reps, rest_seconds, notes, exercise_library(name, target_area, form_cues, coaching_cues, modification_up, modification_down, modification_pregnancy, video_url)))')
            .eq('user_id', member.id)
            .gte('assigned_date', from.toISOString().slice(0, 10))
            .lte('assigned_date', to.toISOString().slice(0, 10))
            .order('assigned_date', { ascending: true })
            .order('sort_order', { foreignTable: 'workouts.workout_exercises', ascending: true });
        if (error || !(data || []).length) return;
        const { data: logs } = await echelonMemberClient
            .from('member_exercise_logs')
            .select('daily_workout_id, exercise_id, load_lb')
            .in('daily_workout_id', data.map((a) => a.id));
        exerciseLoadMap = new Map((logs || []).map((entry) => [`${entry.daily_workout_id}_${entry.exercise_id}`, entry.load_lb]));
        todaysWorkAssignments = data;
        const idx = data.findIndex((a) => a.assigned_date === dateStr);
        todaysWorkIndex = idx !== -1 ? idx : 0;
        if (todaysWorkCalendar) todaysWorkCalendar.hidden = true;
        renderTodaysWorkSlide();
    }

    if (todaysWorkJumpBtn && todaysWorkCalendar) {
        todaysWorkJumpBtn.addEventListener('click', async () => {
            const opening = todaysWorkCalendar.hidden;
            if (opening) {
                await ensureProgramDateBounds();
                const anchor = todaysWorkAssignments[todaysWorkIndex]?.assigned_date || today;
                calendarMonthCursor = new Date(`${anchor}T00:00:00`);
                renderCalendar();
            }
            todaysWorkCalendar.hidden = !opening;
        });
    }

    if (todaysWorkPrevBtn) todaysWorkPrevBtn.addEventListener('click', () => { if (todaysWorkIndex > 0) { todaysWorkIndex -= 1; renderTodaysWorkSlide(); } });
    if (todaysWorkNextBtn) todaysWorkNextBtn.addEventListener('click', () => { if (todaysWorkIndex < todaysWorkAssignments.length - 1) { todaysWorkIndex += 1; renderTodaysWorkSlide(); } });

    async function loadTodaysWork() {
        const list = document.getElementById('todays-work-list');
        if (!list) return;
        const previouslyViewedDate = todaysWorkAssignments[todaysWorkIndex]?.assigned_date;
        const { data, error } = await echelonMemberClient
            .from('member_daily_workouts')
            .select('id, assigned_date, status, coach_note, workouts(title, category, description, setting, workout_exercises(exercise_id, sort_order, sets, reps, rest_seconds, notes, exercise_library(name, target_area, form_cues, coaching_cues, modification_up, modification_down, modification_pregnancy, video_url)))')
            .eq('user_id', member.id)
            .gte('assigned_date', today)
            .order('assigned_date', { ascending: true })
            .order('sort_order', { foreignTable: 'workouts.workout_exercises', ascending: true })
            .limit(14);
        if (error || !(data || []).length) { todaysWorkAssignments = []; todaysWorkIndex = 0; renderTodaysWorkSlide(); return; }
        const { data: logs } = await echelonMemberClient
            .from('member_exercise_logs')
            .select('daily_workout_id, exercise_id, load_lb')
            .in('daily_workout_id', data.map(a => a.id));
        exerciseLoadMap = new Map((logs || []).map(entry => [`${entry.daily_workout_id}_${entry.exercise_id}`, entry.load_lb]));
        todaysWorkAssignments = data;
        const keepIndex = previouslyViewedDate ? data.findIndex(a => a.assigned_date === previouslyViewedDate) : -1;
        const todayIndex = data.findIndex(a => a.assigned_date === today);
        todaysWorkIndex = keepIndex !== -1 ? keepIndex : (todayIndex !== -1 ? todayIndex : 0);
        renderTodaysWorkSlide();
    }

    async function loadYourProgram() {
        const panel = document.getElementById('member-program-panel');
        if (!panel) return;
        const { data: enrollment } = await echelonMemberClient
            .from('member_program_enrollments')
            .select('start_date, program_templates(title, duration_weeks, webpage_url, pdf_url)')
            .eq('user_id', member.id)
            .eq('status', 'active')
            .order('start_date', { ascending: false })
            .limit(1)
            .maybeSingle();
        const template = enrollment?.program_templates;
        if (!template) { panel.textContent = 'Your coach hasn\'t assigned a program yet.'; return; }
        panel.replaceChildren();
        const card = document.createElement('div'); card.className = 'member-program-card';
        const info = document.createElement('div');
        const title = document.createElement('strong'); title.textContent = template.title;
        const meta = document.createElement('span'); meta.textContent = `${template.duration_weeks ? `${template.duration_weeks}-week program` : 'Program'} · started ${enrollment.start_date}`;
        info.append(title, meta);
        card.append(info);
        if (template.webpage_url || template.pdf_url) {
            const links = document.createElement('div'); links.className = 'member-program-links';
            if (template.webpage_url) { const view = document.createElement('a'); view.className = 'btn-secondary'; view.href = template.webpage_url; view.target = '_blank'; view.rel = 'noopener'; view.textContent = 'VIEW YOUR PROGRAM'; links.append(view); }
            if (template.pdf_url) { const dl = document.createElement('a'); dl.className = 'btn-secondary'; dl.href = template.pdf_url; dl.target = '_blank'; dl.rel = 'noopener'; dl.textContent = 'DOWNLOAD PDF'; links.append(dl); }
            card.append(links);
        }
        panel.append(card);
    }

    async function loadHub() {
        const [photos, messages] = await Promise.all([
            echelonMemberClient.from('member_progress_photos').select('storage_path, caption, taken_on, created_at').eq('user_id', member.id).order('taken_on', { ascending: false }).limit(12),
            echelonMemberClient.from('coach_messages').select('sender_id, message, created_at').or(`sender_id.eq.${member.id},recipient_id.eq.${member.id}`).order('created_at', { ascending: true }).limit(50),
            loadTodaysWork(),
            loadStreak(),
            loadYourProgram()
        ]);
        const photoList = document.getElementById('progress-photo-list'); photoList.replaceChildren();
        for (const photo of (photos.data || [])) { const urlResult = await echelonMemberClient.storage.from('progress-photos').createSignedUrl(photo.storage_path, 3600); if (!urlResult.data?.signedUrl) continue; const figure = document.createElement('figure'); const image = document.createElement('img'); image.src = urlResult.data.signedUrl; image.alt = photo.caption || `Progress photo from ${photo.taken_on}`; const caption = document.createElement('figcaption'); caption.textContent = `${photo.taken_on}${photo.caption ? ` · ${photo.caption}` : ''}`; figure.append(image, caption); photoList.append(figure); }
        const messageList = document.getElementById('coach-message-list'); messageList.replaceChildren(); let previousSpeaker = null;
        (messages.data || []).forEach(item => { const isMember = item.sender_id === member.id; const speaker = isMember ? 'YOU' : 'COACH LUTHER'; if (speaker !== previousSpeaker) { const separator = document.createElement('div'); separator.className = `message-separator ${isMember ? 'from-member' : 'from-coach'}`; const label = document.createElement('span'); label.textContent = speaker; separator.append(label); messageList.append(separator); previousSpeaker = speaker; } const bubble = document.createElement('article'); bubble.className = `message-bubble ${isMember ? 'from-member' : 'from-coach'}`; const meta = document.createElement('span'); meta.className = 'message-meta'; meta.textContent = `${speaker} · ${new Date(item.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`; const body = document.createElement('p'); body.textContent = item.message; bubble.append(meta, body); messageList.append(bubble); });
        if (!(messages.data || []).length) messageList.textContent = 'Start the conversation when you need support.';
    }
    await loadHub();
    photoForm.addEventListener('submit', async event => { event.preventDefault(); const file = photoForm.elements.photo.files[0]; const feedback = document.getElementById('photo-feedback'); if (!file || file.size > 8 * 1024 * 1024) { feedback.textContent = 'Choose a JPG, PNG, or WebP image under 8 MB.'; return; } const submit = photoForm.querySelector('button[type="submit"]'); const submitLabel = submit.textContent; submit.disabled = true; submit.textContent = 'UPLOADING…'; const extension = file.name.split('.').pop().toLowerCase(); const path = `${member.id}/${Date.now()}.${extension}`; const upload = await echelonMemberClient.storage.from('progress-photos').upload(path, file, { contentType: file.type, upsert: false }); if (upload.error) { feedback.textContent = 'Photo upload could not be completed.'; submit.disabled = false; submit.textContent = submitLabel; return; } const { error } = await echelonMemberClient.from('member_progress_photos').insert({ user_id: member.id, storage_path: path, taken_on: photoForm.elements.taken_on.value, caption: photoForm.elements.caption.value.trim() || null }); submit.disabled = false; submit.textContent = submitLabel; if (error) feedback.textContent = 'Photo saved, but the timeline could not update.'; else { photoForm.reset(); photoForm.elements.taken_on.value = today; showEchelonSuccess(feedback, 'PROGRESS CAPTURED', 'Your private photo is safely added to your Echelon timeline.'); loadHub(); } });
    document.getElementById('coach-message-form').addEventListener('submit', async event => { event.preventDefault(); const form = event.currentTarget; const message = form.elements.message.value.trim(); const submit = form.querySelector('button[type="submit"]'); const submitLabel = submit.textContent; submit.disabled = true; submit.textContent = 'SENDING…'; const coach = await echelonMemberClient.rpc('primary_echelon_admin'); const { error } = coach.error || !coach.data ? { error: true } : await echelonMemberClient.from('coach_messages').insert({ sender_id: member.id, recipient_id: coach.data, message }); const feedback = document.getElementById('message-feedback'); submit.disabled = false; submit.textContent = submitLabel; if (error) feedback.textContent = 'Message could not be sent.'; else { const forwarded = await forwardMemberMessage(message); form.reset(); showEchelonSuccess(feedback, 'MESSAGE DELIVERED', forwarded ? 'Your coach has your note and an email alert has been sent.' : 'Your message is safely in the private thread.'); loadHub(); } });
});
