document.addEventListener('DOMContentLoaded', async () => {
    const form = document.getElementById('member-onboarding-form');
    if (!form) return;

    const member = await requireMemberSession();
    if (!member) return;

    const feedback = document.getElementById('member-onboarding-feedback');
    const submitButton = form.querySelector('button[type="submit"]');

    const { data: savedRecord } = await echelonMemberClient
        .from('member_onboarding')
        .select('parq, health_history')
        .eq('user_id', member.id)
        .maybeSingle();

    if (savedRecord) {
        Object.entries({ ...savedRecord.parq, ...savedRecord.health_history }).forEach(([name, value]) => {
            const field = form.elements[name];
            if (field && typeof value === 'string') field.value = value;
        });
    }

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        feedback.textContent = '';
        submitButton.disabled = true;
        submitButton.textContent = 'SAVING...';

        const parq = {
            heart_condition: form.elements.heart_condition.value,
            heart_medication: form.elements.heart_medication.value,
            chest_pain_activity: form.elements.chest_pain_activity.value,
            dizziness_or_fainting: form.elements.dizziness_or_fainting.value,
            bone_joint_tissue: form.elements.bone_joint_tissue.value,
            recent_chest_pain: form.elements.recent_chest_pain.value,
            other_activity_concern: form.elements.other_activity_concern.value
        };

        const healthHistory = {
            current_injuries_or_limitations: form.elements.current_injuries_or_limitations.value,
            medications_or_conditions: form.elements.medications_or_conditions.value,
            allergies: form.elements.allergies.value,
            surgeries_or_hospitalizations: form.elements.surgeries_or_hospitalizations.value,
            pregnancy_or_postpartum: form.elements.pregnancy_or_postpartum.value,
            emergency_contact: form.elements.emergency_contact.value,
            health_notes: form.elements.health_notes.value
        };

        const { error } = await echelonMemberClient
            .from('member_onboarding')
            .upsert({
                user_id: member.id,
                parq,
                health_history: healthHistory,
                acknowledged_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            }, { onConflict: 'user_id' });

        if (error) {
            feedback.textContent = 'We could not save your onboarding. Please try again or contact Echelon.';
            submitButton.disabled = false;
            submitButton.textContent = 'SAVE ONBOARDING';
            return;
        }

        showEchelonSuccess(feedback, 'ONBOARDING SAVED', 'Your information is securely on file. Your coach can now prepare for your first steps with Echelon.');
        submitButton.disabled = false;
        submitButton.textContent = 'SAVE ONBOARDING';
    });
});
