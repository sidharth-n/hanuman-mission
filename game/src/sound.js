// Sound: the run's own track (an opening chant, then the song on a loop), the chant again over the big moments, short
// effects for what he does and meets, and one switch for all of it.
// The track is a plain audio element set going by the tap that starts the run, so a phone always allows it, and it sounds
// even with the phone's ringer switched to silent. Effects go through the Web Audio engine, which that same tap wakes.
const TRACKS = import.meta.env.DEV ? '/local-audio/' : 'assets/audio/';      // run.mp3 (chant, then song) and chant.mp3
const EFFECTS = 'assets/sfx/';
const VOICES = 'assets/audio/voice/';      // one file a spoken line, named <scene>-<n>.mp3, listed in index.json
const SCORE = 'assets/audio/score/';       // the music of the scenes and fights, listed in index.json: { name: { loop, under, open, gain } }
const PAD = 0.5;      // a looping cue carries this much of its own end before its start and of its start after its end, so the loop closes exactly whatever the decoder adds
const db = v => Math.pow(10, v / 20);
const INTRO = 5.6;      // seconds of chant at the head of run.mp3: the loop comes back to here, not to the chant
// how loud each effect sits against the track
const LEVEL = { chant: 1, leap: 0.5, slide: 0.6, lamp: 0.24, wind: 0.6, bell: 0.9, hit: 0.9, splash: 0.9, wing: 0.7, power: 0.75, smash: 0.8, fire: 0.8, tap: 0.4,
  fireball: 0.55, spikes: 0.55, beam: 0.9, stone: 0.8, bridge: 0.8, blaze: 0.4,
  step1: 1, step2: 1, step3: 1, step4: 1, breath1: 0.42, breath2: 0.42, breath3: 0.42 };      // his feet and his breath on the way in: small sounds

export function createSound(store) {
  let on = store.get('sound', 'on') === 'on', trackError = '', noSong = false, woke = false;      // noSong: the song of the run is not in this build (it is on the maker's own machine only)
  const AC = window.AudioContext || window.webkitAudioContext;
  const ctx = AC ? new AC() : null, out = ctx ? ctx.createGain() : null, buffers = {}, last = {};
  let voice = null;      // the chant while it sounds
  let resting = false, fading = null;      // the song is for the run only: in a scene or a fight it has faded away and waits
  let burn = null;       // the city burning, on a loop
  // The scenes are small films: a voice on every line, music under it that steps back while someone speaks and comes
  // up in the breaths, and short hits on the beats. All of it goes through the engine, so a phone can fade it.
  let lines = null, cues = null;                       // what there is to play (index.json of each folder), or null
  const said = {}, played = {};                        // decoded: a line or a cue by name (a promise while it loads)
  let speaking = null, token = 0, now = null, wanted = null, held = false;      // the line sounding; the cue sounding { name, src, gain }; the cue asked for; the game is paused

  let level = null;      // the song's own fader in the engine (null: the element's volume is used instead)
  const loud = (v, secs = 0) => {
    if (!level) { track.volume = v; return; }
    const t = ctx.currentTime; level.gain.cancelScheduledValues(t); level.gain.setValueAtTime(level.gain.value, t); level.gain.linearRampToValueAtTime(v, t + Math.max(0.03, secs));
  };
  const ours = () => (cues && cues.journey ? 'journey' : 'run');      // the run's music in a build without the song: a song of our own if there is one, or the drums of the way in
  const track = new Audio();
  track.preload = 'auto'; track.muted = !on;
  track.addEventListener('error', () => { trackError = 'e' + (track.error ? track.error.code : '?'); noSong = true; });
  track.addEventListener('ended', () => { track.currentTime = INTRO; track.play().catch(() => {}); });      // round again, without the opening chant
  track.src = TRACKS + 'run.mp3';
  // is the song in this build at all? A host that answers a missing file with its front page raises no error on a phone, so the answer itself is looked at
  fetch(TRACKS + 'run.mp3', { method: 'HEAD' }).then(r => { if (!r.ok || !/audio|octet-stream/.test(r.headers.get('content-type') || '')) noSong = true; }).catch(() => { noSong = true; });

  const music = ctx ? ctx.createGain() : null, under = ctx ? ctx.createGain() : null, speech = ctx ? ctx.createGain() : null;
  // a file fetched and decoded, or null: a missing file must not raise an error of its own
  const decode = url => fetch(url).then(r => (r.ok ? r.arrayBuffer() : Promise.reject())).then(b => new Promise((ok, no) => { const p = ctx.decodeAudioData(b, ok, no); if (p && p.catch) p.catch(() => {}); })).catch(() => null);
  const cue = name => { if (!(name in played)) played[name] = decode(((cues && cues[name] && cues[name].dir) || SCORE) + name + '.mp3').then(b => (played[name] = b)); return Promise.resolve(played[name]); };
  if (ctx) {
    // everything meets in one soft ceiling, so a voice over music over a blow never clips
    const top = ctx.createDynamicsCompressor(); top.threshold.value = -5; top.knee.value = 5; top.ratio.value = 12; top.attack.value = 0.003; top.release.value = 0.2;
    out.gain.value = on ? 1 : 0; out.connect(top); top.connect(ctx.destination);
    music.connect(under); under.connect(out); speech.connect(out);
    // the song too goes through the engine where it can: an iPhone will not change an audio element's loudness by script, and a song must never stop short, it fades
    try { level = ctx.createGain(); ctx.createMediaElementSource(track).connect(level); level.connect(out); } catch { level = null; }
    const list = dir => fetch(dir + 'index.json').then(r => (r.ok ? r.json() : null)).catch(() => null).then(j => { if (dir === SCORE) cues = j && j.cues ? j.cues : null; return j; });
    list(VOICES).then(j => { lines = j && j.lines ? j.lines : null; });
    list(SCORE).then(() => { if (cues) for (const k of Object.keys(cues)) if (cues[k].loop === false) cue(k); })      // the short hits are ready before they are wanted
      // music that is on this machine only (it lies beside the song of the run and is in no public build): listed in local.json, it is used where a scene asks for it
      .then(() => fetch(TRACKS + 'local.json')).then(r => (r.ok ? r.json() : null)).then(j => { if (j && j.cues) { cues = cues || {}; for (const k of Object.keys(j.cues)) cues[k] = { ...j.cues[k], dir: TRACKS }; } }).catch(() => {});
    const get = (name, url) => decode(url).then(buf => { if (buf) buffers[name] = buf; });
    get('chant', TRACKS + 'chant.mp3').then(() => { if (!buffers.chant) get('chant', EFFECTS + 'chant.mp3'); });      // the cry of Rama's name: the maker's own where it is, a recording of our own in every published build
    for (const name of Object.keys(LEVEL)) if (name !== 'chant') get(name, EFFECTS + name + '.mp3');
  }

  // every touch or key keeps the engine awake (a phone puts it to sleep after a call or a spell in the background)
  function wake() {
    if (!ctx) return;
    if (held) return;      // paused: nothing sounds until the game goes on
    if (ctx.state !== 'running') ctx.resume();
    if (!woke) { try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch { /* not there */ }      // an iPhone with its ringer switched to silent still plays the voices and the music
      woke = true; const s = ctx.createBufferSource(); s.buffer = ctx.createBuffer(1, 1, 22050); s.connect(ctx.destination); s.start(); }
  }
  for (const e of ['pointerup', 'touchend', 'click', 'keydown']) window.addEventListener(e, wake, true);

  // never keep sounding behind another app (the game itself pauses the run, and with it the track)
  document.addEventListener('visibilitychange', () => { if (document.hidden) { track.pause(); if (ctx) ctx.suspend(); } else if (ctx && !held) ctx.resume(); });

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
  // ── the films between the play ──
  // The music steps back under a line and comes up again in the breath after it. How far is the cue's own: `under`
  // (LU below the voice while someone speaks) and `open` (LU below it in the breaths), both measured on the files.
  function duck(down) {
    if (!ctx) return;
    const c = (now && cues && cues[now.name]) || {}, t = ctx.currentTime;
    under.gain.cancelScheduledValues(t);
    if (down) under.gain.setTargetAtTime(db(-((c.under ?? 14) - (c.open ?? 4))), t, 0.09);
    else under.gain.setTargetAtTime(1, t + 0.35, 0.32);
  }
  // The lines of a scene are decoded as it begins; those of the scene before are let go.
  function learn(ids) {
    if (!ctx || !lines) return;
    for (const id of Object.keys(said)) if (!ids.includes(id)) delete said[id];
    for (const id of ids) if (id in lines && !(id in said)) said[id] = decode(VOICES + id + '.mp3').then(b => (said[id] = b));
  }
  function quiet() { token++; if (speaking) { speaking.onended = null; try { speaking.stop(); } catch { /* already over */ } speaking = null; duck(false); } }
  // A line is spoken. Returns how long it lasts in seconds (0: there is no voice for it, or the sound is off).
  function speak(id, lead = 0) {
    quiet();
    if (!on || !ctx || !lines || !(id in lines)) return 0;
    if (!(id in said)) said[id] = decode(VOICES + id + '.mp3').then(b => (said[id] = b));
    const mine = token;
    Promise.resolve(said[id]).then(buf => {
      if (!buf || mine !== token) return;      // the scene has gone on
      if (ctx.state !== 'running' && !held) ctx.resume();
      const src = ctx.createBufferSource(); src.buffer = buf; src.connect(speech); src.start(ctx.currentTime + lead); speaking = src; duck(true);      // lead: a moment for a great sound to pass before the words
      src.onended = () => { if (speaking === src) { speaking = null; duck(false); } };
    });
    return lines[id] + lead;
  }
  // The music of a scene or a fight: the cue named is brought in and whatever sounded before is taken out; no name, silence.
  function score(name, { fade = 1.6, rise = 0.9 } = {}) {
    wanted = name || null;
    if (!ctx || (now && now.name === wanted)) return;
    if (now) { const old = now, t = ctx.currentTime; now = null; old.gain.gain.cancelScheduledValues(t); old.gain.gain.setValueAtTime(old.gain.gain.value, t); old.gain.gain.linearRampToValueAtTime(0, t + fade); try { old.src.stop(t + fade + 0.05); } catch { /* already over */ } }
    if (!wanted || !cues || !cues[wanted]) return;
    const want = wanted;
    cue(want).then(buf => {
      if (!buf || wanted !== want || (now && now.name === want)) return;
      const c = cues[want], loop = c.loop !== false; if (!loop) { const mine = want; setTimeout(() => { if (now && now.name === mine) { now = null; if (wanted === mine) wanted = null; } }, buf.duration * 1000); }      // a cue played once is over when it ends
      const src = ctx.createBufferSource(), g = ctx.createGain(), t = ctx.currentTime;
      src.buffer = buf; if (loop) { src.loop = true; src.loopStart = PAD; src.loopEnd = buf.duration - PAD; }
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(db(c.gain || 0), t + rise);
      src.connect(g); g.connect(music); src.start(t, loop ? PAD : 0); now = { name: want, src, gain: g };
      if (!speaking) duck(false);
      for (const k of Object.keys(played)) if (k !== want && cues[k] && cues[k].loop !== false) delete played[k];      // only the cue that sounds is kept decoded
    });
  }
  // A short hit on a beat: over the music, never stepped back.
  function hit(name, { delay = 0 } = {}) {
    if (!on || !ctx || !cues || !cues[name]) return;
    cue(name).then(buf => { if (!buf) return; const src = ctx.createBufferSource(), g = ctx.createGain(); src.buffer = buf; g.gain.value = db(cues[name].gain || 0); src.connect(g); g.connect(out); src.start(ctx.currentTime + delay); });
  }

  function hush() { if (voice) { voice.onended = null; try { voice.stop(); } catch { /* already over */ } voice = null; loud(1, 0.3); } }

  return {
    get on() { return on; },
    // for checking on a phone: what the track and the engine are doing
    get info() {
      return { on, track: trackError || (track.paused ? 'paused' : 'playing'), at: +track.currentTime.toFixed(1), ready: track.readyState, muted: track.muted,
        engine: ctx ? ctx.state : 'none', effects: Object.keys(buffers).length, chanting: !!voice, burning: !!burn,
        voices: lines ? Object.keys(lines).length : 0, speaking: !!speaking, cue: now ? now.name : wanted ? wanted + '?' : '', cues: cues ? Object.keys(cues).length : 0 };
    },
    toggle() { on = !on; store.set('sound', on ? 'on' : 'off'); track.muted = !on; if (out) out.gain.value = on ? 1 : 0; if (!on) { hush(); quiet(); } return on; },
    learn, speak, quiet, score, hit, has: name => !!(cues && cues[name]),
    warm: name => { if (ctx && cues && cues[name]) cue(name); },      // a cue fetched and decoded ahead of the scene whose first frame it must sound on

    // a run begins: the chant, then the song (one track, begun by the player's own tap)
    blaze,
    // wait: the song is held back (the run from the sea gate to Lankini is without it): the player's tap only makes it ready, and it begins when he runs on after her
    start(wait = false) {
      held = false; wake(); hush(); quiet(); score(null, { fade: 0.3 }); blaze(false); resting = wait; clearInterval(fading); fading = null;
      track.muted = wait || !on; loud(wait ? 0 : 1); try { track.currentTime = 0; } catch { /* not loaded yet */ }
      if (noSong && !wait) score(ours(), { rise: 1.2 });      // without the song the run still has music
      const p = track.play();
      if (p) p.then(() => { if (resting && wait) { track.pause(); try { track.currentTime = 0; } catch { /* not loaded yet */ } } }).catch(e => { trackError = trackError || e.name; });
    },
    pause() { track.pause(); hush(); blaze(false); held = true; if (ctx) ctx.suspend(); },                              // the game is paused: the track held where it is, the chant cut
    resume() { held = false; wake(); if (!resting) track.play().catch(() => {}); },             // and taken up again from there (unless a scene or a fight has it at rest)
    // the run stops for a scene or a fight: the song fades away over a second and a half and waits (a phone that fixes the volume simply stops it then)
    rest() {
      if (resting) return; resting = true; hush(); clearInterval(fading);
      if (level) { loud(0, 1.5); fading = setTimeout(() => { fading = null; track.pause(); }, 1560); return; }
      const from = track.volume, t0 = performance.now();
      fading = setInterval(() => { const u = Math.min(1, (performance.now() - t0) / 1500); track.volume = from * (1 - u) * (1 - u); if (u >= 1) { clearInterval(fading); fading = null; track.pause(); track.volume = 1; } }, 40);
    },
    // and he runs again: the song is simply there, from where it left off
    run() { if (noSong) { quiet(); resting = false; score(ours(), { rise: 0.6 }); return; } score(null); quiet(); if (!resting) return; resting = false; clearInterval(fading); fading = null; track.muted = !on; track.volume = 1; loud(1, 0.4); wake(); track.play().catch(() => {}); },
    stop() { held = false; if (ctx && ctx.state === 'suspended') ctx.resume(); blaze(false); quiet(); score(null, { fade: 1.5 }); clearInterval(fading); fading = null; if (level && !track.paused) { loud(0, 1.2); fading = setTimeout(() => { fading = null; track.pause(); }, 1260); } else track.pause(); },                                       // the run is over
    // the chant over a big moment: once per moment, and not on top of the opening chant
    chant() {
      if (!noSong && !track.paused && track.currentTime < INTRO) return;      // (a build without the song has no opening chant to wait for)
      const now = performance.now();
      if (voice || now - (last.chant || 0) < 22000) return;      // said once at a great moment, never again and again (Sid: "just say Ram once, not in loop")
      hush();
      const src = fire('chant'); if (!src) return;
      voice = src; last.chant = now; loud(0.45, 0.25);      // the song steps back under it (phones that fix the volume keep it level)
      src.onended = () => { if (voice === src) { voice = null; if (!resting) loud(1, 0.5); } };
    },
    // a short effect; gap: the least time in seconds before the same one may sound again
    fx(name, { rate = 1, delay = 0, gap = 0.05 } = {}) {
      const now = performance.now();
      if (now - (last[name] || 0) < gap * 1000) return;
      last[name] = now; fire(name, rate, delay);
    },
  };
}
