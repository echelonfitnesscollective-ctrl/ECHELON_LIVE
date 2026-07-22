function hubNumber(value) { return value === '' ? null : Number(value); }
function hubLine(container, text, className) { const item = document.createElement('article'); item.className = className || 'coaching-history-item'; item.textContent = text; container.append(item); }

document.addEventListener('DOMContentLoaded', async () => {
    const member = await requireMemberSession();
    if (!member) return;
    const today = new Date().toISOString().slice(0, 10);
    const nutritionForm = document.getElementById('nutrition-log-form');
    const photoForm = document.getElementById('progress-photo-form');
    nutritionForm.elements.log_date.value = today; photoForm.elements.taken_on.value = today;

    async function loadHub() {
        const [nutrition, plans, photos, messages] = await Promise.all([
            echelonMemberClient.from('member_nutrition_logs').select('log_date, calories, protein_grams, carbs_grams, fat_grams').eq('user_id', member.id).order('log_date', { ascending: false }).limit(7),
            echelonMemberClient.from('member_workout_plans').select('title, coach_note, plan_text, week_of, status, created_at').eq('user_id', member.id).eq('status', 'Active').order('created_at', { ascending: false }).limit(3),
            echelonMemberClient.from('member_progress_photos').select('storage_path, caption, taken_on, created_at').eq('user_id', member.id).order('taken_on', { ascending: false }).limit(12),
            echelonMemberClient.from('coach_messages').select('sender_id, message, created_at').or(`sender_id.eq.${member.id},recipient_id.eq.${member.id}`).order('created_at', { ascending: true }).limit(50)
        ]);
        const nutritionList = document.getElementById('nutrition-history'); nutritionList.replaceChildren();
        (nutrition.data || []).forEach(item => hubLine(nutritionList, `${item.log_date} · ${item.calories ?? '—'} cal · P ${item.protein_grams ?? '—'}g · C ${item.carbs_grams ?? '—'}g · F ${item.fat_grams ?? '—'}g`));
        const planList = document.getElementById('member-workout-plans'); planList.replaceChildren();
        (plans.data || []).forEach(plan => { const item = document.createElement('article'); item.className = 'workout-plan-card'; const heading = document.createElement('h3'); heading.textContent = plan.title; const note = document.createElement('p'); note.textContent = plan.coach_note || ''; const text = document.createElement('pre'); text.textContent = plan.plan_text; item.append(heading, note, text); planList.append(item); });
        if (!(plans.data || []).length) planList.textContent = 'Your coach has not assigned a plan yet.';
        const photoList = document.getElementById('progress-photo-list'); photoList.replaceChildren();
        for (const photo of (photos.data || [])) { const urlResult = await echelonMemberClient.storage.from('progress-photos').createSignedUrl(photo.storage_path, 3600); if (!urlResult.data?.signedUrl) continue; const figure = document.createElement('figure'); const image = document.createElement('img'); image.src = urlResult.data.signedUrl; image.alt = photo.caption || `Progress photo from ${photo.taken_on}`; const caption = document.createElement('figcaption'); caption.textContent = `${photo.taken_on}${photo.caption ? ` · ${photo.caption}` : ''}`; figure.append(image, caption); photoList.append(figure); }
        const messageList = document.getElementById('coach-message-list'); messageList.replaceChildren();
        (messages.data || []).forEach(item => { const bubble = document.createElement('article'); bubble.className = `message-bubble ${item.sender_id === member.id ? 'from-member' : 'from-coach'}`; bubble.textContent = item.message; messageList.append(bubble); });
        if (!(messages.data || []).length) messageList.textContent = 'Start the conversation when you need support.';
    }
    await loadHub();
    nutritionForm.addEventListener('submit', async event => { event.preventDefault(); const data = Object.fromEntries(new FormData(nutritionForm).entries()); const { error } = await echelonMemberClient.from('member_nutrition_logs').upsert({ user_id: member.id, log_date: data.log_date, calories: hubNumber(data.calories), protein_grams: hubNumber(data.protein_grams), carbs_grams: hubNumber(data.carbs_grams), fat_grams: hubNumber(data.fat_grams), water_ounces: hubNumber(data.water_ounces), notes: data.notes || null, updated_at: new Date().toISOString() }, { onConflict: 'user_id,log_date' }); const feedback = document.getElementById('nutrition-feedback'); if (error) feedback.textContent = 'Nutrition log could not be saved.'; else { showEchelonSuccess(feedback, 'NUTRITION LOGGED', 'Today’s inputs are recorded. Consistency compounds.'); loadHub(); } });
    photoForm.addEventListener('submit', async event => { event.preventDefault(); const file = photoForm.elements.photo.files[0]; const feedback = document.getElementById('photo-feedback'); if (!file || file.size > 8 * 1024 * 1024) { feedback.textContent = 'Choose a JPG, PNG, or WebP image under 8 MB.'; return; } const extension = file.name.split('.').pop().toLowerCase(); const path = `${member.id}/${Date.now()}.${extension}`; const upload = await echelonMemberClient.storage.from('progress-photos').upload(path, file, { contentType: file.type, upsert: false }); if (upload.error) { feedback.textContent = 'Photo upload could not be completed.'; return; } const { error } = await echelonMemberClient.from('member_progress_photos').insert({ user_id: member.id, storage_path: path, taken_on: photoForm.elements.taken_on.value, caption: photoForm.elements.caption.value.trim() || null }); if (error) feedback.textContent = 'Photo saved, but the timeline could not update.'; else { photoForm.reset(); photoForm.elements.taken_on.value = today; showEchelonSuccess(feedback, 'PROGRESS CAPTURED', 'Your private photo is safely added to your Echelon timeline.'); loadHub(); } });
    document.getElementById('coach-message-form').addEventListener('submit', async event => { event.preventDefault(); const form = event.currentTarget; const coach = await echelonMemberClient.rpc('primary_echelon_admin'); const { error } = coach.error || !coach.data ? { error: true } : await echelonMemberClient.from('coach_messages').insert({ sender_id: member.id, recipient_id: coach.data, message: form.elements.message.value.trim() }); const feedback = document.getElementById('message-feedback'); if (error) feedback.textContent = 'Message could not be sent.'; else { form.reset(); showEchelonSuccess(feedback, 'MESSAGE DELIVERED', 'Your coach has your note and can respond in your private thread.'); loadHub(); } });
});
