document.addEventListener('DOMContentLoaded', () => {
    const config = window.ECHELON_CALENDAR_CONFIG || {};
    const type = new URLSearchParams(window.location.search).get('type') || 'one-on-one';
    const offers = {
        'one-on-one': {
            title: '1-ON-1 COACHING',
            detail: 'Your private link displays only released Echelon coaching windows.',
            url: config.oneOnOneUrl
        },
        'private-group': {
            title: 'PRIVATE GROUP TRAINING',
            detail: 'Your organizer link displays only designated Echelon event windows.',
            url: config.privateGroupUrl
        },
        'discovery-call': {
            title: 'ECHELON DISCOVERY CALL',
            detail: 'Choose a short conversation window to determine the best Echelon lane.',
            url: config.discoveryCallUrl
        }
    };
    const offer = offers[type] || offers['one-on-one'];
    const title = document.querySelector('[data-booking-title]');
    const detail = document.querySelector('[data-booking-detail]');
    const action = document.querySelector('[data-booking-action]');
    const status = document.querySelector('[data-booking-status]');
    if (title) title.textContent = offer.title;
    if (detail) detail.textContent = offer.detail;
    if (offer.url && action) {
        action.href = offer.url;
        action.hidden = false;
        action.textContent = 'OPEN PRIVATE CALENDAR →';
    } else if (status) {
        status.hidden = false;
    }
});
