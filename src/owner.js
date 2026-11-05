import '@fontsource/inter-tight/400.css';
import '@fontsource/inter-tight/600.css';
import '@fontsource/ibm-plex-mono/500.css';
import './owner.css';
import config from '../site.config.json';

const EP = String(config.analyticsEndpoint || '').replace(/\/$/, '');
const app = document.getElementById('app');
const NS = 'http://www.w3.org/2000/svg';
const COLORS = { call: 'var(--s1)', text: 'var(--s2)', pay: 'var(--s3)' };

/* ---- tiny DOM helpers (text goes in via textContent / text nodes only) ---- */
function mk(ns, tag, props, kids) {
  const e = ns ? document.createElementNS(NS, tag) : document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') e.setAttribute('class', v);
    else if (k === 'text') e.textContent = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of [].concat(kids || [])) if (kid != null && kid !== false) e.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  return e;
}
const h = (tag, props, ...kids) => mk(false, tag, props, kids.flat());
const sv = (tag, props, ...kids) => mk(true, tag, props, kids.flat());

const PKG = {
  'svc-standard': 'Standard, car · $150', 'svc-deep': 'Deep Clean, car · $185', 'svc-supa': 'Supa Clean, car · $225',
  'svc-suv-standard': 'Standard, SUV · $175', 'svc-suv-deep': 'Deep Clean, SUV · $225', 'svc-suv-supa': 'Supa Clean, SUV · $250',
};
const PLACE = { bar: 'bottom bar', header: 'header', hero: 'top of page', footer: 'footer', page: 'page' };
const SERVICE = { quote: 'Free quote', standard: 'Standard', deep: 'Deep Clean', supa: 'Supa Clean', 'suv-standard': 'SUV Standard', 'suv-deep': 'SUV Deep Clean', 'suv-supa': 'SUV Supa Clean' };
const ACTION = {
  call: (p) => 'Tapped Call (' + (PLACE[p] || p || 'page') + ')',
  text: (p) => 'Tapped Text (' + (PLACE[p] || p || 'page') + ')',
  email: () => 'Tapped Email',
  pay: (p) => 'Clicked Pay deposit: ' + (PKG[p] || p || 'unknown'),
  request: (p) => 'Clicked ' + (p && p.startsWith('book') ? 'Book now' : 'Request: ' + (SERVICE[p] || p)),
  form: (p) => 'Sent request form: ' + (SERVICE[p] || p),
  google: () => 'Opened Google profile',
  facebook: () => 'Opened Facebook',
};

const nf = new Intl.NumberFormat('en-US');
const dayLabel = (d) => new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
const when = (ts) => new Date(ts).toLocaleString('en-US', { timeZone: 'America/Detroit', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
const hourName = (x) => (x % 12 === 0 ? 12 : x % 12) + (x < 12 ? ' am' : ' pm');
function niceStep(v) { const base = [1, 2, 5]; for (let m = 1; ; m *= 10) for (const b of base) if (b * m * 4 >= v) return b * m; }

/* ---- tooltip (shared pattern) ---- */
function tipBox(host) { const t = h('div', { class: 'tip', role: 'presentation' }); host.append(t); return t; }
function placeTip(t, host, x, y) {
  const w = host.clientWidth, tw = t.offsetWidth || 140;
  t.style.left = Math.max(0, Math.min(w - tw, x + 14 > w - tw ? x - tw - 14 : x + 14)) + 'px';
  t.style.top = Math.max(0, y) + 'px';
}

/* ---- line / area chart with crosshair ---- */
function lineChart(host, days, series, opts) {
  opts = opts || {};
  host.replaceChildren();
  const multi = series.length > 1;
  const W = Math.max(300, host.clientWidth), H = opts.height || 240, m = { l: 34, r: multi ? 78 : 12, t: 10, b: 26 };
  const iw = W - m.l - m.r, ih = H - m.t - m.b, n = days.length;
  const step = niceStep(Math.max(1, ...series.flatMap((s) => s.values))), max = step * 4;
  const X = (i) => m.l + (n === 1 ? iw / 2 : (i * iw) / (n - 1));
  const Y = (v) => m.t + ih - (v / max) * ih;
  const svg = sv('svg', { viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: 'img', tabindex: '0', 'aria-label': opts.label || 'Line chart. Use left and right arrow keys to read each day.' });
  for (let i = 0; i <= 4; i++) {
    const v = step * i, y = Y(v);
    svg.append(sv('line', { x1: m.l, x2: W - m.r, y1: y, y2: y, stroke: 'var(--grid)', 'stroke-width': 1 }), sv('text', { x: m.l - 8, y: y + 4, 'text-anchor': 'end', text: nf.format(v) }));
  }
  const every = n <= 8 && iw / n >= 50;
  const nl = every ? n : Math.max(2, Math.min(6, Math.floor(iw / 84)));
  for (let k = 0; k < nl; k++) {
    const i = nl === 1 ? 0 : Math.round((k * (n - 1)) / (nl - 1));
    svg.append(sv('text', { x: X(i), y: H - 6, 'text-anchor': k === 0 ? 'start' : k === nl - 1 ? 'end' : 'middle', text: dayLabel(days[i]) }));
  }
  const pts = (s) => s.values.map((v, i) => `${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(' ');
  for (const s of series) {
    if (opts.area) svg.append(sv('polygon', { points: `${X(0)},${Y(0)} ${pts(s)} ${X(n - 1)},${Y(0)}`, fill: s.color, opacity: '.14' }));
    svg.append(sv('polyline', { points: pts(s), fill: 'none', stroke: s.color, 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }));
  }
  if (multi) { // direct end labels, nudged apart so they never overlap
    const lab = series.map((s) => ({ s, y: Y(s.values[n - 1]) })).sort((a, b) => a.y - b.y);
    for (let i = 1; i < lab.length; i++) if (lab[i].y - lab[i - 1].y < 15) lab[i].y = lab[i - 1].y + 15;
    for (const l of lab) svg.append(sv('text', { class: 'lab', x: W - m.r + 8, y: l.y + 4, text: l.s.short || l.s.name }));
  }
  const cross = sv('g', { style: 'display:none' });
  const vline = sv('line', { y1: m.t, y2: m.t + ih, stroke: 'var(--mid)', 'stroke-width': 1 });
  cross.append(vline);
  const dots = series.map((s) => sv('circle', { r: 4.5, fill: s.color, stroke: '#131315', 'stroke-width': 2 }));
  cross.append(...dots);
  svg.append(cross);
  const tip = tipBox(host);
  let cur = n - 1;
  const show = (i, clientY) => {
    cur = i; cross.style.display = ''; vline.setAttribute('x1', X(i)); vline.setAttribute('x2', X(i));
    series.forEach((s, k) => { dots[k].setAttribute('cx', X(i)); dots[k].setAttribute('cy', Y(s.values[i])); });
    tip.replaceChildren(h('b', { text: dayLabel(days[i]) }), ...series.map((s) => h('div', null, h('span', null, h('i', { style: 'background:' + s.color }), s.name), h('strong', { text: nf.format(s.values[i]) }))));
    tip.classList.add('on');
    placeTip(tip, host, X(i), clientY == null ? m.t + 4 : clientY - host.getBoundingClientRect().top - 30);
  };
  const hide = () => { cross.style.display = 'none'; tip.classList.remove('on'); };
  const idxAt = (e) => { const r = svg.getBoundingClientRect(); const x = ((e.clientX - r.left) / r.width) * W; return Math.max(0, Math.min(n - 1, Math.round(((x - m.l) / iw) * (n - 1)))); };
  svg.addEventListener('pointermove', (e) => show(idxAt(e), e.clientY));
  svg.addEventListener('pointerdown', (e) => show(idxAt(e), e.clientY));
  svg.addEventListener('pointerleave', hide);
  svg.addEventListener('focus', () => show(cur));
  svg.addEventListener('blur', hide);
  svg.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') { e.preventDefault(); show(Math.max(0, cur - 1)); }
    if (e.key === 'ArrowRight') { e.preventDefault(); show(Math.min(n - 1, cur + 1)); }
  });
  host.prepend(svg);
}

/* ---- horizontal bars (label · bar · value) ---- */
function hbars(host, rows, color) {
  host.replaceChildren();
  const max = Math.max(1, ...rows.map((r) => r.value));
  if (!rows.length) { host.append(h('p', { class: 'empty', text: 'Nothing yet for this period.' })); return; }
  for (const r of rows) host.append(h('div', { class: 'hb', title: `${r.label}: ${nf.format(r.value)}` },
    h('span', { class: 'lb', text: r.label }),
    h('div', { class: 'tr' }, h('div', { class: 'bar', style: `width:${r.value ? Math.max(1.5, (r.value / max) * 100) : 0}%;background:${color}` })),
    h('span', { class: 'vl', text: nf.format(r.value) })));
}

/* ---- by-hour column chart ---- */
function hourChart(host, hourly) {
  host.replaceChildren();
  const W = Math.max(300, host.clientWidth), H = 190, m = { l: 30, r: 6, t: 8, b: 24 }, iw = W - m.l - m.r, ih = H - m.t - m.b;
  const step = niceStep(Math.max(1, ...hourly)), max = step * 4, bw = iw / 24;
  const svg = sv('svg', { viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: 'img', 'aria-label': 'Actions by hour of day, Detroit time' });
  for (let i = 0; i <= 4; i++) { const y = m.t + ih - (i / 4) * ih; svg.append(sv('line', { x1: m.l, x2: W - m.r, y1: y, y2: y, stroke: 'var(--grid)' }), sv('text', { x: m.l - 6, y: y + 4, 'text-anchor': 'end', text: nf.format(step * i) })); }
  const tip = tipBox(host);
  hourly.forEach((v, i) => {
    const bh = (v / max) * ih, x = m.l + i * bw + 1;
    const g = sv('g', { tabindex: '0', role: 'img', 'aria-label': `${hourName(i)}: ${v} actions` });
    g.append(sv('rect', { x: m.l + i * bw, y: m.t, width: bw, height: ih, fill: 'transparent' }));
    if (v) g.append(sv('rect', { x, y: m.t + ih - bh, width: Math.max(2, bw - 2), height: bh, rx: 3, fill: 'var(--neutral)' }));
    const on = () => { tip.replaceChildren(h('b', { text: hourName(i) + ' to ' + hourName((i + 1) % 24) }), h('div', null, h('span', { text: 'Actions' }), h('strong', { text: nf.format(v) }))); tip.classList.add('on'); placeTip(tip, host, x + bw / 2, m.t + ih - bh - 46); };
    g.addEventListener('pointerenter', on); g.addEventListener('focus', on);
    g.addEventListener('pointerleave', () => tip.classList.remove('on')); g.addEventListener('blur', () => tip.classList.remove('on'));
    svg.append(g);
  });
  [0, 3, 6, 9, 12, 15, 18, 21].forEach((i) => svg.append(sv('text', { x: m.l + i * bw, y: H - 6, text: hourName(i).replace(' ', '') })));
  host.prepend(svg);
}

/* ---- page ---- */
let days = 30, data = null;
const redraw = [];

function delta(cur, prev) {
  if (!prev && !cur) return 'no activity either period';
  if (!prev) return 'new this period';
  const p = Math.round(((cur - prev) / prev) * 100);
  return (p > 0 ? '▲ ' : p < 0 ? '▼ ' : '') + (p === 0 ? 'same as' : Math.abs(p) + '%') + ' vs previous ' + days + ' days';
}
function kpi(label, key, tot, prev, extra) {
  return h('div', { class: 'kpi' + (key === 'pay' ? ' key' : '') }, h('div', { class: 'k', text: label }), h('div', { class: 'n', text: nf.format(tot[key]) }), h('div', { class: 'd', text: extra || delta(tot[key], prev[key]) }));
}

function owned() { try { return localStorage.getItem('bs-owner') === '1'; } catch { return false; } }
function setOwned(v) { try { v ? localStorage.setItem('bs-owner', '1') : localStorage.removeItem('bs-owner'); } catch { /* ignore */ } }

function render() {
  redraw.length = 0;
  const t = data.totals, p = data.previous;
  const rate = t.visitors ? Math.min(100, (t.payers / t.visitors) * 100).toFixed(1) : '0.0';
  const range = h('div', { class: 'seg', role: 'group', 'aria-label': 'Date range' }, [7, 30, 90].map((d) => h('button', { type: 'button', 'aria-pressed': String(d === days), text: 'Last ' + d + ' days', onclick: () => { days = d; load(); } })));
  const foot = h('div', { class: 'foot' }, h('span', { text: 'Times are Detroit time. Counts reset nothing and keep up to 13 months.' }), h('span', { id: 'ownedline' }));
  const setFoot = () => { const ol = foot.querySelector('#ownedline'); ol.replaceChildren(owned() ? 'This browser is not counted in the numbers. ' : 'This browser is counted in the numbers. ', h('button', { type: 'button', text: owned() ? 'Count it again' : 'Stop counting it', onclick: () => { setOwned(!owned()); setFoot(); } })); };
  setFoot();

  const visits = h('div', { class: 'chart' }), trend = h('div', { class: 'chart' }), pk = h('div'), hrs = h('div', { class: 'chart' }), src = h('div');
  const legend = h('div', { class: 'legend' }, [['call', 'Call taps'], ['text', 'Text taps'], ['pay', 'Deposit clicks']].map(([k, n]) => h('span', null, h('i', { style: 'background:' + COLORS[k] }), n)));
  const recent = data.recent.length ? h('div', { class: 'tablewrap', tabindex: '0', role: 'region', 'aria-label': 'Latest actions' }, h('table', null, h('thead', null, h('tr', null, h('th', { text: 'When' }), h('th', { text: 'Action' }))), h('tbody', null, data.recent.map((r) => h('tr', null, h('td', { text: when(r.ts) }), h('td', { text: (ACTION[r.t] || (() => r.t))(r.p) })))))) : h('p', { class: 'empty', text: 'No call, text or deposit taps yet.' });
  const tbl = h('div', { class: 'tablewrap', tabindex: '0', role: 'region', 'aria-label': 'Daily numbers' }, h('table', null,
    h('thead', null, h('tr', null, ['Day', 'Visitors', 'Calls', 'Texts', 'Deposit clicks', 'Book/quote', 'Requests sent'].map((x, i) => h('th', { class: i ? 'num' : '', text: x })))),
    h('tbody', null, data.days.map((d, i) => [i, d]).reverse().map(([i, d]) => h('tr', null, h('td', { text: dayLabel(d) }), [data.series.visitors[i], data.series.call[i], data.series.text[i], data.series.pay[i], data.series.request[i], data.series.form[i]].map((v) => h('td', { class: 'num', text: nf.format(v) })))))));

  app.replaceChildren(
    h('div', { class: 'top' }, h('div', null, h('p', { class: 'eyebrow', text: "B's Supa Clean Cars" }), h('h1', { text: 'Website analytics' })), h('div', { class: 'controls' }, range, h('button', { type: 'button', class: 'ghost', text: 'Refresh', onclick: () => load() }))),
    h('p', { class: 'note' }, h('strong', { text: 'Deposit clicks are conversions: ' }), 'each one is someone tapping a Pay deposit button. Stripe opens in a new tab, so this shows buying intent. Your Stripe dashboard shows which payments were actually completed.'),
    h('div', { class: 'kpis' }, kpi('Visitors', 'visitors', t, p), kpi('Call taps', 'call', t, p), kpi('Text taps', 'text', t, p), kpi('Deposit clicks', 'pay', t, p), kpi('Book / quote clicks', 'request', t, p), kpi('Requests sent', 'form', t, p),
      h('div', { class: 'kpi' }, h('div', { class: 'k', text: 'Visitors who clicked Pay' }), h('div', { class: 'n', text: rate + '%' }), h('div', { class: 'd', text: nf.format(t.payers) + ' of ' + nf.format(t.visitors) + ' visitors (counted per day)' }))),
    h('div', { class: 'grid' },
      h('section', { class: 'card c12' }, h('h2', { text: 'Calls, texts and deposit clicks per day' }), h('p', { class: 'sub', text: 'Hover or tap the chart to read a day. Arrow keys work too.' }), legend, trend),
      h('section', { class: 'card c8' }, h('h2', { text: 'Visitors per day' }), h('p', { class: 'sub', text: 'Each person counted once per day. No cookies.' }), visits),
      h('section', { class: 'card c4' }, h('h2', { text: 'Deposit clicks by package' }), h('p', { class: 'sub', text: 'Which Pay button was tapped' }), pk),
      h('section', { class: 'card c8' }, h('h2', { text: 'When people take action' }), h('p', { class: 'sub', text: 'Calls, texts, deposit and request taps by hour of day' }), hrs),
      h('section', { class: 'card c4' }, h('h2', { text: 'Where visitors come from' }), h('p', { class: 'sub', text: 'Direct means no referring site' }), src),
      h('section', { class: 'card c12' }, h('h2', { text: 'Latest actions' }), h('p', { class: 'sub', text: 'Newest first. No names or contact details are ever recorded.' }), recent, h('details', null, h('summary', { text: 'Show the daily numbers as a table' }), tbl))),
    foot);

  const draw = () => {
    lineChart(trend, data.days, [{ name: 'Call taps', short: 'Calls', color: COLORS.call, values: data.series.call }, { name: 'Text taps', short: 'Texts', color: COLORS.text, values: data.series.text }, { name: 'Deposit clicks', short: 'Deposits', color: COLORS.pay, values: data.series.pay }], { label: 'Calls, texts and deposit clicks per day' });
    lineChart(visits, data.days, [{ name: 'Visitors', color: 'var(--neutral)', values: data.series.visitors }], { area: true, height: 200, label: 'Visitors per day' });
    hourChart(hrs, data.hourly);
  };
  draw();
  hbars(pk, Object.keys(PKG).map((k) => ({ label: PKG[k], value: data.packages[k] || 0 })), 'var(--s3)');
  hbars(src, data.sources.map((x) => ({ label: x.host || 'Direct', value: x.count })), 'var(--neutral)');
  let w = innerWidth, raf = 0;
  new ResizeObserver(() => { if (innerWidth === w) return; w = innerWidth; cancelAnimationFrame(raf); raf = requestAnimationFrame(draw); }).observe(document.body);
}

function message(text, retry) { app.replaceChildren(h('p', { class: 'msg', text }), retry ? h('p', { class: 'msg retry' }, h('button', { type: 'button', class: 'ghost', text: 'Try again', onclick: load })) : null); }

async function load() {
  if (!EP) { message('The analytics server is not connected yet. Follow worker/README.md to switch it on, then set "analyticsEndpoint" in site.config.json.'); return; }
  const frame = app.querySelectorAll('.chart'); frame.forEach((c) => c.classList.add('loading'));
  try {
    const res = await fetch(EP + '/stats?days=' + days, { credentials: 'omit' });
    if (!res.ok) throw new Error(String(res.status));
    data = await res.json();
    render();
  } catch (e) {
    message('Could not load the numbers (' + (e && e.message ? e.message : 'network') + '). Check the analytics server and try again.', true);
  }
}

if (!owned() && EP) setOwned(true); // opening this page keeps your own visits out of the counts
load();
