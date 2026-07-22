const EFC_WAIVER_VERSION = 'EFC-waiver-v1.0-draft';

document.addEventListener('DOMContentLoaded', async () => {
    const form = document.getElementById('member-waiver-form');
    if (!form) return;

    const member = await requireMemberSession();
    if (!member) return;

    const feedback = document.getElementById('member-waiver-feedback');
    const submitButton = form.querySelector('button[type="submit"]');
    const { data: savedWaiver } = await echelonMemberClient
        .from('member_waivers')
        .select('full_name, signed_at')
        .eq('user_id', member.id)
        .maybeSingle();

    if (savedWaiver) {
        form.elements.full_name.value = savedWaiver.full_name;
        form.elements.read_agreement.checked = true;
        form.elements.electronic_consent.checked = true;
        feedback.textContent = `Previously signed on ${new Date(savedWaiver.signed_at).toLocaleString()}. You may resave if your information changes.`;
    }

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        feedback.textContent = '';
        submitButton.disabled = true;
        submitButton.textContent = 'SAVING…';

        const { error } = await echelonMemberClient
            .from('member_waivers')
            .upsert({
                user_id: member.id,
                full_name: form.elements.full_name.value.trim(),
                agreement_version: EFC_WAIVER_VERSION,
                electronic_consent: form.elements.electronic_consent.checked,
                signed_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            }, { onConflict: 'user_id' });

        if (error) {
            feedback.textContent = 'We could not save your waiver. Please try again or contact Echelon.';
            submitButton.disabled = false;
            submitButton.textContent = 'SIGN & SAVE WAIVER';
            return;
        }

        showEchelonSuccess(feedback, 'WAIVER COMPLETE', 'Your participation agreement is securely on file. You are one step closer to training with Echelon.');
        submitButton.disabled = false;
        submitButton.textContent = 'SIGN & SAVE WAIVER';
    });
});
