// Privacy-friendly counter: no cookies, no IDs stored in the browser. Sends only the event type,
// which button, and (for visits) the referring site's host name. Skipped entirely when the browser
// sends Do Not Track / Global Privacy Control, or on the owner's own browser (see owner page).
import config from '../site.config.json';

const EP = String(config.analyticsEndpoint || '').replace(/\/$/, '');
let skip = false;
try {
  skip = navigator.doNotTrack === '1' || window.doNotTrack === '1' || navigator.globalPrivacyControl === true || localStorage.getItem('bs-owner') === '1';
} catch { /* storage blocked: count normally */ }

export function track(t, p = '', r = '') {
  if (!EP || skip) return;
  const body = JSON.stringify({ t, p, r });
  try {
    if (navigator.sendBeacon && navigator.sendBeacon(EP + '/e', new Blob([body], { type: 'text/plain' }))) return;
    fetch(EP + '/e', { method: 'POST', body, keepalive: true, mode: 'cors', credentials: 'omit', headers: { 'Content-Type': 'text/plain' } }).catch(() => {});
  } catch { /* never break the page for analytics */ }
}

const place = (a) => (a.closest('.mbar') ? 'bar' : a.closest('header') ? 'header' : a.closest('.stage, .hero-track') ? 'hero' : a.closest('footer') ? 'footer' : 'page');

if (EP && !skip) {
  let ref = '';
  try { const h = new URL(document.referrer).hostname.replace(/^www\./, '').toLowerCase(); if (h && h !== location.hostname) ref = h; } catch { /* no referrer */ }
  track('view', '', ref);

  const onClick = (e) => {
    const a = e.target.closest && e.target.closest('a');
    if (!a) return;
    const h = a.getAttribute('href') || '';
    if (/^tel:/i.test(h)) track('call', place(a));
    else if (/^sms:/i.test(h)) track('text', place(a));
    else if (/^mailto:/i.test(h)) track('email', place(a));
    else if (/buy\.stripe\.com/i.test(h)) track('pay', (a.closest('.price-card') || {}).id || 'unknown');
    else if (/maps\.app\.goo\.gl|google\.com\/maps/i.test(h)) track('google', place(a));
    else if (/facebook\.com/i.test(h)) track('facebook', place(a));
    else if (a.dataset.service) track('request', a.dataset.service);
    else if (h === '#book') track('request', 'book-' + place(a));
  };
  document.addEventListener('click', onClick);
  document.addEventListener('auxclick', (e) => { if (e.button === 1) onClick(e); });
}
