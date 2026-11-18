// The scores service. The game never sends a score: it asks for a ticket when a run begins, tells the places it reaches, and at
// the end sends what was gathered; the score is worked out here, each number held to what a run could truly hold.
//   POST /api/run   { pid }                                   -> { run, sig }          a signed ticket for one run
//   POST /api/mark  { run, sig, sec }                         -> { sec }               a place of the route reached (in order); answers the place the run stands at
//   POST /api/score { run, sig, name, title, lamps, dist, won, falls, done } -> { score, lines, card, me, board }
//   GET  /api/board                                           -> { now, day, closes, today, all }   the same for everyone, kept 15 s
//   POST /api/me    { pid }                                   -> { today, all }        one player's places (the pid is his own secret: never in an address)
const ROUTE = 1920, SECS = 9;                         // metres from the gate to the sea; places on the way (0 the gate .. 8 the burning)
const SEC_END = [48, 432, 552, 648, 792, 1128, 1440, 1488, 1920];      // where each place ends
const LAMPS = 440;                                    // the route holds 430 lamps at most
const POINTS = { lamp: 10, metre: 1, fight: 700, fall: 140, burned: 2500 }, FIGHTS = 3, BAND = 250;
const TITLES = ['Hanuman', 'Anjanisuta', 'Vayuputra', 'Mahabala', 'Rameshta', 'Phalgunasakha', 'Pingaksha', 'Amitavikrama', 'Udadhikramana', 'Sitashokavinashana', 'Lakshmanapranadata', 'Dashagrivadarpaha'];
const BAD = ['fuck', 'shit', 'bitch', 'cunt', 'nigger', 'nigga', 'rape', 'porn', 'pussy', 'slut', 'whore', 'madarchod', 'bhenchod', 'bhosdi', 'chutiya', 'randi'];
const json = (o, status = 200, head = {}) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...head } });
const no = (why, status = 400) => json({ error: why }, status);
const int = (v, lo, hi) => Math.max(lo, Math.min(hi, Math.floor(Number(v) || 0)));
const dayOf = ts => new Date(ts + 19800000).toISOString().slice(0, 10);      // the day as India counts it
const band = score => Math.floor(score / BAND);
const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
async function sign(env, text) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(env.SCORE_KEY || ''), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(text)));
}
const same = (a, b) => { if (typeof a !== 'string' || a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; };
const okPid = p => typeof p === 'string' && /^[a-z0-9-]{16,40}$/i.test(p);
function clean(name) {
  let s = String(name || '').normalize('NFKC').replace(/[^\p{L}\p{M}\p{N} ._-]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 12).trim();
  const flat = s.toLowerCase().replace(/[^a-z]/g, '');
  if (!s || BAD.some(w => flat.includes(w))) s = 'Vanara';
  return s;
}
// The score of a run, each number first held to what the run could hold: no more road than the places reached and the time allow,
// no more lamps than that road carries, a fight only in a place that has been reached.
function reckon(row, b, now) {
  const secs = (now - row.t0) / 1000, sec = row.sec;
  const done = !!b.done && sec >= SECS - 1 && secs >= 150;
  const dist = Math.min(int(b.dist, 0, ROUTE), done ? ROUTE : SEC_END[sec] + 24, Math.floor(secs * 18));
  const lamps = Math.min(int(b.lamps, 0, LAMPS), Math.floor(dist * 0.4) + 10);
  // Lankini stands in the first place, the court's guards in the fifth, the grove's captains in the seventh
  const won = Math.min(int(b.won, 0, FIGHTS), sec >= 6 ? 3 : sec >= 4 ? 2 : sec >= 1 || (dist >= 30 && secs >= 20) ? 1 : 0), falls = int(b.falls, 0, 99);
  const lines = { lamps: lamps * POINTS.lamp, dist: dist * POINTS.metre, fights: Math.max(0, won * POINTS.fight - falls * POINTS.fall), burned: done ? POINTS.burned : 0 };
  return { lamps, dist, won, falls, done: done ? 1 : 0, lines, score: lines.lamps + lines.dist + lines.fights + lines.burned };
}
// A player's best on a board is raised, and the bands of the board with it. Never lowered.
async function raise(db, day, pid, name, cc, title, score, ts) {
  const old = await db.prepare('SELECT score FROM best WHERE day = ? AND pid = ?').bind(day, pid).first();
  if (old && old.score >= score) return;
  const todo = [
    db.prepare('INSERT INTO best (day, pid, name, cc, title, score, ts) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7) ON CONFLICT (day, pid) DO UPDATE SET score = excluded.score, ts = excluded.ts, name = excluded.name, cc = excluded.cc, title = excluded.title WHERE excluded.score > best.score').bind(day, pid, name, cc, title, score, ts),
    db.prepare('INSERT INTO hist (day, b, n) VALUES (?1, ?2, 1) ON CONFLICT (day, b) DO UPDATE SET n = n + 1').bind(day, band(score))];
  if (old) todo.push(db.prepare('UPDATE hist SET n = MAX(0, n - 1) WHERE day = ? AND b = ?').bind(day, band(old.score)));
  await db.batch(todo);
}
// One player's place on a board: those in the bands above, and those ahead of him in his own band (an equal score stands behind the one made first).
async function place(db, day, pid) {
  const me = await db.prepare('SELECT score, ts, name, title, cc FROM best WHERE day = ? AND pid = ?').bind(day, pid).first();
  if (!me) return null;
  const b = band(me.score), [above, mates, total, near] = await db.batch([
    db.prepare('SELECT COALESCE(SUM(n), 0) c FROM hist WHERE day = ?1 AND b > ?2').bind(day, b),
    db.prepare('SELECT COUNT(*) c FROM best WHERE day = ?1 AND score >= ?2 AND score < ?3 AND (score > ?4 OR (score = ?4 AND (ts < ?5 OR (ts = ?5 AND pid < ?6))))').bind(day, b * BAND, (b + 1) * BAND, me.score, me.ts, pid),
    db.prepare('SELECT COALESCE(SUM(n), 0) c FROM hist WHERE day = ?').bind(day),
    db.prepare('SELECT pid, name, score, ts FROM best WHERE day = ?1 AND score >= ?2 ORDER BY score ASC, ts DESC LIMIT 6').bind(day, me.score)]);
  const next = near.results.find(r => r.pid !== pid && (r.score > me.score || r.ts < me.ts || (r.ts === me.ts && r.pid < pid)));
  const rank = above.results[0].c + mates.results[0].c + 1;
  return { rank, total: Math.max(total.results[0].c, rank), score: me.score, name: me.name, title: me.title, cc: me.cc, next: next ? { name: next.name, gap: next.score - me.score + 1 } : null };
}
async function board(db, now) {
  const day = dayOf(now), rows = d => db.prepare('SELECT name, cc, title, score FROM best WHERE day = ? ORDER BY score DESC, ts ASC, pid ASC LIMIT 13').bind(d), sum = d => db.prepare('SELECT COALESCE(SUM(n), 0) c FROM hist WHERE day = ?').bind(d);
  const [t, a, n1, n2] = await db.batch([rows(day), rows('all'), sum(day), sum('all')]);
  return { now, day, closes: 86400000 - ((now + 19800000) % 86400000), today: { rows: t.results, total: Math.max(n1.results[0].c, t.results.length) }, all: { rows: a.results, total: Math.max(n2.results[0].c, a.results.length) } };
}
async function ticket(env, b) {      // the row of a run whose ticket is true, or null
  if (!b || typeof b.run !== 'string' || b.run.length > 40) return null;
  const row = await env.DB.prepare('SELECT * FROM runs WHERE id = ?').bind(b.run).first();
  return row && same(b.sig, await sign(env, row.id + '.' + row.pid + '.' + row.t0)) ? row : null;
}
// The story's film, given in pieces: a phone's own player asks for a film a part at a time and will not play one that comes
// only whole, and the site's plain files are given only whole. The file itself is one of the site's own (assets/video/).
async function film(request, env, url, name) {
  if (request.method !== 'GET' && request.method !== 'HEAD') return new Response('', { status: 405 });
  if (!/^prologue-(9x16|16x9)\.mp4$/.test(name)) return new Response('', { status: 404 });
  const res = await env.ASSETS.fetch(new URL('/assets/video/' + name, url)); if (!res.ok) return new Response('', { status: 404 });
  const buf = await res.arrayBuffer(), size = buf.byteLength, head = { 'content-type': 'video/mp4', 'accept-ranges': 'bytes', 'cache-control': 'public, max-age=3600' };
  const m = /^bytes=(\d*)-(\d*)$/.exec(request.headers.get('range') || '');
  if (!m || (m[1] === '' && m[2] === '')) return new Response(request.method === 'HEAD' ? null : buf, { headers: { ...head, 'content-length': String(size) } });
  const start = m[1] === '' ? Math.max(0, size - +m[2]) : +m[1], end = m[1] === '' || m[2] === '' ? size - 1 : Math.min(+m[2], size - 1);      // "the last n", "from a", or "a to b"
  if (start > end || start >= size) return new Response('', { status: 416, headers: { ...head, 'content-range': `bytes */${size}` } });
  return new Response(request.method === 'HEAD' ? null : buf.slice(start, end + 1), { status: 206, headers: { ...head, 'content-range': `bytes ${start}-${end}/${size}`, 'content-length': String(end - start + 1) } });
}
export async function onRequest({ request, env, waitUntil }) {
  const url = new URL(request.url), path = url.pathname.replace(/^\/api\//, ''), now = Date.now(), db = env.DB;
  if (path.startsWith('film/')) return film(request, env, url, path.slice(5));
  if (!db || !env.SCORE_KEY) return no('not set up', 503);
  try {
    if (request.method === 'GET' && path === 'board') {
      const cache = caches.default, key = new Request(url.origin + '/api/board?day=' + dayOf(now));      // a new day reads a new board
      let res = await cache.match(key);
      if (!res) { res = json(await board(db, now), 200, { 'cache-control': 'public, max-age=15' }); waitUntil(cache.put(key, res.clone())); }
      return res;
    }
    if (request.method !== 'POST') return no('no such thing', 404);
    if (+request.headers.get('content-length') > 2000) return no('too long', 413);
    const b = await request.json().catch(() => null); if (!b || typeof b !== 'object') return no('not understood');
    if (path === 'me') { if (!okPid(b.pid)) return no('who'); const day = dayOf(now); return json({ today: await place(db, day, b.pid), all: await place(db, 'all', b.pid) }); }
    const ip = request.headers.get('cf-connecting-ip') || '', iph = (await sign(env, 'ip.' + ip)).slice(0, 24), cc = (request.cf && request.cf.country) || '';
    if (path === 'run') {
      if (!okPid(b.pid)) return no('who');
      const [recent, players, known] = await db.batch([
        db.prepare('SELECT COUNT(*) c FROM runs WHERE iph = ? AND t0 > ?').bind(iph, now - 600000),
        db.prepare('SELECT COUNT(DISTINCT pid) c FROM runs WHERE iph = ? AND t0 > ?').bind(iph, now - 86400000),
        db.prepare('SELECT COUNT(*) c FROM runs WHERE iph = ? AND t0 > ? AND pid = ?').bind(iph, now - 86400000, b.pid)]);
      if (recent.results[0].c >= 15) return no('too many runs begun; wait a little', 429);
      if (players.results[0].c >= 40 && !known.results[0].c) return no('too many players from one place today', 429);
      const id = crypto.randomUUID();
      await db.prepare('INSERT INTO runs (id, pid, t0, iph, cc) VALUES (?, ?, ?, ?, ?)').bind(id, b.pid, now, iph, cc).run();
      return json({ run: id, sig: await sign(env, id + '.' + b.pid + '.' + now) });
    }
    const row = await ticket(env, b); if (!row) return no('no such run', 403);
    if (now - row.t0 > 4 * 3600000) return no('this run is over', 410);
    if (path === 'mark') {
      const sec = int(b.sec, 0, SECS - 1), secs = (now - row.t0) / 1000; let at = row.sec;
      // places come in order, and none sooner than the road to it can be run
      if (sec === row.sec + 1 && secs * 18 >= SEC_END[row.sec] - 30) { const u = await db.prepare("UPDATE runs SET sec = ?, marks = marks || ? WHERE id = ? AND sec = ?").bind(sec, sec + ':' + Math.round(secs) + ' ', row.id, row.sec).run(); if (u.meta.changes) at = sec; }
      return json({ sec: Math.max(at, row.sec) });
    }
    if (path === 'score') {
      const r = reckon(row, b, now), name = clean(b.name), title = TITLES.includes(b.title) ? b.title : TITLES[0], day = dayOf(now), land = row.cc || cc;
      if (!row.done && r.score > row.score) {      // a run told to its end stands as it ended; before that it only rises
        const u = await db.prepare('UPDATE runs SET ts = ?, score = ?, lamps = ?, dist = ?, won = ?, falls = ?, done = ?, name = ?, title = ? WHERE id = ? AND score < ? AND COALESCE(done, 0) = 0')
          .bind(now, r.score, r.lamps, r.dist, r.won, r.falls, r.done, name, title, row.id, r.score).run();
        if (u.meta.changes) {
          await raise(db, day, row.pid, name, land, title, r.score, now); await raise(db, 'all', row.pid, name, land, title, r.score, now);
          if (r.done) await db.prepare('INSERT OR IGNORE INTO cards (run) VALUES (?)').bind(row.id).run();
        }
      }
      await db.prepare('UPDATE best SET name = ?1 WHERE pid = ?2 AND day IN (?3, ?4) AND name <> ?1').bind(name, row.pid, day, 'all').run();      // a name changed on the end screen is changed on the board
      const [cur, num] = await db.batch([db.prepare('SELECT score, done FROM runs WHERE id = ?').bind(row.id), db.prepare('SELECT n FROM cards WHERE run = ?').bind(row.id)]);
      return json({ ...r, best: cur.results[0].score, card: num.results[0] ? num.results[0].n : 0, name, title, cc: land, me: { today: await place(db, day, row.pid), all: await place(db, 'all', row.pid) }, board: await board(db, now) });
    }
    return no('no such thing', 404);
  } catch (e) { return no('the scores are resting: ' + String(e && e.message).slice(0, 120), 500); }
}
