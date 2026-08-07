document.addEventListener('DOMContentLoaded', async () => {
    const member = await requireMemberSession();
    if (!member) return;
    const today = new Date().toISOString().slice(0, 10);
    const photoForm = document.getElementById('progress-photo-form');
    photoForm.elements.taken_on.value = today;

    let showPregnancyMods = false;
    const pregnancyToggle = document.getElementById('pregnancy-toggle-input');
    if (pregnancyToggle) {
        const { data: profile } = await echelonMemberClient.from('member_training_profiles').select('pregnant_or_postpartum').eq('user_id', member.id).maybeSingle();
        showPregnancyMods = !!profile?.pregnant_or_postpartum;
        pregnancyToggle.checked = showPregnancyMods;
        pregnancyToggle.addEventListener('change', async () => {
            showPregnancyMods = pregnancyToggle.checked;
            await echelonMemberClient.from('member_training_profiles').upsert({ user_id: member.id, pregnant_or_postpartum: showPregnancyMods }, { onConflict: 'user_id' });
            loadTodaysWork();
        });
    }

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
    const todaysWorkPrevBtn = document.getElementById('todays-work-prev');
    const todaysWorkNextBtn = document.getElementById('todays-work-next');
    const todaysWorkPosition = document.getElementById('todays-work-position');

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
        list.replaceChildren(buildDaySlide(assignment));
        if (todaysWorkPosition) {
            const isToday = assignment.assigned_date === today;
            todaysWorkPosition.textContent = `${isToday ? 'TODAY' : assignment.assigned_date} · ${todaysWorkIndex + 1} of ${todaysWorkAssignments.length}`;
        }
        if (todaysWorkPrevBtn) todaysWorkPrevBtn.disabled = todaysWorkIndex === 0;
        if (todaysWorkNextBtn) todaysWorkNextBtn.disabled = todaysWorkIndex === todaysWorkAssignments.length - 1;
    }

    if (todaysWorkPrevBtn) todaysWorkPrevBtn.addEventListener('click', () => { if (todaysWorkIndex > 0) { todaysWorkIndex -= 1; renderTodaysWorkSlide(); } });
    if (todaysWorkNextBtn) todaysWorkNextBtn.addEventListener('click', () => { if (todaysWorkIndex < todaysWorkAssignments.length - 1) { todaysWorkIndex += 1; renderTodaysWorkSlide(); } });

    async function loadTodaysWork() {
        const list = document.getElementById('todays-work-list');
        if (!list) return;
        const previouslyViewedDate = todaysWorkAssignments[todaysWorkIndex]?.assigned_date;
        const { data, error } = await echelonMemberClient
            .from('member_daily_workouts')
            .select('id, assigned_date, status, coach_note, workouts(title, category, description, setting, workout_exercises(sort_order, sets, reps, rest_seconds, notes, exercise_library(name, target_area, form_cues, coaching_cues, modification_up, modification_down, modification_pregnancy, video_url)))')
            .eq('user_id', member.id)
            .gte('assigned_date', today)
            .order('assigned_date', { ascending: true })
            .order('sort_order', { foreignTable: 'workouts.workout_exercises', ascending: true })
            .limit(14);
        if (error || !(data || []).length) { todaysWorkAssignments = []; todaysWorkIndex = 0; renderTodaysWorkSlide(); return; }
        todaysWorkAssignments = data;
        const keepIndex = previouslyViewedDate ? data.findIndex(a => a.assigned_date === previouslyViewedDate) : -1;
        const todayIndex = data.findIndex(a => a.assigned_date === today);
        todaysWorkIndex = keepIndex !== -1 ? keepIndex : (todayIndex !== -1 ? todayIndex : 0);
        renderTodaysWorkSlide();
    }

    async function loadHub() {
        const [photos, messages] = await Promise.all([
            echelonMemberClient.from('member_progress_photos').select('storage_path, caption, taken_on, created_at').eq('user_id', member.id).order('taken_on', { ascending: false }).limit(12),
            echelonMemberClient.from('coach_messages').select('sender_id, message, created_at').or(`sender_id.eq.${member.id},recipient_id.eq.${member.id}`).order('created_at', { ascending: true }).limit(50),
            loadTodaysWork()
        ]);
        const photoList = document.getElementById('progress-photo-list'); photoList.replaceChildren();
        for (const photo of (photos.data || [])) { const urlResult = await echelonMemberClient.storage.from('progress-photos').createSignedUrl(photo.storage_path, 3600); if (!urlResult.data?.signedUrl) continue; const figure = document.createElement('figure'); const image = document.createElement('img'); image.src = urlResult.data.signedUrl; image.alt = photo.caption || `Progress photo from ${photo.taken_on}`; const caption = document.createElement('figcaption'); caption.textContent = `${photo.taken_on}${photo.caption ? ` · ${photo.caption}` : ''}`; figure.append(image, caption); photoList.append(figure); }
        const messageList = document.getElementById('coach-message-list'); messageList.replaceChildren(); let previousSpeaker = null;
        (messages.data || []).forEach(item => { const isMember = item.sender_id === member.id; const speaker = isMember ? 'YOU' : 'COACH LUTHER'; if (speaker !== previousSpeaker) { const separator = document.createElement('div'); separator.className = `message-separator ${isMember ? 'from-member' : 'from-coach'}`; const label = document.createElement('span'); label.textContent = speaker; separator.append(label); messageList.append(separator); previousSpeaker = speaker; } const bubble = document.createElement('article'); bubble.className = `message-bubble ${isMember ? 'from-member' : 'from-coach'}`; const meta = document.createElement('span'); meta.className = 'message-meta'; meta.textContent = `${speaker} · ${new Date(item.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`; const body = document.createElement('p'); body.textContent = item.message; bubble.append(meta, body); messageList.append(bubble); });
        if (!(messages.data || []).length) messageList.textContent = 'Start the conversation when you need support.';
    }
    await loadHub();
    photoForm.addEventListener('submit', async event => { event.preventDefault(); const file = photoForm.elements.photo.files[0]; const feedback = document.getElementById('photo-feedback'); if (!file || file.size > 8 * 1024 * 1024) { feedback.textContent = 'Choose a JPG, PNG, or WebP image under 8 MB.'; return; } const extension = file.name.split('.').pop().toLowerCase(); const path = `${member.id}/${Date.now()}.${extension}`; const upload = await echelonMemberClient.storage.from('progress-photos').upload(path, file, { contentType: file.type, upsert: false }); if (upload.error) { feedback.textContent = 'Photo upload could not be completed.'; return; } const { error } = await echelonMemberClient.from('member_progress_photos').insert({ user_id: member.id, storage_path: path, taken_on: photoForm.elements.taken_on.value, caption: photoForm.elements.caption.value.trim() || null }); if (error) feedback.textContent = 'Photo saved, but the timeline could not update.'; else { photoForm.reset(); photoForm.elements.taken_on.value = today; showEchelonSuccess(feedback, 'PROGRESS CAPTURED', 'Your private photo is safely added to your Echelon timeline.'); loadHub(); } });
    document.getElementById('coach-message-form').addEventListener('submit', async event => { event.preventDefault(); const form = event.currentTarget; const message = form.elements.message.value.trim(); const coach = await echelonMemberClient.rpc('primary_echelon_admin'); const { error } = coach.error || !coach.data ? { error: true } : await echelonMemberClient.from('coach_messages').insert({ sender_id: member.id, recipient_id: coach.data, message }); const feedback = document.getElementById('message-feedback'); if (error) feedback.textContent = 'Message could not be sent.'; else { const forwarded = await forwardMemberMessage(message); form.reset(); showEchelonSuccess(feedback, 'MESSAGE DELIVERED', forwarded ? 'Your coach has your note and an email alert has been sent.' : 'Your message is safely in the private thread.'); loadHub(); } });
});
