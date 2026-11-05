import '@fontsource/inter-tight/400.css';
import '@fontsource/inter-tight/500.css';
import '@fontsource/inter-tight/600.css';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import './styles.css';
import config from '../site.config.json';
import { track } from './track.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const root = document.documentElement;

/* ---------- mobile menu ---------- */
(() => {
  const btn = $('.menu-btn'), nav = $('#nav');
  if (!btn || !nav) return;
  const set = open => { nav.classList.toggle('open', open); btn.setAttribute('aria-expanded', String(open)); };
  btn.addEventListener('click', () => set(!nav.classList.contains('open')));
  nav.addEventListener('click', e => { if (e.target.closest('a')) set(false); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && nav.classList.contains('open')) { set(false); btn.focus(); } });
})();

/* ---------- cookie settings dialog ---------- */
(() => {
  const dlg = $('#cookie-dialog');
  if (!dlg) return;
  $$('[data-cookie-settings]').forEach(b => b.addEventListener('click', () => dlg.showModal()));
  $('#ck-close')?.addEventListener('click', () => dlg.close());
  dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });
})();

/* ---------- contact details (only shown when provided in site.config.json) ---------- */
(() => {
  const list = $('#contact-list'); if (!list) return;
  const show = (id, href, text) => { const li = $(id); if (!li) return; const a = $('a', li); a.href = href; a.textContent = text; li.hidden = false; list.hidden = false; };
  if (config.phone) show('#contact-phone', 'tel:' + config.phone.replace(/[^\d+]/g, ''), config.phone);
  if (config.email) show('#contact-email', 'mailto:' + config.email, config.email);
  if (config.phone) {
    const tel = '+1' + config.phone.replace(/\D/g, '').slice(-10);
    const c = $('#mb-call'); if (c) c.href = 'tel:' + tel;
    const x = $('#mb-text'); if (x) x.href = 'sms:' + tel + '?&body=' + encodeURIComponent("Hi, I'd like a quote from B's Supa Clean Cars.");
  }
})();

/* ---------- Google profile link and rating (values come from site.config.json) ---------- */
(() => {
  if (config.googleProfileUrl) $$('#google-link,[data-google-link]').forEach(a => { a.href = config.googleProfileUrl; });
  if (config.facebookUrl) $$('[data-facebook-link]').forEach(a => { a.href = config.facebookUrl; });
  if (config.rating && $('#rating-num')) $('#rating-num').textContent = Number(config.rating).toFixed(1);
  if (config.rating) $$('.js-rating').forEach(n => { n.textContent = Number(config.rating).toFixed(1); });
  if (config.reviewCount && $('#review-count')) $('#review-count').textContent = String(config.reviewCount);
})();

/* ---------- gallery lightbox ---------- */
(() => {
  const dlg = $('#lightbox'); if (!dlg) return;
  const shots = $$('.shot');
  const items = shots.map(b => {
    const img = $('img', b), base = img.getAttribute('src').replace(/-\d+\.webp$/, '').replace('./img/', '');
    const ws = base === 'chevy-after' ? [480, 800] : [480, 800, 1200];
    return {
      alt: img.alt,
      src: `./img/${base}-${ws[ws.length - 1]}.webp`,
      srcset: ws.map(w => `./img/${base}-${w}.webp ${w}w`).join(', '),
      cap: `${b.closest('figure').querySelector('figcaption').textContent} · ${$('.tag', b).textContent}`,
    };
  });
  let i = 0, opener = null;
  const show = n => {
    i = (n + items.length) % items.length; const it = items[i];
    const img = $('#lb-img'); img.srcset = it.srcset; img.sizes = '(min-width:1200px) 1200px, 94vw'; img.src = it.src; img.alt = it.alt;
    $('#lb-cap').textContent = it.cap + ' — ' + it.alt;
    $('#lb-count').textContent = `${i + 1} / ${items.length}`;
  };
  shots.forEach((b, n) => b.addEventListener('click', () => { opener = b; show(n); dlg.showModal(); $('#lb-close').focus(); }));
  $('#lb-prev').addEventListener('click', () => show(i - 1));
  $('#lb-next').addEventListener('click', () => show(i + 1));
  $('#lb-close').addEventListener('click', () => dlg.close());
  dlg.addEventListener('keydown', e => { if (e.key === 'ArrowLeft') show(i - 1); else if (e.key === 'ArrowRight') show(i + 1); });
  dlg.addEventListener('click', e => { if (e.target === dlg || e.target.classList.contains('lb-inner')) dlg.close(); });
  dlg.addEventListener('close', () => opener?.focus());
})();

/* ---------- booking / quote request form ---------- */
(() => {
  const form = $('#req-form'); if (!form) return;
  const status = $('#form-status'), submit = $('#f-submit'), label = $('.btn-label', submit);
  const t0 = Date.now();
  const todayISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  $('#f-date').min = todayISO();
  const labelOf = v => { const o = $(`#f-service option[value="${v}"]`); return o ? o.textContent : v; };

  // service buttons elsewhere on the page pre-select the service
  $$('[data-service]').forEach(a => a.addEventListener('click', () => {
    $('#f-service').value = a.dataset.service;
    setTimeout(() => $('#f-name').focus({ preventScroll: true }), 500);
  }));

  const hasEndpoint = !!config.formEndpoint;
  if (!hasEndpoint) {
    submit.disabled = true; label.textContent = 'Online requests are unavailable right now';
    status.className = 'status bad'; status.textContent = 'Online requests are temporarily unavailable. Please check back soon.';
  }

  const fieldOf = el => el.closest('.field');
  const setErr = (id, msg) => {
    const p = $('#' + id); if (!p) return;
    p.textContent = msg; const f = fieldOf(p); f?.classList.toggle('invalid', !!msg);
    const inp = $('input,select,textarea', f); if (inp) inp.setAttribute('aria-invalid', msg ? 'true' : 'false');
  };
  const v = n => form.elements[n].value.trim();

  function validate() {
    const errs = {};
    if (!v('name')) errs['e-name'] = 'Please enter your name.';
    const email = v('email'), phone = v('phone');
    if (!email && !phone) { errs['e-email'] = 'Add an email or a phone number so we can reply.'; errs['e-phone'] = 'Add a phone number or an email so we can reply.'; }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) errs['e-email'] = 'Enter a valid email address, like name@example.com.';
    if (phone && phone.replace(/\D/g, '').length < 7) errs['e-phone'] = 'Enter a phone number with at least 7 digits.';
    if (!v('service')) errs['e-service'] = 'Please choose a service, or pick Free quote.';
    if (!v('vehicle_type')) errs['e-vtype'] = 'Please tell us what kind of vehicle it is.';
    if (!v('interior')) errs['e-interior'] = 'Please choose leather, upholstery, a mix, or not sure.';
    if (!v('condition')) errs['e-cond'] = 'Please pick a condition from 1 (best) to 10 (worst).';
    if (!v('location')) errs['e-where'] = 'Please enter your town or ZIP code.';
    if (!v('preferred_date')) errs['e-date'] = 'Please pick a convenient day.';
    else if (v('preferred_date') < todayISO()) errs['e-date'] = 'Please pick today or a future day.';
    if (!form.elements.consent.checked) errs['e-consent'] = 'Please agree so we can use your details to reply.';
    ['e-name', 'e-email', 'e-phone', 'e-service', 'e-vtype', 'e-interior', 'e-cond', 'e-where', 'e-date', 'e-consent'].forEach(id => setErr(id, errs[id] || ''));
    return errs;
  }
  form.addEventListener('input', e => { const f = fieldOf(e.target); const err = f && $('.err', f); if (err && err.textContent) validate(); });

  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (!hasEndpoint) return;
    status.className = 'status'; status.textContent = '';
    const errs = validate();
    const first = Object.keys(errs)[0];
    if (first) {
      status.className = 'status bad'; status.textContent = 'Please fix the highlighted fields and try again.';
      $('input,select,textarea', fieldOf($('#' + first))).focus();
      return;
    }
    if (v('website')) { status.className = 'status ok'; status.textContent = 'Thanks.'; return; }   // honeypot: bots only
    if (Date.now() - t0 < 3000) { status.className = 'status bad'; status.textContent = 'That was very quick. Please check your details and send again.'; return; }

    const payload = {
      subject: `Appointment request: ${labelOf(v('service'))} (${v('name')})`,
      name: v('name'), email: v('email'), phone: v('phone'),
      service: labelOf(v('service')), vehicle_type: v('vehicle_type'), interior: v('interior'),
      condition_1_to_10: `${v('condition')} of 10 (10 = worst)`, location: v('location'),
      preferred_date: v('preferred_date'), preferred_times: v('preferred_times'), message: v('message'),
      ...(/formsubmit\.co/.test(config.formEndpoint) && { _subject: `Appointment request: ${labelOf(v('service'))} (${v('name')})`, _template: 'table', _captcha: 'false' }),
      ...(config.formAccessKey && { access_key: config.formAccessKey }),
    };
    submit.disabled = true; submit.setAttribute('aria-busy', 'true');
    label.textContent = 'Sending…'; const sp = document.createElement('span'); sp.className = 'spin'; sp.setAttribute('aria-hidden', 'true'); submit.prepend(sp);
    const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), 15000);
    try {
      const res = await fetch(config.formEndpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(payload), signal: ctl.signal });
      let data = {}; try { data = await res.json(); } catch { /* non-JSON ok */ }
      if (!res.ok || String(data.success) === 'false' || String(data.ok) === 'false') { console.warn('Form service did not accept the request:', res.status, data); throw new Error('bad response'); }
      form.reset(); $$('.field', form).forEach(f => f.classList.remove('invalid'));
      status.className = 'status ok';
      track('form', v('service') || 'unknown');
      status.textContent = 'Request sent. We will contact you to agree on your day. Your deposit and the agreed day set your appointment.';
    } catch {
      status.className = 'status bad';
      const alt = [config.phone && `call ${config.phone}`, config.email && `email ${config.email}`].filter(Boolean).join(' or ');
      status.textContent = 'Sorry, your request did not go through, so nothing was sent. Please try again in a moment' + (alt ? `, or ${alt}.` : '.');
    } finally {
      clearTimeout(to); submit.disabled = false; submit.removeAttribute('aria-busy'); sp.remove(); label.textContent = 'Send appointment request';
      status.focus();
    }
  });
})();

/* ---------- animated hero (loaded only when it can run) ---------- */
(() => {
  if (!$('#stage')) return;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let gl = false;
  try { const c = document.createElement('canvas'); const ctx = c.getContext('webgl2') || c.getContext('webgl'); gl = !!ctx; ctx?.getExtension('WEBGL_lose_context')?.loseContext(); } catch { gl = false; }
  if (reduce || !gl) { root.classList.add('static-hero'); return; }
  import('./hero.js').then(m => m.initHero()).catch(err => { console.warn('Hero animation unavailable:', err); root.classList.add('static-hero'); });
})();


/* ---------- mobile quick-action bar: appears once the hero is scrolled past ---------- */
(() => {
  const bar = document.getElementById('mbar'), heroTrack = document.querySelector('.hero-track');
  if (!bar) return;
  if (!heroTrack || !('IntersectionObserver' in window)) { bar.classList.add('on'); return; }
  new IntersectionObserver(([e]) => bar.classList.toggle('on', !e.isIntersecting), { threshold: 0, rootMargin: '-15% 0px 0px 0px' }).observe(heroTrack);
})();
