// The game's side of the leaderboard. A run begun at the gate asks the scores service for a ticket; each place of the route
// reached is told to it; at every end the gathered numbers are sent and the service answers with the score it reckons, the
// player's place and the board. The numbers shown at once are reckoned here by the same rule; the service's answer replaces them.
export const POINTS = { lamp: 10, metre: 1, fight: 700, fall: 140, burned: 2500 };
export const reckon = s => {
  const lines = { lamps: s.lamps * POINTS.lamp, dist: s.dist * POINTS.metre, fights: Math.max(0, s.won * POINTS.fight - s.falls * POINTS.fall), burned: s.done ? POINTS.burned : 0 };
  return { ...s, lines, score: lines.lamps + lines.dist + lines.fights + lines.burned };
};
export const flag = cc => /^[A-Z]{2}$/.test(cc || '') ? String.fromCodePoint(...[...cc].map(c => 0x1f1a5 + c.charCodeAt(0))) : '';
export function createScores(store) {
  let pid = store.get('pid', '');
  if (!/^[a-z0-9-]{16,40}$/i.test(pid)) { pid = (crypto.randomUUID ? crypto.randomUUID() : 'p-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 12) + Math.random().toString(36).slice(2, 12)); store.set('pid', pid); }
  let run = null, busy = null;
  const post = (path, body) => fetch('/api/' + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), keepalive: true })
    .then(r => r.ok ? r.json() : Promise.reject(new Error('scores ' + r.status)));
  // the places reached are told one after another, in order; one that did not get through is told again before the next
  const flush = () => busy = (busy || Promise.resolve()).then(async () => {
    const mine = run; if (!mine || !mine.sig) return;
    // the service answers the place the run stands at: only that is counted as told (a place it would not yet take is told again later)
    while (run === mine && mine.sent < mine.sec) { const a = await post('mark', { run: mine.run, sig: mine.sig, sec: mine.sent + 1 }); if (!(a.sec > mine.sent)) break; mine.sent = a.sec; }
  }).catch(() => {});
  return {
    pid,
    get live() { return !!(run && run.sig); },
    begin() { const mine = run = { sec: 0, sent: 0 }; post('run', { pid }).then(t => { if (run === mine) { mine.run = t.run; mine.sig = t.sig; flush(); } }).catch(() => {}); },
    mark(sec) { if (run && sec > run.sec) { run.sec = sec; flush(); } },
    async submit(stats) { const mine = run; if (!mine || !mine.sig) throw new Error('no ticket'); await flush(); return post('score', { run: mine.run, sig: mine.sig, ...stats }); },
    // the board is the same for everyone; his own places are asked for apart (his id is his own: never in an address)
    board() { return Promise.all([fetch('/api/board').then(r => r.ok ? r.json() : Promise.reject(new Error('scores ' + r.status))), post('me', { pid }).catch(() => null)]).then(([b, me]) => ({ ...b, me })); },
  };
}
// A seal drawn from a seed (a name and a score): two rings of petals, no two alike. Returns the SVG as text.
export function seal(seed, c) {
  let h = 2166136261; for (const ch of String(seed)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  const r = () => ((h = Math.imul(h ^ (h >>> 15), 2246822507) ^ Math.imul(h ^ (h >>> 13), 3266489909), (h ^= h >>> 16) >>> 0) / 4294967296), p = (rr, aa) => `${(Math.cos(aa) * rr).toFixed(1)} ${(Math.sin(aa) * rr).toFixed(1)}`;
  let out = `<circle r="97" fill="rgba(10,8,6,.72)"/><circle r="96" fill="none" stroke="${c}" stroke-width="2.4"/><circle r="88" fill="none" stroke="${c}" stroke-width=".8" stroke-dasharray="1 3"/><circle r="46" fill="none" stroke="${c}" stroke-width="1.4"/>`;
  for (let k = 0; k < 2; k++) {
    const n = [8, 10, 12][Math.floor(r() * 3)], r0 = 46 + k * 20, r1 = r0 + 26, wd = (Math.PI / n) * (0.6 + r() * 0.35), rot = r() * Math.PI;
    for (let i = 0; i < n; i++) { const a = rot + i * 2 * Math.PI / n; out += `<path d="M${p(r0, a - wd)} Q${p((r0 + r1) / 2, a - wd * 1.1)} ${p(r1, a)} Q${p((r0 + r1) / 2, a + wd * 1.1)} ${p(r0, a + wd)}" fill="none" stroke="${c}" stroke-width="1.3" opacity="${k ? 0.7 : 1}"/>`; }
  }
  return `<svg viewBox="-100 -100 200 200" aria-hidden="true">${out}</svg>`;
}
export const NAMES = [      // the twelve names of Hanuman (Dwadasha Nama), each with its meaning
  ['Hanuman', 'Of the mighty jaw'], ['Anjanisuta', 'Son of Anjana'], ['Vayuputra', 'Son of the wind'], ['Mahabala', 'Of great strength'], ['Rameshta', 'Dear to Rama'],
  ['Phalgunasakha', 'Friend of Arjuna'], ['Pingaksha', 'The tawny-eyed'], ['Amitavikrama', 'Of boundless valour'], ['Udadhikramana', 'Who leapt the ocean'],
  ['Sitashokavinashana', "Who ended Sita's sorrow"], ['Lakshmanapranadata', 'Who gave Lakshmana his life again'], ['Dashagrivadarpaha', "Who broke the ten-headed one's pride"]];
// What a player is told about earning each name (the screen of the twelve names). Every run told to its end earns one name he
// does not hold yet, the rarest that run deserved (the order of `earned` below).
export const HOW = { Hanuman: 'Burn Lanka', Anjanisuta: 'Burn Lanka once more', Vayuputra: 'Burn Lanka without falling', Mahabala: 'Win three fights in one run', Rameshta: 'Gather 300 lamps in one run',
  Phalgunasakha: 'Share a card, then burn Lanka again', Pingaksha: 'Burn Lanka a second time', Amitavikrama: 'Score 9,000 or more', Udadhikramana: 'Cross the sea and burn Lanka',
  Sitashokavinashana: "Bring Rama's ring to Sita and burn Lanka", Lakshmanapranadata: 'Fall, rise, and still burn Lanka', Dashagrivadarpaha: 'Burn Lanka without a single fall, every fight won' };
// Which names a run has earned, the rarest first: s the run's numbers (lamps, won, falls, done, sec, score), h what is kept of earlier runs.
export const earned = (s, h) => [
  ['Dashagrivadarpaha', s.done && s.falls === 0 && s.won >= 3], ['Amitavikrama', s.score >= 9000], ['Mahabala', s.won >= 3], ['Lakshmanapranadata', s.done && s.falls > 0],
  ['Pingaksha', s.done && h.finishes >= 2], ['Phalgunasakha', h.shared > 0], ['Rameshta', s.lamps >= 300], ['Udadhikramana', s.done], ['Sitashokavinashana', s.done || s.sec >= 7],
  ['Vayuputra', s.sec >= 2 && s.falls === 0], ['Anjanisuta', s.sec >= 1], ['Hanuman', true]].filter(x => x[1]).map(x => x[0]);
