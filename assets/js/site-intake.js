const EFC_SITE_SUPABASE_URL = 'https://plkdyvtriajpzcfgtwzp.supabase.co';
const EFC_SITE_SUPABASE_KEY = 'sb_publishable_CwFNrWSrhLKURZIk_-yt1A_ZVpFHEwf';
const echelonSiteClient = window.supabase.createClient(EFC_SITE_SUPABASE_URL, EFC_SITE_SUPABASE_KEY);

function formValues(form) {
    return Object.fromEntries(new FormData(form).entries());
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
            const { error } = await echelonSiteClient.from('coaching_applications').insert({
                full_name: values.full_name,
                email: values.email,
                phone: values.phone,
                program_interest: values.program_interest,
                application_data: values
            });

            if (error) {
                feedback.textContent = 'We could not save your application. Please try again.';
                submitButton.disabled = false;
                submitButton.textContent = 'SUBMIT APPLICATION';
                return;
            }

            await sendFormspreeCopy(coachingForm);
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

            checkinForm.style.display = 'none';
            showEchelonSuccess(success, 'CHECK-IN COMPLETE', 'You are confirmed for today. Arrive ready to work — your coach will take it from here.');
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
            const { error } = await echelonSiteClient.from('website_leads').insert({
                lead_type: 'Contact request',
                full_name: values.name,
                email: values.email,
                category: values.inquiry_type,
                message: values.message,
                source_data: values
            });
            if (error) {
                feedback.textContent = 'We could not send your request. Please try again.';
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
            waitlistForm.style.display = 'none';
            showEchelonSuccess(success, 'YOU’RE ON THE LIST', 'Your place is secured. You will be among the first to hear about new Echelon opportunities.');
        });
    }
});
