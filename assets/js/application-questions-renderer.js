// Shared question-set renderer for the two places prospects answer the same
// Echelon coaching-application question bank: the public application
// (pages/coaching-application.html) and an admin-assigned onboarding link
// (pages/onboarding-questions.html). Keeping the render logic in one place
// keeps the two forms in lockstep since they read the same
// application_questions rows.

function buildApplicationQuestionFields(questions, answers) {
    const fragment = document.createDocumentFragment();
    let currentSection = null;
    const answerMap = answers || {};

    (questions || []).forEach((question) => {
        if (question.section_label && question.section_label !== currentSection) {
            currentSection = question.section_label;
            const header = document.createElement('div');
            header.className = 'form-section-header';
            header.dataset.sectionLabel = currentSection;
            const heading = document.createElement('h2');
            heading.textContent = currentSection.toUpperCase();
            header.append(heading);
            fragment.append(header);
        }

        let field;
        if (question.field_type === 'select') {
            field = document.createElement('select');
            const placeholder = document.createElement('option');
            placeholder.value = '';
            placeholder.textContent = question.label;
            field.append(placeholder);
            (Array.isArray(question.options) ? question.options : []).forEach((optionValue) => {
                const option = document.createElement('option');
                option.textContent = optionValue;
                field.append(option);
            });
        } else if (question.field_type === 'textarea') {
            field = document.createElement('textarea');
            field.rows = 4;
            field.placeholder = question.label;
        } else {
            field = document.createElement('input');
            field.type = 'text';
            field.placeholder = question.label;
        }
        field.name = question.question_key;
        field.dataset.sectionLabel = question.section_label || '';
        field.setAttribute('aria-label', question.label);
        if (question.required) field.required = true;
        if (Object.prototype.hasOwnProperty.call(answerMap, question.question_key)) {
            field.value = answerMap[question.question_key] || '';
        }
        // Long questions clip inside a single-line placeholder on narrow
        // screens (placeholders never wrap), so plain text inputs get a
        // real label above them instead of relying on the placeholder alone.
        if (question.field_type !== 'select' && question.field_type !== 'textarea') {
            const label = document.createElement('label');
            label.textContent = question.label;
            field.removeAttribute('placeholder');
            fragment.append(label);
        }
        fragment.append(field);

        if (question.help_text) {
            const help = document.createElement('p');
            help.className = 'submit-note';
            help.textContent = question.help_text;
            fragment.append(help);
        }
    });

    return fragment;
}

window.buildApplicationQuestionFields = buildApplicationQuestionFields;

// Per-program adjustments to the shared application. Every program
// (1-on-1 Coaching, 12-Week Transformation, Private Group Training,
// and whatever gets added later - Kinetic Lab, Faith & Favor Mobility,
// a revived Group Training, etc.) answers the same question_key with
// the same meaning where it applies, but not every question fits
// every program's shape of applicant. Add an entry here - keyed by
// the exact <option> text in #program-interest - instead of hardcoding
// a one-off branch, so the next program is one object entry, not a
// rewrite of this logic.
//
// hideQuestionKeys: application_questions question_key values that
// don't apply to this program and should be hidden (and un-required)
// when it's selected.
// groupFieldsId: id of a static, program-specific field block already
// in the page markup (e.g. Private Group's org-details textarea) to
// show only for this program.
const EFC_PROGRAM_FIELD_ADJUSTMENTS = {
    'Private Group Training / Organization Wellness': {
        // An organization booking group sessions isn't answering about
        // their own personal fitness goal or their own training days -
        // group-experience-details (shown via groupFieldsId below)
        // already asks for group size, schedule, and what they want the
        // experience to accomplish.
        hideQuestionKeys: ['primary_goal', 'training_days_per_week'],
        groupFieldsId: 'group-experience-fields',
    },
};

function applyProgramFieldAdjustments(programValue) {
    // Not scoped to #dynamic-application-questions: that container is
    // itself replaceWith()-ed away once the dynamic fields render (see
    // loadDynamicApplicationQuestions in site-intake.js), so it no
    // longer exists in the DOM by the time this needs to query it.
    // Field names are unique on this page, so document is safe here.
    const root = document;
    const adjustments = EFC_PROGRAM_FIELD_ADJUSTMENTS[programValue];
    const activeHiddenKeys = new Set(adjustments?.hideQuestionKeys || []);
    const allHiddenKeys = new Set(
        Object.values(EFC_PROGRAM_FIELD_ADJUSTMENTS).flatMap((entry) => entry.hideQuestionKeys || [])
    );
    const allGroupFieldIds = new Set(
        Object.values(EFC_PROGRAM_FIELD_ADJUSTMENTS).map((entry) => entry.groupFieldsId).filter(Boolean)
    );

    // Static, program-specific field blocks already in the page markup.
    allGroupFieldIds.forEach((id) => {
        const block = document.getElementById(id);
        if (!block) return;
        const isActive = adjustments?.groupFieldsId === id;
        block.hidden = !isActive;
        block.querySelectorAll('textarea, input, select').forEach((field) => { field.disabled = !isActive; });
    });

    const touchedSections = new Set();
    allHiddenKeys.forEach((key) => {
        const field = root.querySelector(`[name="${key}"]`);
        if (!field) return;
        const shouldHide = activeHiddenKeys.has(key);
        const label = field.previousElementSibling?.tagName === 'LABEL' ? field.previousElementSibling : null;
        const help = field.nextElementSibling?.classList?.contains('submit-note') ? field.nextElementSibling : null;
        [label, field, help].forEach((el) => { if (el) el.hidden = shouldHide; });
        if (shouldHide) {
            if (field.required) field.dataset.wasRequired = 'true';
            field.required = false;
            field.disabled = true;
        } else {
            field.disabled = false;
            if (field.dataset.wasRequired === 'true') field.required = true;
        }
        if (field.dataset.sectionLabel) touchedSections.add(field.dataset.sectionLabel);
    });

    // A section whose every question just got hidden shouldn't leave its
    // header floating above nothing.
    touchedSections.forEach((sectionLabel) => {
        const header = root.querySelector(`.form-section-header[data-section-label="${CSS.escape(sectionLabel)}"]`);
        if (!header) return;
        const hasVisibleField = [...root.querySelectorAll(`[data-section-label="${CSS.escape(sectionLabel)}"]`)]
            .some((el) => el !== header && !el.hidden && (el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA'));
        header.hidden = !hasVisibleField;
    });
}

window.applyProgramFieldAdjustments = applyProgramFieldAdjustments;
