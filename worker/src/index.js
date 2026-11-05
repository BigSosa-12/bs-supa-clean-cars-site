// B's Supa Clean Cars: privacy-friendly click counter (Cloudflare Worker + D1).
// Stores: time, event type, button/package id, referrer host, and a one-way visitor code that
// changes every day. It never stores IP addresses, cookies or anything that follows a person.

const EVENTS = new Set(['view', 'call', 'text', 'email', 'pay', 'request', 'form', 'google', 'facebook']);
const TZ = 'America/Detroit';
const BOT = /bot|crawl|spider|slurp|headless|lighthouse|preview|facebookexternalhit|curl|wget|python|node-fetch|monitor/i;
const MAX_EVENTS_PER_VISITOR_PER_HOUR = 120;

const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' });
function detroit(ms) {
  const o = Object.fromEntries(fmt.formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  return { day: `${o.year}-${o.month}-${o.day}`, hour: Number(o.hour) };
}
function addDays(day, n) {
  const d = new Date(day + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

const json = (obj, status, extra) =>
  new Response(JSON.stringify(obj), { status: status || 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...(extra || {}) } });

function cors(req, env) {
  const origin = req.headers.get('Origin') || '';
  const ok = (env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
  const allowed = ok.includes(origin);
  return { allowed, origin, headers: allowed ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '86400' } : { Vary: 'Origin' } };
}

let keyCache;
async function masterKey(db) {
  if (keyCache) return keyCache;
  let row = await db.prepare("SELECT v FROM meta WHERE k='key'").first();
  if (!row) {
    const hex = [...crypto.getRandomValues(new Uint8Array(32))].map((b) => b.toString(16).padStart(2, '0')).join('');
    await db.prepare("INSERT OR IGNORE INTO meta (k, v) VALUES ('key', ?)").bind(hex).run();
    row = await db.prepare("SELECT v FROM meta WHERE k='key'").first();
  }
  return (keyCache = row.v);
}
async function visitorCode(db, day, ip, ua) {
  const enc = new TextEncoder();
  const k = await crypto.subtle.importKey('raw', enc.encode((await masterKey(db)) + '|' + day), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', k, enc.encode(ip + '|' + ua)));
  return [...sig.slice(0, 8)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function ingest(req, env, ctx, c) {
  if (!c.allowed) return new Response(null, { status: 403, headers: c.headers });
  const ua = req.headers.get('User-Agent') || '';
  if (env.IGNORE_BOTS !== '0' && BOT.test(ua)) return new Response(null, { status: 204, headers: c.headers });
  let body;
  try { const text = await req.text(); if (text.length > 400) throw 0; body = JSON.parse(text); } catch { return new Response(null, { status: 400, headers: c.headers }); }
  const t = String(body.t || '');
  if (!EVENTS.has(t)) return new Response(null, { status: 400, headers: c.headers });
  const p = /^[a-z0-9-]{1,40}$/.test(String(body.p || '')) ? String(body.p) : '';
  const r = /^[a-z0-9.-]{1,80}$/.test(String(body.r || '')) ? String(body.r) : '';
  const now = Date.now();
  const { day, hour } = detroit(now);
  const v = await visitorCode(env.DB, day, req.headers.get('CF-Connecting-IP') || 'local', ua);
  const recent = await env.DB.prepare('SELECT COUNT(*) n FROM events WHERE v=? AND ts>?').bind(v, now - 3600000).first();
  if (recent && recent.n >= MAX_EVENTS_PER_VISITOR_PER_HOUR) return new Response(null, { status: 204, headers: c.headers });
  await env.DB.prepare('INSERT INTO events (ts, day, hour, t, p, r, v) VALUES (?,?,?,?,?,?,?)').bind(now, day, hour, t, p, r, v).run();
  if (Math.random() < 0.01) ctx.waitUntil(env.DB.prepare('DELETE FROM events WHERE ts<?').bind(now - 400 * 86400000).run());
  return new Response(null, { status: 204, headers: c.headers });
}

async function stats(req, env, c) {
  if (!c.allowed) return json({ error: 'forbidden' }, 403, c.headers);
  const url = new URL(req.url);
  const days = Math.min(Math.max(parseInt(url.searchParams.get('days') || '30', 10) || 30, 1), 180);
  const today = detroit(Date.now()).day;
  const start = addDays(today, -(days - 1));
  const prevStart = addDays(start, -days);
  const list = Array.from({ length: days }, (_, i) => addDays(start, i));

  const [byDay, packages, sources, hours, recent] = await Promise.all([
    env.DB.prepare('SELECT day, t, COUNT(*) c, COUNT(DISTINCT v) u FROM events WHERE day>=? GROUP BY day, t').bind(prevStart).all(),
    env.DB.prepare("SELECT p, COUNT(*) c FROM events WHERE t='pay' AND day>=? GROUP BY p").bind(start).all(),
    env.DB.prepare("SELECT r, COUNT(*) c FROM events WHERE t='view' AND day>=? GROUP BY r ORDER BY c DESC LIMIT 8").bind(start).all(),
    env.DB.prepare("SELECT hour, COUNT(*) c FROM events WHERE t IN ('call','text','email','pay','request','form') AND day>=? GROUP BY hour").bind(start).all(),
    env.DB.prepare("SELECT ts, t, p FROM events WHERE t NOT IN ('view') ORDER BY ts DESC LIMIT 20").all(),
  ]);

  const series = {}, cur = {}, prev = {};
  for (const e of EVENTS) { series[e] = list.map(() => 0); cur[e] = 0; prev[e] = 0; }
  series.visitors = list.map(() => 0);
  let visitors = 0, prevVisitors = 0, payers = 0;
  for (const row of byDay.results) {
    if (row.day >= start) {
      var i = list.indexOf(row.day);
      if (i >= 0) series[row.t][i] += row.c;
      cur[row.t] += row.c;
      if (row.t === 'view') { visitors += row.u; if (i >= 0) series.visitors[i] = row.u; }
      if (row.t === 'pay') payers += row.u;
    } else {
      prev[row.t] += row.c;
      if (row.t === 'view') prevVisitors += row.u;
    }
  }
  const hourly = Array.from({ length: 24 }, () => 0);
  for (const h of hours.results) hourly[h.hour] = h.c;
  return json({
    days: list, series, totals: { ...cur, visitors, payers }, previous: { ...prev, visitors: prevVisitors },
    packages: Object.fromEntries(packages.results.map((x) => [x.p || 'unknown', x.c])),
    sources: sources.results.map((x) => ({ host: x.r || '', count: x.c })),
    hourly, recent: recent.results,
  }, 200, c.headers);
}

export default {
  async fetch(req, env, ctx) {
    const c = cors(req, env);
    const url = new URL(req.url);
    if (req.method === 'OPTIONS') return new Response(null, { status: c.allowed ? 204 : 403, headers: c.headers });
    try {
      if (req.method === 'POST' && url.pathname === '/e') return await ingest(req, env, ctx, c);
      if (req.method === 'GET' && url.pathname === '/stats') return await stats(req, env, c);
      if (url.pathname === '/') return new Response('ok', { status: 200 });
    } catch (e) {
      return json({ error: 'server' }, 500, c.headers);
    }
    return new Response('not found', { status: 404 });
  },
};
