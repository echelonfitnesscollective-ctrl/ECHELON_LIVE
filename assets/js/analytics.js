/*
 * CONVERSION TRACKING
 *
 * This helper is a safe no-op until a GA4 Measurement ID is installed.
 * To activate: add the standard gtag.js snippet (with your G-XXXXXXX ID)
 * to <head> on every page, before this script. Every call below will
 * start reaching GA4 automatically -- no other code changes needed.
 */
window.efcTrack = function efcTrack(eventName, params) {
    if (typeof window.gtag === 'function') {
        window.gtag('event', eventName, params || {});
    }
};
