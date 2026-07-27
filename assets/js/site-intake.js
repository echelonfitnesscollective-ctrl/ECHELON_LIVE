const EFC_SITE_SUPABASE_URL = 'https://plkdyvtriajpzcfgtwzp.supabase.co';
const EFC_SITE_SUPABASE_KEY = 'sb_publishable_CwFNrWSrhLKURZIk_-yt1A_ZVpFHEwf';
const echelonSiteClient = window.supabase.createClient(EFC_SITE_SUPABASE_URL, EFC_SITE_SUPABASE_KEY);

function formValues(form) {
    return Object.fromEntries(new FormData(form).entries());
}

function setCheckinValue(form, fieldName, value) {
    const field = form.elements[fieldName];
    if (field && value && !field.value) field.value = value;
}

async function prefillMemberCheckin(form) {
    const memberNote = document.getElementById('member-checkin-note');
    const requestedProgram = new URLSearchParams(window.location.search).get('program');
    if (requestedProgram && form.elements.program) {
        const matchingOption = Array.from(form.elements.program.options)
            .find((option) => option.value.toLowerCase() === requestedProgram.toLowerCase());
        if (matchingOption) form.elements.program.value = matchingOption.value;
    }

    const { data: { user } } = await echelonSiteClient.auth.getUser();
    if (!user) return;

    const [profileResult, onboardingResult] = await Promise.all([
        echelonSiteClient.from('member_profiles').select('full_name, email, phone').eq('user_id', user.id).maybeSingle(),
        echelonSiteClient.from('member_onboarding').select('health_history').eq('user_id', user.id).maybeSingle()
    ]);
    const profile = profileResult.data || {};
    const healthHistory = onboardingResult.data?.health_history || {};

    setCheckinValue(form, 'full_name', profile.full_name || user.user_metadata?.full_name);
    setCheckinValue(form, 'email', profile.email || user.email);
    setCheckinValue(form, 'phone', profile.phone || user.phone || user.user_metadata?.phone);
    setCheckinValue(form, 'emergency_contact', healthHistory.emergency_contact);
    if (form.elements.first_time && !form.elements.first_time.value) form.elements.first_time.value = "No I've trained before!";

    if (memberNote) {
        memberNote.hidden = false;
        memberNote.textContent = 'MEMBER DETAILS LOADED — confirm your session information, then submit your check-in.';
    }
}

async function sendFormspreeCopy(form) {
    try {
        await fetch(form.action, {
            method: 'POST',
            body: new FormData(form),
            headers: { Accept: 'application/json' }
        });
    } catch {
        // The console copy is the source of truth; email delivery is secondary.
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const coachingForm = document.getElementById('coaching-form');
    if (coachingForm) {
        const feedback = document.getElementById('coaching-form-feedback');
        const submitButton = coachingForm.querySelector('button[type="submit"]');
        coachingForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            submitButton.disabled = true;
            submitButton.textContent = 'SUBMITTING…';
            feedback.textContent = '';

            const values = formValues(coachingForm);
            let submitResult;
            try {
                const response = await fetch('/api/coaching-application/submit', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(values)
                });
                submitResult = await response.json();
                if (!response.ok) throw new Error(submitResult.error || 'Submission failed.');
            } catch (error) {
                feedback.textContent = error.message === 'Too many requests. Please wait a minute and try again.'
                    ? error.message
                    : 'We could not save your application. Please try again.';
                submitButton.disabled = false;
                submitButton.textContent = 'SUBMIT APPLICATION';
                return;
            }

            await sendFormspreeCopy(coachingForm);
            const isPrivateGroup = values.program_interest === 'Private Group Training / Organization Wellness';
            window.efcTrack?.(isPrivateGroup ? 'private_group_inquiry_submit' : 'coaching_application_submit', { program_interest: values.program_interest });
            coachingForm.reset();
            showEchelonSuccess(feedback, 'APPLICATION RECEIVED', 'Your request is securely with Echelon. We will personally review it and reach out within 24–72 hours.');
            submitButton.disabled = false;
            submitButton.textContent = 'SUBMIT APPLICATION';
        });
    }

    const checkinForm = document.getElementById('checkin-form');
    if (checkinForm) {
        const success = document.getElementById('success-message');
        const submitButton = checkinForm.querySelector('button[type="submit"]');
        prefillMemberCheckin(checkinForm).catch(() => {
            // Public guests can still submit when no member profile is available.
        });
        checkinForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            submitButton.disabled = true;
            submitButton.textContent = 'SAVING…';
            const values = formValues(checkinForm);
            const { error } = await echelonSiteClient.from('session_checkins').insert({
                full_name: values.full_name,
                email: values.email,
                phone: values.phone,
                program: values.program,
                first_time: values.first_time,
                emergency_contact: values.emergency_contact,
                coach_note: values.coach_note,
                waiver_agreed: values.waiver_agreed === 'YES'
            });

            if (error) {
                submitButton.disabled = false;
                submitButton.textContent = 'COMPLETE CHECK-IN';
                alert('We could not save your check-in. Please try again.');
                return;
            }

            checkinForm.reset();
            checkinForm.style.display = 'none';
            window.efcTrack?.('checkin_complete', { program: values.program });
            showEchelonSuccess(success, 'CHECK-IN COMPLETE', 'You are confirmed for today. Arrive ready to work — your coach will take it from here.', { onDismiss: () => { checkinForm.style.display = ''; submitButton.disabled = false; submitButton.textContent = 'COMPLETE CHECK-IN'; } });
        });
    }

    const contactForm = document.getElementById('contact-form');
    if (contactForm) {
        const feedback = document.getElementById('contact-form-feedback');
        const submitButton = contactForm.querySelector('button[type="submit"]');
        contactForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            submitButton.disabled = true;
            submitButton.textContent = 'SENDING…';
            feedback.textContent = '';
            const values = formValues(contactForm);
            try {
                const response = await fetch('/api/contact/submit', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(values)
                });
                const result = await response.json();
                if (!response.ok) throw new Error(result.error || 'Submission failed.');
            } catch (error) {
                feedback.textContent = error.message === 'Too many requests. Please wait a minute and try again.'
                    ? error.message
                    : 'We could not send your request. Please try again.';
                submitButton.disabled = false;
                submitButton.textContent = 'SUBMIT REQUEST';
                return;
            }
            await sendFormspreeCopy(contactForm);
            contactForm.reset();
            showEchelonSuccess(feedback, 'MESSAGE RECEIVED', 'Thank you for reaching out. An Echelon team member will be in touch shortly.');
            submitButton.disabled = false;
            submitButton.textContent = 'SUBMIT REQUEST';
        });
    }

    const waitlistForm = document.getElementById('waitlist-form');
    if (waitlistForm) {
        const success = document.getElementById('waitlist-success');
        const submitButton = waitlistForm.querySelector('button[type="submit"]');
        waitlistForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            submitButton.disabled = true;
            submitButton.textContent = 'JOINING…';
            const values = formValues(waitlistForm);
            const { error } = await echelonSiteClient.from('website_leads').insert({
                lead_type: 'Waitlist',
                full_name: values.full_name,
                email: values.email,
                phone: values.phone,
                category: values.interest,
                message: values.notes,
                source_data: values
            });
            if (error) {
                submitButton.disabled = false;
                submitButton.textContent = 'JOIN THE WAITLIST';
                alert('We could not save your waitlist entry. Please try again.');
                return;
            }
            waitlistForm.reset();
            waitlistForm.style.display = 'none';
            window.efcTrack?.('waitlist_join', { interest: values.interest });
            showEchelonSuccess(success, 'YOU’RE ON THE LIST', 'Your place is secured. You will be among the first to hear about new Echelon opportunities.', { onDismiss: () => { waitlistForm.style.display = ''; submitButton.disabled = false; submitButton.textContent = 'JOIN THE WAITLIST'; } });
        });
    }
});
