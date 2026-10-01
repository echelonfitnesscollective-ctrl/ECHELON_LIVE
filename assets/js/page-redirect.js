// Thin compatibility shim: the root-level .html files that load this
// (e.g. /member-onboarding.html) are old flat-URL bookmarks/links from
// before the site reorganized real content under /pages/ - each one is
// otherwise identical, just redirecting to its own same-named file
// under pages/, so one shared script replaces what used to be 16
// near-identical inline <script> blocks (and lets the CSP drop
// 'unsafe-inline' entirely). Preserves any query string/hash so a link
// like /checkin.html?source=qr still lands correctly.
location.replace('pages/' + location.pathname.split('/').pop() + location.search + location.hash);
