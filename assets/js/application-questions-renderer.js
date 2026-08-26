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
        field.setAttribute('aria-label', question.label);
        if (question.required) field.required = true;
        if (Object.prototype.hasOwnProperty.call(answerMap, question.question_key)) {
            field.value = answerMap[question.question_key] || '';
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
