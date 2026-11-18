// The scores service. The game never sends a score: it asks for a ticket when a run begins, tells the places it reaches, and at
// the end sends what was gathered; the score is worked out here, each number held to what a run could truly hold.
//   POST /api/run   { pid }                                   -> { run, sig }          a signed ticket for one run
//   POST /api/mark  { run, sig, sec }                         -> {}                    a place of the route reached (in order)
//   POST /api/score { run, sig, name, title, lamps, dist, won, falls, done } -> { score, lines, me, board }
//   GET  /api/board[?pid=]                                    -> { now, closes, today, all, me }   (the public part kept 15 s)
const ROUTE = 1920, SECS = 9;                         // metres from the gate to the sea; places on the way (0 the gate .. 8 the burning)
const SEC_END = [48, 432, 552, 648, 792, 1128, 1440, 1488, 1920];      // where each place ends
const POINTS = { lamp: 10, metre: 1, fight: 700, fall: 140, burned: 2500 }, FIGHTS = 3;
const TITLES = ['Hanuman', 'Anjanisuta', 'Vayuputra', 'Mahabala', 'Rameshta', 'Phalgunasakha', 'Pingaksha', 'Amitavikrama', 'Udadhikramana', 'Sitashokavinashana', 'Lakshmanapranadata', 'Dashagrivadarpaha'];
const BAD = ['fuck', 'shit', 'bitch', 'cunt', 'nigger', 'nigga', 'rape', 'porn', 'pussy', 'slut', 'whore', 'madarchod', 'bhenchod', 'bhosdi', 'chutiya', 'randi'];
const json = (o, status = 200, head = {}) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...head } });
const no = (why, status = 400) => json({ error: why }, status);
const int = (v, lo, hi) => Math.max(lo, Math.min(hi, Math.floor(Number(v) || 0)));
const dayOf = ts => new Date(ts + 19800000).toISOString().slice(0, 10);      // the day as India counts it
const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
async function sign(env, text) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(env.SCORE_KEY || ''), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(text)));
}
const same = (a, b) => { if (typeof a !== 'string' || a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; };
function clean(name) {
  let s = String(name || '').normalize('NFKC').replace(/[^\p{L}\p{M}\p{N} ._-]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 12).trim();
  const flat = s.toLowerCase().replace(/[^a-z]/g, '');
  if (!s || BAD.some(w => flat.includes(w))) s = 'Vanara';
  return s;
}
// The score of a run, each number first held to what the run could hold: no more road than the places reached, no more lamps than that road carries.
function reckon(row, b, now) {
  const secs = (now - row.t0) / 1000, sec = row.sec;
  const done = !!b.done && sec >= SECS - 1 && secs >= 150;
  const dist = Math.min(int(b.dist, 0, ROUTE), done ? ROUTE : SEC_END[sec] + 24, Math.floor(secs * 18));
  const lamps = Math.min(int(b.lamps, 0, 5000), Math.floor(dist * 0.65) + 10);
  // a fight counts as won only when the place beyond it has been reached: the city past Lankini, the halls past the court's guards, the throne past the grove
  const won = Math.min(int(b.won, 0, FIGHTS), sec >= 7 ? 3 : sec >= 5 ? 2 : sec >= 1 ? 1 : 0), falls = int(b.falls, 0, 99);
  const lines = { lamps: lamps * POINTS.lamp, dist: dist * POINTS.metre, fights: Math.max(0, won * POINTS.fight - falls * POINTS.fall), burned: done ? POINTS.burned : 0 };
  return { lamps, dist, won, falls, done: done ? 1 : 0, lines, score: lines.lamps + lines.dist + lines.fights + lines.burned };
}
const place = async (db, day, pid) => {
  const me = await db.prepare('SELECT score, ts, name, title FROM best WHERE day = ? AND pid = ?').bind(day, pid).first();
  if (!me) return null;
  const [above, total, next] = await db.batch([
    db.prepare('SELECT COUNT(*) c FROM best WHERE day = ?1 AND (score > ?2 OR (score = ?2 AND ts < ?3))').bind(day, me.score, me.ts),
    db.prepare('SELECT COUNT(*) c FROM best WHERE day = ?').bind(day),
    db.prepare('SELECT name, score FROM best WHERE day = ?1 AND (score > ?2 OR (score = ?2 AND ts < ?3)) ORDER BY score ASC, ts DESC LIMIT 1').bind(day, me.score, me.ts)]);
  const n = next.results[0];
  return { rank: above.results[0].c + 1, total: total.results[0].c, score: me.score, name: me.name, title: me.title, next: n ? { name: n.name, gap: n.score - me.score + 1 } : null };
};
const top = async (db, day) => (await db.prepare('SELECT name, cc, title, score FROM best WHERE day = ? ORDER BY score DESC, ts ASC LIMIT 13').bind(day).all()).results;
const count = async (db, day) => (await db.prepare('SELECT COUNT(*) c FROM best WHERE day = ?').bind(day).first()).c;
async function board(db, now) {
  const day = dayOf(now), [today, all, n1, n2] = await Promise.all([top(db, day), top(db, 'all'), count(db, day), count(db, 'all')]);
  return { now, day, closes: 86400000 - ((now + 19800000) % 86400000), today: { rows: today, total: n1 }, all: { rows: all, total: n2 } };
}
async function ticket(env, b) {      // the row of a run whose ticket is true, or null
  if (!b || typeof b.run !== 'string' || b.run.length > 40) return null;
  const row = await env.DB.prepare('SELECT * FROM runs WHERE id = ?').bind(b.run).first();
  return row && same(b.sig, await sign(env, row.id + '.' + row.pid + '.' + row.t0)) ? row : null;
}
export async function onRequest({ request, env, waitUntil }) {
  const url = new URL(request.url), path = url.pathname.replace(/^\/api\//, ''), now = Date.now(), db = env.DB;
  if (!db || !env.SCORE_KEY) return no('not set up', 503);
  try {
    if (request.method === 'GET' && path === 'board') {
      const cache = caches.default, key = new Request(url.origin + '/api/board?public=1');
      let res = await cache.match(key);
      if (!res) { res = json(await board(db, now), 200, { 'cache-control': 'public, max-age=15' }); waitUntil(cache.put(key, res.clone())); }
      const pid = url.searchParams.get('pid'), pub = await res.json();
      if (!pid || pid.length > 40) return json(pub);
      return json({ ...pub, me: { today: await place(db, pub.day, pid), all: await place(db, 'all', pid) } });
    }
    if (request.method !== 'POST') return no('no such thing', 404);
    if (+request.headers.get('content-length') > 2000) return no('too long', 413);
    const b = await request.json().catch(() => null); if (!b || typeof b !== 'object') return no('not understood');
    const ip = request.headers.get('cf-connecting-ip') || '', iph = (await sign(env, 'ip.' + ip)).slice(0, 24), cc = (request.cf && request.cf.country) || '';
    if (path === 'run') {
      if (typeof b.pid !== 'string' || !/^[a-z0-9-]{16,40}$/i.test(b.pid)) return no('who');
      const recent = await db.prepare('SELECT COUNT(*) c FROM runs WHERE iph = ? AND t0 > ?').bind(iph, now - 600000).first();
      if (recent.c >= 15) return no('too many runs begun; wait a little', 429);
      const id = crypto.randomUUID();
      await db.prepare('INSERT INTO runs (id, pid, t0, iph, cc) VALUES (?, ?, ?, ?, ?)').bind(id, b.pid, now, iph, cc).run();
      return json({ run: id, sig: await sign(env, id + '.' + b.pid + '.' + now) });
    }
    const row = await ticket(env, b); if (!row) return no('no such run', 403);
    if (now - row.t0 > 4 * 3600000) return no('this run is over', 410);
    if (path === 'mark') {
      const sec = int(b.sec, 0, SECS - 1), secs = (now - row.t0) / 1000;
      // places come in order, and none sooner than the road to it can be run
      if (sec === row.sec + 1 && secs * 18 >= SEC_END[row.sec] - 30) await db.prepare("UPDATE runs SET sec = ?, marks = marks || ? WHERE id = ? AND sec = ?").bind(sec, sec + ':' + Math.round(secs) + ' ', row.id, row.sec).run();
      return json({});
    }
    if (path === 'score') {
      const r = reckon(row, b, now), name = clean(b.name), title = TITLES.includes(b.title) ? b.title : TITLES[0], day = dayOf(now);
      if (r.score > row.score) {
        const up = 'INSERT INTO best (day, pid, name, cc, title, score, ts) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7) ON CONFLICT (day, pid) DO UPDATE SET score = excluded.score, ts = excluded.ts, name = excluded.name, cc = excluded.cc, title = excluded.title WHERE excluded.score > best.score';
        await db.batch([
          db.prepare('UPDATE runs SET ts = ?, score = ?, lamps = ?, dist = ?, won = ?, falls = ?, done = ?, name = ?, title = ? WHERE id = ?').bind(now, r.score, r.lamps, r.dist, r.won, r.falls, r.done, name, title, row.id),
          db.prepare(up).bind(day, row.pid, name, row.cc || cc, title, r.score, now), db.prepare(up).bind('all', row.pid, name, row.cc || cc, title, r.score, now)]);
      }
      await db.prepare('UPDATE best SET name = ?1 WHERE pid = ?2 AND day IN (?3, ?4) AND name <> ?1').bind(name, row.pid, day, 'all').run();      // a name changed on the end screen is changed on the board
      const fresh = await board(db, now);
      const kept = r.score > row.score ? r : { lamps: row.lamps, dist: row.dist, won: row.won, falls: row.falls, done: row.done, score: row.score };      // what this run stands at on the board
      return json({ ...r, best: kept.score, name, title, cc: row.cc || cc, me: { today: await place(db, day, row.pid), all: await place(db, 'all', row.pid) }, board: fresh });
    }
    return no('no such thing', 404);
  } catch (e) { return no('the scores are resting: ' + String(e && e.message).slice(0, 120), 500); }
}
