document.addEventListener('DOMContentLoaded', () => {
    const programInterest = document.getElementById('program-interest');
    const selectedProgram = new URLSearchParams(window.location.search).get('program');
    const programMap = {
        '12-week-transformation': 'Transformation Coaching',
        '1-on-1-coaching': '1-On-1 Coaching',
        'private-group-training': 'Private Group Training / Organization Wellness',
        'organization-wellness': 'Private Group Training / Organization Wellness',
        // Matches the Training Hub cards' own data-program-key values -
        // that's the raw value applyProgramGate() puts in the CTA's
        // ?program= once a card goes live (see section-control.js), so
        // these need to stay in sync with index.html's data-program-key
        // attributes, not with what the card displays.
        'vl-body-lab': 'Kinetic Labs',
        'faith-favor-mobility': 'Faith & Favor Mobility'
    };

    if (programInterest && programMap[selectedProgram]) {
        programInterest.value = programMap[selectedProgram];
    }

    // Shows/hides both the static group-details field and any dynamic
    // application_questions fields this program doesn't need - see
    // EFC_PROGRAM_FIELD_ADJUSTMENTS in application-questions-renderer.js.
    // Runs again once the dynamic fields actually exist, from
    // site-intake.js's loadDynamicApplicationQuestions.
    const applyAdjustments = () => window.applyProgramFieldAdjustments?.(programInterest?.value || '');
    programInterest?.addEventListener('change', applyAdjustments);
    applyAdjustments();
});
