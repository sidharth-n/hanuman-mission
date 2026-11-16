// Sound: the run's own track (an opening chant, then the song on a loop), the chant again over the big moments, short
// effects for what he does and meets, and one switch for all of it.
// The track is a plain audio element set going by the tap that starts the run, so a phone always allows it, and it sounds
// even with the phone's ringer switched to silent. Effects go through the Web Audio engine, which that same tap wakes.
const TRACKS = import.meta.env.DEV ? '/local-audio/' : 'assets/audio/';      // run.mp3 (chant, then song) and chant.mp3
const EFFECTS = 'assets/sfx/';
const INTRO = 5.6;      // seconds of chant at the head of run.mp3: the loop comes back to here, not to the chant
// how loud each effect sits against the track
const LEVEL = { chant: 1, leap: 0.5, slide: 0.6, lamp: 0.24, wind: 0.6, bell: 0.9, hit: 0.9, splash: 0.9, wing: 0.7, power: 0.75, smash: 0.8, fire: 0.8, tap: 0.4,
  fireball: 0.55, spikes: 0.55, beam: 0.9, stone: 0.8, bridge: 0.8, blaze: 0.4 };

export function createSound(store) {
  let on = store.get('sound', 'on') === 'on', trackError = '', woke = false;
  const AC = window.AudioContext || window.webkitAudioContext;
  const ctx = AC ? new AC() : null, out = ctx ? ctx.createGain() : null, buffers = {}, last = {};
  let voice = null;      // the chant while it sounds
  let burn = null;       // the city burning, on a loop

  const track = new Audio();
  track.preload = 'auto'; track.muted = !on;
  track.addEventListener('error', () => { trackError = 'e' + (track.error ? track.error.code : '?'); });
  track.addEventListener('ended', () => { track.currentTime = INTRO; track.play().catch(() => {}); });      // round again, without the opening chant
  track.src = TRACKS + 'run.mp3';

  if (ctx) {
    out.gain.value = on ? 1 : 0; out.connect(ctx.destination);
    const get = (name, url) => fetch(url).then(r => (r.ok ? r.arrayBuffer() : Promise.reject())).then(b => new Promise((ok, no) => ctx.decodeAudioData(b, ok, no)))
      .then(buf => { buffers[name] = buf; }).catch(() => {});
    get('chant', TRACKS + 'chant.mp3');
    for (const name of Object.keys(LEVEL)) if (name !== 'chant') get(name, EFFECTS + name + '.mp3');
  }

  // every touch or key keeps the engine awake (a phone puts it to sleep after a call or a spell in the background)
  function wake() {
    if (!ctx) return;
    if (ctx.state !== 'running') ctx.resume();
    if (!woke) { woke = true; const s = ctx.createBufferSource(); s.buffer = ctx.createBuffer(1, 1, 22050); s.connect(ctx.destination); s.start(); }
  }
  for (const e of ['pointerup', 'touchend', 'click', 'keydown']) window.addEventListener(e, wake, true);

  // never keep sounding behind another app (the game itself pauses the run, and with it the track)
  document.addEventListener('visibilitychange', () => { if (document.hidden) { track.pause(); if (ctx) ctx.suspend(); } else if (ctx) ctx.resume(); });

  function fire(name, rate = 1, delay = 0) {
    const buf = buffers[name];
    if (!on || !ctx || !buf) return null;
    if (ctx.state !== 'running') { ctx.resume(); return null; }
    const src = ctx.createBufferSource(), g = ctx.createGain();
    src.buffer = buf; src.playbackRate.value = rate; g.gain.value = LEVEL[name]; src.connect(g); g.connect(out); src.start(ctx.currentTime + delay);
    return src;
  }
  // the city burning: a fire that keeps on under everything until the run is paused or over
  function blaze(want) {
    if (!want) { if (burn) { try { burn.stop(); } catch { /* already over */ } burn = null; } return; }
    if (burn || !ctx || !buffers.blaze) return;
    if (ctx.state !== 'running') ctx.resume();
    const g = ctx.createGain(); g.gain.setValueAtTime(0, ctx.currentTime); g.gain.linearRampToValueAtTime(LEVEL.blaze, ctx.currentTime + 1.5);
    burn = ctx.createBufferSource(); burn.buffer = buffers.blaze; burn.loop = true; burn.loopStart = 0.1; burn.loopEnd = buffers.blaze.duration - 0.1;
    burn.connect(g); g.connect(out); burn.start();
  }
  function hush() { if (voice) { voice.onended = null; try { voice.stop(); } catch { /* already over */ } voice = null; track.volume = 1; } }

  return {
    get on() { return on; },
    // for checking on a phone: what the track and the engine are doing
    get info() {
      return { on, track: trackError || (track.paused ? 'paused' : 'playing'), at: +track.currentTime.toFixed(1), ready: track.readyState, muted: track.muted,
        engine: ctx ? ctx.state : 'none', effects: Object.keys(buffers).length, chanting: !!voice, burning: !!burn };
    },
    toggle() { on = !on; store.set('sound', on ? 'on' : 'off'); track.muted = !on; if (out) out.gain.value = on ? 1 : 0; if (!on) hush(); return on; },
    // a run begins: the chant, then the song (one track, begun by the player's own tap)
    blaze,
    start() { wake(); hush(); blaze(false); track.muted = !on; track.volume = 1; try { track.currentTime = 0; } catch { /* not loaded yet */ } track.play().catch(e => { trackError = trackError || e.name; }); },
    pause() { track.pause(); hush(); blaze(false); },                              // the game is paused: the track held where it is, the chant cut
    resume() { wake(); track.play().catch(() => {}); },             // and taken up again from there
    stop() { track.pause(); blaze(false); },                                       // the run is over
    // the chant over a big moment: once per moment, and not on top of the opening chant
    chant() {
      if (!track.paused && track.currentTime < INTRO) return;
      const now = performance.now();
      if (voice && now - (last.chant || 0) < 1500) return;
      hush();
      const src = fire('chant'); if (!src) return;
      voice = src; last.chant = now; track.volume = 0.45;      // the song steps back under it (phones that fix the volume keep it level)
      src.onended = () => { if (voice === src) { voice = null; track.volume = 1; } };
    },
    // a short effect; gap: the least time in seconds before the same one may sound again
    fx(name, { rate = 1, delay = 0, gap = 0.05 } = {}) {
      const now = performance.now();
      if (now - (last[name] || 0) < gap * 1000) return;
      last[name] = now; fire(name, rate, delay);
    },
  };
}
